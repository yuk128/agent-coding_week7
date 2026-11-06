// [불안정 테스트 A] 가끔 실패한다. 원인을 찾아 항상 같은 결과가 나오도록 고친다.
const test = require("node:test");
const assert = require("node:assert/strict");
const { createContext } = require("../src/testkit");
const { addToCart, getCart } = require("../src/cart");

test("무작위 수량을 담으면 그 수량이 장바구니에 기록된다", () => {
  const ctx = createContext();
  const qty = Math.floor(Math.random() * 11) + 1; // 1 ~ 11
  const cart = addToCart(ctx, "u1", "P1", qty);
  assert.equal(cart.items[0].quantity, qty);
});

test("무작위 수량의 합계 금액이 맞다", () => {
  const ctx = createContext();
  const qty = Math.floor(Math.random() * 11) + 1; // 1 ~ 11
  addToCart(ctx, "u1", "P1", qty);
  assert.equal(getCart(ctx, "u1").totalAmount, 15000 * qty);
});
