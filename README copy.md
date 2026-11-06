# MiniMall 테스트 자동화 실습 — AI 기반 테스트 자동화 미니 프로젝트

AI 활용 소프트웨어 공학 6강 실전 연습용 스타터 프로젝트입니다. (수업용 가상 서비스)
5강의 MiniMall 주문 흐름 코드(`src/`, 완성본)를 대상으로, **테스트를 만들고 · 평가하고 · 자동화**합니다.

## 준비
- Node.js 20 이상 (`node --version`). 패키지 설치는 필요 없습니다. (`npm install` 불필요)
- 터미널과 사용 중인 코딩 에이전트 도구

## 자주 쓰는 명령
```bash
npm test                      # 우리 팀 테스트 (my_tests/)
npm run test:ai               # AI 가 만든 테스트 (ai_tests/)
npm run coverage              # 줄 · 분기 · 함수 커버리지 (npm run coverage -- --tests ai_tests)
npm run mutate                # 변이 테스트: 내 테스트가 숨은 결함을 잡는가 (1~2분)
npm run mutate:ai             # 같은 도구로 AI 테스트를 평가
npm run repeat -- flaky_tests/real_clock.test.js --times 30   # 반복 실행으로 불안정 여부 확인
npm run ci                    # CI 게이트 (Mission 4 에서 완성)
```

## 폴더 안내
| 경로 | 설명 | 수정 |
|---|---|---|
| `src/` | 시험 대상 코드(완성본) | ✗ 읽기 전용 |
| `docs/SRS_발췌.md` · `docs/API_CONTRACT.md` | 요구사항 · 함수 계약서 — **기대값의 근거** | ✗ |
| `ai_tests/` | AI 가 만들었다고 가정한 테스트 — 리뷰 대상 | ✗ |
| `my_tests/` | 우리 팀의 테스트 — 여기에 작성 | ○ |
| `flaky_tests/` | 가끔 실패하는 테스트 3개 — Mission 4 에서 고침 | ○ |
| `scripts/` | 변이 · 반복 · 커버리지 도구. `ci.js` 만 완성 | `ci.js` 만 ○ |
| `docs/TEST_DESIGN.md` `TEST_REVIEW.md` `FLAKY_LOG.md` `TEST_REPORT.md` `PLAN.md` `AI_USAGE_LOG.md` `RETRO.md` | 팀이 작성하는 기록 문서 (제출물) | ○ |
| `AGENTS.md` | 에이전트에게 주는 규칙 (Mission 0 에서 완성) | ○ |

## 미션 순서
Mission 0(기준선 측정) → 1(명세에서 테스트 설계) → 2(AI 테스트 리뷰) → 3(결제 · 환불 테스트) → 4(불안정 테스트 · CI) → 5(변이 생존자 분석) → 도전(선택) → 마무리(보고 · 발표)

미션 설명과 채점 기준은 학생용 문제지(Word)를 보세요.

## 제출
수업 공지의 방식을 따릅니다. 일반적으로 이 폴더(`node_modules` 제외)를 압축한 파일 또는 저장소 링크, 그리고 `docs/` 의 기록 문서를 제출합니다. `src/` 를 고쳐도 채점 때 원본으로 복원됩니다.
