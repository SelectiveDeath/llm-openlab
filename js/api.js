// Worker 호출: 채팅(스트리밍), 심판, 기록 등록, 랭킹. ?mock 이면 mock.js의 가짜 응답을 쓴다.
import { WORKER_URL, MOCK } from './config.js';
import * as mock from './mock.js';

export class ApiError extends Error {}

async function post(body, { signal, timeout = 60000 } = {}) {
  const t = AbortSignal.timeout(timeout);
  const combined = signal ? AbortSignal.any([signal, t]) : t;
  let res;
  try {
    res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: combined,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    if (t.aborted) throw new ApiError('답변이 너무 오래 걸려요. 다시 보내 주세요.');
    throw new ApiError('인터넷 연결을 확인해 주세요.');
  }
  if (!res.ok) throw new ApiError(errorMessage(res.status, await res.text().catch(() => '')));
  return res;
}

// 채팅. tier: 'low' | 'top'. onToken(조각)으로 실시간 전달하고, 끝나면 전체 답변을 돌려준다.
export async function chat(tier, messages, { onToken, signal } = {}) {
  if (MOCK) return mock.chat(tier, messages, { onToken, signal });
  const res = await post({ tier, messages }, { signal, timeout: 90000 });
  return readStream(res, onToken);
}

// 심판: AI의 마지막 답이 미션을 달성했을 확률 (0~1)
export async function judge({ goal, messages, facts }) {
  const payload = {
    goal,
    messages: messages.slice(-10).map(({ role, content }) => ({ role, content: content.slice(0, 4000) })),
    ...(facts ? { facts } : {}),
  };
  if (MOCK) return mock.judge(payload);
  const data = await (await post({ judge: payload }, { timeout: 30000 })).json();
  if (typeof data.success !== 'number') throw new ApiError('판정 결과를 읽지 못했어요.');
  return data.success;
}

// 세트 기록 등록 → 등록 뒤의 랭킹
export async function submitSet(record) {
  if (MOCK) return mock.submitSet(record);
  return (await post({ score: record }, { timeout: 15000 })).json();
}

// 랭킹 조회. player를 주면 그 사람의 순위도 함께
export async function fetchBoard(player = null) {
  if (MOCK) return mock.board(player);
  return (await post({ board: { player } }, { timeout: 10000 })).json();
}

// 관리자 패널
export async function admin(body) {
  if (MOCK) return mock.admin(body);
  return (await post({ admin: body }, { timeout: 15000 })).json();
}

function errorMessage(status, text) {
  // Worker가 보낸 한국어 안내 문구가 있으면 그대로 보여 준다
  try {
    const msg = JSON.parse(text).error;
    if (typeof msg === 'string' && /[가-힣]/.test(msg)) return msg;
  } catch { /* JSON이 아니면 아래 기본 문구 */ }
  if (status === 429) return '지금 요청이 너무 많아요. 10초 정도 기다렸다가 다시 보내 주세요.';
  if (status === 401 || status === 403) return 'AI 연결에 문제가 생겼어요. 동아리원에게 알려 주세요.';
  if (status === 400 && /policy/i.test(text)) return '이 질문은 보낼 수 없어요. 다른 질문으로 도전해 보세요.';
  if (status >= 500) return 'AI 서버에 잠깐 문제가 생겼어요. 다시 보내 주세요.';
  return `오류 (${status})`;
}

// OpenAI 스트리밍 형식(SSE: "data: {...}" 줄) 읽기
async function readStream(res, onToken) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '', full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      const data = line.trim();
      if (!data.startsWith('data:')) continue;
      const payload = data.slice(5).trim();
      if (payload === '[DONE]') return full;
      try {
        const piece = JSON.parse(payload).choices?.[0]?.delta?.content;
        if (piece) { full += piece; onToken?.(piece); }
      } catch { /* 잘린 줄은 무시 */ }
    }
  }
  return full;
}
