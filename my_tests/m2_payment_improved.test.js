// Mission 2 — AI 결제 테스트(ai_tests/payment.ai.test.js)의 약점을 고친 테스트
// 기대값 근거: docs/API_CONTRACT.md 3장
const test = require("node:test");
const assert = require("node:assert/strict");
const { createContext, seedOrder } = require("../src/testkit");
const { payOrder } = require("../src/payment");
const { expectRejectCode } = require("./_helpers");

const records = (ctx, id) => ctx.store.payments.get(id) || [];
const status = (ctx, id) => ctx.store.orders.get(id).status;

test("[M2-P-01] 결제 성공: 주문 PAID, 결제 기록 SUCCEEDED(txId · paidAt), alreadyPaid false, PG 에 서버 금액 전달", async () => {
  const ctx = createContext();
  const o = seedOrder(ctx, { items: [["P1", 2]] });
  const r = await payOrder(ctx, "u1", o.id);
  assert.equal(r.order.status, "PAID");
  assert.equal(r.alreadyPaid, false);
  assert.equal(r.payment.status, "SUCCEEDED");
  assert.ok(r.payment.txId);
  assert.ok(r.payment.paidAt);
  assert.equal(status(ctx, o.id), "PAID");
  assert.equal(ctx.pg.charges.length, 1);
  assert.equal(ctx.pg.charges[0].amount, 30000);
  assert.equal(ctx.pg.charges[0].orderId, o.id);
});

// [약한 단언] assert.ok(again) → alreadyPaid 와 PG 호출 횟수
test("[M2-P-02] 이미 결제한 주문은 PG 에 다시 요청하지 않고 alreadyPaid true 를 돌려준다", async () => {
  const ctx = createContext();
  const o = seedOrder(ctx);
  await payOrder(ctx, "u1", o.id);
  const again = await payOrder(ctx, "u1", o.id);
  assert.equal(again.alreadyPaid, true);
  assert.equal(again.order.status, "PAID");
  assert.equal(ctx.pg.charges.length, 1);
  assert.equal(records(ctx, o.id).length, 1);
});

// [오류 삼키기] try/catch 대신 반드시 거부되어야 한다
test("[M2-P-03] PG 실패는 PAYMENT_FAILED(reason) 이고 주문은 결제대기로 남으며 실패 기록이 쌓인다", async () => {
  const ctx = createContext();
  const o = seedOrder(ctx);
  ctx.pg.failNextCharge("LIMIT_EXCEEDED");
  const err = await expectRejectCode(() => payOrder(ctx, "u1", o.id), "PAYMENT_FAILED");
  assert.equal(err.details.reason, "LIMIT_EXCEEDED");
  assert.equal(status(ctx, o.id), "PENDING_PAYMENT");
  assert.equal(records(ctx, o.id).length, 1);
  assert.equal(records(ctx, o.id)[0].status, "FAILED");
  assert.equal(records(ctx, o.id)[0].failureReason, "LIMIT_EXCEEDED");
});

test("[M2-P-04] PG 시간 초과는 PAYMENT_FAILED(reason PG_ERROR) 이고 주문은 결제대기로 남는다", async () => {
  const ctx = createContext();
  const o = seedOrder(ctx);
  ctx.pg.timeoutNextCharge();
  const err = await expectRejectCode(() => payOrder(ctx, "u1", o.id), "PAYMENT_FAILED");
  assert.equal(err.details.reason, "PG_ERROR");
  assert.equal(status(ctx, o.id), "PENDING_PAYMENT");
  assert.equal(records(ctx, o.id)[0].status, "FAILED");
});

test("[M2-P-05] 취소된 주문은 INVALID_STATE 이고 PG 에 요청하지 않으며 상태가 그대로다", async () => {
  const ctx = createContext();
  const o = seedOrder(ctx, { status: "CANCELED" });
  await expectRejectCode(() => payOrder(ctx, "u1", o.id), "INVALID_STATE");
  assert.equal(ctx.pg.charges.length, 0);
  assert.equal(status(ctx, o.id), "CANCELED");
});

// [AI 가 놓친 규칙] 재시도
test("[M2-P-06] 실패 뒤 재시도하면 성공하고 결제 기록은 attempt 1, 2 로 쌓이며 키는 서로 다르다", async () => {
  const ctx = createContext();
  const o = seedOrder(ctx);
  ctx.pg.failNextCharge("CARD_DECLINED");
  await expectRejectCode(() => payOrder(ctx, "u1", o.id), "PAYMENT_FAILED");
  const r = await payOrder(ctx, "u1", o.id);
  assert.equal(r.order.status, "PAID");
  const recs = records(ctx, o.id);
  assert.deepEqual(recs.map((x) => x.attempt), [1, 2]);
  assert.deepEqual(recs.map((x) => x.status), ["FAILED", "SUCCEEDED"]);
  assert.equal(ctx.pg.charges.length, 2);
  assert.notEqual(ctx.pg.charges[0].idempotencyKey, ctx.pg.charges[1].idempotencyKey);
});

// [AI 가 놓친 규칙] 동시 요청
test("[M2-P-07] 같은 주문의 결제 요청이 동시에 와도 PG 요청은 한 번이다", async () => {
  const ctx = createContext();
  const o = seedOrder(ctx);
  const results = await Promise.all([payOrder(ctx, "u1", o.id), payOrder(ctx, "u1", o.id), payOrder(ctx, "u1", o.id)]);
  assert.equal(ctx.pg.charges.length, 1);
  assert.equal(status(ctx, o.id), "PAID");
  assert.ok(results.every((r) => r.order.status === "PAID"));
});

test("[M2-P-08] 동시 요청의 결과가 실패이면 모든 요청이 같은 실패를 받고 PG 요청은 한 번이다", async () => {
  const ctx = createContext();
  const o = seedOrder(ctx);
  ctx.pg.failNextCharge("LIMIT_EXCEEDED");
  const settled = await Promise.allSettled([payOrder(ctx, "u1", o.id), payOrder(ctx, "u1", o.id)]);
  assert.ok(settled.every((s) => s.status === "rejected" && s.reason.code === "PAYMENT_FAILED"));
  assert.equal(ctx.pg.charges.length, 1);
  assert.equal(status(ctx, o.id), "PENDING_PAYMENT");
});

test("[M2-P-09] 남의 주문 · 없는 주문은 NOT_FOUND 이고 PG 에 요청하지 않는다", async () => {
  const ctx = createContext();
  const o = seedOrder(ctx, { userId: "u1" });
  await expectRejectCode(() => payOrder(ctx, "u2", o.id), "NOT_FOUND");
  await expectRejectCode(() => payOrder(ctx, "u1", "ORD-9999"), "NOT_FOUND");
  assert.equal(ctx.pg.charges.length, 0);
  assert.equal(status(ctx, o.id), "PENDING_PAYMENT");
});

test("[M2-P-10] 서로 다른 주문의 결제는 서로 영향을 주지 않는다", async () => {
  const ctx = createContext();
  const a = seedOrder(ctx, { items: [["P1", 1]] });
  const b = seedOrder(ctx, { items: [["P2", 1]] });
  ctx.pg.failNextCharge("LIMIT_EXCEEDED");
  await expectRejectCode(() => payOrder(ctx, "u1", a.id), "PAYMENT_FAILED");
  const r = await payOrder(ctx, "u1", b.id);
  assert.equal(r.order.status, "PAID");
  assert.equal(status(ctx, a.id), "PENDING_PAYMENT");
  assert.equal(r.payment.amount, 59000);
});

test("[M2-P-11] 결제 기록에는 카드 관련 필드가 없다", async () => {
  const ctx = createContext();
  const o = seedOrder(ctx);
  const r = await payOrder(ctx, "u1", o.id);
  assert.ok(Object.keys(r.payment).every((k) => !/card|number|cvc/i.test(k)));
});