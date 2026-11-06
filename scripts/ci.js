#!/usr/bin/env node
// Mission 4 — CI 게이트: "이 변경을 합쳐도 되는가?"를 사람이 아니라 스크립트가 판단한다.
//   npm run ci          (종료 코드 0 = 통과, 1 = 실패 — CI 서비스는 종료 코드를 본다)
//
// 아래 TODO 를 완성하세요. 완성한 게이트는 두 가지를 모두 만족해야 합니다.
//   (1) 여러분의 테스트(my_tests/)로 실행하면 통과한다.
//   (2) 'AI 가 만든 약한 테스트(ai_tests/)'로 바꿔 넣으면 실패한다.  ← 줄 커버리지만으로는 (2)를 만족하기 어렵다!
const { listTests, runTests, coverage } = require("./lib");
const { spawnSync } = require("child_process");
const path = require("path");

// TODO 1: 팀의 기준을 숫자로 정한다. (근거를 docs/TEST_REPORT.md 에 쓴다)
//   - 너무 낮으면 약한 테스트가 통과하고, 너무 높으면 팀의 테스트도 막힌다.
const THRESHOLDS = {
  lineCoverage: 0, // 대상 소스의 평균 줄 커버리지(%)
  mutationScore: 0, // 공개 변이 도구의 변이 점수(%)
};

const results = [];
function step(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? "✔" : "✘"} ${name} — ${detail}`);
}

// 1단계: 테스트가 통과한다 (제공됨)
const t = runTests(listTests("my_tests"));
step("테스트", t.ok, `${t.pass}/${t.tests - t.todo} 통과 (todo ${t.todo}개 제외)`);

// 2단계: 줄 커버리지가 기준 이상이다
// TODO 2: coverage(listTests("my_tests")) 의 line(평균 줄 %)을 THRESHOLDS.lineCoverage 와 비교해 step() 을 호출한다.

// 3단계: 변이 점수가 기준 이상이다
// TODO 3: spawnSync(process.execPath, [path.join(__dirname, "mutate.js"), "--json"], { encoding: "utf8" }) 로
//         변이 도구를 실행하고, 출력(JSON)의 score 를 THRESHOLDS.mutationScore 와 비교해 step() 을 호출한다.
//         (도구가 원본 테스트 실패로 종료 코드 2 를 돌려주면 이 단계는 실패로 처리한다)

// 4단계(선택): 불안정 검사 — node scripts/repeat.js flaky_tests --times 10 --json 이 통과하는가?

const failed = results.some((r) => !r.ok);
console.log(failed ? "\nCI 실패" : "\nCI 통과");
process.exit(failed ? 1 : 0);
