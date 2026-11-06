// 바쁜 CI 서버(느린 디스크 · 몰린 작업)를 흉내 내는 도구. (테스트 파일이 아니다 — 수정하지 않는다)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (maxMs) => sleep(Math.random() * maxMs); // 0 ~ maxMs 사이의 무작위 지연
module.exports = { sleep, jitter };
