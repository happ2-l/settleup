import { allocate } from './allocate';
import { SettleError, type SettleErrorCode } from './errors';
import { indexMembers, isWeight, isWon } from './validate';
import type { Item, Member, MemberId, Round, RoundResult, SettleOptions, Won } from './types';

/**
 * 한 차수를 참석자별 부담액으로 나눈다.
 *
 * 1. 고정금액인 사람은 그 금액으로 확정하고 항목 계산에서 뺀다.
 * 2. 각 항목(+ 항목에 안 잡힌 공통 금액)을 먹은 사람끼리 비율대로 나눠 '원래 몫'을 구한다.
 * 3. 실제 결제액에서 고정금액을 뺀 나머지를 원래 몫 비율로 원 단위까지 배분한다.
 *    할인이나 고정금액으로 생긴 차이는 이 단계에서 비례해서 반영된다.
 */
export function splitRound(round: Round, members: readonly Member[], options: SettleOptions = {}): RoundResult {
  const unit = options.unit ?? 1;
  validateRound(round, indexMembers(members));

  const charged = round.total - (round.discount ?? 0);
  const fixed = new Map<MemberId, Won>();
  for (const p of round.participants) {
    if (p.fixed !== undefined) fixed.set(p.memberId, p.fixed);
  }
  const fixedSum = sum([...fixed.values()]);
  if (fixedSum > charged) {
    throw new SettleError(
      'FIXED_EXCEEDS_TOTAL',
      `${label(round)}: 고정금액 합계(${won(fixedSum)})가 결제액(${won(charged)})보다 큽니다`,
      round.id,
    );
  }

  const items = round.items ?? [];
  const common: Item = { name: '공통', amount: round.total - sum(items.map((i) => i.amount)) };
  const raw = new Map<MemberId, number>();
  for (const p of round.participants) {
    if (!fixed.has(p.memberId)) raw.set(p.memberId, 0);
  }
  for (const item of [...items, common]) {
    if (item.amount === 0) continue;
    const consumers = consumersOf(item, round);
    if (consumers.length === 0) {
      if (item === common) continue;
      throw new SettleError(
        'ITEM_NO_CONSUMER',
        `${label(round)}: '${item.name ?? item.category ?? '항목'}'을(를) 나눠 낼 사람이 없습니다`,
        round.id,
      );
    }
    // 먹은 사람이 전부 고정금액이면 이 항목은 아래 배분 단계에서 나머지 사람들이 나눠 낸다
    const payers = consumers.filter(([id]) => !fixed.has(id));
    const weightSum = sum(payers.map(([, w]) => w));
    for (const [id, w] of payers) raw.set(id, raw.get(id)! + (item.amount * w) / weightSum);
  }

  const pool = charged - fixedSum;
  const weights = [...raw].filter(([, share]) => share > 0);
  if (pool > 0 && weights.length === 0) {
    throw new SettleError('NO_ONE_TO_PAY', `${label(round)}: 남은 ${won(pool)}을 낼 사람이 없습니다`, round.id);
  }
  const allocated = allocate(pool, weights, unit, topPayer(round));

  const shares: Record<MemberId, Won> = {};
  for (const p of round.participants) {
    shares[p.memberId] = fixed.get(p.memberId) ?? allocated.get(p.memberId) ?? 0;
  }
  return { roundId: round.id, charged, shares };
}

function consumersOf(item: Item, round: Round): [MemberId, number][] {
  if (item.shares) {
    return Object.entries(item.shares).filter(([, w]) => w > 0);
  }
  const category = item.category;
  return round.participants
    .filter((p) => category === undefined || !p.excludes?.includes(category))
    .map((p): [MemberId, number] => [p.memberId, p.weight ?? 1])
    .filter(([, w]) => w > 0);
}

/** 단위 미만 잔돈을 떠안을 사람: 가장 많이 결제한 사람 */
function topPayer(round: Round): MemberId | undefined {
  let top: [MemberId, Won] | undefined;
  for (const entry of Object.entries(round.payments)) {
    if (!top || entry[1] > top[1]) top = entry;
  }
  return top?.[0];
}

function validateRound(round: Round, members: ReadonlyMap<MemberId, Member>): void {
  const fail = (code: SettleErrorCode, message: string): never => {
    throw new SettleError(code, `${label(round)}: ${message}`, round.id);
  };
  const name = (id: MemberId) => members.get(id)?.name ?? id;

  if (!isWon(round.total)) fail('INVALID_AMOUNT', '총액은 0 이상의 정수(원)여야 합니다');
  const discount = round.discount ?? 0;
  if (!isWon(discount)) fail('INVALID_AMOUNT', '할인 금액은 0 이상의 정수(원)여야 합니다');
  if (discount > round.total) fail('DISCOUNT_EXCEEDS_TOTAL', '할인 금액이 총액보다 큽니다');

  const participants = new Set<MemberId>();
  for (const p of round.participants) {
    if (!members.has(p.memberId)) fail('UNKNOWN_MEMBER', `모임에 없는 사람(${p.memberId})이 참석자로 들어 있습니다`);
    if (participants.has(p.memberId)) fail('DUPLICATE_ID', `${name(p.memberId)}이(가) 참석자에 두 번 들어 있습니다`);
    participants.add(p.memberId);
    if (p.weight !== undefined && !isWeight(p.weight)) {
      fail('INVALID_WEIGHT', `${name(p.memberId)}의 비율은 0 이상의 숫자여야 합니다`);
    }
    if (p.fixed !== undefined && !isWon(p.fixed)) {
      fail('INVALID_AMOUNT', `${name(p.memberId)}의 고정금액은 0 이상의 정수(원)여야 합니다`);
    }
  }

  let itemSum = 0;
  for (const item of round.items ?? []) {
    const itemName = item.name ?? item.category ?? '항목';
    if (!isWon(item.amount)) fail('INVALID_AMOUNT', `'${itemName}' 금액은 0 이상의 정수(원)여야 합니다`);
    itemSum += item.amount;
    for (const [id, w] of Object.entries(item.shares ?? {})) {
      if (!participants.has(id)) {
        fail('NOT_A_PARTICIPANT', `'${itemName}'을(를) 나눌 ${name(id)}이(가) 이 차수 참석자가 아닙니다`);
      }
      if (!isWeight(w)) fail('INVALID_WEIGHT', `'${itemName}'에서 ${name(id)}의 비율은 0 이상의 숫자여야 합니다`);
    }
  }
  if (itemSum > round.total) {
    fail('ITEMS_EXCEED_TOTAL', `항목 합계(${won(itemSum)})가 총액(${won(round.total)})보다 큽니다`);
  }

  let paid = 0;
  for (const [id, amount] of Object.entries(round.payments)) {
    if (!members.has(id)) fail('UNKNOWN_MEMBER', `모임에 없는 사람(${id})이 결제자로 들어 있습니다`);
    if (!isWon(amount)) fail('INVALID_AMOUNT', `${name(id)}의 결제 금액은 0 이상의 정수(원)여야 합니다`);
    paid += amount;
  }
  const charged = round.total - discount;
  if (paid !== charged) {
    fail('PAYMENT_MISMATCH', `결제한 금액 합계(${won(paid)})가 결제액(${won(charged)})과 다릅니다`);
  }
}

const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);
const label = (round: Round) => round.name ?? round.id;
const won = (amount: Won) => `${amount.toLocaleString('ko-KR')}원`;
