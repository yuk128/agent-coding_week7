// Mission 2 — AI 주문 테스트(ai_tests/order.ai.test.js)의 약점을 고친 테스트
// 기대값 근거: docs/API_CONTRACT.md 2장
const test = require("node:test");
const assert = require("node:assert/strict");
const { addToCart, getCart } = require("../src/cart");
const { createOrder, canTransition, changeStatus } = require("../src/order");
const { expectCode, fresh } = require("./_helpers");

const ADDR = "서울시 중구 세종대로 110";
const STATES = ["PENDING_PAYMENT", "PAID", "PREPARING", "SHIPPING", "DELIVERED", "CANCELED"];
const ALLOWED = {
  PENDING_PAYMENT: ["PAID", "CANCELED"], PAID: ["PREPARING", "CANCELED"],
  PREPARING: ["SHIPPING"], SHIPPING: ["DELIVERED"], DELIVERED: [], CANCELED: [],
};
const stock = (ctx, id) => ctx.store.products.get(id).stock;

// [상태 공유] 테스트마다 새 컨텍스트 + [값 비교] 재고 · 합계 · 장바구니
test("[M2-O-01] 주문하면 재고가 차감되고 합계가 맞고 장바구니가 비워진다", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P1", 2);
  addToCart(ctx, "u1", "P2", 1);
  const order = createOrder(ctx, "u1", { address: ADDR });
  assert.equal(order.id, "ORD-0001");
  assert.equal(order.status, "PENDING_PAYMENT");
  assert.equal(order.totalAmount, 89000);
  assert.equal(stock(ctx, "P1"), 8);
  assert.equal(stock(ctx, "P2"), 2);
  assert.equal(getCart(ctx, "u1").items.length, 0);
});

// [동어반복] 기대값을 계약서의 단가로 직접 계산
test("[M2-O-02] 주문 항목의 단가 · 수량이 정확하다 (15000×2)", () => {
  const ctx = fresh();
  addToCart(ctx, "u2", "P1", 2);
  const order = createOrder(ctx, "u2", { address: "부산시 해운대구" });
  assert.deepEqual(order.items, [{ productId: "P1", name: "무선 마우스", unitPrice: 15000, quantity: 2 }]);
  assert.equal(order.totalAmount, 30000);
});

// [오류 코드 + 불변]
test("[M2-O-03] 빈 장바구니는 EMPTY_CART 이고 주문이 만들어지지 않는다", () => {
  const ctx = fresh();
  expectCode(() => createOrder(ctx, "u9", { address: "서울시" }), "EMPTY_CART");
  assert.equal(ctx.store.orders.size, 0);
});

test("[M2-O-04] 배송지가 없거나 비었거나 문자열이 아니면 INVALID_ADDRESS 이고 상태는 그대로다", () => {
  const ctx = fresh();
  addToCart(ctx, "u3", "P1", 1);
  for (const bad of [undefined, "", " ", "   ", 123, null]) {
    expectCode(() => createOrder(ctx, "u3", { address: bad }), "INVALID_ADDRESS");
  }
  expectCode(() => createOrder(ctx, "u3", {}), "INVALID_ADDRESS");
  assert.equal(stock(ctx, "P1"), 10);
  assert.equal(getCart(ctx, "u3").items[0].quantity, 1);
  assert.equal(ctx.store.orders.size, 0);
});

test("[M2-O-05] 재고가 부족하면 OUT_OF_STOCK 이고 shortages 가 정확하며 아무것도 바뀌지 않는다", () => {
  const ctx = fresh();
  addToCart(ctx, "u4", "P2", 2);
  ctx.store.products.get("P2").stock = 1;
  const err = expectCode(() => createOrder(ctx, "u4", { address: "서울시" }), "OUT_OF_STOCK");
  assert.deepEqual(err.details.shortages.map((s) => [s.productId, s.requested, s.available]), [["P2", 2, 1]]);
  assert.equal(stock(ctx, "P2"), 1);
  assert.equal(getCart(ctx, "u4").items[0].quantity, 2);
  assert.equal(ctx.store.orders.size, 0);
});

// [AI 가 놓친 규칙] 부족한 상품이 여럿이면 모두 shortages 에 담긴다
test("[M2-O-06] 부족한 상품이 여럿이면 모두 shortages 에 담기고 충분한 상품은 빠진다", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P1", 2);
  addToCart(ctx, "u1", "P2", 3);
  addToCart(ctx, "u1", "P5", 1);
  ctx.store.products.get("P1").stock = 1;
  ctx.store.products.get("P2").stock = 2;
  const err = expectCode(() => createOrder(ctx, "u1", { address: ADDR }), "OUT_OF_STOCK");
  const rows = err.details.shortages.map((s) => [s.productId, s.requested, s.available]).sort();
  assert.deepEqual(rows, [["P1", 2, 1], ["P2", 3, 2]]);
  assert.equal(stock(ctx, "P5"), 1);
});

// [약한 단언] assert.ok(changed) → 상태 값과 저장소 확인
test("[M2-O-07] 상태를 바꾸면 반환값과 저장소의 상태가 모두 바뀐다", () => {
  const ctx = fresh();
  addToCart(ctx, "u5", "P5", 1);
  const order = createOrder(ctx, "u5", { address: "서울시" });
  const changed = changeStatus(ctx, order.id, "PAID");
  assert.equal(changed.status, "PAID");
  assert.equal(ctx.store.orders.get(order.id).status, "PAID");
});

// [전이표 일부만 확인] 36조합 전체
test("[M2-O-08] canTransition 은 36조합 중 전이표의 6쌍만 true 이다", () => {
  for (const from of STATES) {
    for (const to of STATES) {
      assert.equal(canTransition(from, to), ALLOWED[from].includes(to), `${from} -> ${to}`);
    }
  }
});

test("[M2-O-09] 허용되지 않은 전이 30쌍은 모두 INVALID_STATE 이고 상태가 그대로다", () => {
  for (const from of STATES) {
    for (const to of STATES) {
      if (ALLOWED[from].includes(to)) continue;
      const ctx = fresh();
      addToCart(ctx, "u6", "P1", 1);
      const order = createOrder(ctx, "u6", { address: "서울시" });
      ctx.store.orders.get(order.id).status = from;
      const err = expectCode(() => changeStatus(ctx, order.id, to), "INVALID_STATE");
      assert.deepEqual(err.details, { from, to });
      assert.equal(ctx.store.orders.get(order.id).status, from);
    }
  }
});