// Mission 3 — 결제 테스트 (모의 PG: failNextCharge / timeoutNextCharge / charges)
const test = require("node:test");
const assert = require("node:assert/strict");
const { seedOrder } = require("../src/testkit");
const { payOrder } = require("../src/payment");
const { expectRejectCode, fresh } = require("./_helpers");

test("[TC-P-01] 결제에 성공하면 주문은 PAID, 결제 기록은 SUCCEEDED 이고 PG 에는 서버의 주문 금액이 전달된다", async () => {
  const ctx = fresh();
  const o = seedOrder(ctx, { items: [["P1", 2]] });
  const r = await payOrder(ctx, "u1", o.id);
  assert.equal(r.order.status, "PAID");
  assert.equal(r.payment.status, "SUCCEEDED");
  assert.equal(r.alreadyPaid, false);
  assert.equal(ctx.pg.charges.length, 1);
  assert.equal(ctx.pg.charges[0].amount, 30000);
});

test.todo("[TC-P-02] TODO: PG 실패(ok:false)와 시간 초과 — 오류 코드 · 사유 · 주문 상태 · 결제 기록");
test.todo("[TC-P-03] TODO: 재시도 — attempt 번호와 멱등성 키");
test.todo("[TC-P-04] TODO: 이미 결제됨 · 취소된 주문 · 남의 주문");
test.todo("[TC-P-05] TODO: 동시 요청(Promise.all) — PG 요청은 한 번");
