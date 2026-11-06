#!/usr/bin/env node
// 공개 변이 테스트 도구 — "내 테스트가 일부러 심은 결함을 잡아내는가?"를 측정한다.
//
// 사용법
//   node scripts/mutate.js                       # my_tests/ 를 평가
//   node scripts/mutate.js --tests ai_tests      # AI가 만든 테스트를 평가
//   node scripts/mutate.js --files cart,order    # 일부 소스만
//   node scripts/mutate.js --list                # 변이 목록만 출력(실행 안 함)
//   node scripts/mutate.js --json                # 결과를 JSON 으로 출력 (CI 에서 사용)
//   node scripts/mutate.js --jobs 4 --timeout 15000
//
// 동작: 소스(src/*.js)의 연산자·상수·조건 등을 하나씩 바꾼 '변이체'를 만들고,
//       테스트가 실패하면 변이체를 '죽인 것(killed)', 모두 통과하면 '살아남은 것(survived)'으로 센다.
//       변이 점수 = 죽인 변이체 / 전체 변이체.
// 주의: 이 도구의 변이 종류는 공개되어 있다. 채점에는 이 도구가 만들지 않는 다른 결함도 사용된다.
//       살아남은 변이체 중에는 어떤 테스트로도 죽일 수 없는 '동등 변이체(equivalent mutant)'도 있다.
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const { spawn } = require("child_process");
const { ROOT, TARGETS, listTests } = require("./lib");

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf("--" + name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : def; };
const flag = (name) => args.includes("--" + name);
const testsDir = opt("tests", "my_tests");
const jobs = Math.max(1, Number(opt("jobs", Math.min(4, os.cpus().length))));
const timeoutMs = Number(opt("timeout", 15000));
const wanted = opt("files", "") ? opt("files", "").split(",").map((s) => s.trim()) : TARGETS;
const asJson = flag("json");
const listOnly = flag("list");

// ---------- 1) 변이 생성 ----------
// 코드(문자열 · 주석 · 템플릿 밖)에서만 변이를 만든다.
function scan(src) {
  const code = new Array(src.length).fill(true); // 변이 가능한 위치인가
  let i = 0;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === "/" && n === "/") { while (i < src.length && src[i] !== "\n") code[i++] = false; continue; }
    if (c === "/" && n === "*") { while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) code[i++] = false; code[i++] = false; code[i++] = false; continue; }
    if (c === '"' || c === "'") { const q = c; code[i++] = false; while (i < src.length && src[i] !== q) { if (src[i] === "\\") code[i++] = false; code[i++] = false; } code[i++] = false; continue; }
    if (c === "`") { code[i++] = false; let depth = 0; while (i < src.length && !(src[i] === "`" && depth === 0)) { if (src[i] === "$" && src[i + 1] === "{") depth++; else if (src[i] === "}" && depth > 0) depth--; if (src[i] === "\\") code[i++] = false; code[i++] = false; } code[i++] = false; continue; }
    i++;
  }
  return code;
}

function matchParen(src, code, open) { // open 은 '(' 의 위치. 짝이 되는 ')' 위치를 돌려준다.
  let d = 0;
  for (let i = open; i < src.length; i++) { if (!code[i]) continue; if (src[i] === "(") d++; else if (src[i] === ")") { d--; if (d === 0) return i; } }
  return -1;
}

function generate(file) {
  const src = fs.readFileSync(path.join(ROOT, "src", file + ".js"), "utf8");
  const code = scan(src);
  const lineOf = (pos) => src.slice(0, pos).split("\n").length;
  const out = [];
  const add = (start, end, repl, op) => out.push({ file, start, end, repl, op, line: lineOf(start), original: src.slice(start, end) });
  const prevSig = (pos) => { let j = pos - 1; while (j >= 0 && /\s/.test(src[j])) j--; return j >= 0 ? src[j] : ""; };
  for (let p = 0; p < src.length; p++) {
    if (!code[p]) continue;
    const s3 = src.substr(p, 3), s2 = src.substr(p, 2), c = src[p];
    if (s3 === "===") { add(p, p + 3, "!==", "비교 반전"); p += 2; continue; }
    if (s3 === "!==") { add(p, p + 3, "===", "비교 반전"); p += 2; continue; }
    if (s2 === ">=") { add(p, p + 2, ">", "경계 이동"); p += 1; continue; }
    if (s2 === "<=") { add(p, p + 2, "<", "경계 이동"); p += 1; continue; }
    if (s2 === "=>" ) { p += 1; continue; }
    if (s2 === "&&") { add(p, p + 2, "||", "논리 연산자"); p += 1; continue; }
    if (s2 === "||") { add(p, p + 2, "&&", "논리 연산자"); p += 1; continue; }
    if (s2 === "??" ) { p += 1; continue; }
    if (s2 === "+=") { add(p, p + 2, "-=", "산술 연산자"); p += 1; continue; }
    if (s2 === "-=") { add(p, p + 2, "+=", "산술 연산자"); p += 1; continue; }
    if (s2 === "++" || s2 === "--" || s2 === "**" || s2 === "==" || s2 === "!=") { p += 1; continue; }
    if (c === ">" ) { add(p, p + 1, ">=", "경계 이동"); continue; }
    if (c === "<" ) { add(p, p + 1, "<=", "경계 이동"); continue; }
    if (c === "+" ) { add(p, p + 1, "-", "산술 연산자"); continue; }
    if (c === "-" && /[\w)\]]/.test(prevSig(p))) { add(p, p + 1, "+", "산술 연산자"); continue; }
    if (c === "*" ) { add(p, p + 1, "/", "산술 연산자"); continue; }
    if (c === "!" && src[p + 1] !== "=") { add(p, p + 1, "", "부정 제거"); continue; }
    if (/[A-Za-z_$]/.test(c) && !/[\w$.]/.test(src[p - 1] || " ")) {
      const m = src.slice(p).match(/^[A-Za-z_$][\w$]*/)[0];
      if (m === "true") add(p, p + 4, "false", "불리언 반전");
      else if (m === "false") add(p, p + 5, "true", "불리언 반전");
      else if (m === "if") { // if (조건) → if (false) / if (true)
        const o = src.indexOf("(", p); const cl = o >= 0 ? matchParen(src, code, o) : -1;
        if (cl > 0) { add(o + 1, cl, "false", "조건 false"); add(o + 1, cl, "true", "조건 true"); }
      }
      p += m.length - 1; continue;
    }
    if (/\d/.test(c) && !/[\w$.]/.test(src[p - 1] || " ")) {
      const m = src.slice(p).match(/^\d+/)[0];
      if (src[p + m.length] !== "." && !/[\w$]/.test(src[p + m.length] || " ")) add(p, p + m.length, String(Number(m) + 1), "상수 변경");
      p += m.length - 1; continue;
    }
  }
  // 문장 삭제: 한 줄짜리 호출 · 대입 문장
  let off = 0;
  for (const ln of src.split("\n")) {
    const t = ln.trim();
    const first = off + ln.indexOf(t);
    if (code[first] && t.endsWith(";") && !/^(return|throw|const|let|var|if|else|for|while|break|continue|module)\b/.test(t) && !/^[}\])]/.test(t)) {
      const isCall = /^(await\s+)?[\w$.\[\]]+\(.*\);$/.test(t);
      const isAssign = /^[\w$.\[\]]+\s*(\+|-)?=[^=>].*;$/.test(t);
      if (isCall || isAssign) add(first, first + t.length, ";", "문장 삭제");
    }
    off += ln.length + 1;
  }
  const seen = new Set();
  return out.filter((m) => { // 컴파일되지 않는 변이체는 버린다
    const mutated = src.slice(0, m.start) + m.repl + src.slice(m.end);
    const key = m.start + ":" + m.end + ":" + m.repl; if (seen.has(key)) return false; seen.add(key);
    try { new vm.Script(mutated, { filename: file }); } catch { return false; }
    return mutated !== src;
  }).map((m, i) => ({ ...m, id: `${file}#${i + 1}`, src }));
}

// ---------- 2) 실행 ----------
function runOnce(cwd, files) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--test", "--test-reporter=tap", ...files], { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let out = ""; child.stdout.on("data", (d) => (out += d)); child.stderr.on("data", (d) => (out += d));
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeoutMs);
    child.on("close", (code) => { clearTimeout(timer); resolve({ code, timedOut, out }); });
  });
}

function makeWorkspace(testFiles) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mutate-"));
  fs.cpSync(path.join(ROOT, "src"), path.join(dir, "src"), { recursive: true });
  fs.cpSync(path.join(ROOT, testsDir), path.join(dir, testsDir), { recursive: true }); // 도우미 파일(_helpers.js 등)도 함께 복사
  const rel = testFiles.map((f) => path.relative(ROOT, f));
  return { dir, rel };
}

async function main() {
  const mutants = wanted.flatMap((f) => { if (!TARGETS.includes(f)) throw new Error(`알 수 없는 파일: ${f}`); return generate(f); });
  if (listOnly) {
    for (const m of mutants) console.log(`${m.id.padEnd(14)} ${m.file}.js:${m.line}  [${m.op}]  ${JSON.stringify(m.original)} -> ${JSON.stringify(m.repl)}`);
    console.log(`\n변이체 ${mutants.length}개`);
    return;
  }
  const testFiles = listTests(testsDir);
  if (testFiles.length === 0) { console.error(`'${testsDir}/' 에 *.test.js 파일이 없습니다.`); process.exit(2); }
  const log = (...a) => { if (!asJson) console.log(...a); };
  const workers = Array.from({ length: jobs }, () => makeWorkspace(testFiles));
  const base = await runOnce(workers[0].dir, workers[0].rel);
  if (base.code !== 0) {
    console.error("원본 코드에서 테스트가 실패합니다. 변이 테스트는 모든 테스트가 통과할 때만 의미가 있습니다.\n");
    console.error(base.out.split("\n").filter((l) => /not ok|error|expected|actual/i.test(l)).slice(0, 15).join("\n"));
    for (const w of workers) fs.rmSync(w.dir, { recursive: true, force: true });
    process.exit(2);
  }
  log(`변이체 ${mutants.length}개 · 테스트 파일 ${testFiles.length}개 (${testsDir}/) · 병렬 ${jobs}\n`);
  const results = new Array(mutants.length);
  let next = 0, done = 0;
  await Promise.all(workers.map(async (w) => {
    while (true) {
      const idx = next++; if (idx >= mutants.length) return;
      const m = mutants[idx]; const target = path.join(w.dir, "src", m.file + ".js");
      fs.writeFileSync(target, m.src.slice(0, m.start) + m.repl + m.src.slice(m.end));
      const r = await runOnce(w.dir, w.rel);
      fs.writeFileSync(target, m.src);
      results[idx] = { killed: r.code !== 0, timedOut: r.timedOut };
      done++; if (!asJson && process.stdout.isTTY) process.stdout.write(`\r진행 ${done}/${mutants.length}`);
    }
  }));
  if (!asJson && process.stdout.isTTY) process.stdout.write("\r" + " ".repeat(24) + "\r");
  for (const w of workers) fs.rmSync(w.dir, { recursive: true, force: true });

  const killed = results.filter((r) => r.killed).length;
  const survivors = mutants.filter((_, i) => !results[i].killed);
  const score = mutants.length ? Math.round((killed / mutants.length) * 1000) / 10 : 0;
  const byFile = {};
  mutants.forEach((m, i) => { const b = (byFile[m.file] ??= { total: 0, killed: 0 }); b.total++; if (results[i].killed) b.killed++; });
  const report = { tests: testsDir, total: mutants.length, killed, survived: survivors.length, timedOut: results.filter((r) => r.timedOut).length, score, byFile,
    survivors: survivors.map((m) => ({ id: m.id, file: m.file + ".js", line: m.line, op: m.op, original: m.original, replacement: m.repl, code: m.src.split("\n")[m.line - 1].trim() })) };
  try { fs.mkdirSync(path.join(ROOT, "reports"), { recursive: true }); fs.writeFileSync(path.join(ROOT, "reports", "mutation-latest.json"), JSON.stringify(report, null, 2)); } catch {}
  if (asJson) { console.log(JSON.stringify(report, null, 2)); return; }
  console.log(`변이 점수 ${score}%  (죽인 변이체 ${killed} / 전체 ${mutants.length}, 시간 초과 ${report.timedOut}건 포함)\n`);
  console.log("파일별: " + Object.entries(byFile).map(([f, b]) => `${f}.js ${b.killed}/${b.total}`).join("  ") + "\n");
  if (survivors.length) {
    console.log(`살아남은 변이체 ${survivors.length}개 — 테스트가 이 변경을 알아채지 못했다:`);
    for (const s of report.survivors) console.log(`  ${s.id.padEnd(14)} ${s.file}:${s.line}  [${s.op}] ${JSON.stringify(s.original)} -> ${JSON.stringify(s.replacement)}    ${s.code}`);
    console.log("\n각 변이체가 (1) 죽여야 할 진짜 결함인지 (2) 동작이 달라지지 않는 동등 변이체인지 판단하세요.");
  }
}
main().catch((e) => { console.error(e.message || e); process.exit(1); });
