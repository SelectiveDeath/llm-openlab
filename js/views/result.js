// 세트 결과: 두 모델 비교 + 기록 등록 + 현재 랭킹
import { MODELS } from '../config.js';
import { MAX_QUESTIONS, MAX_STARS } from '../rules.js';
import { submitSet } from '../api.js';
import { boardPanel } from '../board.js';
import { TIERS } from '../missions.js';
import { maxSetPoints, partPoints } from '../ranking.js';
import { h, clear, starRow, short } from '../ui.js';

// 랭킹에 올릴 세트 기록: 속이지 못한 모델은 질문을 다 쓴 것으로 친다
function setRecord({ player, set }) {
  const part = (s) => ({ stars: s.stars, q: s.fooled ? s.q : MAX_QUESTIONS });
  return { player: player.id, nickname: player.nickname, setNo: set.no, missionId: set.mission.id, low: part(set.low), top: part(set.top) };
}

export function resultView({ game, setsLeft, onAgain, onQuit }) {
  const { player, set } = game;
  const record = setRecord(game);
  const total = partPoints(record.low.stars, set.bonus) + partPoints(record.top.stars, set.bonus);
  const tier = TIERS[set.mission.tier];
  const { sets } = player.cfg;

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
      clear(rankLine).append(`전체 ${data.players}명 중 `, h('b', `${data.me.rank}위`));
      if (data.me.points > total) rankLine.append(h('span.muted', ` (내 최고 기록 ★ ${data.me.points})`));
    }
  })();

  const diff = summary(set);
  const el = h('div.screen.result',
    h('section.result-main',
      h('div.kicker', `${player.nickname} · ${set.no}세트 결과`),
      h('h1', set.mission.icon, ' ', set.mission.title, h('span.mission-tier.tier-' + tier.key, tier.name)),
      h('div.result-total', '이번 세트 점수 ', h('b', `★ ${total}`), h('small', ` / ${maxSetPoints(player.cfg.bonus)}`)),
      rankLine,
      h('div.vs-cards', side('low', set.low, set.bonus), side('top', set.top, set.bonus)),
      diff && h('p.result-summary', diff),
      h('div.result-actions',
        setsLeft > 0
          ? [h('button.btn.btn-primary.btn-xl', { onclick: onAgain }, `한 세트 더 하기 (${set.no + 1}/${sets}) →`),
            h('button.btn.btn-ghost', { onclick: onQuit }, '여기까지 할게요')]
          : h('button.btn.btn-primary.btn-xl', { onclick: onQuit }, '끝! 다음 사람에게 넘기기'))),
    boardSlot);

  return { el, cleanup: () => board?.cleanup() };
}

function side(tier, s, bonus) {
  const m = MODELS[tier];
  const ai = s.messages.filter((x) => x.role === 'assistant');
  const quote = s.fooled ? s.messages[s.fooledAt]?.content : ai.at(-1)?.content;
  return h('div.vs-card.tier-' + tier + (s.fooled ? '.win' : '.lose'),
    h('div.vs-model', `${m.icon} ${m.name}`, h('small', ` ${m.id} · ${m.year}`)),
    h('div.vs-stars', starRow(s.stars, MAX_STARS, 'big'), s.fooled && bonus > 0 && h('span.bonus', `+${bonus}`)),
    h('div.vs-state', s.fooled ? `질문 ${s.q}번 만에 넘어갔어요` : s.gaveUp ? (s.q ? `질문 ${s.q}번 뒤 포기했어요` : '도전하지 않고 넘어갔어요') : '끝까지 버텼어요'),
    quote && h('blockquote.vs-quote', h('small', s.fooled ? '속은 답' : '마지막 답'), short(quote, 120)));
}

function summary({ low, top }) {
  if (low.fooled && !top.fooled) return `같은 미션인데 ${MODELS.low.name}는 넘어가고, ${MODELS.top.name}는 넘어가지 않았어요.`;
  if (low.fooled && top.fooled && top.q > low.q) return `둘 다 속였어요! ${MODELS.top.name}가 질문 ${top.q - low.q}번을 더 버텼어요.`;
  if (low.fooled && top.fooled) return '두 모델을 모두 금방 속였어요. 대단해요!';
  if (!low.fooled && top.fooled) return `${MODELS.low.name}는 버티고 ${MODELS.top.name}만 넘어갔어요. 흔치 않은 결과예요!`;
  return '두 모델 모두 버텼어요. 다른 미션으로 다시 도전해 보세요!';
}
