// 게임 규칙. 사이트와 Cloudflare Worker(기록 검사)가 함께 쓴다. 브라우저 전용 기능을 쓰지 말 것.
// 고정 규칙(질문 수, 별 기준)은 여기서 바꾸고 Worker도 다시 배포한다 (cd worker && npx wrangler deploy).
// 행사 중에 바꿀 수 있는 설정(세트 수, 다시 돌리기, 보너스 등)은 관리자 패널에서 바꾼다 → DEFAULT_SETTINGS는 처음 값.

// 모델 하나에게 할 수 있는 질문 수
export const MAX_QUESTIONS = 8;

// 질문 수에 따른 별: 이 개수 이하로 속이면 그 별 (위에서부터 확인)
export const STAR_RULES = [
  { max: 4, stars: 3 },
  { max: 6, stars: 2 },
  { max: 8, stars: 1 },
];

// 질문 한 개의 최대 글자 수
export const MAX_QUESTION_CHARS = 300;

export const NICKNAME_MAX = 12;

// q번째 질문에서 속이면 받는 별 (속이지 못하면 0)
export function starsFor(q) {
  return STAR_RULES.find((r) => q <= r.max)?.stars ?? 0;
}

export const MAX_STARS = STAR_RULES[0].stars;

// ── 관리자 패널에서 바꾸는 설정 ──
export const DEFAULT_SETTINGS = {
  sets: 3, // 한 사람이 할 수 있는 세트 수
  rerolls: 1, // 카드 한 장을 세트마다 다시 돌릴 수 있는 횟수
  bonus: { 1: 0, 2: 1, 3: 2 }, // 카드 난이도(쉬움·보통·어려움)별 보너스 별. 속인 모델마다 더한다
  off: [], // 끈 미션 id (카드에 안 나옴)
  notice: '', // 대기 화면 맨 위에 띄울 안내
  idleSec: 90, // 입력이 없을 때 "계속할까요?"를 띄우기까지 걸리는 시간(초)
  boardSize: 10, // 랭킹에 보여 줄 인원
  tipsFrom: 2, // 몇 번째 세트부터 속이기 팁을 보여 줄지 (0이면 안 보여 줌)
};

// 설정값의 허용 범위
export const SETTING_RANGES = {
  sets: [1, 5],
  rerolls: [0, 3],
  bonus: [0, 5],
  idleSec: [30, 600],
  boardSize: [3, 30],
  tipsFrom: [0, 5],
  notice: 80, // 글자 수
};

// 저장된 설정이나 관리자가 보낸 값을 허용 범위 안으로 정리한다 (빠진 값은 기본값)
export function normalizeSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const int = (v, [lo, hi], d) => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  const D = DEFAULT_SETTINGS;
  const R = SETTING_RANGES;
  return {
    sets: int(s.sets, R.sets, D.sets),
    rerolls: int(s.rerolls, R.rerolls, D.rerolls),
    bonus: Object.fromEntries([1, 2, 3].map((t) => [t, int(s.bonus?.[t], R.bonus, D.bonus[t])])),
    off: Array.isArray(s.off) ? [...new Set(s.off.filter((id) => typeof id === 'string').map((id) => id.slice(0, 30)))].slice(0, 100) : [],
    notice: typeof s.notice === 'string' ? s.notice.trim().slice(0, R.notice) : D.notice,
    idleSec: int(s.idleSec, R.idleSec, D.idleSec),
    boardSize: int(s.boardSize, R.boardSize, D.boardSize),
    tipsFrom: int(s.tipsFrom, R.tipsFrom, D.tipsFrom),
  };
}

// 닉네임 검사. 문제가 있으면 안내 문구, 없으면 null
const BAD_WORDS = ['시발', '씨발', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '좆', '존나', '개새', '새끼', '꺼져', '닥쳐', '미친', 'fuck', 'shit', 'bitch', 'sex', '섹스', '느금', '애미', '애비'];
export function checkNickname(name) {
  const n = typeof name === 'string' ? name.trim() : '';
  if (!n) return '닉네임을 입력해 주세요.';
  if ([...n].length > NICKNAME_MAX) return `닉네임은 ${NICKNAME_MAX}자까지 쓸 수 있어요.`;
  const flat = n.toLowerCase().replace(/[\s._\-*]/g, '');
  if (BAD_WORDS.some((w) => flat.includes(w))) return '다른 닉네임으로 해 주세요.';
  return null;
}
