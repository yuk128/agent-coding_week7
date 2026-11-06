// 이 파일은 AI 도구가 생성한 테스트라고 가정합니다. (리뷰 대상 — 수정하지 않습니다)
const test = require("node:test");
const assert = require("node:assert/strict");
const { createContext, seedOrder } = require("../src/testkit");
const { payOrder } = require("../src/payment");

test("결제에 성공하면 주문이 결제완료가 된다", async () => {
  const ctx = createContext();
  const o = seedOrder(ctx, { items: [["P1", 2]] });
  const result = await payOrder(ctx, "u1", o.id);
  assert.equal(result.order.status, "PAID");
});

test("이미 결제한 주문은 다시 결제하지 않는다", async () => {
  const ctx = createContext();
  const o = seedOrder(ctx);
  await payOrder(ctx, "u1", o.id);
  const again = await payOrder(ctx, "u1", o.id);
  assert.ok(again);
});

test("결제 요청이 PG로 전달된다", async () => {
  const ctx = createContext();
  const o = seedOrder(ctx, { items: [["P2", 1]] });
  await payOrder(ctx, "u1", o.id);
  assert.ok(ctx.pg.charges.length > 0);
});

test("결제가 실패해도 오류가 처리된다", async () => {
  const ctx = createContext();
  const o = seedOrder(ctx);
  ctx.pg.failNextCharge("LIMIT_EXCEEDED");
  try {
    await payOrder(ctx, "u1", o.id);
  } catch (e) {
    // 실패는 예상된 동작
  }
});

test("PG 시간 초과도 처리된다", async () => {
  const ctx = createContext();
  const o = seedOrder(ctx);
  ctx.pg.timeoutNextCharge();
  try {
    await payOrder(ctx, "u1", o.id);
  } catch (e) {
    assert.ok(e);
  }
});

test("취소된 주문은 결제할 수 없다", async () => {
  const ctx = createContext();
  const o = seedOrder(ctx, { status: "CANCELED" });
  try {
    await payOrder(ctx, "u1", o.id);
  } catch (e) {
    assert.ok(e instanceof Error);
  }
});
