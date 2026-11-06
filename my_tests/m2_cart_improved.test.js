// Mission 2 — AI 장바구니 테스트(ai_tests/cart.ai.test.js)의 약점을 고친 테스트
// 기대값 근거: docs/API_CONTRACT.md 1장
const test = require("node:test");
const assert = require("node:assert/strict");
const { addToCart, changeQuantity, removeItem, getCart } = require("../src/cart");
const { expectCode, fresh } = require("./_helpers");

const big = () => fresh({ products: [{ id: "PB", name: "대량", price: 1000, stock: 500, status: "ON_SALE" }] });
const qty = (ctx, u, p) => (getCart(ctx, u).items.find((i) => i.productId === p) || {}).quantity;

// [약한 단언] assert.ok 대신 값을 비교한다
test("[M2-C-01] 담으면 수량 · 단가 · 소계가 정확한 값으로 기록된다", () => {
  const cart = addToCart(fresh(), "u1", "P1", 3);
  assert.deepEqual(cart.items, [{ productId: "P1", name: "무선 마우스", unitPrice: 15000, quantity: 3, lineTotal: 45000 }]);
  assert.equal(cart.totalAmount, 45000);
});

// [경계값 누락] 1, 99 는 성공, 100 은 오류
test("[M2-C-02] 수량 1 · 99 는 담기고 100 은 INVALID_QUANTITY 이다", () => {
  const ctx = big();
  assert.equal(addToCart(ctx, "u1", "PB", 1).items[0].quantity, 1);
  assert.equal(addToCart(big(), "u1", "PB", 99).items[0].quantity, 99);
  expectCode(() => addToCart(big(), "u1", "PB", 100), "INVALID_QUANTITY");
});

// [합산을 값으로 확인]
test("[M2-C-03] 2개 담고 3개 더 담으면 수량이 5 이다", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P1", 2);
  assert.equal(addToCart(ctx, "u1", "P1", 3).items[0].quantity, 5);
});

// [동어반복] 기대값을 계약서의 단가로 직접 계산한다
test("[M2-C-04] 합계는 단가 × 수량의 합과 같다 (15000×2 + 59000×1 = 89000)", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P1", 2);
  addToCart(ctx, "u1", "P2", 1);
  assert.equal(getCart(ctx, "u1").totalAmount, 89000);
});

// [수량 변경은 합산이 아님]
test("[M2-C-05] 수량을 2 에서 4 로 바꾸면 4 이다 (6 이 아님)", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P1", 2);
  const cart = changeQuantity(ctx, "u1", "P1", 4);
  assert.equal(cart.items[0].quantity, 4);
  assert.equal(cart.totalAmount, 60000);
});

// [삭제: 다른 항목 유지]
test("[M2-C-06] 한 상품을 삭제해도 다른 상품은 남는다", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P1", 2);
  addToCart(ctx, "u1", "P2", 1);
  assert.deepEqual(removeItem(ctx, "u1", "P1").items.map((i) => i.productId), ["P2"]);
});

// [오류 코드 확인 + 불변]
test("[M2-C-07] 잘못된 수량은 INVALID_QUANTITY 이고 장바구니는 비어 있다", () => {
  const ctx = fresh();
  for (const bad of [0, -1, 100, 1.5, "2", null]) {
    expectCode(() => addToCart(ctx, "u1", "P1", bad), "INVALID_QUANTITY");
  }
  assert.equal(getCart(ctx, "u1").items.length, 0);
});

test("[M2-C-08] 재고 10 에 11개는 OUT_OF_STOCK(maxAddable 10), 10개는 성공이다", () => {
  const err = expectCode(() => addToCart(fresh(), "u1", "P1", 11), "OUT_OF_STOCK");
  assert.equal(err.details.maxAddable, 10);
  assert.equal(addToCart(fresh(), "u1", "P1", 10).items[0].quantity, 10);
});

test("[M2-C-09] 판매 중지 · 없는 상품은 NOT_FOUND 이고 장바구니는 비어 있다", () => {
  const ctx = fresh();
  expectCode(() => addToCart(ctx, "u1", "P4", 1), "NOT_FOUND");
  expectCode(() => addToCart(ctx, "u1", "NOPE", 1), "NOT_FOUND");
  assert.equal(getCart(ctx, "u1").items.length, 0);
});

test("[M2-C-10] 장바구니에 없는 상품의 수량 변경은 NOT_FOUND 이고 기존 항목은 그대로다", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P1", 2);
  expectCode(() => changeQuantity(ctx, "u1", "P2", 1), "NOT_FOUND");
  assert.equal(qty(ctx, "u1", "P1"), 2);
});

// [양방향 확인]
test("[M2-C-11] 구매자마다 장바구니가 분리되어 서로 섞이지 않는다", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P1", 2);
  addToCart(ctx, "u2", "P1", 5);
  assert.equal(qty(ctx, "u1", "P1"), 2);
  assert.equal(qty(ctx, "u2", "P1"), 5);
});

// [AI 가 놓친 규칙: 합산 후 재고 초과 maxAddable]
test("[M2-C-12] 7개 담은 재고 10 상품에 5개 더하면 OUT_OF_STOCK, maxAddable 3, 수량 7 유지", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P1", 7);
  const err = expectCode(() => addToCart(ctx, "u1", "P1", 5), "OUT_OF_STOCK");
  assert.equal(err.details.maxAddable, 3);
  assert.equal(qty(ctx, "u1", "P1"), 7);
});