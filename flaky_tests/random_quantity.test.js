// [불안정 테스트 A → 수정] 원인: 시드 없는 무작위 값(1~11)이 재고 10을 넘어 OUT_OF_STOCK 발생
// 수정: 시드 고정 난수(1~10, 재고 이내) + 경계값 1·10 직접 지정. 의도(수량이 기록된다/합계가 맞다)는 그대로.
const test = require("node:test");
const assert = require("node:assert/strict");
const { createContext } = require("../src/testkit");
const { addToCart, getCart } = require("../src/cart");

// 시드 고정 난수 (mulberry32): 실행할 때마다 같은 값이 나온다
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = seeded(20261106);
const QUANTITIES = [1, 10, ...Array.from({ length: 5 }, () => Math.floor(rand() * 10) + 1)]; // 모두 1~10

test("무작위 수량을 담으면 그 수량이 장바구니에 기록된다", () => {
  for (const qty of QUANTITIES) {
    const ctx = createContext();
    const cart = addToCart(ctx, "u1", "P1", qty);
    assert.equal(cart.items[0].quantity, qty, `수량 ${qty}`);
  }
});

test("무작위 수량의 합계 금액이 맞다", () => {
  for (const qty of QUANTITIES) {
    const ctx = createContext();
    addToCart(ctx, "u1", "P1", qty);
    assert.equal(getCart(ctx, "u1").totalAmount, 15000 * qty, `수량 ${qty}`);
  }
});