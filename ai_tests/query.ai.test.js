// 이 파일은 AI 도구가 생성한 테스트라고 가정합니다. (리뷰 대상 — 수정하지 않습니다)
const test = require("node:test");
const assert = require("node:assert/strict");
const { createContext, createFakeClock, seedOrder } = require("../src/testkit");
const { getOrderDetail, listOrders } = require("../src/orderQuery");
const { expirePendingOrders } = require("../src/expiry");

test("주문 상세를 조회할 수 있다", () => {
  const ctx = createContext();
  const o = seedOrder(ctx, { items: [["P1", 2]] });
  const d = getOrderDetail(ctx, "u1", o.id);
  assert.equal(d.id, o.id);
  assert.ok(d.items.length > 0);
});

test("주문 목록을 조회할 수 있다", () => {
  const ctx = createContext();
  seedOrder(ctx);
  seedOrder(ctx, { items: [["P1", 1], ["P2", 1]] });
  const list = listOrders(ctx, "u1");
  assert.ok(Array.isArray(list.items));
});

test("대표 상품명이 표시된다", () => {
  const ctx = createContext();
  seedOrder(ctx, { items: [["P1", 1], ["P2", 1]] });
  const list = listOrders(ctx, "u1");
  assert.ok(list.items[0].representativeName);
});

test("30분 지난 결제대기 주문은 자동 취소된다", () => {
  const clock = createFakeClock();
  const ctx = createContext({ clock });
  seedOrder(ctx);
  clock.advanceMinutes(40);
  const ids = expirePendingOrders(ctx, {});
  assert.ok(ids.length >= 1);
});
