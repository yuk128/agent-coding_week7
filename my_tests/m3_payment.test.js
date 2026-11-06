// Mission 3: 결제 — 재시도·동시 요청 (기대값 근거: docs/API_CONTRACT.md 3장)
const test = require("node:test");
const assert = require("node:assert/strict");
const { seedOrder } = require("../src/testkit");
const { payOrder } = require("../src/payment");
const { fresh, expectRejectCode } = require("./_helpers");

const recs = (ctx, id) => ctx.store.payments.get(id);

// 잡는 결함: attempt 증가 오류, 사유·기록 상태 오류, 금액·멱등성 키 오류, 기록 id 중복(payment#26)
test("TC-P-01 실패→시간 초과→성공: 기록 3건, attempt 1·2·3, 사유·금액·키·id 검증", async () => {
  const ctx = fresh();
  const o = seedOrder(ctx, { items: [["P1", 2]] });

  ctx.pg.failNextCharge("LIMIT_EXCEEDED");
  const e1 = await expectRejectCode(() => payOrder(ctx, "u1", o.id), "PAYMENT_FAILED");
  assert.equal(e1.details.reason, "LIMIT_EXCEEDED");

  ctx.pg.timeoutNextCharge();
  const e2 = await expectRejectCode(() => payOrder(ctx, "u1", o.id), "PAYMENT_FAILED");
  assert.equal(e2.details.reason, "PG_ERROR");
  assert.equal(ctx.store.orders.get(o.id).status, "PENDING_PAYMENT");

  const r = await payOrder(ctx, "u1", o.id);
  assert.equal(r.alreadyPaid, false);
  assert.equal(r.order.status, "PAID");

  const list = recs(ctx, o.id);
  assert.equal(list.length, 3);
  assert.deepEqual(list.map((x) => x.attempt), [1, 2, 3]);
  assert.deepEqual(list.map((x) => x.status), ["FAILED", "FAILED", "SUCCEEDED"]);
  assert.equal(list[0].failureReason, "LIMIT_EXCEEDED");
  assert.equal(list[1].failureReason, "PG_ERROR");
  assert.equal(typeof list[2].txId, "string");
  assert.ok(list[2].paidAt);
  assert.equal(new Set(list.map((x) => x.id)).size, 3, "결제 기록 id 는 모두 달라야 한다");

  const keys = ctx.pg.charges.map((c) => c.idempotencyKey);
  assert.ok(keys.length >= 2);
  assert.equal(new Set(keys).size, keys.length, "멱등성 키는 시도마다 달라야 한다");
  for (const c of ctx.pg.charges) assert.equal(c.amount, o.totalAmount);
});

// 잡는 결함: 동시 실패 때 PG 중복 요청 / 실패 뒤 재시도 불가 / 동시 요청마다 다른 결과
test("TC-P-02 동시 3건이 모두 실패: PG 1회, 같은 실패, 기록 1건, 이후 재시도 가능", async () => {
  const ctx = fresh();
  const o = seedOrder(ctx, { items: [["P1", 1]] });
  ctx.pg.failNextCharge("LIMIT_EXCEEDED");

  const rs = await Promise.allSettled([
    payOrder(ctx, "u1", o.id),
    payOrder(ctx, "u1", o.id),
    payOrder(ctx, "u1", o.id),
  ]);
  for (const r of rs) {
    assert.equal(r.status, "rejected");
    assert.equal(r.reason.code, "PAYMENT_FAILED");
    assert.equal(r.reason.details.reason, "LIMIT_EXCEEDED");
  }
  assert.equal(ctx.pg.charges.length, 1);
  assert.equal(recs(ctx, o.id).length, 1);
  assert.equal(recs(ctx, o.id)[0].status, "FAILED");
  assert.equal(ctx.store.orders.get(o.id).status, "PENDING_PAYMENT");

  const ok = await payOrder(ctx, "u1", o.id);
  assert.equal(ok.order.status, "PAID");
  assert.equal(ctx.pg.charges.length, 2);
  assert.deepEqual(recs(ctx, o.id).map((x) => x.attempt), [1, 2]);
});

// 잡는 결함: 동시 성공 때 PG 중복 요청 / 기록 중복 (버튼 연타)
test("TC-P-03 동시 5건 성공: PG 1회, 기록 SUCCEEDED 1건, 모두 PAID 결과", async () => {
  const ctx = fresh();
  const o = seedOrder(ctx, { items: [["P1", 2]] });
  const rs = await Promise.allSettled(
    Array.from({ length: 5 }, () => payOrder(ctx, "u1", o.id))
  );
  for (const r of rs) {
    assert.equal(r.status, "fulfilled");
    assert.equal(r.value.order.status, "PAID");
    assert.equal(r.value.payment.status, "SUCCEEDED");
  }
  assert.equal(ctx.pg.charges.length, 1);
  assert.equal(ctx.pg.charges[0].amount, o.totalAmount);
  assert.equal(recs(ctx, o.id).length, 1);
  assert.equal(recs(ctx, o.id)[0].status, "SUCCEEDED");
  assert.equal(ctx.store.orders.get(o.id).status, "PAID");
});