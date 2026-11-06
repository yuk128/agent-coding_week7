// [불안정 테스트 B → 수정] 원인: 실제 시계 + sleep/jitter 경합 (바쁘면 "방금 만든 주문"도 30ms가 지나 버림)
// 수정: 가짜 시계로 시간을 직접 조종. 의도(30ms 지나면 취소 / 안 지나면 취소 안 됨)는 그대로.
// 부동소수점(30/60000 분)의 오차를 피하려고 경계에서 1ms 떨어진 31ms / 29ms 를 쓴다.
const test = require("node:test");
const assert = require("node:assert/strict");
const { createContext, createFakeClock, seedOrder } = require("../src/testkit");
const { expirePendingOrders } = require("../src/expiry");

const THIRTY_MS_IN_MINUTES = 30 / 60000; // 30밀리초

test("30밀리초가 지난 결제대기 주문은 자동 취소된다", () => {
  const clock = createFakeClock();
  const ctx = createContext({ clock });
  const o = seedOrder(ctx);
  clock.advance(31);
  const ids = expirePendingOrders(ctx, { timeoutMinutes: THIRTY_MS_IN_MINUTES });
  assert.deepEqual(ids, [o.id]);
  assert.equal(ctx.store.orders.get(o.id).status, "CANCELED");
});

test("방금 만든 주문은 아직 자동 취소되지 않는다", () => {
  const clock = createFakeClock();
  const ctx = createContext({ clock });
  const o = seedOrder(ctx);
  clock.advance(29);
  const ids = expirePendingOrders(ctx, { timeoutMinutes: THIRTY_MS_IN_MINUTES });
  assert.deepEqual(ids, []);
  assert.equal(ctx.store.orders.get(o.id).status, "PENDING_PAYMENT");
});