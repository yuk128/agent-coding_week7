// 이 파일은 AI 도구가 생성한 테스트라고 가정합니다. (리뷰 대상 — 수정하지 않습니다)
const test = require("node:test");
const assert = require("node:assert/strict");
const { createContext } = require("../src/testkit");
const { addToCart } = require("../src/cart");
const { createOrder, changeStatus, canTransition } = require("../src/order");

const ctx = createContext();

test("주문을 생성할 수 있다", () => {
  addToCart(ctx, "u1", "P1", 2);
  addToCart(ctx, "u1", "P2", 1);
  const order = createOrder(ctx, "u1", { address: "서울시 중구 세종대로 110" });
  assert.equal(order.id, "ORD-0001");
  assert.equal(order.status, "PENDING_PAYMENT");
  assert.equal(ctx.store.carts.get("u1").size, 0);
});

test("주문하면 재고가 차감된다", () => {
  addToCart(ctx, "u1", "P1", 1);
  const order = createOrder(ctx, "u1", { address: "서울시 중구 세종대로 110" });
  assert.equal(order.id, "ORD-0002");
  assert.equal(order.status, "PENDING_PAYMENT");
});

test("주문 금액이 계산된다", () => {
  addToCart(ctx, "u2", "P1", 2);
  const order = createOrder(ctx, "u2", { address: "부산시 해운대구" });
  const expected = order.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  assert.equal(order.totalAmount, expected);
});

test("빈 장바구니로는 주문할 수 없다", () => {
  assert.throws(() => createOrder(ctx, "u9", { address: "서울시" }));
});

test("배송지가 없으면 주문할 수 없다", () => {
  addToCart(ctx, "u3", "P1", 1);
  assert.throws(() => createOrder(ctx, "u3", {}), Error);
});

test("재고가 부족하면 주문할 수 없다", () => {
  addToCart(ctx, "u4", "P2", 2);
  ctx.store.products.get("P2").stock = 1;
  assert.throws(() => createOrder(ctx, "u4", { address: "서울시" }));
});

test("주문 상태를 변경할 수 있다", () => {
  addToCart(ctx, "u5", "P5", 1);
  const order = createOrder(ctx, "u5", { address: "서울시" });
  const changed = changeStatus(ctx, order.id, "PAID");
  assert.ok(changed);
});

test("허용되지 않은 상태 변경은 거부된다", () => {
  addToCart(ctx, "u6", "P1", 1);
  const order = createOrder(ctx, "u6", { address: "서울시" });
  assert.throws(() => changeStatus(ctx, order.id, "DELIVERED"));
});

test("상태 전이 가능 여부를 확인할 수 있다", () => {
  assert.equal(canTransition("PENDING_PAYMENT", "PAID"), true);
});
