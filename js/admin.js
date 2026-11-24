// 관리자 패널: 체험 켜기/끄기, 게임 설정, 미션 카드 켜기/끄기, 현황·통계, 참가자 관리, 기록 내려받기, 초기화
// 비밀번호는 이 탭(sessionStorage)에만 기억한다. 바꾼 설정은 체험 노트북에 5초 안에 반영된다.
import { admin } from './api.js';
import { MODELS } from './config.js';
import { DEFAULT_SETTINGS, SETTING_RANGES } from './rules.js';
import { TIERS, MISSIONS, missionById } from './missions.js';
import { maxSetPoints } from './ranking.js';
import { h, clear, toast } from './ui.js';

const root = document.getElementById('admin');
const PW_KEY = 'llm-openlab:admin';
let password = sessionStorage.getItem(PW_KEY) || '';
let data = null;

async function call(body = {}, done = '') {
  try {
    const res = await admin({ password, action: 'get', ...body });
    if (res.error) throw new Error(res.error);
    sessionStorage.setItem(PW_KEY, password);
    data = res;
    render();
    if (done) toast(done);
  } catch (err) {
    if (/비밀번호/.test(err.message)) { sessionStorage.removeItem(PW_KEY); password = ''; login(err.message); }
    else toast(err.message, 3200);
  }
}

function login(error = '') {
  const input = h('input.input', { type: 'password', placeholder: '관리자 비밀번호' });
  const go = () => { password = input.value; call(); };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  clear(root).append(h('div.admin-login',
    h('h1', '🎛 오픈랩 관리자'), input, error && h('p.nick-error', error),
    h('button.btn.btn-primary', { onclick: go }, '들어가기')));
  input.focus();
}

const pct = (v) => (v === null || v === undefined ? '-' : `${Math.round(v * 100)}%`);
const num = (v) => (v === null || v === undefined ? '-' : v.toFixed(1));

function render() {
  const { settings: st } = data;
  clear(root).append(h('div.admin',
    h('header.admin-head',
      h('h1', '🎛 오픈랩 관리자'),
      h('div.admin-actions',
        h('button.btn.toggle' + (data.enabled ? '.on' : '.off'), { onclick: () => call({ action: 'enable', on: !data.enabled }, data.enabled ? '체험을 껐어요' : '체험을 켰어요') },
          data.enabled ? '🟢 체험 진행 중 · 끄기' : '🔴 체험 멈춤 · 켜기'),
        h('button.btn', { onclick: () => call({}, '새로 불러왔어요') }, '🔄 새로고침'))),
    h('p.muted.admin-note', '설정을 바꾸면 체험 노트북에 5초 안에 반영돼요. 이미 체험 중인 사람은 끝날 때까지 시작할 때의 설정을 그대로 써요.'),
    statsSection(),
    settingsSection(st),
    missionsSection(st),
    playersSection(st),
    dangerSection()));
}

// ── 현황 ──
function statsSection() {
  const s = data.summary;
  const tile = (label, value, sub = '') => h('div.stat', h('small', label), h('b', value), sub && h('span.muted', sub));
  return section('📊 현황',
    h('div.stats',
      tile('참가자', `${s.players}명`),
      tile('끝낸 세트', `${s.sets}개`),
      tile(`${MODELS.low.name}을 속인 비율`, pct(s.lowRate), s.lowAvgQ ? `평균 질문 ${num(s.lowAvgQ)}번` : ''),
      tile(`${MODELS.top.name}을 속인 비율`, pct(s.topRate), s.topAvgQ ? `평균 질문 ${num(s.topAvgQ)}번` : '')));
}

// ── 게임 설정 ──
function settingsSection(st) {
  const R = SETTING_RANGES;
  const field = (label, input, hint) => h('label.field', h('span.field-label', label), input, hint && h('small.muted', hint));
  const numInput = (value, [lo, hi]) => h('input.input.num', { type: 'number', min: lo, max: hi, value });
  const select = (value, [lo, hi], unit = '') => h('select.input.num', Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
    .map((v) => h('option', { value: v, selected: v === value }, `${v}${unit}`)));

  const sets = select(st.sets, R.sets, '세트');
  const rerolls = select(st.rerolls, R.rerolls, '번');
  const bonus = Object.fromEntries([1, 2, 3].map((t) => [t, select(st.bonus[t], R.bonus, '개')]));
  const idle = numInput(st.idleSec, R.idleSec);
  const boardSize = select(st.boardSize, R.boardSize, '명');
  const tipsFrom = h('select.input.num', Array.from({ length: R.tipsFrom[1] + 1 }, (_, v) =>
    h('option', { value: v, selected: v === st.tipsFrom }, v === 0 ? '안 보여 줌' : `${v}세트부터`)));
  const notice = h('input.input', { value: st.notice, maxLength: R.notice, placeholder: '예) 한 사람당 3세트까지! 뒤에 기다리는 친구를 배려해 주세요' });

  const save = () => call({
    action: 'settings',
    settings: {
      sets: +sets.value, rerolls: +rerolls.value, idleSec: +idle.value, boardSize: +boardSize.value, tipsFrom: +tipsFrom.value, notice: notice.value,
      bonus: Object.fromEntries(Object.entries(bonus).map(([t, el]) => [t, +el.value])),
    },
  }, '설정을 저장했어요');

  return section('⚙️ 게임 설정',
    h('div.fields',
      field('한 사람당 세트 수', sets, '세트 = 미션 고르기 → 하위 모델 → 최상위 모델'),
      field('카드 다시 돌리기', rerolls, '카드 한 장을 세트마다 다시 돌릴 수 있는 횟수 (0이면 버튼이 사라져요)'),
      ...[1, 2, 3].map((t) => field(`${TIERS[t].name} 카드 보너스`, bonus[t], '속인 모델마다 더하는 별')),
      field('속이기 팁', tipsFrom, '대화 화면에 미션 종류에 맞는 팁을 보여 줘요'),
      field('랭킹 표시 인원', boardSize, '대기 화면·결과 화면에 보여 줄 순위 수'),
      field('방치 확인 시간(초)', idle, `입력이 없으면 "계속할까요?"를 띄워요 (${R.idleSec[0]}~${R.idleSec[1]}초)`)),
    field('대기 화면 공지', notice, `대기 화면 맨 위에 보여요. 비우면 안 보여요 (${R.notice}자까지)`),
    h('div.row-actions',
      h('button.btn.btn-primary', { onclick: save }, '💾 설정 저장'),
      h('button.btn', { onclick: () => confirm('설정을 처음 값으로 되돌릴까요? (미션 카드도 모두 켜져요)') && call({ action: 'defaults' }, '처음 설정으로 되돌렸어요') }, '↩ 처음 설정으로'),
      h('span.muted', `지금 한 세트 최고 점수: ★ ${maxSetPoints(st.bonus)} · 처음 설정: ${DEFAULT_SETTINGS.sets}세트, 다시 돌리기 ${DEFAULT_SETTINGS.rerolls}번`)));
}

// ── 미션 카드 ──
function missionsSection(st) {
  const stats = Object.fromEntries(data.missions.map((m) => [m.id, m]));
  const toggle = (m) => {
    const off = st.off.includes(m.id) ? st.off.filter((id) => id !== m.id) : [...st.off, m.id];
    const left = MISSIONS.filter((x) => x.tier === m.tier && !off.includes(x.id)).length;
    if (!left) { toast(`${TIERS[m.tier].name} 카드는 하나 이상 켜 두어야 해요`); render(); return; }
    call({ action: 'settings', settings: { off } }, st.off.includes(m.id) ? `'${m.title}' 카드를 켰어요` : `'${m.title}' 카드를 껐어요`);
  };
  const rows = [1, 2, 3].flatMap((t) => MISSIONS.filter((m) => m.tier === t).map((m) => {
    const s = stats[m.id];
    const on = !st.off.includes(m.id);
    return h('tr' + (on ? '' : '.off-row'),
      h('td', h('input', { type: 'checkbox', checked: on, onchange: () => toggle(m), 'aria-label': `${m.title} 켜기` })),
      h('td', h('span.mission-tier.tier-' + TIERS[t].key, TIERS[t].name)),
      h('td', h('b', `${m.icon} ${m.title}`), h('div.muted.small', m.brief)),
      h('td.c', String(s?.plays ?? 0)),
      h('td.c', pct(s?.lowRate)),
      h('td.c', pct(s?.topRate)));
  }));
  const onCount = MISSIONS.length - st.off.length;
  return section(`🃏 미션 카드 (${onCount}/${MISSIONS.length}장 사용 중)`,
    h('p.muted', '체크를 끄면 그 카드가 더는 나오지 않아요. 너무 쉽거나 어려운 미션을 행사 중에 빼 보세요.'),
    h('div.table-wrap', h('table.admin-table',
      h('thead', h('tr', h('th', '사용'), h('th', '난이도'), h('th', '미션'), h('th.c', '도전'), h('th.c', `${MODELS.low.name} 속인 비율`), h('th.c', `${MODELS.top.name} 속인 비율`))),
      h('tbody', rows))));
}

// ── 참가자 ──
function playersSection(st) {
  const players = data.players ?? [];
  const max = maxSetPoints(st.bonus);
  return section(`🏆 참가자 랭킹 (${players.length}명)`,
    h('p.muted', '숨기면 랭킹에서만 빠지고 기록은 남아요. 지우면 그 사람의 기록이 모두 사라져요.'),
    players.length
      ? h('div.table-wrap', h('table.admin-table',
        h('thead', h('tr', h('th', '순위'), h('th', '닉네임'), h('th', '최고 점수'), h('th', '질문'), h('th', '별 (하위/최상위)'), h('th', '카드'), h('th', ''))),
        h('tbody', players.map((p) => h('tr' + (p.hidden ? '.hidden-row' : ''),
          h('td', String(p.rank)), h('td', h('b', p.nickname)), h('td', `★ ${p.points} / ${max}`), h('td', `${p.q}번`),
          h('td', `${p.lowStars} / ${p.topStars}`), h('td', TIERS[p.tier].name),
          h('td.actions',
            h('button.btn.btn-sm', { onclick: () => call({ action: 'hide', player: p.player, hidden: !p.hidden }, p.hidden ? '다시 보이게 했어요' : '랭킹에서 숨겼어요') }, p.hidden ? '보이기' : '숨기기'),
            h('button.btn.btn-sm.danger', { onclick: () => confirm(`'${p.nickname}'의 기록을 모두 지울까요?`) && call({ action: 'delete', player: p.player }, '기록을 지웠어요') }, '지우기')))))))
      : h('p.empty-line', '아직 기록이 없어요.'));
}

// ── 기록, 초기화 ──
function dangerSection() {
  return section('🗂 기록',
    h('div.row-actions',
      h('button.btn', { onclick: downloadCsv }, '⬇ 전체 기록 내려받기 (CSV)'),
      h('button.btn.danger', { onclick: () => confirm('랭킹 기록을 모두 지울까요? 되돌릴 수 없어요.') && call({ action: 'reset' }, '랭킹을 초기화했어요') }, '🗑 랭킹 초기화')),
    h('p.muted', '행사 전에 연습 기록을 지우려면 랭킹 초기화를 누르세요. 설정은 그대로 남아요.'));
}

function downloadCsv() {
  const head = ['닉네임', '세트', '미션', '난이도', '하위 모델 별', '하위 모델 질문', '최상위 모델 별', '최상위 모델 질문', '숨김', '시각'];
  const rows = (data.records ?? []).map((r) => {
    const m = missionById(r.missionId);
    return [r.nickname, r.setNo ?? '', m?.title ?? r.missionId, m ? TIERS[m.tier].name : '', r.lowStars, r.lowQ, r.topStars, r.topQ, r.hidden ? 'O' : '', new Date(r.at).toLocaleString('ko-KR')];
  });
  const csv = [head, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })), download: `오픈랩-기록-${new Date().toISOString().slice(0, 10)}.csv` });
  a.click();
  URL.revokeObjectURL(a.href);
}

const section = (title, ...children) => h('section.admin-section', h('h2', title), ...children);

password ? call() : login();
