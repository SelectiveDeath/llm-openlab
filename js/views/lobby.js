// 대기 화면: 게임 소개 + 닉네임 입력 + 실시간 랭킹. 관리자 설정(공지, 세트 수, 보너스, 켜짐/꺼짐)이 바뀌면 바로 반영된다.
import { MODELS } from '../config.js';
import { MAX_QUESTIONS, STAR_RULES, NICKNAME_MAX, checkNickname } from '../rules.js';
import { TIERS, rewardText } from '../missions.js';
import { settings } from '../settings.js';
import { h, clear, starRow } from '../ui.js';
import { boardPanel } from '../board.js';

export function lobbyView({ onStart }) {
  const input = h('input.input.nick-input', { id: 'nick', maxLength: NICKNAME_MAX * 2, placeholder: `닉네임 (${NICKNAME_MAX}자까지)`, autocomplete: 'off', spellcheck: false });
  const err = h('p.nick-error');
  const startBtn = h('button.btn.btn-primary.btn-xl', { onclick: start }, '시작하기 →');
  const notice = h('div.notice');
  const tierRules = h('div.tier-rules');
  const limits = h('p.start-limits');

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

  // 가운데: 제목과 시작 상자 / 왼쪽: 하는 방법과 규칙 / 오른쪽: 실시간 랭킹
  const el = h('div.screen.lobby',
    h('aside.lobby-side.rules',
      h('h2', '🧭 이렇게 해요'),
      h('ol.how',
        how('🎰', '미션 카드 고르기', '쉬움·보통·어려움 중 한 장'),
        how(MODELS.low.icon, `${MODELS.low.name} 속이기`, `${MODELS.low.id} · ${MODELS.low.year}년`),
        how(MODELS.top.icon, `${MODELS.top.name} 속이기`, `${MODELS.top.id} · ${MODELS.top.year}년`)),
      h('h3', '⭐ 별 받는 법'),
      h('div.star-rules', STAR_RULES.map((r) => h('span.star-rule', starRow(r.stars), ` ${r.max}번 안에 속이면`))),
      h('h3', '🃏 카드 난이도'),
      tierRules),
    h('section.lobby-center',
      notice,
      h('div.kicker', 'AI 동아리 오픈랩'),
      h('h1', 'AI를 속여라!'),
      h('p.lobby-lead', '같은 미션으로 ', h('b.c-low', '하위 모델'), '과 ', h('b.c-top', '최상위 모델'), '을', h('br'), '차례로 속여 보세요. ', h('b', '질문을 적게 쓸수록'), ' 별이 많아요.'),
      h('div.start-card',
        h('label.start-label', { for: 'nick' }, '🎮 닉네임을 쓰고 바로 시작!'),
        input,
        startBtn,
        err,
        limits)),
    h('div.lobby-side', board.el));

  return { el, focus: () => input.focus(), cleanup: board.cleanup };
}

const how = (icon, title, sub) => h('li.how-step', h('span.how-icon', icon), h('span.how-text', h('b', title), h('small', sub)));
