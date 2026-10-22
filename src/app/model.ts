import type { Member, Round, Transfer } from '../engine';

/** 정산에 쓰는 카테고리. 참석자의 excludes와 술값 항목이 이 이름으로 연결된다 */
export const ALCOHOL = '술';

/** 돈 받을 곳. 받는 사람만 적으면 된다 */
export interface PayInfo {
  bank?: string;
  accountNo?: string;
  /** 예금주 */
  holder?: string;
  /** 토스 아이디 (toss.me/아이디) */
  toss?: string;
  /** 카카오페이 송금 링크 (https://qr.kakaopay.com/…) */
  kakaopay?: string;
}

export interface Friend extends Member {
  pay?: PayInfo;
}

export interface MeetingRound extends Round {
  /** 여러 명이 나눠 결제했으면 true. false면 결제자 한 명이 결제액 전부를 낸 것으로 맞춤 */
  multiPay?: boolean;
}

export interface Meeting {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  members: Friend[];
  rounds: MeetingRound[];
  /** 정산 중 이미 보낸 송금 */
  repayments: Transfer[];
  /** 정산 단위 (1, 10, 100, 1000원) */
  unit: number;
  updatedAt: number;
  /** 처음 열었을 때 보여주는 예시 */
  sample?: boolean;
}

export function shortId(): string {
  return Math.random().toString(36).slice(2, 8);
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function newMeeting(): Meeting {
  return { id: shortId(), title: '', date: today(), members: [], rounds: [], repayments: [], unit: 1, updatedAt: Date.now() };
}

export function sampleMeeting(): Meeting {
  const [a, b, c, d, e] = ['철수', '영희', '민수', '지은', '현우'].map((name, i) => ({ id: `s${i}`, name }));
  return {
    id: 'sample',
    title: '예시: 동기 모임',
    date: today(),
    sample: true,
    members: [{ ...a!, pay: { bank: '카카오뱅크', accountNo: '3333-00-0000000', holder: '김철수' } }, b!, c!, d!, e!],
    rounds: [
      {
        id: 'r1',
        name: '고깃집',
        total: 160_000,
        items: [{ name: '술', category: ALCOHOL, amount: 70_000 }],
        participants: [
          { memberId: a!.id },
          { memberId: b!.id },
          { memberId: c!.id },
          { memberId: d!.id, excludes: [ALCOHOL] },
          { memberId: e!.id, weight: 0.5 },
        ],
        payments: { [a!.id]: 160_000 },
      },
      {
        id: 'r2',
        name: '술집',
        total: 60_000,
        participants: [{ memberId: a!.id }, { memberId: b!.id }, { memberId: c!.id }],
        payments: { [b!.id]: 60_000 },
      },
    ],
    repayments: [],
    unit: 1,
    updatedAt: Date.now(),
  };
}
