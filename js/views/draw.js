// 미션 뽑기: 쉬움·보통·어려움 카드가 한 장씩, 슬롯머신처럼 각자 돌다가 차례로 멈춘다.
// 카드마다 정해진 횟수(관리자 설정 rerolls)만큼 다시 돌릴 수 있다. 하나를 고르면 그 미션으로 세트가 시작된다.
import { TIERS, MISSIONS, rollTier, rewardText } from '../missions.js';
import { h, clear } from '../ui.js';

const SPIN_MS = [1100, 1600, 2100]; // 카드가 멈추는 시각 (왼쪽부터 차례로)
const RESPIN_MS = 1100;
const BURST = 36; // 멈출 때 터지는 조각 수 (고를 때는 1.5배)

// 다시 돌리기 아이콘 (시계 방향 화살표)
const RESPIN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/></svg>';

export function drawView({ game, onPick }) {
  const { player, set } = game;
  const { cfg } = player;
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  let picked = false;

  const slots = [1, 2, 3].map((tier) => makeSlot(tier));
  const row = h('div.cards', slots.map((s) => s.el));

  function makeSlot(tier) {
    const t = TIERS[tier];
    const slot = { tier, mission: null, rerolls: cfg.rerolls, spinning: false };
    const icon = h('div.card-icon');
    const title = h('div.card-title');
    const goal = h('p.card-goal');
    const burst = h('div.burst');
    const card = h('button.mcard.tier-' + t.key, { disabled: true, onclick: () => pick(slot) },
      h('div.mcard-head', h('span.mcard-tier', t.name), h('span.mcard-reward', rewardText(cfg.bonus[tier]))),
      h('div.mcard-window', h('div.mcard-reel', icon, title)),
      goal,
      h('div.mcard-risk', t.risk),
      h('span.shine'),
      burst);
    const again = h('button.respin', { html: RESPIN_ICON, title: '다시 돌리기', 'aria-label': `${t.name} 카드 다시 돌리기`, onclick: () => spin(slot, RESPIN_MS, true) });
    slot.el = h('div.slot', card, again);
    Object.assign(slot, { card, icon, title, goal, burst, again });
    return slot;
  }

  // 카드 돌리기: 같은 난이도 미션들이 빠르게 지나가다가 점점 느려지며 멈춘다
  function spin(slot, duration, isRespin = false) {
    if (picked || slot.spinning) return;
    if (isRespin) {
      if (slot.rerolls <= 0) return;
      slot.rerolls -= 1;
    }
    const others = slots.filter((s) => s !== slot).map((s) => s.mission?.id);
    const result = rollTier(slot.tier, [...player.seen, ...others, slot.mission?.id], cfg.off);
    const pool = MISSIONS.filter((m) => m.tier === slot.tier && !cfg.off.includes(m.id));
    slot.spinning = true;
    slot.mission = null;
    slot.card.disabled = true;
    slot.card.classList.remove('landed');
    slot.card.classList.add('spinning');
    slot.goal.textContent = '';
    updateAgain(slot);

    const start = performance.now();
    let i = Math.floor(Math.random() * pool.length);
    const step = () => {
      const t = (performance.now() - start) / duration;
      if (t >= 1) return land(slot, result);
      i = (i + 1) % pool.length;
      show(slot, pool[i]);
      later(step, 45 + 260 * t * t); // 처음엔 빠르게, 끝으로 갈수록 느리게
    };
    step();
  }

  function show(slot, m) {
    slot.icon.textContent = m.icon;
    slot.title.textContent = m.title;
  }

  function land(slot, m) {
    slot.spinning = false;
    slot.mission = m;
    show(slot, m);
    slot.goal.textContent = m.brief;
    slot.card.classList.remove('spinning');
    void slot.card.offsetWidth; // 애니메이션 다시 시작
    slot.card.classList.add('landed');
    slot.card.disabled = false;
    burst(slot);
    updateAgain(slot);
  }

  // 폭발: 섬광 + 퍼지는 고리 2개 + 사방으로 튀는 조각(네모·동그라미·별)
  function burst(slot, scale = 1) {
    clear(slot.burst);
    slot.burst.append(h('b.boom-flash'), h('b.boom-ring'), h('b.boom-ring.late'));
    const n = Math.round(BURST * scale);
    for (let k = 0; k < n; k++) {
      const a = (Math.PI * 2 * k) / n + Math.random() * .4;
      const d = (150 + Math.random() * 200) * scale;
      const star = k % 5 === 0;
      slot.burst.append(h('i' + (star ? '.star-bit' : ''), {
        style: {
          '--x': `${Math.cos(a) * d}px`, '--y': `${Math.sin(a) * d}px`, '--r': `${Math.random() * 720 - 360}deg`,
          '--s': (.6 + Math.random() * .9).toFixed(2), animationDelay: `${Math.random() * 80}ms`,
        },
      }, star ? '★' : null));
    }
    slot.card.classList.remove('boom');
    void slot.card.offsetWidth; // 애니메이션 다시 시작
    slot.card.classList.add('boom');
  }

  function updateAgain(slot) {
    slot.again.hidden = cfg.rerolls <= 0;
    slot.again.title = slot.rerolls > 0 ? `다시 돌리기 (${slot.rerolls}번 남음)` : '다시 돌리기를 다 썼어요';
    slot.again.disabled = picked || slot.spinning || slot.rerolls <= 0;
    slot.again.classList.toggle('used', slot.rerolls <= 0);
    slot.again.classList.toggle('turning', slot.spinning);
  }

  function pick(slot) {
    if (picked || !slot.mission) return;
    picked = true;
    for (const s of slots) {
      s.card.disabled = true;
      s.card.classList.toggle('chosen', s === slot);
      s.card.classList.toggle('dropped', s !== slot);
      updateAgain(s);
    }
    burst(slot, 1.5);
    later(() => onPick(slot.mission), 1000);
  }

  slots.forEach((s, k) => spin(s, SPIN_MS[k]));

  const el = h('div.screen.draw',
    h('div.draw-head',
      h('div.kicker', `${player.nickname} · ${set.no}세트 / ${cfg.sets}세트`),
      h('h1', '도전할 미션을 고르세요'),
      h('p.muted', '어려운 카드일수록 AI가 잘 안 넘어가지만, 성공하면 보너스 별을 더 받아요.')),
    row);
  return { el, cleanup: () => timers.forEach(clearTimeout) };
}
