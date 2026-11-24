// 게임 규칙 설정. 사이트와 Cloudflare Worker(기록 검사)가 함께 쓴다. 브라우저 전용 기능을 쓰지 말 것.
// 규칙을 바꾼 뒤에는 Worker도 다시 배포해야 기록 검사가 맞는다 (cd worker && npx wrangler deploy).

// 한 사람이 할 수 있는 세트 수 (세트 = 미션 뽑기 → 하위 모델 → 최상위 모델). 2 또는 3 추천
export const SETS_PER_PLAYER = 3;

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

// 미션 카드: 한 번에 보여 주는 장수, 세트마다 다시 뽑기 횟수
export const CARDS_PER_DRAW = 3;
export const REROLLS_PER_SET = 1;

export const NICKNAME_MAX = 12;

// q번째 질문에서 속이면 받는 별 (속이지 못하면 0)
export function starsFor(q) {
  return STAR_RULES.find((r) => q <= r.max)?.stars ?? 0;
}

export const MAX_STARS = STAR_RULES[0].stars;

// 닉네임 검사. 문제가 있으면 안내 문구, 없으면 null
const BAD_WORDS = ['시발', '씨발', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '좆', '존나', '개새', '새끼', '꺼져', '닥쳐', '미친', 'fuck', 'shit', 'bitch', 'sex', '섹스', '느금', '애미', '애비'];
export function checkNickname(name) {
  const n = typeof name === 'string' ? name.trim() : '';
  if (!n) return '닉네임을 입력해 주세요.';
  if ([...n].length > NICKNAME_MAX) return `닉네임은 ${NICKNAME_MAX}자까지예요.`;
  const flat = n.toLowerCase().replace(/[\s._\-*]/g, '');
  if (BAD_WORDS.some((w) => flat.includes(w))) return '다른 닉네임을 써 주세요.';
  return null;
}
