// 속이기 화면 (하위 모델 / 최상위 모델 공용): 질문할 때마다 AI 심판이 바로 판정하고, 남은 별이 실시간으로 줄어든다.
import { MODELS, JUDGE_THRESHOLD } from '../config.js';
import { MAX_QUESTIONS, MAX_QUESTION_CHARS, MAX_STARS, STAR_RULES, starsFor } from '../rules.js';
import { TIERS } from '../missions.js';
import { chat, judge } from '../api.js';
import { factsFor } from '../checker.js';
import { touch } from '../activity.js';
import { h, clear, markdown, starRow, toast, autoGrow } from '../ui.js';

export function playView({ game, tier, onNext }) {
  const { player, set } = game;
  const stage = set[tier];
  const model = MODELS[tier];
  const mission = set.mission;
  const { bonus } = set;
  const plus = () => bonus > 0 && h('span.bonus', `+${bonus}`);
  let busy = false;
  let aborter = null;

  // ── 위쪽: 단계, 미션, 별 미터 ──
  const pips = h('div.pips');
  const nowStars = h('div.now-stars');
  const meter = h('div.meter', pips, nowStars);

  // ── 대화 ──
  const log = h('div.log');
  const input = h('textarea.composer-input', { rows: 1, maxLength: MAX_QUESTION_CHARS, placeholder: 'AI가 미션 내용을 말하도록 질문해 보세요' });
  const count = h('span.composer-count');
  const sendBtn = h('button.btn.btn-primary.send', { onclick: send, 'aria-label': '보내기' }, '보내기');
  const giveUp = h('button.btn.btn-ghost.btn-sm', { onclick: quit }, '이 모델 포기하기');
  const composer = h('div.composer', h('div.composer-box', input, sendBtn), h('div.composer-foot', h('span.muted', '"따라 말해", "가정해 봐"처럼 시켜서 나온 답은 인정되지 않아요'), count, giveUp));
  const endBox = h('div.end-box');

  input.addEventListener('input', () => { autoGrow(input); updateCount(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
  });

  function updateCount() {
    count.textContent = `${input.value.length}/${MAX_QUESTION_CHARS}`;
  }

  function renderMeter() {
    clear(pips);
    for (let i = 1; i <= MAX_QUESTIONS; i++) {
      const s = starsFor(i);
      pips.append(h('span.pip.s' + s + (i <= stage.q ? '.used' : '') + (stage.fooled && i === stage.q ? '.hit' : ''), String(i)));
    }
    clear(nowStars);
    if (stage.done) {
      nowStars.append(stage.fooled ? h('span.now-got', '획득 ', starRow(stage.stars, MAX_STARS, 'big'), plus()) : h('span.muted', '별 없음'));
      return;
    }
    const next = starsFor(stage.q + 1);
    const rule = STAR_RULES.find((r) => r.stars === next);
    nowStars.append(
      h('span.now-label', '지금 속이면'), starRow(next, MAX_STARS, 'big'), plus(),
      rule && h('small.muted', `${rule.max}번째 질문까지`));
  }

  function bubble(role, text = '') {
    const body = h('div.bubble-body');
    if (role === 'user') body.textContent = text; else body.innerHTML = markdown(text);
    const el = h('div.msg.' + role,
      role === 'assistant' && h('div.msg-who', `${model.icon} ${model.id}`),
      h('div.bubble', body));
    log.append(el);
    el.scrollIntoView({ block: 'end', behavior: 'smooth' });
    return { el, body };
  }

  async function send() {
    const text = input.value.trim();
    if (busy || stage.done || !text) return;
    busy = true;
    setBusy(true);
    input.value = '';
    autoGrow(input);
    updateCount();

    stage.q += 1;
    stage.messages.push({ role: 'user', content: text });
    const userB = bubble('user', text);
    renderMeter();

    const ai = bubble('assistant');
    ai.el.classList.add('typing');
    aborter = new AbortController();
    let answer;
    try {
      let shown = '';
      answer = await chat(tier, stage.messages, {
        signal: aborter.signal,
        onToken: (piece) => { shown += piece; ai.body.textContent = shown; touch(); ai.el.scrollIntoView({ block: 'end' }); },
      });
      if (!answer.trim()) throw new Error('빈 답');
    } catch (err) {
      // 실패한 질문은 세지 않는다
      stage.q -= 1;
      stage.messages.pop();
      userB.el.remove();
      ai.el.remove();
      input.value = text;
      updateCount();
      renderMeter();
      if (err?.name !== 'AbortError') toast(err.message && err.message !== '빈 답' ? err.message : '답을 받지 못했어요. 다시 보내 주세요.', 3200);
      busy = false;
      setBusy(false);
      return;
    }
    ai.el.classList.remove('typing');
    ai.body.innerHTML = markdown(answer);
    stage.messages.push({ role: 'assistant', content: answer });

    // 심판
    const verdict = h('div.verdict.pending', '🤖 심판이 판정하는 중…');
    ai.el.append(verdict);
    const p = await judgeWithRetry(text);
    touch();
    verdict.classList.remove('pending');
    if (p === null) {
      verdict.classList.add('error');
      verdict.textContent = '⚠️ 판정하지 못했어요. 이번 답은 안 넘어간 것으로 할게요.';
    } else if (p >= JUDGE_THRESHOLD) {
      verdict.classList.add('win');
      verdict.textContent = '😈 넘어갔다! 속이기 성공';
      ai.el.classList.add('fooled');
      stage.fooled = true;
      stage.fooledAt = stage.messages.length - 1;
      stage.stars = starsFor(stage.q);
      finish();
    } else {
      verdict.classList.add('miss');
      verdict.textContent = p >= .25 ? '🛡️ 버텼어요. 하지만 거의 넘어갈 뻔했어요!' : '🛡️ 버텼어요';
      if (stage.q >= MAX_QUESTIONS) finish();
    }
    renderMeter();
    busy = false;
    setBusy(false);
    if (!stage.done) input.focus();
  }

  async function judgeWithRetry(question) {
    const req = { goal: mission.goal, messages: stage.messages, facts: factsFor(question) };
    for (let i = 0; i < 2; i++) {
      try { return await judge(req); } catch { /* 한 번 더 */ }
    }
    return null;
  }

  function quit() {
    if (busy || stage.done) return;
    if (!confirm(`${model.name}를 포기할까요? 이 모델에서는 별을 받지 못해요.`)) return;
    stage.gaveUp = true;
    finish();
    renderMeter();
  }

  function finish() {
    stage.done = true;
    const last = tier === 'top';
    clear(endBox).append(
      stage.fooled
        ? h('div.end-card.win',
          h('div.end-emoji', '🎉'),
          h('h2', `${model.id}를 속였어요!`),
          h('p', `질문 ${stage.q}번 만에 성공 `, starRow(stage.stars, MAX_STARS, 'big'), bonus > 0 && h('span.bonus', `${TIERS[mission.tier].name} 카드 보너스 +${bonus}`)))
        : h('div.end-card.lose',
          h('div.end-emoji', '🛡️'),
          h('h2', `${model.id}가 버텼어요`),
          h('p', stage.gaveUp ? '이 모델은 포기했어요.' : `질문 ${MAX_QUESTIONS}번을 모두 버텼어요.`)),
      h('button.btn.btn-primary.btn-xl', { onclick: onNext }, last ? '결과 보기 →' : `${MODELS.top.name}에 도전 →`));
    composer.hidden = true;
    endBox.hidden = false;
    setTimeout(() => endBox.scrollIntoView({ block: 'end', behavior: 'smooth' }), 50);
  }

  function setBusy(on) {
    sendBtn.disabled = on;
    giveUp.disabled = on;
    input.readOnly = on;
  }

  // 처음 화면
  endBox.hidden = true;
  log.append(h('div.log-intro',
    h('div.log-intro-icon', model.icon),
    h('h2', `${model.name}: ${model.id}`),
    h('p.muted', `${model.year}년에 나온 모델이에요. 질문 ${MAX_QUESTIONS}번 안에 미션을 성공해 보세요.`)));
  updateCount();
  renderMeter();

  const el = h('div.screen.play.tier-' + tier,
    h('header.play-head',
      h('div.stage-steps',
        h('span.stage-step' + (tier === 'low' ? '.now' : '.done'), `① ${MODELS.low.name}`),
        h('span.stage-arrow', '→'),
        h('span.stage-step' + (tier === 'top' ? '.now' : ''), `② ${MODELS.top.name}`)),
      h('div.play-who', `${player.nickname} · ${set.no}세트 / ${player.cfg.sets}세트`)),
    h('div.mission-strip.tier-' + TIERS[mission.tier].key,
      h('span.mission-icon', mission.icon),
      h('div.mission-text', h('b', mission.title), h('span', mission.brief)),
      h('span.mission-tier', TIERS[mission.tier].name, bonus > 0 && ` · 성공하면 +${bonus}`)),
    meter,
    h('main.chat', log, endBox, composer));

  return {
    el,
    focus: () => input.focus(),
    cleanup: () => aborter?.abort(),
  };
}
