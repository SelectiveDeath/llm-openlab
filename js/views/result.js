// 세트 결과: 두 모델 비교 + 기록 등록 + 현재 랭킹
import { MODELS } from '../config.js';
import { MAX_QUESTIONS, MAX_STARS, SETS_PER_PLAYER } from '../rules.js';
import { submitSet } from '../api.js';
import { boardPanel } from '../board.js';
import { h, clear, starRow, short } from '../ui.js';

// 랭킹에 올릴 세트 기록: 속이지 못한 모델은 질문을 다 쓴 것으로 친다
function setRecord({ player, set }) {
  const part = (s) => ({ stars: s.stars, q: s.fooled ? s.q : MAX_QUESTIONS });
  return { player: player.id, nickname: player.nickname, setNo: set.no, missionId: set.mission.id, low: part(set.low), top: part(set.top) };
}

export function resultView({ game, setsLeft, onAgain, onQuit }) {
  const { player, set } = game;
  const record = setRecord(game);
  const total = record.low.stars + record.top.stars;

  const boardSlot = h('div.result-board', h('div.board.loading', '기록을 올리는 중…'));
  const rankLine = h('p.rank-line');
  let board = null;

  (async () => {
    let data = null;
    try {
      data = await submitSet(record);
    } catch (err) {
      clear(rankLine).append(h('span.error', `기록을 올리지 못했어요: ${err.message}`));
    }
    board = boardPanel({ player: player.id, initial: data, title: '🏆 현재 랭킹' });
    clear(boardSlot).append(board.el);
    if (data?.me) {
      clear(rankLine).append('지금 ', h('b', `${data.me.rank}위`), ` / ${data.players}명`);
      if (data.me.stars > total) rankLine.append(h('span.muted', ` (최고 기록: ★ ${data.me.stars})`));
    }
  })();

  const diff = summary(set);
  const el = h('div.screen.result',
    h('section.result-main',
      h('div.kicker', `${player.nickname} · 세트 ${set.no}/${SETS_PER_PLAYER} 결과`),
      h('h1', set.mission.icon, ' ', set.mission.title),
      h('div.result-total', '이번 세트 ', h('b', `★ ${total}`), h('small', ` / ${MAX_STARS * 2}`)),
      rankLine,
      h('div.vs-cards', side('low', set.low), side('top', set.top)),
      diff && h('p.result-summary', diff),
      h('div.result-actions',
        setsLeft > 0
          ? [h('button.btn.btn-primary.btn-xl', { onclick: onAgain }, `한 세트 더 (${set.no + 1}/${SETS_PER_PLAYER}) →`),
            h('button.btn.btn-ghost', { onclick: onQuit }, '그만하기')]
          : h('button.btn.btn-primary.btn-xl', { onclick: onQuit }, '끝! 다음 사람 시작'))),
    boardSlot);

  return { el, cleanup: () => board?.cleanup() };
}

function side(tier, s) {
  const m = MODELS[tier];
  const ai = s.messages.filter((x) => x.role === 'assistant');
  const quote = s.fooled ? s.messages[s.fooledAt]?.content : ai.at(-1)?.content;
  return h('div.vs-card.tier-' + tier + (s.fooled ? '.win' : '.lose'),
    h('div.vs-model', `${m.icon} ${m.name}`, h('small', ` ${m.id} · ${m.year}`)),
    starRow(s.stars, MAX_STARS, 'big'),
    h('div.vs-state', s.fooled ? `질문 ${s.q}개 만에 속았어요` : s.q ? `질문 ${s.q}개를 버텼어요` : '도전하지 않았어요'),
    quote && h('blockquote.vs-quote', h('small', s.fooled ? '속은 답' : '마지막 답'), short(quote, 120)));
}

function summary({ low, top }) {
  if (low.fooled && !top.fooled) return `같은 미션인데 ${MODELS.low.name}는 속고, ${MODELS.top.name}는 속지 않았어요.`;
  if (low.fooled && top.fooled && top.q > low.q) return `${MODELS.top.name}는 ${top.q - low.q}번 더 버텼어요.`;
  if (low.fooled && top.fooled) return '두 모델 모두 금방 속았어요! 대단한데요?';
  if (!low.fooled && top.fooled) return `${MODELS.top.name}만 속았어요. 신기한 결과예요!`;
  return '두 모델 모두 버텼어요. 다른 미션으로 다시 도전해 보세요!';
}
