# CI 가이드 (Mission 4)

`scripts/ci.js` 는 종료 코드로 결과를 알린다. (0 = 통과, 그 밖 = 실패) CI 서비스는 이 종료 코드를 보고 변경을 막거나 허용한다.
아래는 GitHub Actions 에서 이 스크립트를 실행하는 워크플로 예시이다. `.github/workflows/ci.yml` 로 저장한다. (실제로 실행하지 않아도 된다)

```yaml
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm run ci
```

기준값을 정하는 요령
- `npm run coverage -- --tests ai_tests` 와 `npm run mutate:ai` 의 값(약한 테스트)과, 우리 팀 테스트의 값을 나란히 놓는다.
- 기준은 **약한 테스트는 막고 우리 테스트는 통과시키는 값**이어야 한다. 줄 커버리지가 약한 테스트도 통과시킨다면 그 지표만으로는 부족하다.
- 변이 도구는 1~2분이 걸린다. CI 에서 매번 돌릴지, 하루 한 번만 돌릴지는 팀이 정한다. (이 실습에서는 매번 돌린다)
