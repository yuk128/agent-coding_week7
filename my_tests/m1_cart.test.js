// Mission 1 — 장바구니 테스트 (docs/TEST_DESIGN.md 의 케이스 ID 를 테스트 이름에 쓴다)
const test = require("node:test");
const assert = require("node:assert/strict");
const { addToCart, changeQuantity, removeItem, getCart } = require("../src/cart");
const { expectCode, fresh } = require("./_helpers");

// 예시 (이 스타일로 작성한다: 준비 → 실행 → 값으로 확인)
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

test.todo("[TC-C-03] TODO: 동등분할 · 경계값 표에서 도출한 다음 케이스를 작성한다");
test.todo("[TC-C-04] TODO: 합산 · 재고 경계 · maxAddable");
test.todo("[TC-C-05] TODO: 수량 변경 · 삭제 · 순서 · 구매자 분리");
