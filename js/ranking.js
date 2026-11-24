// 랭킹 계산. Worker(실제 랭킹)와 mock 모드(이 브라우저 랭킹)가 함께 쓴다. 브라우저 전용 기능을 쓰지 말 것.
// 세트 점수 = 두 모델 별의 합. 한 사람의 최고 세트로 순위를 매긴다:
//   별이 많은 순 → 같으면 그 세트에서 쓴 질문 수가 적은 순 → 같으면 먼저 한 사람

// set: { player, nickname, lowStars, lowQ, topStars, topQ, at }
const better = (a, b) =>
  (b.lowStars + b.topStars) - (a.lowStars + a.topStars) || (a.lowQ + a.topQ) - (b.lowQ + b.topQ) || a.at - b.at;

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
    stars: s.lowStars + s.topStars,
    q: s.lowQ + s.topQ,
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
    me: me && { rank: me.rank, stars: me.stars, q: me.q },
    players: all.length,
    topFooled: new Set(sets.filter((s) => s.topStars > 0).map((s) => s.player)).size, // 최상위 모델을 한 번이라도 속인 사람 수
  };
}
