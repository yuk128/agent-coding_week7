# 불안정(flaky) 테스트 기록 (Mission 4)

측정: `npm run repeat -- flaky_tests/<파일>.test.js --times 30`

| 테스트 파일 | 수정 전 실패율 | 원인 가설 | 확인한 근거(어떻게 알았나) | 고친 방법 | 수정 후 실패율(30회 이상) |
|---|---|---|---|---|---|
| random_quantity.test.js | | | | | |
| real_clock.test.js | | | | | |
| shared_state.test.js | | | | | |

## 원인 유형 정리 (팀이 직접 쓴다)
- 무작위 · 시간 · 실행 순서 · 공유 상태 · 외부 시스템 중 우리가 만난 원인은?
- 앞으로 불안정 테스트를 예방하려고 AGENTS.md 에 추가할 규칙은?

## CI 기준 (scripts/ci.js)
| 항목 | 기준값 | 근거(ai_tests 의 값 vs my_tests 의 값) |
|---|---|---|
| 줄 커버리지 | | |
| 변이 점수 | | |
