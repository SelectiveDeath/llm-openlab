// 관리자 패널: 체험 켜기/끄기, 부적절한 닉네임 숨기기, 랭킹 초기화
// 비밀번호는 이 탭(sessionStorage)에만 기억한다.
import { admin } from './api.js';
import { MAX_SET_POINTS } from './ranking.js';
import { h, clear, toast } from './ui.js';

const root = document.getElementById('admin');
const PW_KEY = 'llm-openlab:admin';
let password = sessionStorage.getItem(PW_KEY) || '';

async function call(body = {}) {
  try {
    const data = await admin({ password, action: 'get', ...body });
    if (data.error) throw new Error(data.error);
    sessionStorage.setItem(PW_KEY, password);
    render(data);
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

function render(data) {
  const players = data.players ?? [];
  clear(root).append(h('div.admin',
    h('header.admin-head',
      h('h1', '🎛 오픈랩 관리자'),
      h('div.admin-actions',
        h('button.btn' + (data.enabled ? '.on' : '.off'), { onclick: () => call({ action: 'enable', on: !data.enabled }) },
          data.enabled ? '🟢 체험 켜짐 (끄기)' : '🔴 체험 꺼짐 (켜기)'),
        h('button.btn', { onclick: () => call() }, '🔄 새로고침'),
        h('button.btn.danger', { onclick: reset }, '🗑 랭킹 초기화'))),
    h('p.muted', `참가 ${players.length}명 · 세트 기록 ${data.sets}개`),
    h('table.admin-table',
      h('thead', h('tr', h('th', '순위'), h('th', '닉네임'), h('th', '점수'), h('th', '질문'), h('th', '하위/최상위'), h('th', ''))),
      h('tbody', players.map((p) => h('tr' + (p.hidden ? '.hidden-row' : ''),
        h('td', String(p.rank)), h('td', p.nickname), h('td', `★ ${p.points} / ${MAX_SET_POINTS}`), h('td', String(p.q)),
        h('td', `${p.lowStars} / ${p.topStars}`),
        h('td', h('button.btn.btn-sm', { onclick: () => call({ action: 'hide', player: p.player, hidden: !p.hidden }) },
          p.hidden ? '다시 보이기' : '숨기기'))))))));
}

async function reset() {
  if (!confirm('랭킹 기록을 모두 지울까요? 되돌릴 수 없어요.')) return;
  call({ action: 'reset' });
}

password ? call() : login();
