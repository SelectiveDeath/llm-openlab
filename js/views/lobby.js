// 대기 화면: 게임 소개 + 닉네임 입력 + 실시간 랭킹. 관리자 설정(공지, 세트 수, 보너스, 켜짐/꺼짐)이 바뀌면 바로 반영된다.
import { MODELS } from '../config.js';
import { MAX_QUESTIONS, STAR_RULES, NICKNAME_MAX, checkNickname } from '../rules.js';
import { TIERS, rewardText } from '../missions.js';
import { settings } from '../settings.js';
import { h, clear, starRow } from '../ui.js';
import { boardPanel } from '../board.js';

export function lobbyView({ onStart }) {
  const input = h('input.input.nick-input', { maxLength: NICKNAME_MAX * 2, placeholder: `닉네임 (${NICKNAME_MAX}자까지)`, autocomplete: 'off', spellcheck: false });
  const err = h('p.nick-error');
  const startBtn = h('button.btn.btn-primary.btn-xl', { onclick: start }, '시작하기 →');
  const notice = h('div.notice');
  const tierRules = h('div.tier-rules');
  const limits = h('span.star-rule.muted');

  function start() {
    if (!settings.enabled) { err.textContent = '지금은 체험을 잠시 쉬고 있어요.'; return; }
    const problem = checkNickname(input.value);
    if (problem) { err.textContent = problem; input.focus(); return; }
    onStart(input.value.trim());
  }
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) start(); });
  input.addEventListener('input', () => { err.textContent = ''; });

  // 설정에 따라 바뀌는 부분
  function update() {
    const text = !settings.enabled ? '⏸ 지금은 체험을 잠시 쉬고 있어요.' : settings.notice ? `📢 ${settings.notice}` : '';
    notice.textContent = text;
    notice.hidden = !text;
    notice.classList.toggle('paused', !settings.enabled);
    startBtn.disabled = !settings.enabled;
    clear(tierRules).append(...Object.entries(TIERS).map(([tier, t]) =>
      h('div.tier-rule.tier-' + t.key, h('b', t.name), h('span', t.risk), h('small', rewardText(settings.bonus[tier])))));
    limits.textContent = `모델마다 질문 ${MAX_QUESTIONS}번 · 한 사람당 ${settings.sets}세트`;
  }
  update();

  const board = boardPanel({ onData: update });

  const el = h('div.screen.lobby',
    h('section.lobby-hero',
      notice,
      h('div.kicker', 'AI 동아리 오픈랩'),
      h('h1', 'AI를 속여라!'),
      h('p.lobby-lead', '같은 미션으로 ', h('b.c-low', '하위 모델'), '과 ', h('b.c-top', '최상위 모델'), '을 차례로 속여 보세요.', h('br'), h('b', '질문을 적게 쓸수록'), ' 별을 많이 받아요.'),
      h('div.how',
        how('🎰', '미션 카드 고르기', '쉬움·보통·어려움 중 한 장'),
        how(MODELS.low.icon, `${MODELS.low.name} 속이기`, `${MODELS.low.id} · ${MODELS.low.year}년`),
        how(MODELS.top.icon, `${MODELS.top.name} 속이기`, `${MODELS.top.id} · ${MODELS.top.year}년`)),
      tierRules,
      h('div.star-rules',
        STAR_RULES.map((r) => h('span.star-rule', starRow(r.stars), ` ${r.max}번 안에 속이면`)),
        limits),
      h('div.nick-box', input, startBtn),
      err),
    board.el);

  return { el, focus: () => input.focus(), cleanup: board.cleanup };
}

const how = (icon, title, sub) => h('div.how-step', h('span.how-icon', icon), h('b', title), h('small', sub));
