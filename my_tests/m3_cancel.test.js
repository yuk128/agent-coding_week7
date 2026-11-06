// Mission 3 — 취소 · 환불 테스트 (모의 PG: failNextRefund / timeoutNextRefund / refunds)
const test = require("node:test");
const assert = require("node:assert/strict");
const { seedOrder } = require("../src/testkit");
const { cancelOrder } = require("../src/cancel");
const { expectRejectCode, fresh } = require("./_helpers");

test("[TC-X-01] 결제 전 주문을 취소하면 PG 호출 없이 CANCELED 가 되고 재고가 복원된다", async () => {
  const ctx = fresh();
  const o = seedOrder(ctx, { items: [["P1", 3]] }); // 재고 10 -> 7
  const r = await cancelOrder(ctx, "u1", o.id);
  assert.equal(r.order.status, "CANCELED");
  assert.equal(ctx.store.products.get("P1").stock, 10);
  assert.equal(ctx.pg.refunds.length, 0);
});

test.todo("[TC-X-02] TODO: 결제 후 취소 — 환불 금액 · 결제 기록 REFUNDED · 재고 복원");
test.todo("[TC-X-03] TODO: 환불 실패 · 시간 초과 — REFUND_FAILED, 주문 PAID 유지, 재고 복원 안 함");
test.todo("[TC-X-04] TODO: 취소할 수 없는 상태 · 남의 주문 · 없는 주문");
test.todo("[TC-X-05] TODO: 동시 취소 — 환불과 재고 복원은 한 번");
