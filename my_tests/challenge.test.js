// 도전: 시간·상태·동시성 조합 결함 (기대값 근거: docs/API_CONTRACT.md 3·4·6장)
const test = require("node:test");
const assert = require("node:assert/strict");
const { createContext, createFakeClock, seedOrder } = require("../src/testkit");
const { expirePendingOrders } = require("../src/expiry");
const { cancelOrder } = require("../src/cancel");
const { payOrder } = require("../src/payment");

const MIN = 60 * 1000;
const stock = (ctx, id) => ctx.store.products.get(id).stock;

// 잡는 결함: 경계를 분 단위로 근사하거나 >= 대신 > 를 쓰는 결함 (1ms 단위)
test("TC-H-01 1ms 차이 두 주문: 정확히 30분이 된 주문만 취소된다", () => {
  const clock = createFakeClock();
  const ctx = createContext({ clock });
  const a = seedOrder(ctx, { items: [["P1", 1]] });
  clock.advance(1);
  const b = seedOrder(ctx, { items: [["P1", 1]] });
  clock.advance(30 * MIN - 1); // a: 정확히 30분, b: 29분 59.999초
  assert.deepEqual(expirePendingOrders(ctx, {}), [a.id]);
  assert.equal(ctx.store.orders.get(a.id).status, "CANCELED");
  assert.equal(ctx.store.orders.get(b.id).status, "PENDING_PAYMENT");
  clock.advance(1);
  assert.deepEqual(expirePendingOrders(ctx, {}), [b.id]);
});

// 잡는 결함: 상품이 판매 중지되면 재고 복원을 건너뛰는 결함 (취소)
for (const status of ["PENDING_PAYMENT", "PAID"]) {
  test(`TC-H-02 ${status} 주문 후 상품이 판매 중지돼도 취소하면 재고가 복원된다`, async () => {
    const ctx = createContext();
    const o = seedOrder(ctx, { items: [["P1", 3]], status });
    const before = stock(ctx, "P1");
    ctx.store.products.get("P1").status = "STOPPED";
    const r = await cancelOrder(ctx, "u1", o.id);
    assert.equal(r.order.status, "CANCELED");
    assert.equal(stock(ctx, "P1"), before + 3);
  });
}

// 잡는 결함: 판매 중지 상품의 자동 취소에서 재고 복원 누락
test("TC-H-03 상품이 판매 중지돼도 자동 취소되고 재고가 복원된다", () => {
  const clock = createFakeClock();
  const ctx = createContext({ clock });
  const o = seedOrder(ctx, { items: [["P1", 2]] });
  const before = stock(ctx, "P1");
  ctx.store.products.get("P1").status = "STOPPED";
  clock.advance(30 * MIN);
  assert.deepEqual(expirePendingOrders(ctx, {}), [o.id]);
  assert.equal(stock(ctx, "P1"), before + 2);
});

// 잡는 결함: 구매자 단위로 진행 중 요청을 막아 한 주문의 결제가 다른 주문을 막거나 합쳐지는 결함
test("TC-H-04 같은 구매자의 서로 다른 두 주문을 동시에 결제: 각각 PG 1회, 금액·키 구분", async () => {
  const ctx = createContext();
  const a = seedOrder(ctx, { items: [["P1", 1]] });
  const b = seedOrder(ctx, { items: [["P2", 1]] });
  const rs = await Promise.all([payOrder(ctx, "u1", a.id), payOrder(ctx, "u1", b.id)]);
  assert.equal(rs[0].order.status, "PAID");
  assert.equal(rs[1].order.status, "PAID");
  assert.equal(ctx.pg.charges.length, 2);
  const byOrder = new Map(ctx.pg.charges.map((c) => [c.orderId, c]));
  assert.equal(byOrder.get(a.id).amount, a.totalAmount);
  assert.equal(byOrder.get(b.id).amount, b.totalAmount);
  assert.notEqual(byOrder.get(a.id).idempotencyKey, byOrder.get(b.id).idempotencyKey);
});

// 속성 기반: 재고 + (취소되지 않은 주문의 수량) = 처음 재고 (시드 고정 난수)
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 잡는 결함: 취소·자동 취소 조합에서 재고가 새거나 이중 복원되는 결함
test("TC-H-05 무작위 주문·취소·시간 경과·자동 취소 뒤에도 재고 보존 불변식이 유지된다", async () => {
  const rand = seeded(20261106);
  const clock = createFakeClock();
  const ctx = createContext({ clock });
  const initial = { P1: stock(ctx, "P1"), P2: stock(ctx, "P2") };

  const conserved = (step) => {
    for (const id of Object.keys(initial)) {
      let held = 0;
      for (const o of ctx.store.orders.values()) {
        if (o.status === "CANCELED") continue;
        for (const it of o.items) if (it.productId === id) held += it.quantity;
      }
      assert.equal(stock(ctx, id) + held, initial[id], `${id} 재고 보존 위반 (step ${step})`);
    }
  };

  for (let step = 0; step < 200; step++) {
    const r = rand();
    if (r < 0.35) {
      const pid = rand() < 0.5 ? "P1" : "P2";
      const qty = Math.floor(rand() * 3) + 1;
      if (stock(ctx, pid) >= qty) {
        seedOrder(ctx, { items: [[pid, qty]], status: rand() < 0.5 ? "PAID" : "PENDING_PAYMENT" });
      }
    } else if (r < 0.65) {
      const ids = [...ctx.store.orders.keys()];
      if (ids.length) {
        const id = ids[Math.floor(rand() * ids.length)];
        try {
          await cancelOrder(ctx, "u1", id);
        } catch (e) {
          if (e.code !== "INVALID_STATE") throw e; // 이미 취소된 주문 외의 오류는 실패로 본다
        }
      }
    } else if (r < 0.85) {
      clock.advance(Math.floor(rand() * 40) * MIN);
    } else {
      expirePendingOrders(ctx, {});
    }
    conserved(step);
  }
});