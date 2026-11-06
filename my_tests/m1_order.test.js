// Mission 1 — 주문 생성 · 상태 전이 테스트
// 기대값의 근거는 docs/API_CONTRACT.md 2장이다. (src 코드를 보고 만든 값 없음)
const test = require("node:test");
const assert = require("node:assert/strict");
const { addToCart, getCart } = require("../src/cart");
const { createOrder, canTransition, changeStatus } = require("../src/order");
const { expectCode, fresh } = require("./_helpers");

const ADDR = "서울시 중구 세종대로 110";
const STATES = ["PENDING_PAYMENT", "PAID", "PREPARING", "SHIPPING", "DELIVERED", "CANCELED"];
// 계약서 2장 상태 전이표
const ALLOWED = {
  PENDING_PAYMENT: ["PAID", "CANCELED"],
  PAID: ["PREPARING", "CANCELED"],
  PREPARING: ["SHIPPING"],
  SHIPPING: ["DELIVERED"],
  DELIVERED: [],
  CANCELED: [],
};
const stockOf = (ctx, id) => ctx.store.products.get(id).stock;
const orderCount = (ctx) => ctx.store.orders.size;
// 주문 한 건을 만든 컨텍스트를 돌려준다
function withOrder() {
  const ctx = fresh();
  addToCart(ctx, "u1", "P1", 1);
  const order = createOrder(ctx, "u1", { address: ADDR });
  return { ctx, order };
}

test("[TC-O-01] 재고가 충분하면 결제대기 주문이 만들어지고 재고가 차감되며 장바구니가 비워진다", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P1", 2);
  addToCart(ctx, "u1", "P2", 1);
  const order = createOrder(ctx, "u1", { address: "서울시 중구 세종대로 110" });
  assert.equal(order.id, "ORD-0001");
  assert.equal(order.status, "PENDING_PAYMENT");
  assert.equal(order.totalAmount, 2 * 15000 + 59000);
  assert.equal(ctx.store.products.get("P1").stock, 8);
  assert.equal(ctx.store.products.get("P2").stock, 2);
});

test("[TC-O-02] 배송지가 비어 있거나 문자열이 아니면 INVALID_ADDRESS 이고 재고 · 장바구니 · 주문은 바뀌지 않는다", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P1", 2);
  for (const bad of ["", " ", "   ", 123, null, undefined]) {
    expectCode(() => createOrder(ctx, "u1", { address: bad }), "INVALID_ADDRESS");
  }
  assert.equal(stockOf(ctx, "P1"), 10);
  assert.equal(getCart(ctx, "u1").items[0].quantity, 2);
  assert.equal(orderCount(ctx), 0);
});

test("[TC-O-03] 배송지의 앞뒤 공백은 제거되어 저장된다", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P1", 1);
  const order = createOrder(ctx, "u1", { address: "  서울시 중구  " });
  assert.equal(order.address, "서울시 중구");
  assert.equal(ctx.store.orders.get(order.id).address, "서울시 중구");
});

test("[TC-O-04] 빈 장바구니로는 EMPTY_CART 이고 주문이 만들어지지 않는다", () => {
  const ctx = fresh();
  expectCode(() => createOrder(ctx, "u1", { address: ADDR }), "EMPTY_CART");
  assert.equal(orderCount(ctx), 0);
});

test("[TC-O-05] 재고가 부족하면 OUT_OF_STOCK 과 shortages 가 나오고 재고 · 장바구니 · 주문은 바뀌지 않는다", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P2", 3);
  ctx.store.products.get("P2").stock = 2;
  const err = expectCode(() => createOrder(ctx, "u1", { address: ADDR }), "OUT_OF_STOCK");
  assert.deepEqual(err.details.shortages, [
    { productId: "P2", name: ctx.store.products.get("P2").name, requested: 3, available: 2 },
  ]);
  assert.equal(stockOf(ctx, "P2"), 2);
  assert.equal(getCart(ctx, "u1").items[0].quantity, 3);
  assert.equal(orderCount(ctx), 0);
});

test("[TC-O-06] 부족한 상품은 모두 shortages 에 담기고 충분한 상품은 빠지며 재고는 아무것도 바뀌지 않는다", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P1", 2);
  addToCart(ctx, "u1", "P2", 3);
  addToCart(ctx, "u1", "P5", 1);
  ctx.store.products.get("P1").stock = 1;
  ctx.store.products.get("P2").stock = 2;
  const err = expectCode(() => createOrder(ctx, "u1", { address: ADDR }), "OUT_OF_STOCK");
  const rows = err.details.shortages
    .map((s) => [s.productId, s.requested, s.available])
    .sort((a, b) => a[0].localeCompare(b[0]));
  assert.deepEqual(rows, [["P1", 2, 1], ["P2", 3, 2]]);
  assert.equal(stockOf(ctx, "P1"), 1);
  assert.equal(stockOf(ctx, "P2"), 2);
  assert.equal(stockOf(ctx, "P5"), 1);
  assert.equal(orderCount(ctx), 0);
});

test("[TC-O-07] 담은 뒤 판매 중지된 상품은 shortages 의 available 이 0 이다", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P1", 2);
  ctx.store.products.get("P1").status = "STOPPED";
  const err = expectCode(() => createOrder(ctx, "u1", { address: ADDR }), "OUT_OF_STOCK");
  assert.deepEqual(err.details.shortages, [
    { productId: "P1", name: ctx.store.products.get("P1").name, requested: 2, available: 0 },
  ]);
  assert.equal(stockOf(ctx, "P1"), 10);
  assert.equal(orderCount(ctx), 0);
});

test("[TC-O-08] 재고와 딱 맞는 수량도 주문되고 재고는 0 이 된다", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P2", 3);
  const order = createOrder(ctx, "u1", { address: ADDR });
  assert.equal(order.status, "PENDING_PAYMENT");
  assert.equal(stockOf(ctx, "P2"), 0);
});

test("[TC-O-09] 주문 뒤에 상품 가격이 바뀌어도 주문의 단가와 합계는 그대로다", () => {
  const { ctx, order } = withOrder();
  ctx.store.products.get("P1").price = 99999;
  const saved = ctx.store.orders.get(order.id);
  assert.equal(saved.items[0].unitPrice, 15000);
  assert.equal(saved.totalAmount, 15000);
});

test("[TC-O-10] 주문번호는 4자리로 순차 발급되고 주문 후 장바구니는 비워진다", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P1", 1);
  const first = createOrder(ctx, "u1", { address: ADDR });
  assert.equal(getCart(ctx, "u1").items.length, 0);
  addToCart(ctx, "u1", "P1", 1);
  const second = createOrder(ctx, "u1", { address: ADDR });
  assert.equal(first.id, "ORD-0001");
  assert.equal(second.id, "ORD-0002");
});

test("[TC-O-11] 주문의 createdAt 은 시계의 현재 시각이다", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P1", 1);
  const order = createOrder(ctx, "u1", { address: ADDR });
  assert.equal(order.createdAt, ctx.clock.now().toISOString());
});

test("[TC-O-12] 마지막 재고 1개를 두 구매자가 주문하면 한 명만 성공하고 재고는 0 미만이 되지 않는다", () => {
  const ctx = fresh();
  addToCart(ctx, "u1", "P5", 1);
  addToCart(ctx, "u2", "P5", 1);
  createOrder(ctx, "u1", { address: ADDR });
  expectCode(() => createOrder(ctx, "u2", { address: ADDR }), "OUT_OF_STOCK");
  assert.equal(stockOf(ctx, "P5"), 0);
  assert.equal(orderCount(ctx), 1);
});

test("[TC-O-13] canTransition 은 상태 36조합 중 전이표의 6쌍만 true 이다", () => {
  let trueCount = 0;
  for (const from of STATES) {
    for (const to of STATES) {
      const expected = ALLOWED[from].includes(to);
      assert.equal(canTransition(from, to), expected, `${from} -> ${to}`);
      if (expected) trueCount += 1;
    }
  }
  assert.equal(trueCount, 6);
});

test("[TC-O-14] 허용된 전이 6쌍은 changeStatus 로 상태가 바뀌고 바뀐 주문이 반환된다", () => {
  for (const from of STATES) {
    for (const to of ALLOWED[from]) {
      const { ctx, order } = withOrder();
      ctx.store.orders.get(order.id).status = from;
      const result = changeStatus(ctx, order.id, to);
      assert.equal(result.status, to, `${from} -> ${to} 반환값`);
      assert.equal(ctx.store.orders.get(order.id).status, to, `${from} -> ${to} 저장소`);
    }
  }
});

test("[TC-O-15] 허용되지 않은 전이 30쌍은 INVALID_STATE(details from · to)이고 상태는 바뀌지 않는다", () => {
  for (const from of STATES) {
    for (const to of STATES) {
      if (ALLOWED[from].includes(to)) continue;
      const { ctx, order } = withOrder();
      ctx.store.orders.get(order.id).status = from;
      const err = expectCode(() => changeStatus(ctx, order.id, to), "INVALID_STATE");
      assert.deepEqual(err.details, { from, to });
      assert.equal(ctx.store.orders.get(order.id).status, from, `${from} -> ${to} 불변`);
    }
  }
});

test("[TC-O-16] 없는 주문의 changeStatus 는 NOT_FOUND 이다", () => {
  const ctx = fresh();
  expectCode(() => changeStatus(ctx, "ORD-9999", "PAID"), "NOT_FOUND");
});

test("[TC-O-17] 반환된 주문을 고쳐도 저장소의 주문은 바뀌지 않는다", () => {
  const { ctx, order } = withOrder();
  order.status = "DELIVERED";
  order.items.push({ productId: "X" });
  const saved = ctx.store.orders.get(order.id);
  assert.equal(saved.status, "PENDING_PAYMENT");
  assert.equal(saved.items.length, 1);
});