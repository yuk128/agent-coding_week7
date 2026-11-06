#!/usr/bin/env node
// 같은 테스트를 여러 번 반복 실행해 '가끔 실패하는지(flaky)'를 확인한다.
//   node scripts/repeat.js flaky_tests/random_quantity.test.js          # 30회
//   node scripts/repeat.js flaky_tests --times 50 --jobs 4              # 폴더 전체, 50회
//   node scripts/repeat.js my_tests --times 10 --json
// 매번 새 프로세스로 실행하므로 무작위 값 · 실제 시간 · 실행 순서의 영향이 그대로 나타난다.
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { ROOT, listTests } = require("./lib");

const a = process.argv.slice(2);
const target = a.find((x) => !x.startsWith("--") && a[a.indexOf(x) - 1] !== "--times" && a[a.indexOf(x) - 1] !== "--jobs");
const opt = (n, d) => { const i = a.indexOf("--" + n); return i >= 0 ? Number(a[i + 1]) : d; };
const times = opt("times", 30), jobs = Math.max(1, opt("jobs", Math.min(4, os.cpus().length)));
if (!target) { console.error("사용: node scripts/repeat.js <테스트 파일 또는 폴더> [--times 30] [--jobs 4] [--json]"); process.exit(1); }
const abs = path.resolve(ROOT, target);
const files = fs.existsSync(abs) && fs.statSync(abs).isDirectory() ? listTests(target) : [abs];
if (!files.length || !fs.existsSync(files[0])) { console.error(`테스트 파일을 찾을 수 없습니다: ${target}`); process.exit(1); }

function once() {
  return new Promise((resolve) => {
    const c = spawn(process.execPath, ["--test", "--test-reporter=tap", ...files], { cwd: ROOT });
    let out = ""; c.stdout.on("data", (d) => (out += d)); c.stderr.on("data", (d) => (out += d));
    c.on("close", (code) => resolve({ code, out }));
  });
}
(async () => {
  let next = 0; const res = [];
  await Promise.all(Array.from({ length: jobs }, async () => { while (next < times) { next++; res.push(await once()); } }));
  const failed = res.filter((r) => r.code !== 0);
  const names = {};
  for (const r of failed) for (const m of r.out.matchAll(/^not ok \d+ - (.+)$/gm)) names[m[1]] = (names[m[1]] || 0) + 1;
  const report = { target, runs: res.length, passed: res.length - failed.length, failed: failed.length, failureRate: Math.round((failed.length / res.length) * 1000) / 10, failingTests: names };
  if (a.includes("--json")) { console.log(JSON.stringify(report, null, 2)); process.exit(failed.length ? 1 : 0); }
  console.log(`\n${target} — ${res.length}회 실행: 통과 ${report.passed}, 실패 ${report.failed} (실패율 ${report.failureRate}%)`);
  for (const [n, c] of Object.entries(names)) console.log(`  실패한 테스트: ${n}  (${c}회)`);
  const first = failed[0]?.out.split("\n").filter((l) => /error:|expected|actual|AppError|code:/i.test(l)).slice(0, 6);
  if (first && first.length) console.log("\n실패 예시:\n  " + first.join("\n  "));
  if (!failed.length) console.log("항상 통과했습니다. 횟수를 늘려도 통과하는지 확인하세요.");
  process.exit(failed.length ? 1 : 0);
})();
