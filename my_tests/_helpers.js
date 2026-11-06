// 테스트 도우미 (필요하면 자유롭게 고치거나 추가한다)
const assert = require("node:assert/strict");
const { createContext } = require("../src/testkit");

// 동기 함수가 AppError(code) 를 던지는지 확인하고, 던진 오류를 돌려준다.
function expectCode(fn, code) {
  let err;
  try { fn(); } catch (e) { err = e; }
  assert.ok(err, `AppError(${code}) 가 던져져야 하는데 아무 오류도 없었다`);
  assert.equal(err.code, code, `오류 코드가 ${code} 이어야 한다 (실제: ${err.code})`);
  return err;
}

// 비동기 함수가 AppError(code) 로 거부되는지 확인하고, 던진 오류를 돌려준다.
async function expectRejectCode(fn, code) {
  let err;
  try { await fn(); } catch (e) { err = e; }
  assert.ok(err, `AppError(${code}) 로 거부되어야 하는데 아무 오류도 없었다`);
  assert.equal(err.code, code, `오류 코드가 ${code} 이어야 한다 (실제: ${err.code})`);
  return err;
}

// 테스트마다 새 컨텍스트를 만든다. (상태를 공유하지 않기 위해)
//   fresh() 기본 상품: P1 마우스(재고10) / P2 키보드(3) / P3 케이블(0, 품절) / P4 헤드셋(판매중지) / P5 받침대(1)
//   fresh({ products: [...] }) 로 재고가 아주 많은 상품 등을 직접 지정할 수 있다.
const fresh = (opts) => createContext(opts);

module.exports = { expectCode, expectRejectCode, fresh };
