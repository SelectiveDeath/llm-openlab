// 지금 설정 (관리자 패널에서 바꾼 값). 랭킹을 받아 올 때마다 같이 와서 갱신된다.
// 한 사람이 체험을 시작하면 app.js가 그 순간의 값을 따로 복사해 두고 쓴다 (도중에 바뀌어도 흔들리지 않게).
import { DEFAULT_SETTINGS, normalizeSettings } from './rules.js';

export const settings = { ...normalizeSettings(DEFAULT_SETTINGS), enabled: true };

export function applySettings(s) {
  if (!s) return;
  Object.assign(settings, normalizeSettings(s), { enabled: s.enabled !== false });
}

export const snapshot = () => structuredClone(settings);
