// 🏆 랭킹 패널: 대기 화면과 세트 결과 화면에서 쓴다. 몇 초마다 새로 받아 와서 다른 노트북 기록도 보인다.
import { BOARD_REFRESH_MS } from './config.js';
import { MAX_SET_POINTS } from './ranking.js';
import { TIERS } from './missions.js';
import { fetchBoard } from './api.js';
import { h, clear } from './ui.js';

const MEDALS = ['🥇', '🥈', '🥉'];

export function boardPanel({ player = null, initial = null, title = '🏆 실시간 랭킹' } = {}) {
  const stats = h('div.board-stats');
  const list = h('ol.board-list');
  const el = h('section.board', h('div.board-head', h('h2', title), stats), list);

  function render(data) {
    clear(stats).append(
      h('span', '참가 ', h('b', String(data.players)), '명'),
      h('span', '최상위 모델을 속인 사람 ', h('b', String(data.topFooled)), '명'));
    clear(list);
    if (!data.rows.length) {
      list.append(h('li.board-empty', '아직 기록이 없어요. 첫 번째 주인공이 되어 보세요!'));
      return;
    }
    for (const r of data.rows) list.append(row(r));
    if (data.me && !data.rows.some((r) => r.mine)) {
      list.append(h('li.board-gap', '⋯'), row({ ...data.me, nickname: '나', mine: true }));
    }
  }

  function row(r) {
    return h('li.board-row' + (r.mine ? '.mine' : '') + (r.rank <= 3 ? '.podium' : ''),
      h('span.board-rank', MEDALS[r.rank - 1] ?? String(r.rank)),
      h('span.board-name', r.nickname, r.tier && h('span.tier-dot.tier-' + TIERS[r.tier].key, { title: TIERS[r.tier].name })),
      h('span.board-score',
        h('span.board-stars', '★ ', h('b', String(r.points)), h('small', ` / ${MAX_SET_POINTS}`)),
        h('span.board-q', `질문 ${r.q}개`)));
  }

  let stopped = false;
  let timer = null;
  async function refresh() {
    try {
      render(await fetchBoard(player));
      el.classList.remove('offline');
    } catch {
      el.classList.add('offline');
    }
    if (!stopped) timer = setTimeout(refresh, BOARD_REFRESH_MS);
  }

  if (initial) {
    render(initial);
    timer = setTimeout(refresh, BOARD_REFRESH_MS);
  } else {
    list.append(h('li.board-empty', '랭킹을 불러오는 중…'));
    refresh();
  }

  return { el, cleanup: () => { stopped = true; clearTimeout(timer); } };
}
