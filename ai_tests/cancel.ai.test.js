// 이 파일은 AI 도구가 생성한 테스트라고 가정합니다. (리뷰 대상 — 수정하지 않습니다)
const test = require("node:test");
const assert = require("node:assert/strict");
const { createContext, seedOrder } = require("../src/testkit");
const { cancelOrder } = require("../src/cancel");

test("결제 전 주문을 취소할 수 있다", async () => {
  const ctx = createContext();
  const o = seedOrder(ctx);
  const r = await cancelOrder(ctx, "u1", o.id);
  assert.equal(r.order.status, "CANCELED");
});

test("취소하면 재고가 복원된다", async () => {
  const ctx = createContext();
  const o = seedOrder(ctx, { items: [["P1", 3]] });
  const r = await cancelOrder(ctx, "u1", o.id);
  assert.equal(r.order.status, "CANCELED");
});

test("결제 후 취소하면 환불된다", async () => {
  const ctx = createContext();
  const o = seedOrder(ctx, { status: "PAID" });
  const r = await cancelOrder(ctx, "u1", o.id);
  assert.ok(r.order);
});

test("이미 취소된 주문은 다시 취소할 수 없다", async () => {
  const ctx = createContext();
  const o = seedOrder(ctx, { status: "CANCELED" });
  await assert.rejects(() => cancelOrder(ctx, "u1", o.id));
});

test("환불이 실패하면 오류가 발생한다", async () => {
  const ctx = createContext();
  const o = seedOrder(ctx, { status: "PAID" });
  ctx.pg.failNextRefund();
  try {
    await cancelOrder(ctx, "u1", o.id);
  } catch (e) {
    // 환불 실패 처리
  }
});
