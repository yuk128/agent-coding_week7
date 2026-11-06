#!/usr/bin/env node
// 대상 소스(src/ 의 cart · order · payment · cancel · orderQuery · expiry · util)의 커버리지를 보여 준다.
//   node scripts/coverage.js                 # my_tests/
//   node scripts/coverage.js --tests ai_tests
//   node scripts/coverage.js --json
const { listTests, coverage } = require("./lib");
const a = process.argv.slice(2);
const i = a.indexOf("--tests"); const dir = i >= 0 ? a[i + 1] : "my_tests";
const files = listTests(dir);
if (files.length === 0) { console.error(`'${dir}/' 에 *.test.js 파일이 없습니다.`); process.exit(1); }
const c = coverage(files);
if (!c.ok) { console.error("테스트가 실패해 커버리지를 계산하지 못했습니다. 먼저 테스트를 통과시키세요."); process.exit(2); }
if (a.includes("--json")) { const { out, ...rest } = c; console.log(JSON.stringify(rest, null, 2)); process.exit(0); }
console.log(`\n커버리지 (${dir}/) — 테스트 ${c.tests}개\n`);
console.log("파일          줄%     분기%   함수%   실행되지 않은 줄");
for (const [n, v] of Object.entries(c.files)) console.log(`${(n + ".js").padEnd(14)}${String(v.line).padEnd(8)}${String(v.branch).padEnd(8)}${String(v.funcs).padEnd(8)}${v.uncovered}`);
console.log(`\n평균          ${String(c.line).padEnd(8)}${String(c.branch).padEnd(8)}${c.funcs}`);
