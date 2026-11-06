// Mission 5 — 주문 조회 · 자동 취소 테스트, 변이 생존자를 죽이는 테스트
const test = require("node:test");
const assert = require("node:assert/strict");
const { seedOrder, createFakeClock } = require("../src/testkit");
const { getOrderDetail, listOrders } = require("../src/orderQuery");
const { expirePendingOrders } = require("../src/expiry");
const { expectCode, fresh } = require("./_helpers");

test.todo("[TC-Q-01] TODO: 주문 상세 — 본인 확인 · 주문 시점 값");
test.todo("[TC-Q-02] TODO: 주문 목록 — 정렬 · 페이지 · 대표 상품명");
test.todo("[TC-E-01] TODO: 자동 취소 — 경계 시각 · 여러 건 · 재고 복원");
