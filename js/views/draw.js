// 미션 뽑기: 게임의 증강 고르기처럼 카드 3장이 뒷면으로 깔렸다가 하나씩 뒤집힌다.
import { CARDS_PER_DRAW, SETS_PER_PLAYER } from '../rules.js';
import { TIERS, drawCards } from '../missions.js';
import { h, clear } from '../ui.js';

const FLIP_GAP = 350; // 카드가 차례로 뒤집히는 간격(ms)

export function drawView({ game, onPick }) {
  const { player, set } = game;
  const row = h('div.cards');
  const rerollBtn = h('button.btn.btn-ghost', { onclick: reroll });
  const timers = [];

  function deal() {
    timers.forEach(clearTimeout);
    const cards = drawCards(player.seen, CARDS_PER_DRAW);
    clear(row);
    cards.forEach((m, i) => {
      const card = h('button.card3d.tier-' + TIERS[m.tier].key, { disabled: true, onclick: () => pick(card, m) },
        h('div.card3d-inner',
          h('div.card-face.card-back', h('span.card-back-mark', '?')),
          h('div.card-face.card-front',
            h('div.card-tier', TIERS[m.tier].name, h('small', ` · ${TIERS[m.tier].label}`)),
            h('div.card-icon', m.icon),
            h('div.card-title', m.title),
            h('p.card-goal', m.goal))));
      row.append(card);
      timers.push(setTimeout(() => { card.classList.add('flipped'); card.disabled = false; }, 450 + i * FLIP_GAP));
    });
    rerollBtn.textContent = `🔄 다시 뽑기 (${set.rerolls})`;
    rerollBtn.disabled = set.rerolls <= 0;
  }

  function reroll() {
    if (set.rerolls <= 0) return;
    set.rerolls -= 1;
    deal();
  }

  function pick(card, mission) {
    row.querySelectorAll('.card3d').forEach((c) => { c.disabled = true; c.classList.toggle('chosen', c === card); c.classList.toggle('dropped', c !== card); });
    rerollBtn.disabled = true;
    timers.push(setTimeout(() => onPick(mission), 700));
  }

  deal();
  const el = h('div.screen.draw',
    h('div.draw-head',
      h('div.kicker', `${player.nickname} · 세트 ${set.no}/${SETS_PER_PLAYER}`),
      h('h1', '미션 카드를 골라 주세요'),
      h('p.muted', '고른 미션으로 하위 모델과 최상위 모델을 차례로 속여요. 등급이 높을수록 어려워요.')),
    row,
    h('div.draw-foot', rerollBtn));
  return { el, cleanup: () => timers.forEach(clearTimeout) };
}
