#!/usr/bin/env node
// Mission 4 — CI 게이트: "이 변경을 합쳐도 되는가?"를 사람이 아니라 스크립트가 판단한다.
//   npm run ci          (종료 코드 0 = 통과, 1 = 실패 — CI 서비스는 종료 코드를 본다)
const { listTests, runTests, coverage } = require("./lib");
const { spawnSync } = require("child_process");
const path = require("path");

// 기준값 근거 (docs/FLAKY_LOG.md CI 기준 표 참고)
//  - 줄 커버리지 90: AI 테스트는 97.57% 였으므로 줄 커버리지는 약한 테스트를 거르지 못한다.
//    그래서 "실행 안 된 코드가 많은 변경"을 막는 최소선으로만 둔다.
//  - 변이 점수 85: AI 테스트 58.2%, 우리 테스트 91% → 그 사이에서 우리 테스트가 통과하고
//    약한 테스트는 막힌다. 동등 변이체(약 3개, 1.5%)와 계약서에 없는 동작으로 못 죽이는 몫을 감안한 여유.
const THRESHOLDS = {
  lineCoverage: 90, // 대상 소스의 평균 줄 커버리지(%)
  mutationScore: 85, // 공개 변이 도구의 변이 점수(%)
};

const results = [];
function step(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? "✔" : "✘"} ${name} — ${detail}`);
}

// 1단계: 테스트가 통과한다
const t = runTests(listTests("my_tests"));
step("테스트", t.ok, `${t.pass}/${t.tests - t.todo} 통과 (todo ${t.todo}개 제외)`);

// 2단계: 줄 커버리지가 기준 이상이다
const cov = coverage(listTests("my_tests"));
const line = Number(cov.line);
step(
  "줄 커버리지",
  line >= THRESHOLDS.lineCoverage,
  Number.isNaN(line) ? "측정 실패" : `${line.toFixed(2)}% (기준 ${THRESHOLDS.lineCoverage}% 이상)`
);

// 3단계: 변이 점수가 기준 이상이다
const m = spawnSync(process.execPath, [path.join(__dirname, "mutate.js"), "--json"], {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
let score = NaN;
if (m.status !== 2) {
  try {
    const out = m.stdout || "";
    score = Number(JSON.parse(out.slice(out.indexOf("{"))).score);
  } catch (e) {
    score = NaN;
  }
}
step(
  "변이 점수",
  score >= THRESHOLDS.mutationScore,
  Number.isNaN(score)
    ? "측정 실패 (원본 코드에서 테스트가 실패했거나 출력을 읽지 못함)"
    : `${score}% (기준 ${THRESHOLDS.mutationScore}% 이상)`
);

// 4단계: 불안정 검사 — flaky_tests 를 10번 반복해 한 번도 실패하지 않는가?
const r = spawnSync(process.execPath, [path.join(__dirname, "repeat.js"), "flaky_tests", "--times", "10", "--json"], {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
step("불안정 검사", r.status === 0, r.status === 0 ? "flaky_tests 10회 반복 통과" : "반복 실행 중 실패가 있음");

const failed = results.some((x) => !x.ok);
console.log(failed ? "\nCI 실패" : "\nCI 통과");
process.exit(failed ? 1 : 0);