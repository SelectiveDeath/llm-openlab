// 점수와 랭킹 계산. Worker(실제 랭킹)와 mock 모드(이 브라우저 랭킹)가 함께 쓴다. 브라우저 전용 기능을 쓰지 말 것.
// 세트 점수 = 두 모델 별의 합 + 속인 모델마다 카드 난이도 보너스(쉬움 0 · 보통 1 · 어려움 2).
// 한 사람의 최고 세트로 순위를 매긴다: 점수가 높은 순 → 같으면 그 세트에서 쓴 질문 수가 적은 순 → 같으면 먼저 한 사람
import { MAX_STARS } from './rules.js';
import { TIERS, MAX_BONUS, missionById } from './missions.js';

export const MAX_SET_POINTS = (MAX_STARS + MAX_BONUS) * 2;

export const bonusOf = (missionId) => TIERS[missionById(missionId)?.tier]?.bonus ?? 0;

// 모델 하나의 점수: 속였으면 별 + 보너스, 못 속였으면 0
export const partPoints = (stars, missionId) => (stars > 0 ? stars + bonusOf(missionId) : 0);

// set: { player, nickname, missionId, lowStars, lowQ, topStars, topQ, at }
export const setPoints = (s) => partPoints(s.lowStars, s.missionId) + partPoints(s.topStars, s.missionId);

const better = (a, b) => setPoints(b) - setPoints(a) || (a.lowQ + a.topQ) - (b.lowQ + b.topQ) || a.at - b.at;

export function ranking(sets) {
  const best = new Map();
  for (const s of sets) {
    const cur = best.get(s.player);
    if (!cur || better(s, cur) < 0) best.set(s.player, s);
  }
  return [...best.values()].sort(better).map((s, i) => ({
    rank: i + 1,
    player: s.player,
    nickname: s.nickname,
    points: setPoints(s),
    q: s.lowQ + s.topQ,
    tier: missionById(s.missionId)?.tier ?? 1,
    lowStars: s.lowStars,
    topStars: s.topStars,
  }));
}

// 화면에 보낼 랭킹: 위에서 size명 + 요청한 사람의 순위 + 통계
export function boardView(sets, { player = null, size = 10 } = {}) {
  const all = ranking(sets);
  const me = player ? all.find((r) => r.player === player) ?? null : null;
  return {
    rows: all.slice(0, size).map(({ player: p, ...r }) => ({ ...r, mine: p === player })),
    me: me && { rank: me.rank, points: me.points, q: me.q },
    players: all.length,
    topFooled: new Set(sets.filter((s) => s.topStars > 0).map((s) => s.player)).size, // 최상위 모델을 한 번이라도 속인 사람 수
  };
}
