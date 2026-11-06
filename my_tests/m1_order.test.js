// Mission 1 — 주문 생성 · 상태 전이 테스트
const test = require("node:test");
const assert = require("node:assert/strict");
const { addToCart } = require("../src/cart");
const { createOrder, canTransition, changeStatus } = require("../src/order");
const { expectCode, fresh } = require("./_helpers");

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

test.todo("[TC-O-02] TODO: 배송지 검증(공백 · 빈 문자열 · 문자열 아님)");
test.todo("[TC-O-03] TODO: 재고 전수 검사와 shortages (여러 상품 · 판매 중지 · 실패 시 불변)");
test.todo("[TC-O-04] TODO: 상태 전이표 전체(허용 · 거부)와 오류 코드");
