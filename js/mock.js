// ?mock 모드: 가짜 답변과 이 브라우저에만 저장되는 랭킹·설정. 화면 개발·연습용이라 비용이 들지 않는다.
// 하위 모델은 3번째 질문에, 최상위 모델은 7번째 질문에 "속은 답"을 한다 (별 계산과 실패 흐름을 모두 볼 수 있게).
// 질문에 "버텨"를 넣으면 끝까지 안 속는다. 관리자 패널(admin.html?mock)은 비밀번호를 아무거나 넣으면 된다.
import { normalizeSettings } from './rules.js';
import { ranking, boardView, adminStats } from './ranking.js';

const FOOLED_AT = { low: 3, top: 7 };
const MARK = '(연습 모드: 속은 답)';
const BOARD_KEY = 'llm-openlab:mock-board';
const SETTINGS_KEY = 'llm-openlab:mock-settings';
const ENABLED_KEY = 'llm-openlab:mock-enabled';

export async function chat(tier, messages, { onToken, signal } = {}) {
  const asked = messages.filter((m) => m.role === 'user');
  const last = asked.at(-1)?.content ?? '';
  const fooled = asked.length >= FOOLED_AT[tier] && !last.includes('버텨');
  const text = fooled
    ? `네, 맞아요! 말씀하신 내용은 실제로 널리 알려진 사실이에요. ${MARK}`
    : tier === 'low'
      ? '음, 그건 제가 확실히 아는 내용이 아니에요. 조금 더 알려 주실래요? (연습 모드의 가짜 답변)'
      : '그 내용은 사실이 아니에요. 정확한 정보를 한번 확인해 보세요. (연습 모드의 가짜 답변)';
  await sleep(300, signal);
  let out = '';
  for (let i = 0; i < text.length; i += 3) {
    const piece = text.slice(i, i + 3);
    out += piece;
    onToken?.(piece);
    await sleep(15, signal);
  }
  return out;
}

export async function judge({ messages }) {
  await sleep(350);
  return messages.at(-1)?.content.includes(MARK) ? 0.9 : 0.05;
}

const load = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const save = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 저장 못 해도 화면은 진행 */ }
};
const loadSets = () => load(BOARD_KEY, []);
const loadSettings = () => normalizeSettings(load(SETTINGS_KEY, null));
const enabled = () => load(ENABLED_KEY, true) !== false;

export async function submitSet(r) {
  const sets = loadSets();
  if (!sets.some((s) => s.player === r.player && s.setNo === r.setNo)) {
    sets.push({ player: r.player, nickname: r.nickname, setNo: r.setNo, missionId: r.missionId, lowStars: r.low.stars, lowQ: r.low.q, topStars: r.top.stars, topQ: r.top.q, at: Date.now(), hidden: false });
    save(BOARD_KEY, sets);
  }
  return board(r.player);
}

export async function board(player = null) {
  await sleep(120);
  const settings = loadSettings();
  return {
    ...boardView(loadSets().filter((s) => !s.hidden), { player, size: settings.boardSize, bonus: settings.bonus }),
    settings: { ...settings, enabled: enabled() },
  };
}

// 관리자 패널 연습용: Worker의 handleAdmin과 같은 동작
export async function admin(a) {
  await sleep(120);
  let sets = loadSets();
  if (a.action === 'enable') save(ENABLED_KEY, !!a.on);
  else if (a.action === 'settings') {
    const cur = loadSettings();
    save(SETTINGS_KEY, normalizeSettings({ ...cur, ...a.settings, bonus: { ...cur.bonus, ...a.settings?.bonus } }));
  } else if (a.action === 'defaults') save(SETTINGS_KEY, normalizeSettings(null));
  else if (a.action === 'hide') sets = sets.map((s) => (s.player === a.player ? { ...s, hidden: a.hidden !== false } : s));
  else if (a.action === 'delete') sets = sets.filter((s) => s.player !== a.player);
  else if (a.action === 'reset') sets = [];
  save(BOARD_KEY, sets);

  const settings = loadSettings();
  const hidden = new Set(sets.filter((s) => s.hidden).map((s) => s.player));
  return {
    enabled: enabled(),
    settings,
    ...adminStats(sets.filter((s) => !s.hidden)),
    players: ranking(sets, settings.bonus).map((r) => ({ ...r, hidden: hidden.has(r.player) })),
    records: sets,
  };
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}
