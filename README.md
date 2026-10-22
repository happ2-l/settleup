# settleup

친구들이랑 밥 먹고 정산하는 웹앱. 폰 브라우저에서 열고, 결과는 카톡 링크로 공유합니다.
앱스토어 설치 없이 쓰고, 원하면 홈 화면에 추가해 앱처럼 쓸 수 있습니다.

```bash
npm install
npm run dev         # 개발 서버 (같은 와이파이의 폰에서 표시된 Network 주소로 접속)
npm test            # 테스트
npm run typecheck   # 타입 검사
npm run build       # dist/에 정적 파일 생성
```

## 배포 (GitHub Pages)

기본 브랜치에 push하면 `.github/workflows/deploy.yml`이 테스트 후 GitHub Pages에 올립니다.
처음 한 번만 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 바꿔 주세요.
주소는 `https://<계정>.github.io/settleup/`입니다.

## 앱 구조

| 위치 | 내용 |
|---|---|
| `src/engine` | 계산 엔진. 화면과 무관한 순수 함수 (아래 설명) |
| `src/app/model.ts` | 정산 한 건(모임)의 저장 형식, 예시 데이터 |
| `src/app/edit.ts` | 화면에서 쓰는 수정 함수 (친구 추가, 술값, 참석, 예외 설정 등) |
| `src/app/share.ts` | 공유 링크와 카톡 공유 문구 |
| `src/app/pay.ts` | 받는 곳 (은행 계좌, 토스 아이디, 카카오페이로도 받는지) |
| `src/app/receiptImage.ts` | 공유용 영수증 이미지 (캔버스에 직접 그림) |
| `src/app/avatar.ts` | 참석자 동그라미 글자·색 |
| `src/app/storage.ts` | 폰 브라우저에 저장 (localStorage) |
| `src/app/ui` | 화면 (React) |

- **저장**: 서버 없이 각자 폰 브라우저에 저장됩니다. 브라우저 기록을 지우면 사라집니다.
- **공유**: 정산 내용 전체를 압축해서 링크 `#/s/…`에 담습니다. 링크를 연 친구의 목록에도 저장됩니다.
  링크는 만든 시점의 내용이라, 나중에 고치면 다시 공유해야 합니다.
  '단톡방에 공유하기'는 영수증 이미지와 정산 글·링크를 함께 보내고, '송금 안내만'은 누가 얼마를 어디로 보낼지만 글로 보냅니다.
- **링크 미리보기**: `index.html`의 og 태그와 `public/og.png`. 배포 주소는 `.env`의 `VITE_SITE_URL`.

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
