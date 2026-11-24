// 마지막으로 사람이 무언가를 한 시각 (방치 확인용). AI가 답을 쓰는 동안에도 갱신한다.
let last = Date.now();
export const touch = () => { last = Date.now(); };
export const idleFor = () => Date.now() - last;
for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(ev, touch, { passive: true });
