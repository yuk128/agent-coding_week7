// Mission 2 개선: ai_tests/query.ai.test.js 의 조회 부분 약점을 고친 테스트
// 기대값 근거: docs/API_CONTRACT.md 5장(주문 조회) — src 코드 참고 안 함
// (expirePendingOrders 는 Mission 5 의 m5_query_expiry.test.js 에서 다룬다)
const test = require("node:test");
const assert = require("node:assert/strict");
const { createFakeClock, seedOrder } = require("../src/testkit");
const { getOrderDetail, listOrders } = require("../src/orderQuery");
const { fresh, expectCode } = require("./_helpers");

// 재고가 넉넉한 전용 상품 (주문을 많이 만들어도 재고 문제가 없게)
const PRODUCTS = [
  { id: "P1", name: "마우스", price: 10000, stock: 1000, status: "ON_SALE" },
  { id: "P2", name: "키보드", price: 20000, stock: 1000, status: "ON_SALE" },
  { id: "P3", name: "케이블", price: 3000, stock: 1000, status: "ON_SALE" },
];
const big = () => {
  const clock = createFakeClock();
  return { clock, ctx: fresh({ clock, products: PRODUCTS }) };
};

// ---------- getOrderDetail ----------

// 잡는 결함: 필드 누락, lineTotal/totalAmount 계산 오류 (AI 테스트는 items.length > 0 만 확인했음)
test("M2-Q01 상세: 필드와 lineTotal·totalAmount 가 정확하다", () => {
  const { ctx } = big();
  const o = seedOrder(ctx, { items: [["P1", 2], ["P2", 3]] });
  const d = getOrderDetail(ctx, "u1", o.id);
  assert.equal(d.id, o.id);
  assert.equal(d.status, "PENDING_PAYMENT");
  assert.equal(d.createdAt, o.createdAt);
  assert.equal(d.address, o.address);
  assert.deepEqual(d.items, [
    { productId: "P1", name: "마우스", unitPrice: 10000, quantity: 2, lineTotal: 20000 },
    { productId: "P2", name: "키보드", unitPrice: 20000, quantity: 3, lineTotal: 60000 },
  ]);
  assert.equal(d.totalAmount, 80000);
});

// 잡는 결함: 현재 상품 가격을 읽어 오는 결함 (규칙 2)
test("M2-Q02 상세: 상품 가격이 바뀌어도 주문 시점 값을 유지한다", () => {
  const { ctx } = big();
  const o = seedOrder(ctx, { items: [["P1", 2]] });
  ctx.store.products.get("P1").price = 99999;
  const d = getOrderDetail(ctx, "u1", o.id);
  assert.equal(d.items[0].unitPrice, 10000);
  assert.equal(d.items[0].lineTotal, 20000);
  assert.equal(d.totalAmount, 20000);
});

// 잡는 결함: 상품 삭제 시 오류/값 변경 (규칙 2)
test("M2-Q03 상세: 상품이 삭제되어도 조회된다", () => {
  const { ctx } = big();
  const o = seedOrder(ctx, { items: [["P1", 2]] });
  ctx.store.products.delete("P1");
  const d = getOrderDetail(ctx, "u1", o.id);
  assert.equal(d.items[0].name, "마우스");
  assert.equal(d.totalAmount, 20000);
});

// 잡는 결함: 남의 주문 노출 / FORBIDDEN 등 다른 코드 (규칙 1)
test("M2-Q04 상세: 남의 주문·없는 주문은 NOT_FOUND", () => {
  const { ctx } = big();
  const o = seedOrder(ctx, { items: [["P1", 1]] });
  expectCode(() => getOrderDetail(ctx, "u2", o.id), "NOT_FOUND");
  expectCode(() => getOrderDetail(ctx, "u1", "ORD-9999"), "NOT_FOUND");
});

// 잡는 결함: 저장소 객체를 그대로 반환 (공통 규칙: 반환값은 복사본)
test("M2-Q05 상세: 반환값을 고쳐도 저장소가 바뀌지 않는다", () => {
  const { ctx } = big();
  const o = seedOrder(ctx, { items: [["P1", 2]] });
  const d = getOrderDetail(ctx, "u1", o.id);
  d.status = "HACKED";
  d.items[0].quantity = 999;
  const again = getOrderDetail(ctx, "u1", o.id);
  assert.equal(again.status, "PENDING_PAYMENT");
  assert.equal(again.items[0].quantity, 2);
});

// ---------- listOrders ----------

// 잡는 결함: 행 필드 누락/오류 (AI 테스트는 Array.isArray 만 확인했음)
test("M2-Q06 목록: 행 필드와 page·pageSize·total 이 정확하다", () => {
  const { ctx } = big();
  const o = seedOrder(ctx, { items: [["P1", 2]] });
  const list = listOrders(ctx, "u1", {});
  assert.equal(list.page, 1);
  assert.equal(list.pageSize, 10);
  assert.equal(list.total, 1);
  assert.deepEqual(list.items, [
    {
      orderId: o.id,
      createdAt: o.createdAt,
      representativeName: "마우스",
      totalAmount: 20000,
      status: "PENDING_PAYMENT",
    },
  ]);
});

// 잡는 결함: 정렬 방향 오류 (규칙 3)
test("M2-Q07 목록: 최신순으로 정렬된다", () => {
  const { ctx, clock } = big();
  const a = seedOrder(ctx, { items: [["P1", 1]] });
  clock.advanceMinutes(1);
  const b = seedOrder(ctx, { items: [["P1", 1]] });
  clock.advanceMinutes(1);
  const c = seedOrder(ctx, { items: [["P1", 1]] });
  const ids = listOrders(ctx, "u1", {}).items.map((x) => x.orderId);
  assert.deepEqual(ids, [c.id, b.id, a.id]);
});

// 잡는 결함: 동시각 정렬 규칙 누락 (규칙 3 — 같은 시각이면 주문번호가 큰 것이 먼저)
test("M2-Q08 목록: 같은 시각이면 주문번호가 큰 것이 먼저", () => {
  const { ctx } = big();
  const a = seedOrder(ctx, { items: [["P1", 1]] });
  const b = seedOrder(ctx, { items: [["P1", 1]] });
  const ids = listOrders(ctx, "u1", {}).items.map((x) => x.orderId);
  assert.deepEqual(ids, [b.id, a.id]);
});

// 잡는 결함: 대표 상품명 형식 오류 (규칙 5 — AI 테스트는 값이 있기만 하면 통과했음)
test("M2-Q09 대표 상품명: 1종은 상품명, 여러 종은 '첫 상품명 외 N건'", () => {
  const { ctx, clock } = big();
  seedOrder(ctx, { items: [["P1", 3]] });
  clock.advanceMinutes(1);
  seedOrder(ctx, { items: [["P1", 1], ["P2", 1]] });
  clock.advanceMinutes(1);
  seedOrder(ctx, { items: [["P2", 1], ["P1", 1], ["P3", 1]] });
  const names = listOrders(ctx, "u1", {}).items.map((x) => x.representativeName);
  assert.deepEqual(names, ["키보드 외 2건", "마우스 외 1건", "마우스"]);
});

// 잡는 결함: 페이지 계산(offset)·total 오류 (규칙 4)
test("M2-Q10 페이지: 12건이면 1쪽 10건, 2쪽 2건, 3쪽 빈 목록, total 은 항상 12", () => {
  const { ctx, clock } = big();
  const ids = [];
  for (let i = 0; i < 12; i++) {
    ids.push(seedOrder(ctx, { items: [["P1", 1]] }).id);
    clock.advanceMinutes(1);
  }
  const newest = [...ids].reverse(); // 최신순
  const p1 = listOrders(ctx, "u1", { page: 1 });
  const p2 = listOrders(ctx, "u1", { page: 2 });
  const p3 = listOrders(ctx, "u1", { page: 3 });
  assert.deepEqual(p1.items.map((x) => x.orderId), newest.slice(0, 10));
  assert.deepEqual(p2.items.map((x) => x.orderId), newest.slice(10));
  assert.deepEqual(p3.items, []);
  assert.equal(p1.total, 12);
  assert.equal(p2.total, 12);
  assert.equal(p3.total, 12);
  assert.equal(p2.page, 2);
});

test("M2-Q11 페이지: pageSize 지정, 정확히 한 페이지(10건)면 2쪽은 비어 있다", () => {
  const { ctx, clock } = big();
  const ids = [];
  for (let i = 0; i < 10; i++) {
    ids.push(seedOrder(ctx, { items: [["P1", 1]] }).id);
    clock.advanceMinutes(1);
  }
  const newest = [...ids].reverse();
  assert.equal(listOrders(ctx, "u1", { page: 2 }).items.length, 0);
  const small = listOrders(ctx, "u1", { page: 2, pageSize: 4 });
  assert.equal(small.pageSize, 4);
  assert.deepEqual(small.items.map((x) => x.orderId), newest.slice(4, 8));
});

test("M2-Q12 목록: 주문이 없으면 items [] / total 0", () => {
  const { ctx } = big();
  const list = listOrders(ctx, "u1", {});
  assert.deepEqual(list.items, []);
  assert.equal(list.total, 0);
});

// 잡는 결함: 다른 구매자 주문 섞임 (규칙 6)
test("M2-Q13 목록: 본인 주문만 나오고 total 도 본인 건수", () => {
  const { ctx } = big();
  const mine = seedOrder(ctx, { items: [["P1", 1]] });
  seedOrder(ctx, { userId: "u2", items: [["P2", 1]] });
  const list = listOrders(ctx, "u1", {});
  assert.equal(list.total, 1);
  assert.deepEqual(list.items.map((x) => x.orderId), [mine.id]);
});