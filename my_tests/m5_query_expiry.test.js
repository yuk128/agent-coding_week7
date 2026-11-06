// Mission 5: 자동 취소(expiry) 테스트 — 기대값 근거: docs/API_CONTRACT.md 6장
// (주문 조회 TC-Q-01·02 는 m2_query_improved.test.js 의 M2-Q01~Q13 이 다룬다)
const test = require("node:test");
const assert = require("node:assert/strict");
const { createContext, createFakeClock, seedOrder } = require("../src/testkit");
const { expirePendingOrders } = require("../src/expiry");

const MIN = 60 * 1000;
const setup = () => {
  const clock = createFakeClock();
  return { clock, ctx: createContext({ clock }) };
};
const stock = (ctx, id) => ctx.store.products.get(id).stock;
const statusOf = (ctx, id) => ctx.store.orders.get(id).status;

// 잡는 결함: 기본 30분 상수, 경계 이동(>= → >), 단위 상수(60·1000), 문장 삭제(재고 복원·상태 변경)
test("TC-E-01 기본 30분: 29분 59.999초는 취소 안 됨, 정확히 30분이면 취소·재고 복원", () => {
  const { clock, ctx } = setup();
  const o = seedOrder(ctx, { items: [["P1", 2]] });
  const before = stock(ctx, "P1");

  clock.advance(30 * MIN - 1);
  assert.deepEqual(expirePendingOrders(ctx, {}), []);
  assert.equal(statusOf(ctx, o.id), "PENDING_PAYMENT");
  assert.equal(stock(ctx, "P1"), before);

  clock.advance(1); // 정확히 30분
  assert.deepEqual(expirePendingOrders(ctx, {}), [o.id]);
  assert.equal(statusOf(ctx, o.id), "CANCELED");
  assert.equal(stock(ctx, "P1"), before + 2);
});

// 잡는 결함: timeoutMinutes 인자를 무시하거나 단위를 틀리게 곱함
test("TC-E-02 timeoutMinutes 10 지정: 9분 59.999초는 유지, 정확히 10분이면 취소", () => {
  const { clock, ctx } = setup();
  const o = seedOrder(ctx, { items: [["P1", 1]] });
  clock.advance(10 * MIN - 1);
  assert.deepEqual(expirePendingOrders(ctx, { timeoutMinutes: 10 }), []);
  clock.advance(1);
  assert.deepEqual(expirePendingOrders(ctx, { timeoutMinutes: 10 }), [o.id]);
  assert.equal(statusOf(ctx, o.id), "CANCELED");
});

// 잡는 결함: 시간 차 계산 부호(now - createdAt)가 뒤집혀 막 만든 주문도 취소됨, 조건 항상 참
test("TC-E-03 방금 만든 주문(0분)과 1분 지난 주문은 취소되지 않는다", () => {
  const { clock, ctx } = setup();
  const a = seedOrder(ctx, { items: [["P1", 1]] });
  assert.deepEqual(expirePendingOrders(ctx, {}), []);
  clock.advance(1 * MIN);
  assert.deepEqual(expirePendingOrders(ctx, {}), []);
  assert.equal(statusOf(ctx, a.id), "PENDING_PAYMENT");
});

// 잡는 결함: 여러 건 중 일부만 처리, 재고를 상품별로 복원하지 않음
test("TC-E-04 여러 건: 모두 취소되어 번호 오름차순으로 반환되고 상품별 재고가 복원된다", () => {
  const { clock, ctx } = setup();
  const a = seedOrder(ctx, { items: [["P1", 2], ["P2", 1]] });
  const b = seedOrder(ctx, { items: [["P1", 3]] });
  const c = seedOrder(ctx, { items: [["P2", 1]] });
  const p1 = stock(ctx, "P1");
  const p2 = stock(ctx, "P2");
  clock.advance(31 * MIN);
  assert.deepEqual(expirePendingOrders(ctx, {}), [a.id, b.id, c.id]);
  for (const id of [a.id, b.id, c.id]) assert.equal(statusOf(ctx, id), "CANCELED");
  assert.equal(stock(ctx, "P1"), p1 + 5);
  assert.equal(stock(ctx, "P2"), p2 + 2);
});

// 잡는 결함: 만료 대상 선택 오류 (오래된 것만 / 젊은 것만 취소해야 함)
test("TC-E-05 시각이 다른 두 주문: 오래된 것만 취소되고 젊은 주문과 그 재고는 그대로", () => {
  const { clock, ctx } = setup();
  const old = seedOrder(ctx, { items: [["P1", 2]] });
  clock.advance(20 * MIN);
  const young = seedOrder(ctx, { items: [["P2", 1]] });
  const p1 = stock(ctx, "P1");
  const p2 = stock(ctx, "P2");
  clock.advance(15 * MIN); // old 35분, young 15분
  assert.deepEqual(expirePendingOrders(ctx, {}), [old.id]);
  assert.equal(statusOf(ctx, old.id), "CANCELED");
  assert.equal(stock(ctx, "P1"), p1 + 2);
  assert.equal(statusOf(ctx, young.id), "PENDING_PAYMENT");
  assert.equal(stock(ctx, "P2"), p2);
});

// 잡는 결함: 상태 필터 오류(조건 항상 거짓/참, 비교 반전) — 다른 상태의 주문을 건드리면 안 됨
for (const status of ["PAID", "PREPARING", "SHIPPING", "DELIVERED", "CANCELED"]) {
  test(`TC-E-06 ${status} 주문은 오래되어도 건드리지 않는다 (상태·재고 그대로)`, () => {
    const { clock, ctx } = setup();
    const o = seedOrder(ctx, { items: [["P1", 2]], status });
    const before = stock(ctx, "P1");
    clock.advance(60 * MIN);
    assert.deepEqual(expirePendingOrders(ctx, {}), []);
    assert.equal(statusOf(ctx, o.id), status);
    assert.equal(stock(ctx, "P1"), before);
  });
}

// 잡는 결함: 상태 필터가 없으면 결제대기와 결제완료를 같이 취소함
test("TC-E-07 결제대기와 결제완료가 섞여 있으면 결제대기만 취소된다", () => {
  const { clock, ctx } = setup();
  const pending = seedOrder(ctx, { items: [["P1", 1]] });
  const paid = seedOrder(ctx, { items: [["P1", 2]], status: "PAID" });
  const before = stock(ctx, "P1");
  clock.advance(60 * MIN);
  assert.deepEqual(expirePendingOrders(ctx, {}), [pending.id]);
  assert.equal(statusOf(ctx, pending.id), "CANCELED");
  assert.equal(statusOf(ctx, paid.id), "PAID");
  assert.equal(stock(ctx, "P1"), before + 1);
});

// 잡는 결함: 반복 호출 시 재고 이중 복원 (계약서 6장 규칙 2)
test("TC-E-08 같은 호출을 반복해도 재고는 한 번만 복원된다", () => {
  const { clock, ctx } = setup();
  const o = seedOrder(ctx, { items: [["P1", 3]] });
  const before = stock(ctx, "P1");
  clock.advance(31 * MIN);
  assert.deepEqual(expirePendingOrders(ctx, {}), [o.id]);
  assert.deepEqual(expirePendingOrders(ctx, {}), []);
  assert.equal(stock(ctx, "P1"), before + 3);
  assert.equal(statusOf(ctx, o.id), "CANCELED");
});