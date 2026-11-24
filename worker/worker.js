// LLM 오픈랩 · OpenAI 중계 + 랭킹 서버 (Cloudflare Worker)
// 체험 노트북 → 이 Worker → OpenAI. OpenAI 키는 Worker 비밀값(OPENAI_API_KEY)에만 있다.
//
// 설정값 (wrangler.toml [vars])
//  - LOW_MODEL / TOP_MODEL: 하위 모델 / 최상위 모델
//  - JUDGE_MODEL:           AI 심판 (확률(logprobs)을 주고 빨라야 함)
//  - ALLOWED_ORIGINS:       요청을 받을 사이트 주소, 쉼표로 구분
// 비밀값: OPENAI_API_KEY, ADMIN_PASSWORD
//
// 요청 종류
//  - { tier: 'low'|'top', messages }   → 채팅 (스트리밍)
//  - { judge: { goal, messages, facts } } → 판정 { success: 0~1 }
//  - { score: { player, nickname, setNo, missionId, low: {stars, q}, top: {stars, q} } } → 기록 등록 후 랭킹
//  - { board: { player } }              → 랭킹 + 지금 설정 (대기 화면이 몇 초마다 받아 간다)
//  - { admin: { password, action, ... } } → 관리자 (켜기/끄기, 설정, 기록 숨기기·지우기, 초기화)

import { judgeRequest, parseJudge, checkJudgeInput } from '../js/judge.js';
import { MAX_QUESTIONS, MAX_QUESTION_CHARS, MAX_STARS, starsFor, checkNickname, normalizeSettings } from '../js/rules.js';
import { missionById } from '../js/missions.js';
import { ranking, boardView, adminStats } from '../js/ranking.js';

// 답을 짧게 받아서 화면에서 읽기 쉽고 비용도 줄인다 (두 모델에 똑같이 적용)
const SYSTEM = '한국어로 답하세요. 답은 5문장 이내로 짧게 하세요.';

const LIMITS = {
  answerChars: 4000,
  lowTokens: 600,
  topTokens: 2000, // 추론 모델은 생각하는 토큰도 여기에 포함
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const cors = allowed.includes(origin)
      ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' }
      : {};

    if (request.method === 'OPTIONS') return new Response(null, { status: allowed.includes(origin) ? 204 : 403, headers: cors });
    if (request.method !== 'POST') return json({ error: 'POST만 받아요.' }, 405, cors);
    if (!allowed.includes(origin)) return json({ error: '허용되지 않은 사이트에서 온 요청이에요.' }, 403, cors);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: '요청 형식이 올바르지 않아요.' }, 400, cors);
    }

    if (body?.board) return json(await board(env, body.board.player), 200, cors);
    if (body?.admin) { const r = await handleAdmin(body.admin, env); return json(r.body, r.status, cors); }
    if (body?.score) { const r = await handleScore(body.score, env); return json(r.body, r.status, cors); }

    if (!(await isEnabled(env))) return json({ error: '지금은 체험을 잠시 쉬고 있어요. 동아리원에게 물어봐 주세요.' }, 503, cors);
    if (!env.OPENAI_API_KEY) return json({ error: '서버에 OpenAI 키가 설정되지 않았어요.' }, 500, cors);
    if (body?.judge) return handleJudge(body.judge, env, cors);
    return handleChat(body, env, cors);
  },
};

async function handleChat(body, env, cors) {
  const tier = body?.tier === 'top' ? 'top' : 'low';
  const model = tier === 'top' ? env.TOP_MODEL || 'gpt-6-astra' : env.LOW_MODEL || 'gpt-4o-mini';
  const messages = Array.isArray(body?.messages) ? body.messages : null;
  if (!messages?.length || messages.length > MAX_QUESTIONS * 2 - 1) return json({ error: '메시지 수가 올바르지 않아요.' }, 400, cors);
  for (const m of messages) {
    if (!m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string') return json({ error: '메시지 형식이 올바르지 않아요.' }, 400, cors);
    if (m.content.length > (m.role === 'user' ? MAX_QUESTION_CHARS : LIMITS.answerChars)) return json({ error: '메시지가 너무 길어요.' }, 413, cors);
  }
  if (messages.filter((m) => m.role === 'user').length > MAX_QUESTIONS) return json({ error: `질문은 ${MAX_QUESTIONS}개까지예요.` }, 400, cors);

  const upstream = await openai(env, {
    model,
    messages: [{ role: 'system', content: SYSTEM }, ...messages.map(({ role, content }) => ({ role, content }))],
    max_completion_tokens: tier === 'top' ? LIMITS.topTokens : LIMITS.lowTokens,
    stream: true,
  });
  if (!upstream.ok) return upstreamError(upstream, cors);
  return new Response(upstream.body, {
    headers: { ...cors, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}

async function handleJudge(j, env, cors) {
  const problem = checkJudgeInput(j);
  if (problem) return json({ error: problem }, 400, cors);
  const res = await openai(env, judgeRequest(env.JUDGE_MODEL || 'gpt-5.4-mini', j));
  if (!res.ok) return upstreamError(res, cors);
  const success = parseJudge(await res.json());
  if (success === null) return json({ error: '판정 결과를 읽지 못했어요.' }, 502, cors);
  return json({ success }, 200, cors);
}

// ── 설정 ──────────────────────────────────

async function getState(env, key) {
  return (await env.DB.prepare('SELECT value FROM state WHERE key = ?1').bind(key).first())?.value ?? null;
}

async function setState(env, key, value) {
  await env.DB.prepare('INSERT INTO state (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2').bind(key, value).run();
}

async function isEnabled(env) {
  return (await getState(env, 'enabled')) !== 'false';
}

async function getSettings(env) {
  try { return normalizeSettings(JSON.parse(await getState(env, 'settings'))); } catch { return normalizeSettings(null); }
}

// ── 랭킹 ──────────────────────────────────

async function loadSets(env, { hidden = false } = {}) {
  const { results } = await env.DB.prepare(
    `SELECT player, nickname, set_no, mission_id, low_stars, low_q, top_stars, top_q, created_at, hidden FROM sets ${hidden ? '' : 'WHERE hidden = 0'} ORDER BY id`,
  ).all();
  return results.map((r) => ({
    player: r.player, nickname: r.nickname, setNo: r.set_no, missionId: r.mission_id, lowStars: r.low_stars, lowQ: r.low_q, topStars: r.top_stars, topQ: r.top_q, at: r.created_at, hidden: !!r.hidden,
  }));
}

async function board(env, player) {
  const [sets, settings, enabled] = await Promise.all([loadSets(env), getSettings(env), isEnabled(env)]);
  return {
    ...boardView(sets, { player: typeof player === 'string' ? player : null, size: settings.boardSize, bonus: settings.bonus }),
    settings: { ...settings, enabled },
  };
}

// 기록 검사: 별과 질문 수가 규칙에 맞는지 (속이지 못하면 별 0, 질문은 최대치)
function validPart(p) {
  if (!p || !Number.isInteger(p.stars) || !Number.isInteger(p.q)) return false;
  if (p.q < 1 || p.q > MAX_QUESTIONS || p.stars < 0 || p.stars > MAX_STARS) return false;
  return p.stars === 0 ? p.q === MAX_QUESTIONS : p.stars === starsFor(p.q);
}

async function handleScore(s, env) {
  const bad = (error) => ({ status: 400, body: { error } });
  if (typeof s?.player !== 'string' || !/^[0-9a-f-]{8,40}$/.test(s.player)) return bad('기록 형식이 올바르지 않아요.');
  const nickProblem = checkNickname(s.nickname);
  if (nickProblem) return bad(nickProblem);
  const { sets } = await getSettings(env);
  // 체험 도중 관리자가 세트 수를 줄여도 이미 시작한 세트는 받는다 (최대치 5)
  if (!Number.isInteger(s.setNo) || s.setNo < 1 || s.setNo > Math.max(sets, 5)) return bad('세트 번호가 올바르지 않아요.');
  if (!missionById(s.missionId)) return bad('미션이 올바르지 않아요.');
  if (!validPart(s.low) || !validPart(s.top)) return bad('점수가 규칙에 맞지 않아요.');

  // 같은 사람의 같은 세트는 한 번만 (두 번 눌러도 중복 등록 안 됨)
  await env.DB.prepare(
    `INSERT OR IGNORE INTO sets (player, nickname, set_no, mission_id, low_stars, low_q, top_stars, top_q, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
  ).bind(s.player, s.nickname.trim(), s.setNo, s.missionId, s.low.stars, s.low.q, s.top.stars, s.top.q, Date.now()).run();
  return { status: 200, body: await board(env, s.player) };
}

// ── 관리자 ──────────────────────────────────

async function handleAdmin(a, env) {
  if (!env.ADMIN_PASSWORD) return { status: 500, body: { error: '관리자 비밀번호가 설정되지 않았어요.' } };
  if (!a || typeof a.password !== 'string' || !(await sameText(a.password, env.ADMIN_PASSWORD))) {
    await new Promise((r) => setTimeout(r, 600)); // 비밀번호 마구 대입 늦추기
    return { status: 401, body: { error: '비밀번호가 맞지 않아요.' } };
  }
  const db = env.DB;
  const player = typeof a.player === 'string' ? a.player : null;
  if (a.action === 'enable') {
    await setState(env, 'enabled', a.on ? 'true' : 'false');
  } else if (a.action === 'settings') {
    // 보낸 값만 바꾸고 나머지는 그대로
    const cur = await getSettings(env);
    const next = normalizeSettings({ ...cur, ...a.settings, bonus: { ...cur.bonus, ...a.settings?.bonus } });
    await setState(env, 'settings', JSON.stringify(next));
  } else if (a.action === 'defaults') {
    await setState(env, 'settings', JSON.stringify(normalizeSettings(null)));
  } else if (a.action === 'hide' && player) {
    await db.prepare('UPDATE sets SET hidden = ?2 WHERE player = ?1').bind(player, a.hidden === false ? 0 : 1).run();
  } else if (a.action === 'delete' && player) {
    await db.prepare('DELETE FROM sets WHERE player = ?1').bind(player).run();
  } else if (a.action === 'reset') {
    await db.prepare('DELETE FROM sets').run();
  }

  const [all, settings, enabled] = await Promise.all([loadSets(env, { hidden: true }), getSettings(env), isEnabled(env)]);
  const hidden = new Set(all.filter((s) => s.hidden).map((s) => s.player));
  return {
    status: 200,
    body: {
      enabled,
      settings,
      ...adminStats(all.filter((s) => !s.hidden)),
      players: ranking(all, settings.bonus).map((r) => ({ ...r, hidden: hidden.has(r.player) })),
      records: all,
    },
  };
}

// ── 공통 ──────────────────────────────────

function openai(env, payload) {
  return fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// OpenAI 오류 내용은 그대로 넘기지 않고 상태 코드만 전달 (키, 계정 정보 노출 방지)
async function upstreamError(res, cors) {
  const text = await res.text();
  // 원인 확인용 로그 (npx wrangler tail). 오류 메시지에는 키 일부가 섞일 수 있어 코드만 남긴다
  let code = '';
  try { code = JSON.parse(text).error?.code ?? ''; } catch { /* JSON이 아니면 상태 코드만 */ }
  console.error('OpenAI 오류', res.status, code);
  const policy = /content|policy|safety/i.test(text);
  return json({ error: policy ? 'policy' : 'upstream' }, res.status === 429 ? 429 : policy ? 400 : 502, cors);
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
}

// 길이와 무관하게 비교 시간이 같도록 해시로 비교
async function sameText(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([a, b].map((t) => crypto.subtle.digest('SHA-256', enc.encode(t))));
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < u.length; i++) diff |= u[i] ^ v[i];
  return diff === 0;
}
