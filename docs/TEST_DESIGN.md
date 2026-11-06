# 테스트 설계표 (Mission 1)

기준: `docs/SRS_발췌.md` 의 수락 기준과 `docs/API_CONTRACT.md` 의 규칙 번호. **기대값의 근거(오라클)를 반드시 적는다.**

## 1. 동등분할 · 경계값 표
| 케이스 ID | 대상(함수) | 규칙 번호 / 수락 기준 | 입력 조건 (동등분할 그룹) | 대표값 · 경계값 | 기대 결과 | 근거(오라클) |
|---|---|---|---|---|---|---|
//예시(?)
| TC-C-01 | addToCart | 계약서 1장 규칙 1, US-05 | 유효한 수량(1~99 정수), 재고 충분 | 2 | 수량 2, 소계 30000 | 계약서 1장 / US-05 정상 |
| TC-C-02 | addToCart | 계약서 1장 규칙 1 | 무효한 수량: 0 | 0 | INVALID_QUANTITY, 장바구니 불변 | 계약서 1장 규칙 1 |

//직접 작성한 것
| TC-C-01 | addToCart | FR-CART-01 / AC-05-1 | 재고 충분, 정상 수량 | 재고 10, 수량 2 | 장바구니 수량 2 | AC-05-1 |
| TC-C-02 | addToCart | FR-CART-01 / AC-05-2 | 이미 담긴 상품에 추가 | 기존 2, 추가 3 | 최종 수량 5 | AC-05-2 |
| TC-C-03 | addToCart | FR-CART-01 / AC-05-3 | 재고 초과 수량 | 재고 10, 수량 11 | 담기 거부, 최대 수량 안내 | AC-05-3 |
| TC-C-04 | addToCart | FR-CART-01 / AC-05-3 | 재고와 동일한 수량 | 재고 10, 수량 10 | 장바구니에 수량 10 담기 | FR-CART-01 |
| TC-C-05 | addToCart | FR-CART-01 / AC-05-4 | 로그인하지 않은 사용자 | 비로그인 상태에서 담기 | 로그인 화면으로 안내 | AC-05-4 |

작성 요령
- **수량(1~99)** 처럼 범위가 있는 입력은 `경계 바로 아래 · 경계 · 경계 바로 위`(0, 1, 99, 100)와 형식이 다른 값(1.5, "2", null)을 모두 고른다.
- **재고** 는 `부족(재고-1 초과) · 딱 맞음 · 여유`, 상태는 `판매중 · 판매중지 · 품절` 로 나눈다.
- **성공 조건만이 아니라 실패 조건과 '실패했을 때 바뀌면 안 되는 것'(재고 · 장바구니 · 주문)** 도 케이스로 만든다.

## 2. 설계 → 테스트 추적표
| 케이스 ID | 테스트 파일 · 이름 | 결과(통과 / 변이를 죽임 / 보류) |
|---|---|---|
//장바구니 테스트
| TC-C-01 | m1_cart.test.js · 담으면 수량과 소계가 기록된다 | 통과 |
| TC-C-02 | m1_cart.test.js · 수량 0은 INVALID_QUANTITY | 통과 |
| TC-C-03 | m1_cart.test.js · 수량 1(최솟값) | 통과 |
| TC-C-04 | m1_cart.test.js · 수량 99(최댓값) | 통과 |
| TC-C-05 | m1_cart.test.js · 수량 100은 INVALID_QUANTITY | 통과 |
| TC-C-06 | m1_cart.test.js · 음수·소수·문자열·null·NaN 수량 | 통과 |
| TC-C-07 | m1_cart.test.js · 같은 상품 다시 담으면 합산 | 통과 |
| TC-C-08 | m1_cart.test.js · 재고와 딱 맞는 수량 | 통과 |
| TC-C-09 | m1_cart.test.js · 재고+1은 OUT_OF_STOCK, maxAddable 3 | 통과 |
| TC-C-10 | m1_cart.test.js · 품절 상품 maxAddable 0 | 통과 |
| TC-C-11 | m1_cart.test.js · 7개 담고 5개 추가 시 maxAddable 3 | 통과 |
| TC-C-12 | m1_cart.test.js · 7개 담고 3개 추가 시 합산 10 성공 | 통과 |
| TC-C-13 | m1_cart.test.js · 판매 중지 상품 NOT_FOUND | 통과 |
| TC-C-14 | m1_cart.test.js · 없는 상품 NOT_FOUND | 통과 |
| TC-C-15 | m1_cart.test.js · changeQuantity는 합산이 아님 | 통과 |
| TC-C-16 | m1_cart.test.js · changeQuantity 재고 딱 맞음 | 통과 |
| TC-C-17 | m1_cart.test.js · changeQuantity 재고+1 | 통과 |
| TC-C-18 | m1_cart.test.js · changeQuantity 수량 0 | 통과 |
| TC-C-19 | m1_cart.test.js · changeQuantity 없는 상품 | 통과 |
| TC-C-20 | m1_cart.test.js · 담은 뒤 판매 중지된 상품 변경 | 통과 |
| TC-C-21 | m1_cart.test.js · removeItem은 지정 상품만 삭제 | 통과 |
| TC-C-22 | m1_cart.test.js · removeItem 없는 상품 | 통과 |
| TC-C-23 | m1_cart.test.js · 담은 순서 유지 | 통과 |
| TC-C-24 | m1_cart.test.js · 장바구니 없는 구매자의 getCart | 통과 |
| TC-C-25 | m1_cart.test.js · 구매자별 장바구니 분리 | 통과 |
| TC-C-26 | m1_cart.test.js · 여러 상품 소계·합계 | 통과 |
| TC-C-27 | m1_cart.test.js · 반환값은 복사본 | 통과 |

//주문 테스트
| TC-O-01 | m1_order.test.js · 재고 충분하면 주문 생성·재고 차감·장바구니 비움 | 통과 |
| TC-O-02 | m1_order.test.js · 배송지 무효는 INVALID_ADDRESS | 통과 |
| TC-O-03 | m1_order.test.js · 배송지 앞뒤 공백 제거 | 통과 |
| TC-O-04 | m1_order.test.js · 빈 장바구니는 EMPTY_CART | 통과 |
| TC-O-05 | m1_order.test.js · 재고 부족 OUT_OF_STOCK와 shortages | 통과 |
| TC-O-06 | m1_order.test.js · 부족 상품 여러 개 모두 shortages | 통과 |
| TC-O-07 | m1_order.test.js · 판매 중지 상품 available 0 | 통과 |
| TC-O-08 | m1_order.test.js · 재고 딱 맞는 주문 | 통과 |
| TC-O-09 | m1_order.test.js · 주문 후 가격 변경에도 주문 금액 유지 | 통과 |
| TC-O-10 | m1_order.test.js · 주문번호 순차 발급 | 통과 |
| TC-O-11 | m1_order.test.js · createdAt은 시계의 현재 시각 | 통과 |
| TC-O-12 | m1_order.test.js · 마지막 재고를 두 구매자가 주문 | 통과 |
| TC-O-13 | m1_order.test.js · canTransition 36조합 | 통과 |
| TC-O-14 | m1_order.test.js · 허용 전이 6쌍 | 통과 |
| TC-O-15 | m1_order.test.js · 불허 전이 30쌍은 INVALID_STATE | 통과 |
| TC-O-16 | m1_order.test.js · 없는 주문 NOT_FOUND | 통과 |
| TC-O-17 | m1_order.test.js · 반환값은 복사본 | 통과 |

## 3. AI 에게 맡긴 부분과 사람이 확인한 부분
- 에이전트에게 요청한 것(프롬프트 요약): 1번 미션에서 해야할 것을 알려주고 계획을 묻고 확인 후 방향이 맞은지 확인 후 진행
- 에이전트가 제안한 케이스 중 사람이 추가 · 삭제 · 수정한 것: (보류)