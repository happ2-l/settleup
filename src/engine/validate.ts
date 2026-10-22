import { SettleError } from './errors';
import type { Member, MemberId } from './types';

export function indexMembers(members: readonly Member[]): Map<MemberId, Member> {
  const byId = new Map<MemberId, Member>();
  for (const member of members) {
    if (byId.has(member.id)) {
      throw new SettleError('DUPLICATE_ID', `멤버 '${member.name}'의 id가 중복됩니다`);
    }
    byId.set(member.id, member);
  }
  return byId;
}

export function isWon(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

export function isWeight(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
