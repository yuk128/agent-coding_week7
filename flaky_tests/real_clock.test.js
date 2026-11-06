// [불안정 테스트 B] 가끔 실패한다. 원인을 찾아 항상 같은 결과가 나오도록 고친다.
const test = require("node:test");
const assert = require("node:assert/strict");
const { createContext, seedOrder } = require("../src/testkit");
const { expirePendingOrders } = require("../src/expiry");
const { sleep, jitter } = require("./_chaos");

const THIRTY_MS_IN_MINUTES = 30 / 60000; // 30밀리초

test("30밀리초가 지난 결제대기 주문은 자동 취소된다", async () => {
  const ctx = createContext(); // 기본 시계는 실제 시간이다
  const o = seedOrder(ctx);
  await sleep(20);
  await jitter(30); // 바쁜 서버 흉내
  const ids = expirePendingOrders(ctx, { timeoutMinutes: THIRTY_MS_IN_MINUTES });
  assert.deepEqual(ids, [o.id]);
});

test("방금 만든 주문은 아직 자동 취소되지 않는다", async () => {
  const ctx = createContext();
  seedOrder(ctx);
  await jitter(40); // 바쁜 서버 흉내
  const ids = expirePendingOrders(ctx, { timeoutMinutes: THIRTY_MS_IN_MINUTES });
  assert.deepEqual(ids, []);
});
