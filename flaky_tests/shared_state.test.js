// [불안정 테스트 C] 가끔 실패한다. 원인을 찾아 항상 같은 결과가 나오도록 고친다.
const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { createContext } = require("../src/testkit");
const { addToCart } = require("../src/cart");
const { createOrder } = require("../src/order");
const { jitter } = require("./_chaos");

const ctx = createContext(); // 이 파일의 모든 테스트가 함께 쓴다

describe("주문번호는 순서대로 발급된다", { concurrency: true }, () => {
  test("첫 번째 구매자의 주문번호는 ORD-0001", async () => {
    addToCart(ctx, "u1", "P1", 1);
    await jitter(15);
    const order = createOrder(ctx, "u1", { address: "서울시 중구" });
    assert.equal(order.id, "ORD-0001");
  });

  test("두 번째 구매자의 주문번호는 ORD-0002", async () => {
    addToCart(ctx, "u2", "P1", 1);
    await jitter(15);
    const order = createOrder(ctx, "u2", { address: "부산시 해운대구" });
    assert.equal(order.id, "ORD-0002");
  });
});
