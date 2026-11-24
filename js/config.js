// 사이트 설정. 게임 규칙(세트 수, 질문 수, 별 기준)은 rules.js에 있다.

// OpenAI 중계 서버 (Cloudflare Worker). 키는 Worker에만 있다.
export const WORKER_URL = 'https://llm-openlab.llm-timemachine.workers.dev';

// 화면에 보여 줄 모델 정보 (name 뒤 조사는 받침 기준 "을·은·이"로 써 두었으니, 이름을 바꾸면 조사도 확인) (실제 호출 모델은 Worker의 LOW_MODEL / TOP_MODEL 설정이 정한다)
export const MODELS = {
  low: { id: 'gpt-4o-mini', year: 2024, name: '하위 모델', icon: '📼' },
  top: { id: 'gpt-6-astra', year: 2026, name: '최상위 모델', icon: '🚀' },
};

// 심판이 낸 성공 확률이 이 값 이상이면 "속였다"
export const JUDGE_THRESHOLD = 0.5;

// 아무 입력이 없을 때: 관리자 설정 idleSec 뒤 "계속할까요?" → IDLE_GRACE_MS 뒤 대기 화면으로
export const IDLE_GRACE_MS = 30_000;

// 랭킹 새로고침 간격 (관리자 설정도 이때 같이 받아 온다)
export const BOARD_REFRESH_MS = 5_000;

// 주소에 ?mock 이 있으면 가짜 답변 + 이 브라우저에만 저장되는 랭킹 (연습·테스트용, 비용 0)
export const MOCK = new URLSearchParams(location.search).has('mock');
