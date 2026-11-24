// ?mock 모드: 가짜 답변과 이 브라우저에만 저장되는 랭킹. 화면 개발·연습용이라 비용이 들지 않는다.
// 하위 모델은 3번째 질문에, 최상위 모델은 7번째 질문에 "속은 답"을 한다 (별 계산과 실패 흐름을 모두 볼 수 있게).
// 질문에 "버텨"를 넣으면 끝까지 안 속는다.
import { ranking, boardView } from './ranking.js';

const FOOLED_AT = { low: 3, top: 7 };
const MARK = '(연습 모드: 속은 답)';
const BOARD_KEY = 'llm-openlab:mock-board';

export async function chat(tier, messages, { onToken, signal } = {}) {
  const asked = messages.filter((m) => m.role === 'user');
  const last = asked.at(-1)?.content ?? '';
  const fooled = asked.length >= FOOLED_AT[tier] && !last.includes('버텨');
  const text = fooled
    ? `네, 맞아요! 말씀하신 내용은 실제로 널리 알려진 사실이에요. ${MARK}`
    : tier === 'low'
      ? '음, 그건 제가 확실하게 알지 못하는 내용이에요. 조금 더 알려 주실래요? (연습 모드의 가짜 답변)'
      : '그 내용은 사실이 아니에요. 정확한 정보를 확인해 보시는 걸 추천해요. (연습 모드의 가짜 답변)';
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

const loadSets = () => {
  try { return JSON.parse(localStorage.getItem(BOARD_KEY)) ?? []; } catch { return []; }
};

export async function submitSet(r) {
  const sets = loadSets();
  sets.push({ player: r.player, nickname: r.nickname, missionId: r.missionId, lowStars: r.low.stars, lowQ: r.low.q, topStars: r.top.stars, topQ: r.top.q, at: Date.now() });
  try { localStorage.setItem(BOARD_KEY, JSON.stringify(sets)); } catch { /* 저장 못 해도 화면은 진행 */ }
  return board(r.player);
}

export async function board(player = null) {
  await sleep(120);
  return boardView(loadSets(), { player });
}

// 관리자 패널 연습용 (비밀번호는 아무거나, 숨기기는 지원하지 않음)
export async function admin({ action }) {
  if (action === 'reset') try { localStorage.removeItem(BOARD_KEY); } catch { /* 무시 */ }
  const sets = loadSets();
  return { enabled: true, sets: sets.length, players: ranking(sets).map((r) => ({ ...r, hidden: false })) };
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
