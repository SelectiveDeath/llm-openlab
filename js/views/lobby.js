// 대기 화면: 게임 소개 + 닉네임 입력 + 실시간 랭킹
import { MODELS } from '../config.js';
import { SETS_PER_PLAYER, MAX_QUESTIONS, STAR_RULES, NICKNAME_MAX, checkNickname } from '../rules.js';
import { h, starRow } from '../ui.js';
import { boardPanel } from '../board.js';

export function lobbyView({ onStart }) {
  const input = h('input.input.nick-input', { maxLength: NICKNAME_MAX * 2, placeholder: '닉네임', autocomplete: 'off', spellcheck: false });
  const err = h('p.nick-error');
  const start = () => {
    const problem = checkNickname(input.value);
    if (problem) { err.textContent = problem; input.focus(); return; }
    onStart(input.value.trim());
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) start(); });
  input.addEventListener('input', () => { err.textContent = ''; });

  const board = boardPanel();

  const el = h('div.screen.lobby',
    h('section.lobby-hero',
      h('div.kicker', 'AI 동아리 오픈랩'),
      h('h1', h('span.grad', 'AI를 속여라!')),
      h('p.lobby-lead', '같은 미션으로 ', h('b.c-low', '하위 모델'), '과 ', h('b.c-top', '최상위 모델'), '을 차례로 속여 보세요.', h('br'), h('b', '적은 질문'), '으로 속일수록 별이 많아요.'),
      h('div.how',
        how('🃏', '미션 카드 뽑기', '3장 중 하나를 골라요'),
        how(MODELS.low.icon, `${MODELS.low.name} 속이기`, `${MODELS.low.id} · ${MODELS.low.year}`),
        how(MODELS.top.icon, `${MODELS.top.name} 속이기`, `${MODELS.top.id} · ${MODELS.top.year}`)),
      h('div.star-rules',
        STAR_RULES.map((r) => h('span.star-rule', starRow(r.stars), ` 질문 ${r.max}개 이하`)),
        h('span.star-rule.muted', `모델마다 질문 ${MAX_QUESTIONS}개 · 한 사람 ${SETS_PER_PLAYER}세트까지`)),
      h('div.nick-box', input, h('button.btn.btn-primary.btn-xl', { onclick: start }, '시작하기 →')),
      err),
    board.el);

  return { el, focus: () => input.focus(), cleanup: board.cleanup };
}

const how = (icon, title, sub) => h('div.how-step', h('span.how-icon', icon), h('b', title), h('small', sub));
