import { SettleError, settle, type SettlementResult } from '../engine';
import { roundLabel } from './format';
import type { Meeting } from './model';

export type Computed = { ok: true; result: SettlementResult } | { ok: false; error: SettleError };

/** 입력 중에도 계속 계산한다. 입력이 덜 됐으면 에러를 돌려줘서 화면에 그대로 보여준다 */
export function compute(meeting: Meeting): Computed {
  try {
    return {
      ok: true,
      result: settle(
        {
          members: meeting.members,
          rounds: meeting.rounds.map((r, i) => ({ ...r, name: roundLabel(r.name, i) })),
          repayments: meeting.repayments,
        },
        { unit: meeting.unit },
      ),
    };
  } catch (e) {
    if (e instanceof SettleError) return { ok: false, error: e };
    throw e;
  }
}
