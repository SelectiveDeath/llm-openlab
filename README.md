# 😈 AI를 속여라! · LLM 오픈랩

AI 동아리 공유회(오픈랩) 체험용 사이트. 같은 미션으로 **하위 모델**과 **최상위 모델**을 차례로 속여 보고 차이를 비교한다.

- 체험: https://selectivedeath.github.io/llm-openlab/
- 연습 모드(가짜 답변, 비용 0, 이 브라우저에만 랭킹 저장): https://selectivedeath.github.io/llm-openlab/?mock
- 관리자: https://selectivedeath.github.io/llm-openlab/admin.html

## 체험 흐름

1. **대기 화면**: 실시간 랭킹 + 닉네임 입력
2. **미션 카드 뽑기**: 실버(쉬움)·골드(보통)·프리즘(어려움) 카드 3장 중 하나 (세트마다 다시 뽑기 1번)
3. **하위 모델** `gpt-4o-mini` 속이기 → 4. **최상위 모델** `gpt-6-astra` 속이기 (같은 미션)
5. **세트 결과 + 현재 랭킹** → 한 세트 더 / 다음 사람

- 모델마다 질문 8개. 답이 올 때마다 AI 심판(`gpt-5.4-mini`)이 바로 판정
- 별: 질문 4개 이하 ⭐⭐⭐ · 6개 이하 ⭐⭐ · 8개 이하 ⭐ · 실패 0
- 랭킹: 한 사람의 **최고 세트**(두 모델 별 합, 최대 6) → 같으면 질문 수가 적은 순
- 90초 동안 입력이 없으면 확인창, 30초 더 없으면 대기 화면으로

## 설정 바꾸기

| 바꿀 것 | 위치 |
|---|---|
| 세트 수(2·3), 질문 수, 별 기준, 다시 뽑기 횟수 | `js/rules.js` (바꾼 뒤 Worker도 다시 배포) |
| 미션 카드 | `js/missions.js` (바꾼 뒤 Worker도 다시 배포) |
| 화면에 보이는 모델 이름, 방치 시간, 랭킹 새로고침 | `js/config.js` |
| 실제로 호출하는 모델 | `worker/wrangler.toml`의 `LOW_MODEL`, `TOP_MODEL`, `JUDGE_MODEL` |

## 구조

- 바닐라 HTML/CSS/JS 모듈, 빌드 없음. GitHub Pages로 배포
- `worker/`: Cloudflare Worker `llm-openlab` (OpenAI 중계, 심판, 랭킹) + D1 데이터베이스 `llm-openlab` (`worker/schema.sql`)
- 비밀값(커밋 금지): `OPENAI_API_KEY`, `ADMIN_PASSWORD` → `cd worker && npx wrangler secret put 이름`

## 배포

```sh
python tools/cachebust.py          # JS 문법 검사 + 캐시 버전 붙이기 (커밋 전에 항상)
cd worker && npx wrangler@4.127.1 deploy
git push                           # GitHub Pages
```

## 행사 전후

- 행사 전: 관리자 패널에서 **랭킹 초기화**, 연습 기록이 없는지 확인
- 행사 중: 부적절한 닉네임은 관리자 패널에서 **숨기기**
- 행사 후: 관리자 패널에서 **체험 끄기** (OpenAI 호출 차단), OpenAI 키 삭제
