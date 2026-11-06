// [불안정 테스트 C → 수정] 원인: 모든 테스트가 ctx 하나를 공유 + concurrency:true 로 실행 순서 비결정
// 수정: 테스트마다 새 ctx, 순서 의존 제거(두 번째 테스트는 첫 주문을 직접 만든 뒤 확인). 의도는 그대로.
const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { createContext } = require("../src/testkit");
const { addToCart } = require("../src/cart");
const { createOrder } = require("../src/order");

describe("주문번호는 순서대로 발급된다", () => {
  test("첫 번째 구매자의 주문번호는 ORD-0001", () => {
    const ctx = createContext();
    addToCart(ctx, "u1", "P1", 1);
    const order = createOrder(ctx, "u1", { address: "서울시 중구" });
    assert.equal(order.id, "ORD-0001");
  });

  test("두 번째 구매자의 주문번호는 ORD-0002", () => {
    const ctx = createContext();
    addToCart(ctx, "u1", "P1", 1);
    const first = createOrder(ctx, "u1", { address: "서울시 중구" });
    assert.equal(first.id, "ORD-0001");
    addToCart(ctx, "u2", "P1", 1);
    const order = createOrder(ctx, "u2", { address: "부산시 해운대구" });
    assert.equal(order.id, "ORD-0002");
  });
});