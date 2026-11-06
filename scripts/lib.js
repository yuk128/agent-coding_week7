// 공통 도구 (수정하지 않는다) — 테스트 파일 찾기, 실행, 커버리지 파싱
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
// 변이와 커버리지의 대상이 되는 소스 (공통 도구 errors/pg/seed/testkit/index 는 제외)
const TARGETS = ["cart", "order", "payment", "cancel", "orderQuery", "expiry", "util"];

function listTests(dir) {
  const abs = path.resolve(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const p = path.join(abs, e.name);
    if (e.isDirectory()) out.push(...listTests(path.relative(ROOT, p)));
    else if (e.name.endsWith(".test.js")) out.push(p);
  }
  return out.sort();
}

// node --test 를 실행해 { ok, tests, pass, fail, todo, out } 를 돌려준다.
function runTests(files, { cwd = ROOT, timeout = 120000, env = {}, extraArgs = [], reporter = "tap" } = {}) {
  const r = spawnSync(process.execPath, ["--test", `--test-reporter=${reporter}`, ...extraArgs, ...files], { cwd, encoding: "utf8", timeout, env: { ...process.env, ...env } });
  const out = (r.stdout || "") + (r.stderr || "");
  const num = (k) => { const m = out.match(new RegExp("^(?:# |ℹ )" + k + " (\\d+)", "m")); return m ? Number(m[1]) : 0; };
  return { ok: r.status === 0 && !(r.error && r.error.code === "ETIMEDOUT"), status: r.status, timedOut: !!(r.error && r.error.code === "ETIMEDOUT"), tests: num("tests"), pass: num("pass"), fail: num("fail"), todo: num("todo"), out };
}

// 커버리지: 대상 소스 파일들의 줄/분기/함수 커버리지 평균과 파일별 값을 돌려준다.
function coverage(files, opts = {}) {
  const r = runTests(files, { ...opts, reporter: "spec", extraArgs: ["--experimental-test-coverage"] });
  const per = {};
  for (const line of r.out.split("\n")) {
    const m = line.match(/^ℹ\s+(\w+)\.js\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*(.*)$/);
    if (m && TARGETS.includes(m[1])) per[m[1]] = { line: Number(m[2]), branch: Number(m[3]), funcs: Number(m[4]), uncovered: m[5].trim() };
  }
  const names = Object.keys(per);
  const avg = (k) => (names.length ? Math.round((names.reduce((s, n) => s + per[n][k], 0) / names.length) * 100) / 100 : 0);
  return { ok: r.ok, tests: r.tests, pass: r.pass, fail: r.fail, files: per, line: avg("line"), branch: avg("branch"), funcs: avg("funcs"), out: r.out };
}

module.exports = { ROOT, TARGETS, listTests, runTests, coverage };
