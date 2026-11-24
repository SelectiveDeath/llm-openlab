// 점수, 랭킹, 관리자 통계 계산. Worker(실제 랭킹)와 mock 모드(이 브라우저 랭킹)가 함께 쓴다. 브라우저 전용 기능을 쓰지 말 것.
// 세트 점수 = 두 모델 별의 합 + 속인 모델마다 카드 난이도 보너스 (bonus: { 1: 쉬움, 2: 보통, 3: 어려움 }, 관리자 설정)
// 한 사람의 최고 세트로 순위를 매긴다: 점수가 높은 순 → 같으면 그 세트에서 쓴 질문 수가 적은 순 → 같으면 먼저 한 사람
import { MAX_STARS, MAX_QUESTIONS } from './rules.js';
import { MISSIONS, missionById } from './missions.js';

export const maxSetPoints = (bonus) => (MAX_STARS + Math.max(...Object.values(bonus))) * 2;

const tierOf = (missionId) => missionById(missionId)?.tier ?? 1;

// 모델 하나의 점수: 속였으면 별 + 보너스, 못 속였으면 0
export const partPoints = (stars, tierBonus) => (stars > 0 ? stars + tierBonus : 0);

// set: { player, nickname, missionId, lowStars, lowQ, topStars, topQ, at }
export const setPoints = (s, bonus) => {
  const b = bonus[tierOf(s.missionId)] ?? 0;
  return partPoints(s.lowStars, b) + partPoints(s.topStars, b);
};

export function ranking(sets, bonus) {
  const better = (a, b) => setPoints(b, bonus) - setPoints(a, bonus) || (a.lowQ + a.topQ) - (b.lowQ + b.topQ) || a.at - b.at;
  const best = new Map();
  for (const s of sets) {
    const cur = best.get(s.player);
    if (!cur || better(s, cur) < 0) best.set(s.player, s);
  }
  return [...best.values()].sort(better).map((s, i) => ({
    rank: i + 1,
    player: s.player,
    nickname: s.nickname,
    points: setPoints(s, bonus),
    q: s.lowQ + s.topQ,
    tier: tierOf(s.missionId),
    lowStars: s.lowStars,
    topStars: s.topStars,
  }));
}

// 화면에 보낼 랭킹: 위에서 size명 + 요청한 사람의 순위 + 통계
export function boardView(sets, { player = null, size = 10, bonus }) {
  const all = ranking(sets, bonus);
  const me = player ? all.find((r) => r.player === player) ?? null : null;
  return {
    rows: all.slice(0, size).map(({ player: p, ...r }) => ({ ...r, mine: p === player })),
    me: me && { rank: me.rank, points: me.points, q: me.q },
    players: all.length,
    topFooled: new Set(sets.filter((s) => s.topStars > 0).map((s) => s.player)).size, // 최상위 모델을 한 번이라도 속인 사람 수
  };
}

// 관리자 통계: 전체 요약 + 미션별 도전 수와 속인 비율
export function adminStats(sets) {
  const rate = (list, key) => (list.length ? list.filter((s) => s[key] > 0).length / list.length : null);
  const avg = (list, key, starKey) => {
    const won = list.filter((s) => s[starKey] > 0);
    return won.length ? won.reduce((n, s) => n + s[key], 0) / won.length : null;
  };
  return {
    summary: {
      players: new Set(sets.map((s) => s.player)).size,
      sets: sets.length,
      lowRate: rate(sets, 'lowStars'),
      topRate: rate(sets, 'topStars'),
      lowAvgQ: avg(sets, 'lowQ', 'lowStars'), // 속였을 때 평균 질문 수
      topAvgQ: avg(sets, 'topQ', 'topStars'),
      maxQ: MAX_QUESTIONS,
    },
    missions: MISSIONS.map((m) => {
      const list = sets.filter((s) => s.missionId === m.id);
      return { id: m.id, plays: list.length, lowRate: rate(list, 'lowStars'), topRate: rate(list, 'topStars') };
    }),
  };
}
