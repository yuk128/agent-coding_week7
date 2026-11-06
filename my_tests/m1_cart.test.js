// Mission 1 — 장바구니 테스트 (케이스 ID 는 docs/TEST_DESIGN.md 와 같다)
// 기대값의 근거는 docs/API_CONTRACT.md 1장이다. (src 코드를 보고 만든 값 없음)
const test = require("node:test");
const assert = require("node:assert/strict");
const { addToCart, changeQuantity, removeItem, getCart } = require("../src/cart");
const { expectCode, fresh } = require("./_helpers");

// 재고가 아주 많은 상품 하나만 있는 컨텍스트 (수량 99 경계 확인용)
const bigStock = () =>
  fresh({ products: [{ id: "PB", name: "대량 상품", price: 1000, stock: 500, status: "ON_SALE" }] });
const ids = (ctx, u) => getCart(ctx, u).items.map((i) => i.productId);
const qty = (ctx, u, pid) => {
  const it = getCart(ctx, u).items.find((i) => i.productId === pid);
  return it ? it.quantity : undefined;
};

test("[TC-C-01] 재고가 충분한 상품을 담으면 수량과 소계가 장바구니에 기록된다", () => {
  const ctx = fresh();
  const cart = addToCart(ctx, "u1", "P1", 2);
  assert.deepEqual(cart.items, [{ productId: "P1", name: "무선 마우스", unitPrice: 15000, quantity: 2, lineTotal: 30000 }]);
  assert.equal(cart.totalAmount, 30000);
});

test("[TC-C-02] 수량이 0 이면 INVALID_QUANTITY 이고 장바구니는 바뀌지 않는다", () => {
  const ctx = fresh();
  expectCode(() => addToCart(ctx, "u1", "P1", 0), "INVALID_QUANTITY");
  assert.equal(getCart(ctx, "u1").items.length, 0);
});

test("[TC-C-03] 수량 1(최솟값)은 담을 수 있다", () => {
  const ctx = fresh();
  const cart = addToCart(ctx, "u1", "P1", 1);
  assert.equal(cart.items[0].quantity, 1);
  assert.equal(cart.totalAmount, 15000);
});

test("[TC-C-04] 수량 99(최댓값)는 재고가 충분하면 담을 수 있다", () => {
  const ctx = bigStock();
  const cart = addToCart(ctx, "u1", "PB", 99);
  assert.equal(cart.items[0].quantity, 99);
  assert.equal(cart.totalAmount, 99000);
});

test("[TC-C-05] 수량 100 은 INVALID_QUANTITY 이고 장바구니는 바뀌지 않는다", () => {
  const ctx = bigStock();
  expectCode(() => addToCart(ctx, "u1", "PB", 100), "INVALID_QUANTITY");
  assert.equal(getCart(ctx, "u1").items.length, 0);
});

test("[TC-C-06] 음수 · 소수 · 문자열 · null · NaN 수량은 모두 INVALID_QUANTITY 이고 장바구니는 바뀌지 않는다", () => {
  const ctx = fresh();
  for (const bad of [-1, 1.5, "2", null, NaN]) {
    expectCode(() => addToCart(ctx, "u1", "P1", bad), "INVALID_QUANTITY");
  }
  assert.equal(getCart(ctx, "u1").items.length, 0);
});

test("[TC-C-07] 이미 담긴 상품을 다시 담으면 수량이 합산된다", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P1", 2);
  const cart = addToCart(ctx, "u1", "P1", 3);
  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].quantity, 5);
});

test("[TC-C-08] 재고와 딱 맞는 수량은 담을 수 있다", () => {
  const ctx = fresh();
  const cart = addToCart(ctx, "u1", "P2", 3);
  assert.equal(cart.items[0].quantity, 3);
});

test("[TC-C-09] 재고보다 1개 많으면 OUT_OF_STOCK 이고 maxAddable 은 3, 장바구니는 바뀌지 않는다", () => {
  const ctx = fresh();
  const err = expectCode(() => addToCart(ctx, "u1", "P2", 4), "OUT_OF_STOCK");
  assert.equal(err.details.maxAddable, 3);
  assert.equal(getCart(ctx, "u1").items.length, 0);
});

test("[TC-C-10] 품절 상품은 OUT_OF_STOCK 이고 maxAddable 은 0, 장바구니는 바뀌지 않는다", () => {
  const ctx = fresh();
  const err = expectCode(() => addToCart(ctx, "u1", "P3", 1), "OUT_OF_STOCK");
  assert.equal(err.details.maxAddable, 0);
  assert.equal(getCart(ctx, "u1").items.length, 0);
});

test("[TC-C-11] 이미 7개 담은 재고 10 상품에 5개를 더하면 OUT_OF_STOCK, maxAddable 3, 수량 7 유지", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P1", 7);
  const err = expectCode(() => addToCart(ctx, "u1", "P1", 5), "OUT_OF_STOCK");
  assert.equal(err.details.maxAddable, 3);
  assert.equal(qty(ctx, "u1", "P1"), 7);
});

test("[TC-C-12] 이미 7개 담은 재고 10 상품에 3개를 더하면 합산 10으로 성공한다", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P1", 7);
  const cart = addToCart(ctx, "u1", "P1", 3);
  assert.equal(cart.items[0].quantity, 10);
});

test("[TC-C-13] 판매 중지 상품은 NOT_FOUND 이고 장바구니는 바뀌지 않는다", () => {
  const ctx = fresh();
  expectCode(() => addToCart(ctx, "u1", "P4", 1), "NOT_FOUND");
  assert.equal(getCart(ctx, "u1").items.length, 0);
});

test("[TC-C-14] 없는 상품은 NOT_FOUND 이고 장바구니는 바뀌지 않는다", () => {
  const ctx = fresh();
  expectCode(() => addToCart(ctx, "u1", "P999", 1), "NOT_FOUND");
  assert.equal(getCart(ctx, "u1").items.length, 0);
});

test("[TC-C-15] changeQuantity 는 합산이 아니라 수량을 바꾼다", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P1", 2);
  const cart = changeQuantity(ctx, "u1", "P1", 5);
  assert.equal(cart.items[0].quantity, 5);
  assert.equal(cart.totalAmount, 75000);
});

test("[TC-C-16] changeQuantity 로 재고와 딱 맞는 수량(10)으로 바꿀 수 있다", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P1", 2);
  const cart = changeQuantity(ctx, "u1", "P1", 10);
  assert.equal(cart.items[0].quantity, 10);
});

test("[TC-C-17] changeQuantity 로 재고보다 1개 많게(11) 바꾸면 OUT_OF_STOCK 이고 수량은 그대로다", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P1", 2);
  expectCode(() => changeQuantity(ctx, "u1", "P1", 11), "OUT_OF_STOCK");
  assert.equal(qty(ctx, "u1", "P1"), 2);
});

test("[TC-C-18] changeQuantity 수량 0 은 INVALID_QUANTITY 이고 항목은 삭제되지 않는다", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P1", 2);
  expectCode(() => changeQuantity(ctx, "u1", "P1", 0), "INVALID_QUANTITY");
  assert.equal(qty(ctx, "u1", "P1"), 2);
});

test("[TC-C-19] 장바구니에 없는 상품의 changeQuantity 는 NOT_FOUND 이다", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P1", 2);
  expectCode(() => changeQuantity(ctx, "u1", "P2", 1), "NOT_FOUND");
  assert.deepEqual(ids(ctx, "u1"), ["P1"]);
});

test("[TC-C-20] 담은 뒤 판매 중지된 상품의 changeQuantity 는 NOT_FOUND 이고 수량은 그대로다", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P1", 2);
  ctx.store.products.get("P1").status = "STOPPED";
  expectCode(() => changeQuantity(ctx, "u1", "P1", 3), "NOT_FOUND");
  assert.equal(qty(ctx, "u1", "P1"), 2);
});

test("[TC-C-21] removeItem 은 지정한 상품만 빼고 나머지는 유지한다", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P1", 2);
  addToCart(ctx, "u1", "P2", 1);
  const cart = removeItem(ctx, "u1", "P1");
  assert.deepEqual(cart.items.map((i) => i.productId), ["P2"]);
  assert.equal(cart.totalAmount, 59000);
});

test("[TC-C-22] 장바구니에 없는 상품의 removeItem 은 NOT_FOUND 이고 장바구니는 그대로다", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P1", 2);
  expectCode(() => removeItem(ctx, "u1", "P2"), "NOT_FOUND");
  assert.deepEqual(ids(ctx, "u1"), ["P1"]);
});

test("[TC-C-23] 장바구니 항목은 담은 순서대로 나온다", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P2", 1);
  addToCart(ctx, "u1", "P1", 1);
  addToCart(ctx, "u1", "P5", 1);
  assert.deepEqual(ids(ctx, "u1"), ["P2", "P1", "P5"]);
});

test("[TC-C-24] 장바구니가 없는 구매자의 getCart 는 빈 목록과 합계 0 이다", () => {
  const ctx = fresh();
  assert.deepEqual(getCart(ctx, "u9"), { userId: "u9", items: [], totalAmount: 0 });
});

test("[TC-C-25] 구매자마다 장바구니가 분리된다", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P1", 2);
  addToCart(ctx, "u2", "P1", 5);
  assert.equal(qty(ctx, "u1", "P1"), 2);
  assert.equal(qty(ctx, "u2", "P1"), 5);
  assert.equal(getCart(ctx, "u3").items.length, 0);
});

test("[TC-C-26] 여러 상품의 소계와 합계가 정확하다", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P1", 2);
  addToCart(ctx, "u1", "P2", 1);
  const cart = getCart(ctx, "u1");
  assert.deepEqual(cart.items.map((i) => i.lineTotal), [30000, 59000]);
  assert.equal(cart.totalAmount, 89000);
});

test("[TC-C-27] 반환된 장바구니를 고쳐도 저장소의 장바구니는 바뀌지 않는다", () => {
  const ctx = fresh();
  const cart = addToCart(ctx, "u1", "P1", 2);
  cart.items[0].quantity = 99;
  cart.items.push({ productId: "X" });
  assert.equal(qty(ctx, "u1", "P1"), 2);
  assert.equal(getCart(ctx, "u1").items.length, 1);
});
