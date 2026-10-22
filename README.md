# settleup

친구들이랑 밥 먹고 정산하는 웹앱. 지금은 **계산 엔진**(`src/engine`)만 있습니다.

```bash
npm install
npm test            # 테스트
npm run typecheck   # 타입 검사
```

## 계산 엔진

차수마다 인원이 다르고, 술 안 마신 사람, 잠깐 있다 간 사람, "난 만원만" 같은 경우를
기능 하나하나로 만들지 않고 전부 **"이 금액을, 이 사람들이, 이 비율로 나눈다"** 하나로 표현합니다.

```
모임 (members)
 └─ 차수 (rounds: 1차, 2차 …)
     ├─ total / discount     영수증 총액, 할인
     ├─ payments             누가 얼마 결제했나 (여러 명 가능)
     ├─ participants         이 차수 참석자 + 각자의 예외 (weight, excludes, fixed)
     └─ items                총액 중 따로 나눌 부분 (술값, 혼자 시킨 메뉴). 나머지는 전원이 나눔
```

| 상황 | 입력 |
|---|---|
| 차수마다 인원이 다름 | 차수별 `participants` |
| 술 안 마심 | 술값을 `items: [{ category: '술', amount }]`로 빼고, 참석자에 `excludes: ['술']` |
| 잠깐 있다 감 / 늦게 옴 | `weight: 0.5` (시간으로 계산하려면 `stayRatio()`) |
| 선배가 더 냄 | `weight: 1.5` |
| 특정 메뉴는 몇 명만 | `items: [{ amount, shares: { 철수: 1, 영희: 1 } }]` |
| "난 만원만 낼게" | `fixed: 10000` — 나머지는 다른 사람들이 비율대로 |
| 생일자 / 쏘는 사람 | 얻어먹는 사람에 `fixed: 0` (또는 `weight: 0`) |
| 할인·쿠폰 | `discount` — 각자 몫에 비례해서 줄어듦 |
| 여러 명이 나눠 결제 | `payments: { 철수: 60000, 영희: 40000 }` |
| 이미 일부 송금함 | 모임의 `repayments` |
| 100원 단위로 맞추기 | `settle(gathering, { unit: 100 })` — 단위 미만 잔돈은 결제자가 |

### 계산 순서

1. 차수마다 고정금액인 사람을 먼저 확정하고 항목 계산에서 뺀다.
2. 각 항목(+ 공통 금액)을 먹은 사람끼리 비율대로 나눠 '원래 몫'을 구한다.
3. 실제 결제액 − 고정금액 합을 원래 몫 비율로 원 단위까지 배분한다. 합계는 항상 정확히 맞는다 (최대잉여법).
4. 모든 차수를 합쳐 사람별 잔액(결제 − 부담 + 보낸 돈 − 받은 돈)을 구한다.
5. 잔액을 합이 0인 가장 작은 그룹들로 쪼개 송금 횟수를 최소로 만든다 (18명 초과는 그리디).

### 사용 예

```ts
import { settle } from './src/engine';

const result = settle({
  members: [
    { id: 'a', name: '철수' }, { id: 'b', name: '영희' }, { id: 'c', name: '민수' },
    { id: 'd', name: '지은' }, { id: 'e', name: '현우' },
  ],
  rounds: [
    {
      id: 'r1', name: '1차 고깃집', total: 160_000,
      items: [{ name: '술', category: '술', amount: 70_000 }],
      participants: [
        { memberId: 'a' }, { memberId: 'b' }, { memberId: 'c' },
        { memberId: 'd', excludes: ['술'] },  // 술 안 마심
        { memberId: 'e', weight: 0.5 },       // 일찍 감
      ],
      payments: { a: 160_000 },
    },
    {
      id: 'r2', name: '2차 술집', total: 60_000,
      participants: [{ memberId: 'a' }, { memberId: 'b' }, { memberId: 'c' }],
      payments: { b: 60_000 },
    },
  ],
});

result.rounds[0].shares  // { a: 40000, b: 40000, c: 40000, d: 20000, e: 20000 }
result.transfers         // c → a 60000, d → a 20000, e → a 20000
```

입력이 잘못되면 `SettleError`를 던집니다. `code`로 종류를 구분하고, `message`는 화면에 그대로 보여줄 수 있는 문장입니다
(예: `1차 고깃집: 결제한 금액 합계(150,000원)가 결제액(160,000원)과 다릅니다`).
