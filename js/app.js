// 오픈랩 체험 진행: 대기 화면 → (미션 뽑기 → 하위 모델 → 최상위 모델 → 세트 결과) × 세트 수 → 대기 화면
// 노트북 한 대를 여러 사람이 돌아가며 쓰므로, 기록은 메모리에만 두고 사람이 바뀌면 모두 지운다.
import { IDLE_MS, IDLE_GRACE_MS, MOCK } from './config.js';
import { SETS_PER_PLAYER } from './rules.js';
import { h, clear } from './ui.js';
import { touch, idleFor } from './activity.js';
import { lobbyView } from './views/lobby.js';
import { drawView } from './views/draw.js';
import { playView } from './views/play.js';
import { resultView } from './views/result.js';

const root = document.getElementById('app');

// 지금 체험 중인 사람과 세트
const game = {
  player: null, // { id, nickname, setsDone, seen: [미션 id] }
  set: null, // { no, mission, low: stage, top: stage }
};

const newStage = () => ({ messages: [], q: 0, stars: 0, done: false, fooled: false, fooledAt: -1 });

let current = null; // 지금 화면의 정리 함수(타이머 해제 등)

function show(view) {
  current?.cleanup?.();
  current = view;
  clear(root).append(view.el);
  root.scrollTop = 0;
  view.focus?.();
}

function goLobby() {
  game.player = null;
  game.set = null;
  show(lobbyView({ onStart: startPlayer }));
}

function startPlayer(nickname) {
  game.player = { id: crypto.randomUUID(), nickname, setsDone: 0, seen: [] };
  goDraw();
}

function goDraw() {
  game.set = { no: game.player.setsDone + 1, mission: null, low: newStage(), top: newStage() };
  show(drawView({
    game,
    onPick: (mission) => {
      game.set.mission = mission;
      game.player.seen.push(mission.id);
      goPlay('low');
    },
  }));
}

function goPlay(tier) {
  show(playView({
    game,
    tier,
    onNext: () => (tier === 'low' ? goPlay('top') : goResult()),
  }));
}

function goResult() {
  game.player.setsDone += 1;
  show(resultView({
    game,
    setsLeft: SETS_PER_PLAYER - game.player.setsDone,
    onAgain: goDraw,
    onQuit: goLobby,
  }));
}

// ── 방치 대비: 입력이 없으면 확인 → 그래도 없으면 대기 화면 ──
let idleBox = null;

setInterval(() => {
  if (!game.player || idleBox) return;
  if (idleFor() < IDLE_MS) return;
  let left = Math.round(IDLE_GRACE_MS / 1000);
  const count = h('b', String(left));
  const close = () => { clearInterval(timer); idleBox?.remove(); idleBox = null; touch(); };
  idleBox = h('div.modal-overlay',
    h('div.modal',
      h('div.modal-emoji', '⏰'),
      h('p.modal-msg', '아직 하고 있나요?'),
      h('p.modal-sub', count, '초 뒤에 처음 화면으로 돌아가요.'),
      h('div.modal-actions',
        h('button.btn', { onclick: () => { close(); goLobby(); } }, '그만하기'),
        h('button.btn.btn-primary', { onclick: close }, '계속할래요'))));
  document.body.append(idleBox);
  const timer = setInterval(() => {
    left -= 1;
    count.textContent = String(left);
    if (left <= 0) { close(); goLobby(); }
  }, 1000);
}, 1000);

if (MOCK) document.body.classList.add('is-mock');
goLobby();
