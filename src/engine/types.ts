/** 원 단위 정수 금액 */
export type Won = number;
export type MemberId = string;

export interface Member {
  id: MemberId;
  name: string;
}

/** 한 차수에 참석한 사람과 그 사람만의 예외 */
export interface Participant {
  memberId: MemberId;
  /** 부담 비율. 기본 1. 일찍 가면 0.5, 더 내면 1.5, 0이면 면제 */
  weight?: number;
  /** 안 먹은 카테고리. 예: ['술'] → category가 '술'인 항목에서 빠짐 */
  excludes?: string[];
  /** 이 차수에서 딱 이 금액만 냄. 0이면 면제(얻어먹음) */
  fixed?: Won;
}

/** 총액 중 따로 나눠야 하는 부분 (술값, 혼자 시킨 메뉴 등) */
export interface Item {
  name?: string;
  amount: Won;
  /** 참석자의 excludes와 맞춰 볼 카테고리. 예: '술' */
  category?: string;
  /** 지정하면 참석자의 weight·excludes를 무시하고 이 사람들만 이 비율로 나눔 */
  shares?: Record<MemberId, number>;
}

/** 1차, 2차 같은 한 번의 결제 */
export interface Round {
  id: string;
  name?: string;
  /** 영수증 총액 (할인 전) */
  total: Won;
  /** 할인·쿠폰. 각자 몫에 비례해서 줄어듦 */
  discount?: Won;
  participants: Participant[];
  /** 총액 중 따로 나눌 부분. 나머지(총액 − 항목 합)는 참석자 전원이 비율대로 */
  items?: Item[];
  /** 실제로 결제한 사람과 금액. 합계 = total − discount */
  payments: Record<MemberId, Won>;
}

export interface Transfer {
  from: MemberId;
  to: MemberId;
  amount: Won;
}

export interface Gathering {
  members: Member[];
  rounds: Round[];
  /** 정산 중 이미 보낸 송금 */
  repayments?: Transfer[];
}

export interface SettleOptions {
  /** 각자 몫을 이 단위(10, 100, 1000원)로 맞춤. 단위 미만 잔돈은 결제자가 떠안음. 기본 1 */
  unit?: number;
}

export interface RoundResult {
  roundId: string;
  /** 실제 결제액 (total − discount) */
  charged: Won;
  /** 참석자별 부담액. 합계 = charged */
  shares: Record<MemberId, Won>;
}

export interface MemberResult {
  memberId: MemberId;
  /** 결제한 돈 */
  paid: Won;
  /** 부담해야 할 돈 */
  owed: Won;
  /** 이미 보낸 송금 */
  sent: Won;
  /** 이미 받은 송금 */
  received: Won;
  /** +면 받을 돈, −면 보낼 돈 */
  balance: Won;
}

export interface SettlementResult {
  rounds: RoundResult[];
  members: MemberResult[];
  /** 남은 정산을 끝내는 최소 송금 목록 */
  transfers: Transfer[];
}
