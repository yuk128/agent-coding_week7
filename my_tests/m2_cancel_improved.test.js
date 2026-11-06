// Mission 2 개선: ai_tests/cancel.ai.test.js 의 약점을 고친 테스트
// 기대값 근거: docs/API_CONTRACT.md 4장(취소·환불) — src 코드 참고 안 함
const test = require("node:test");
const assert = require("node:assert/strict");
const { seedOrder } = require("../src/testkit");
const { cancelOrder } = require("../src/cancel");
const { fresh, expectRejectCode } = require("./_helpers");

const stock = (ctx, id) => ctx.store.products.get(id).stock;
const lastPayment = (ctx, orderId) => {
  const list = ctx.store.payments.get(orderId);
  return list[list.length - 1];
};

// ---------- 결제 전 취소 (규칙 3) ----------

// 잡는 결함: 재고 복원 누락 / 복원 수량 오류 (AI 테스트는 상태만 확인했음)
test("M2-C01 결제 전 취소: CANCELED + 상품별 재고가 수량만큼 복원된다", async () => {
  const ctx = fresh();
  const o = seedOrder(ctx, { items: [["P1", 3], ["P2", 2]] });
  const p1 = stock(ctx, "P1");
  const p2 = stock(ctx, "P2");
  const r = await cancelOrder(ctx, "u1", o.id);
  assert.equal(r.order.status, "CANCELED");
  assert.equal(ctx.store.orders.get(o.id).status, "CANCELED");
  assert.equal(stock(ctx, "P1"), p1 + 3);
  assert.equal(stock(ctx, "P2"), p2 + 2);
});

// 잡는 결함: 결제 전 취소인데 PG 환불 호출
test("M2-C02 결제 전 취소: PG 환불을 호출하지 않는다", async () => {
  const ctx = fresh();
  const o = seedOrder(ctx);
  await cancelOrder(ctx, "u1", o.id);
  assert.equal(ctx.pg.refunds.length, 0);
});

// ---------- 결제 후 취소 (규칙 4) ----------

// 잡는 결함: 환불 금액/txId 오류, 결제 기록 갱신 누락, 재고 복원 누락
test("M2-C03 결제 후 취소: 결제 금액·txId 로 환불, 기록 REFUNDED, 재고 복원", async () => {
  const ctx = fresh();
  const o = seedOrder(ctx, { items: [["P1", 2]], status: "PAID" });
  const before = stock(ctx, "P1");
  const pay = lastPayment(ctx, o.id);
  const r = await cancelOrder(ctx, "u1", o.id);

  assert.equal(r.order.status, "CANCELED");
  assert.equal(ctx.pg.refunds.length, 1);
  assert.equal(ctx.pg.refunds[0].amount, pay.amount);
  assert.equal(ctx.pg.refunds[0].txId, pay.txId);

  const after = lastPayment(ctx, o.id);
  assert.equal(after.status, "REFUNDED");
  assert.equal(after.refund.status, "SUCCEEDED");
  assert.equal(typeof after.refund.refundId, "string");
  assert.ok(after.refund.at, "refund.at 이 기록되어야 한다");
  assert.equal(stock(ctx, "P1"), before + 2);
});

// ---------- 환불 실패 (규칙 4) ----------

// 잡는 결함: 오류 코드/사유 오류, 상태·재고·기록 처리 오류 (AI 테스트는 try/catch 로 삼켰음)
test("M2-C04 환불 실패(ok:false): REFUND_FAILED+사유, 주문 PAID 유지, 재고 그대로, 실패 기록", async () => {
  const ctx = fresh();
  const o = seedOrder(ctx, { items: [["P1", 2]], status: "PAID" });
  const before = stock(ctx, "P1");
  ctx.pg.failNextRefund("REFUND_REJECTED");

  const err = await expectRejectCode(() => cancelOrder(ctx, "u1", o.id), "REFUND_FAILED");
  assert.equal(err.details.reason, "REFUND_REJECTED");
  assert.equal(ctx.store.orders.get(o.id).status, "PAID");
  assert.equal(stock(ctx, "P1"), before);
  const rec = lastPayment(ctx, o.id);
  assert.equal(rec.refund.status, "FAILED");
  assert.equal(rec.refund.reason, "REFUND_REJECTED");
  assert.ok(rec.refund.at);
});

// 잡는 결함: 시간 초과를 다른 사유로 처리 / 시간 초과 때 상태·재고 변경
test("M2-C05 환불 시간 초과: REFUND_FAILED + reason PG_ERROR, 주문 PAID·재고 그대로", async () => {
  const ctx = fresh();
  const o = seedOrder(ctx, { items: [["P1", 2]], status: "PAID" });
  const before = stock(ctx, "P1");
  ctx.pg.timeoutNextRefund();

  const err = await expectRejectCode(() => cancelOrder(ctx, "u1", o.id), "REFUND_FAILED");
  assert.equal(err.details.reason, "PG_ERROR");
  assert.equal(ctx.store.orders.get(o.id).status, "PAID");
  assert.equal(stock(ctx, "P1"), before);
  assert.equal(lastPayment(ctx, o.id).refund.status, "FAILED");
});

// 잡는 결함: 환불 실패 후 재시도 불가 / 재고 이중 복원
test("M2-C06 환불 실패 뒤 다시 취소하면 성공하고 재고는 한 번만 복원된다", async () => {
  const ctx = fresh();
  const o = seedOrder(ctx, { items: [["P1", 2]], status: "PAID" });
  const before = stock(ctx, "P1");
  ctx.pg.failNextRefund("REFUND_REJECTED");
  await expectRejectCode(() => cancelOrder(ctx, "u1", o.id), "REFUND_FAILED");

  const r = await cancelOrder(ctx, "u1", o.id);
  assert.equal(r.order.status, "CANCELED");
  assert.equal(stock(ctx, "P1"), before + 2);
  assert.equal(lastPayment(ctx, o.id).status, "REFUNDED");
});

// ---------- 취소 불가 상태 (규칙 2) ----------

// 잡는 결함: 허용 상태 오류, 거부했는데 환불·재고 부작용 (AI 테스트는 CANCELED 하나만 확인했음)
for (const status of ["PREPARING", "SHIPPING", "DELIVERED", "CANCELED"]) {
  test(`M2-C07 ${status} 주문 취소 거부: INVALID_STATE, 환불·재고·상태 변화 없음`, async () => {
    const ctx = fresh();
    const o = seedOrder(ctx, { items: [["P1", 2]], status });
    const before = stock(ctx, "P1");
    await expectRejectCode(() => cancelOrder(ctx, "u1", o.id), "INVALID_STATE");
    assert.equal(ctx.pg.refunds.length, 0);
    assert.equal(stock(ctx, "P1"), before);
    assert.equal(ctx.store.orders.get(o.id).status, status);
  });
}

// ---------- 본인 확인 (규칙 1) ----------

// 잡는 결함: 남의 주문 취소 허용 / FORBIDDEN 등 다른 코드
test("M2-C08 남의 주문은 NOT_FOUND 이고 아무것도 바뀌지 않는다", async () => {
  const ctx = fresh();
  const o = seedOrder(ctx, { items: [["P1", 2]], status: "PAID" });
  const before = stock(ctx, "P1");
  await expectRejectCode(() => cancelOrder(ctx, "u2", o.id), "NOT_FOUND");
  assert.equal(ctx.store.orders.get(o.id).status, "PAID");
  assert.equal(ctx.pg.refunds.length, 0);
  assert.equal(stock(ctx, "P1"), before);
});

test("M2-C09 없는 주문은 NOT_FOUND", async () => {
  const ctx = fresh();
  await expectRejectCode(() => cancelOrder(ctx, "u1", "ORD-9999"), "NOT_FOUND");
});

// ---------- 동시 취소 (규칙 5) ----------

// 잡는 결함: 동시 요청 시 환불 2회 / 재고 이중 복원
test("M2-C10 결제 후 동시 취소 2건: 환불 1회, 재고 1회만 복원", async () => {
  const ctx = fresh();
  const o = seedOrder(ctx, { items: [["P1", 2]], status: "PAID" });
  const before = stock(ctx, "P1");
  const results = await Promise.allSettled([
    cancelOrder(ctx, "u1", o.id),
    cancelOrder(ctx, "u1", o.id),
  ]);
  assert.ok(results.some((x) => x.status === "fulfilled"), "적어도 한 요청은 성공해야 한다");
  assert.equal(ctx.pg.refunds.length, 1);
  assert.equal(stock(ctx, "P1"), before + 2);
  assert.equal(ctx.store.orders.get(o.id).status, "CANCELED");
});

test("M2-C11 결제 전 동시 취소 2건: 재고 1회만 복원", async () => {
  const ctx = fresh();
  const o = seedOrder(ctx, { items: [["P1", 3]] });
  const before = stock(ctx, "P1");
  await Promise.allSettled([
    cancelOrder(ctx, "u1", o.id),
    cancelOrder(ctx, "u1", o.id),
  ]);
  assert.equal(stock(ctx, "P1"), before + 3);
  assert.equal(ctx.store.orders.get(o.id).status, "CANCELED");
});