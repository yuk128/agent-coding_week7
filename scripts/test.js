#!/usr/bin/env node
// 지정한 폴더의 *.test.js 를 모두 실행한다. (운영체제와 Node.js 버전에 상관없이 같은 방식으로 동작)
//   node scripts/test.js my_tests          # 폴더 전체
//   node scripts/test.js my_tests --name "수량"   # 이름에 '수량' 이 들어간 테스트만
const { spawnSync } = require("child_process");
const { listTests } = require("./lib");
const [dir = "my_tests", ...rest] = process.argv.slice(2);
const files = listTests(dir);
if (files.length === 0) { console.error(`'${dir}/' 에 *.test.js 파일이 없습니다.`); process.exit(1); }
const extra = [];
const ni = rest.indexOf("--name"); if (ni >= 0 && rest[ni + 1]) extra.push("--test-name-pattern", rest[ni + 1]);
const r = spawnSync(process.execPath, ["--test", ...extra, ...files], { stdio: "inherit" });
process.exit(r.status ?? 1);
