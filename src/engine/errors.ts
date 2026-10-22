export type SettleErrorCode =
  | 'INVALID_AMOUNT'
  | 'INVALID_WEIGHT'
  | 'INVALID_UNIT'
  | 'UNKNOWN_MEMBER'
  | 'DUPLICATE_ID'
  | 'NOT_A_PARTICIPANT'
  | 'PAYMENT_MISMATCH'
  | 'DISCOUNT_EXCEEDS_TOTAL'
  | 'ITEMS_EXCEED_TOTAL'
  | 'ITEM_NO_CONSUMER'
  | 'FIXED_EXCEEDS_TOTAL'
  | 'NO_ONE_TO_PAY'
  | 'INVALID_TRANSFER';

/** 입력이 잘못됐을 때. message는 화면에 그대로 보여줄 수 있는 문장 */
export class SettleError extends Error {
  override name = 'SettleError';

  constructor(
    readonly code: SettleErrorCode,
    message: string,
    readonly roundId?: string,
  ) {
    super(message);
  }
}
