import { SettleError } from './errors';
import { splitRound } from './round';
import { directTransfers, minimizeTransfers } from './transfers';
import { indexMembers, isWon } from './validate';
import type { Gathering, MemberId, MemberResult, SettleOptions, SettlementResult } from './types';

/** 모임 전체를 정산한다: 차수별 부담액 → 사람별 잔액 → 송금 목록 (기본은 최소 횟수) */
export function settle(gathering: Gathering, options: SettleOptions = {}): SettlementResult {
  const unit = options.unit ?? 1;
  if (!Number.isSafeInteger(unit) || unit < 1) {
    throw new SettleError('INVALID_UNIT', '정산 단위는 1 이상의 정수(원)여야 합니다');
  }
  const members = indexMembers(gathering.members);
  const name = (id: MemberId) => members.get(id)?.name ?? id;

  const roundIds = new Set<string>();
  for (const round of gathering.rounds) {
    if (roundIds.has(round.id)) {
      throw new SettleError('DUPLICATE_ID', `차수 id '${round.id}'가 중복됩니다`, round.id);
    }
    roundIds.add(round.id);
  }

  const summary = new Map<MemberId, MemberResult>(
    gathering.members.map((m) => [m.id, { memberId: m.id, paid: 0, owed: 0, sent: 0, received: 0, balance: 0 }]),
  );
  const rounds = gathering.rounds.map((round) => {
    const result = splitRound(round, gathering.members, { unit });
    for (const [id, amount] of Object.entries(round.payments)) summary.get(id)!.paid += amount;
    for (const [id, amount] of Object.entries(result.shares)) summary.get(id)!.owed += amount;
    return result;
  });

  for (const { from, to, amount } of gathering.repayments ?? []) {
    const sender = summary.get(from);
    const receiver = summary.get(to);
    if (!sender || !receiver) {
      throw new SettleError('UNKNOWN_MEMBER', `송금 기록에 모임에 없는 사람(${sender ? to : from})이 있습니다`);
    }
    if (from === to) throw new SettleError('INVALID_TRANSFER', `${name(from)}이(가) 자기 자신에게 보낸 송금이 있습니다`);
    if (!isWon(amount) || amount === 0) {
      throw new SettleError('INVALID_TRANSFER', `${name(from)} → ${name(to)} 송금 금액은 1원 이상의 정수여야 합니다`);
    }
    sender.sent += amount;
    receiver.received += amount;
  }

  const balances: Record<MemberId, number> = {};
  for (const m of summary.values()) {
    m.balance = m.paid - m.owed + m.sent - m.received;
    balances[m.memberId] = m.balance;
  }

  const transfers =
    options.transfers === 'direct'
      ? directTransfers(
          rounds.map((r, i) => ({ shares: r.shares, payments: gathering.rounds[i]!.payments })),
          gathering.repayments ?? [],
          gathering.members.map((m) => m.id),
        )
      : minimizeTransfers(balances);

  return { rounds, members: [...summary.values()], transfers };
}
