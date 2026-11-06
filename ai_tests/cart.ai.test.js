// 이 파일은 AI 도구가 생성한 테스트라고 가정합니다. (리뷰 대상 — 수정하지 않습니다)
const test = require("node:test");
const assert = require("node:assert/strict");
const { createContext } = require("../src/testkit");
const { addToCart, changeQuantity, removeItem, getCart } = require("../src/cart");

test("장바구니에 상품을 담을 수 있다", () => {
  const ctx = createContext();
  const cart = addToCart(ctx, "u1", "P1", 2);
  assert.ok(cart);
  assert.ok(cart.items.length > 0);
});

test("수량 2개를 담을 수 있다", () => {
  const ctx = createContext();
  const cart = addToCart(ctx, "u1", "P1", 2);
  assert.ok(cart.items.length > 0);
});

test("수량 3개를 담을 수 있다", () => {
  const ctx = createContext();
  const cart = addToCart(ctx, "u1", "P1", 3);
  assert.ok(cart.items.length > 0);
});

test("수량 5개를 담을 수 있다", () => {
  const ctx = createContext();
  const cart = addToCart(ctx, "u1", "P1", 5);
  assert.ok(cart.items.length > 0);
});

test("같은 상품을 다시 담으면 수량이 합산된다", () => {
  const ctx = createContext();
  addToCart(ctx, "u1", "P1", 2);
  const cart = addToCart(ctx, "u1", "P1", 3);
  assert.equal(cart.items.length, 1);
});

test("담긴 수량이 저장소에 기록된다", () => {
  const ctx = createContext();
  addToCart(ctx, "u1", "P1", 2);
  assert.equal(ctx.store.carts.get("u1").get("P1"), 2);
});

test("장바구니 합계 금액이 계산된다", () => {
  const ctx = createContext();
  addToCart(ctx, "u1", "P1", 2);
  addToCart(ctx, "u1", "P2", 1);
  const cart = getCart(ctx, "u1");
  const expected = cart.items.reduce((sum, i) => sum + i.lineTotal, 0);
  assert.equal(cart.totalAmount, expected);
});

test("수량을 변경할 수 있다", () => {
  const ctx = createContext();
  addToCart(ctx, "u1", "P1", 2);
  const cart = changeQuantity(ctx, "u1", "P1", 4);
  assert.ok(cart.items[0]);
});

test("상품을 삭제할 수 있다", () => {
  const ctx = createContext();
  addToCart(ctx, "u1", "P1", 2);
  const cart = removeItem(ctx, "u1", "P1");
  assert.equal(cart.items.length, 0);
});

test("잘못된 수량은 거부된다", () => {
  const ctx = createContext();
  assert.throws(() => addToCart(ctx, "u1", "P1", 0));
});

test("재고를 초과하면 담을 수 없다", () => {
  const ctx = createContext();
  assert.throws(() => addToCart(ctx, "u1", "P1", 11), Error);
});

test("판매 중지 상품은 담을 수 없다", () => {
  const ctx = createContext();
  assert.throws(() => addToCart(ctx, "u1", "P4", 1));
});

test("없는 상품은 담을 수 없다", () => {
  const ctx = createContext();
  assert.throws(() => addToCart(ctx, "u1", "NOPE", 1), Error);
});

test("장바구니에 없는 상품은 수량을 바꿀 수 없다", () => {
  const ctx = createContext();
  assert.throws(() => changeQuantity(ctx, "u1", "P1", 2));
});

test("구매자마다 장바구니가 분리된다", () => {
  const ctx = createContext();
  addToCart(ctx, "u1", "P1", 1);
  assert.equal(getCart(ctx, "u2").items.length, 0);
});
