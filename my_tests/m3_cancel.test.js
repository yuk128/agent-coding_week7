// Mission 3: 취소·환불 — m2_cancel_improved 와 겹치지 않는 케이스
// 기대값 근거: docs/API_CONTRACT.md 4장
const test = require("node:test");
const assert = require("node:assert/strict");
const { seedOrder } = require("../src/testkit");
const { cancelOrder } = require("../src/cancel");
const { fresh, expectRejectCode } = require("./_helpers");

const stock = (ctx, id) => ctx.store.products.get(id).stock;

// 잡는 결함: 재고 복원 시 삭제된 상품에서 크래시 (util#7). 계약서에 명시 없음 → 가정: 취소는 성공해야 한다
test("TC-X-01 [가정] 상품이 삭제된 주문도 취소되고 남은 상품의 재고는 복원된다", async () => {
  const ctx = fresh();
  const o = seedOrder(ctx, { items: [["P1", 2], ["P2", 1]] });
  const p1 = stock(ctx, "P1");
  ctx.store.products.delete("P2");
  const r = await cancelOrder(ctx, "u1", o.id);
  assert.equal(r.order.status, "CANCELED");
  assert.equal(stock(ctx, "P1"), p1 + 2);
});

// 잡는 결함: 여러 상품 중 일부만 복원 / 환불 금액이 주문 합계와 다름
test("TC-X-02 결제 후 여러 상품 취소: 환불 금액 = 주문 합계, 상품별 재고 복원", async () => {
  const ctx = fresh();
  const o = seedOrder(ctx, { items: [["P1", 3], ["P2", 2]], status: "PAID" });
  const p1 = stock(ctx, "P1");
  const p2 = stock(ctx, "P2");
  await cancelOrder(ctx, "u1", o.id);
  assert.equal(ctx.pg.refunds.length, 1);
  assert.equal(ctx.pg.refunds[0].amount, o.totalAmount);
  assert.equal(stock(ctx, "P1"), p1 + 3);
  assert.equal(stock(ctx, "P2"), p2 + 2);
});

// 잡는 결함: 취소 성공 뒤 다시 취소하면 환불·재고 이중 처리 (순차 요청)
test("TC-X-03 취소 완료 뒤 다시 취소: INVALID_STATE, 환불·재고 추가 변화 없음", async () => {
  const ctx = fresh();
  const o = seedOrder(ctx, { items: [["P1", 2]], status: "PAID" });
  const before = stock(ctx, "P1");
  await cancelOrder(ctx, "u1", o.id);
  await expectRejectCode(() => cancelOrder(ctx, "u1", o.id), "INVALID_STATE");
  assert.equal(ctx.pg.refunds.length, 1);
  assert.equal(stock(ctx, "P1"), before + 2);
});

// 잡는 결함: 한 주문 취소가 다른 주문의 상태·재고에 영향
test("TC-X-04 한 주문을 취소해도 같은 구매자의 다른 주문은 그대로다", async () => {
  const ctx = fresh();
  const a = seedOrder(ctx, { items: [["P1", 2]], status: "PAID" });
  const b = seedOrder(ctx, { items: [["P1", 3]], status: "PAID" });
  const before = stock(ctx, "P1");
  await cancelOrder(ctx, "u1", a.id);
  assert.equal(ctx.store.orders.get(a.id).status, "CANCELED");
  assert.equal(ctx.store.orders.get(b.id).status, "PAID");
  assert.equal(stock(ctx, "P1"), before + 2);
});

// 잡는 결함: 환불 실패가 두 번 이어진 뒤 성공할 때 상태·재고 오류
test("TC-X-05 환불 실패(ok:false)→시간 초과→성공: 마지막에만 CANCELED, 재고 1회 복원", async () => {
  const ctx = fresh();
  const o = seedOrder(ctx, { items: [["P1", 2]], status: "PAID" });
  const before = stock(ctx, "P1");

  ctx.pg.failNextRefund("REFUND_REJECTED");
  await expectRejectCode(() => cancelOrder(ctx, "u1", o.id), "REFUND_FAILED");
  assert.equal(ctx.store.orders.get(o.id).status, "PAID");
  assert.equal(stock(ctx, "P1"), before);

  ctx.pg.timeoutNextRefund();
  await expectRejectCode(() => cancelOrder(ctx, "u1", o.id), "REFUND_FAILED");
  assert.equal(ctx.store.orders.get(o.id).status, "PAID");
  assert.equal(stock(ctx, "P1"), before);

  const r = await cancelOrder(ctx, "u1", o.id);
  assert.equal(r.order.status, "CANCELED");
  assert.equal(stock(ctx, "P1"), before + 2);
});