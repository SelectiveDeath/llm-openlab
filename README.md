# 😈 AI를 속여라! · LLM 오픈랩

AI 동아리 공유회(오픈랩) 체험용 사이트. 같은 미션으로 **하위 모델**과 **최상위 모델**을 차례로 속여 보고 차이를 비교한다.

- 체험: https://selectivedeath.github.io/llm-openlab/
- 연습 모드(가짜 답변, 비용 0, 이 브라우저에만 랭킹 저장): https://selectivedeath.github.io/llm-openlab/?mock
- 관리자: https://selectivedeath.github.io/llm-openlab/admin.html

## 체험 흐름

1. **대기 화면**: 실시간 랭킹 + 닉네임 입력
2. **미션 카드 고르기**: 쉬움·보통·어려움 카드가 한 장씩 슬롯머신처럼 돌다가 멈춤 → 하나 고르기 (미션 30개, 카드마다 다시 돌리기)
3. **하위 모델** `gpt-4o-mini` 속이기 → 4. **최상위 모델** `gpt-6-astra` 속이기 (같은 미션)
5. **세트 결과 + 현재 랭킹** → 한 세트 더 / 다음 사람

- 모델마다 질문 8개. 답이 올 때마다 AI 심판(`gpt-5.4-mini`)이 바로 판정
- 별: 질문 4개 이하 ⭐⭐⭐ · 6개 이하 ⭐⭐ · 8개 이하 ⭐ · 실패 0
- 카드 보너스: 속인 모델마다 쉬움 +0 · 보통 +1 · 어려움 +2 (처음 값, 관리자 패널에서 변경)
- 랭킹: 한 사람의 **최고 세트**(두 모델 별 + 보너스, 최대 10) → 같으면 질문 수가 적은 순
- 90초 동안 입력이 없으면 확인창, 30초 더 없으면 대기 화면으로

## 설정 바꾸기

행사 중에는 **관리자 패널**에서 바꾼다 (체험 노트북에 5초 안에 반영):
체험 켜기/끄기, 한 사람당 세트 수, 카드 다시 돌리기 횟수, 난이도별 보너스, 속이기 팁(처음 값: 2세트부터), 랭킹 표시 인원, 방치 확인 시간, 대기 화면 공지, 미션 카드 켜기/끄기, 참가자 숨기기·지우기, 기록 CSV 내려받기, 랭킹 초기화.

코드로 바꾸는 것:

| 바꿀 것 | 위치 |
|---|---|
| 질문 수, 별 기준, 관리자 설정의 처음 값과 범위 | `js/rules.js` (바꾼 뒤 Worker도 다시 배포) |
| 미션 카드 내용 | `js/missions.js` (바꾼 뒤 Worker도 다시 배포) |
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
