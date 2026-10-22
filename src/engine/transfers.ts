import type { MemberId, Transfer, Won } from './types';

/** 이 인원까지는 송금 횟수가 진짜 최소인 해를 구함 (2^n 탐색, 18명 ≈ 25ms). 넘으면 그리디 */
const EXACT_LIMIT = 18;

type Entry = readonly [MemberId, Won];

/**
 * 잔액(+받을 돈, −보낼 돈)을 정리하는 송금 목록을 만든다.
 *
 * 합이 0인 가장 작은 그룹들로 사람들을 최대한 많이 쪼개면 송금 횟수가 최소가 된다
 * (k명 그룹은 k−1번이면 정리됨). 그룹 안에서는 가장 많이 낼 사람 → 가장 많이 받을 사람 순으로 매칭.
 */
export function minimizeTransfers(balances: Readonly<Record<MemberId, Won>>): Transfer[] {
  const entries: Entry[] = Object.entries(balances).filter(([, amount]) => amount !== 0);
  if (entries.reduce((sum, [, amount]) => sum + amount, 0) !== 0) {
    throw new RangeError('잔액 합계가 0이 아닙니다');
  }
  if (entries.length === 0) return [];
  const groups = entries.length <= EXACT_LIMIT ? zeroSumGroups(entries) : [entries];
  return groups.flatMap(greedy);
}

/** 합이 0인 부분집합으로 최대한 많이 쪼갠다. dp[mask] = mask 안에서 만들 수 있는 최대 그룹 수 */
function zeroSumGroups(entries: readonly Entry[]): Entry[][] {
  const n = entries.length;
  const full = (1 << n) - 1;
  const sums = new Float64Array(full + 1);
  const dp = new Int8Array(full + 1);
  const removed = new Int8Array(full + 1);

  for (let mask = 1; mask <= full; mask++) {
    const low = mask & -mask;
    sums[mask] = sums[mask ^ low]! + entries[31 - Math.clz32(low)]![1];
    let best = -1;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i) && dp[mask ^ (1 << i)]! > best) {
        best = dp[mask ^ (1 << i)]!;
        removed[mask] = i;
      }
    }
    dp[mask] = best + (sums[mask] === 0 ? 1 : 0);
  }

  // 최적 경로를 따라 한 명씩 빼면서 합이 0이 되는 지점마다 그룹을 끊는다
  const groups: Entry[][] = [];
  let group: Entry[] = [];
  for (let mask = full; mask; ) {
    const i = removed[mask]!;
    group.push(entries[i]!);
    mask ^= 1 << i;
    if (sums[mask] === 0) {
      groups.push(group);
      group = [];
    }
  }
  return groups;
}

function greedy(group: readonly Entry[]): Transfer[] {
  const byAmount = (a: [MemberId, Won], b: [MemberId, Won]) => b[1] - a[1];
  const debtors = group.filter(([, v]) => v < 0).map(([id, v]): [MemberId, Won] => [id, -v]).sort(byAmount);
  const creditors = group.filter(([, v]) => v > 0).map(([id, v]): [MemberId, Won] => [id, v]).sort(byAmount);

  const transfers: Transfer[] = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d]!;
    const creditor = creditors[c]!;
    const amount = Math.min(debtor[1], creditor[1]);
    transfers.push({ from: debtor[0], to: creditor[0], amount });
    debtor[1] -= amount;
    creditor[1] -= amount;
    if (debtor[1] === 0) d++;
    if (creditor[1] === 0) c++;
  }
  return transfers;
}

/**
 * 각 차수에서 각자 몫을 그 차수 결제자에게 보내는 송금 목록. 같은 두 사람 사이에 오가는 돈만 상계한다.
 * 결제자가 여럿이면 결제자 본인 몫을 본인 결제액에서 먼저 빼고, 나머지 사람 몫을 결제자 순서대로 채운다.
 * 이미 보낸 송금(repayments)은 그만큼 반대 방향으로 갚은 것으로 친다.
 */
export function directTransfers(
  rounds: readonly { shares: Readonly<Record<MemberId, Won>>; payments: Readonly<Record<MemberId, Won>> }[],
  repayments: readonly Transfer[],
  order: readonly MemberId[],
): Transfer[] {
  const owed = new Map<MemberId, Map<MemberId, Won>>();
  const add = (from: MemberId, to: MemberId, amount: Won) => {
    if (from === to || amount === 0) return;
    const row = owed.get(from) ?? new Map<MemberId, Won>();
    row.set(to, (row.get(to) ?? 0) + amount);
    owed.set(from, row);
  };
  const get = (from: MemberId, to: MemberId) => owed.get(from)?.get(to) ?? 0;

  for (const round of rounds) {
    const caps = Object.entries(round.payments).filter(([, v]) => v > 0);
    const needs = Object.entries(round.shares).filter(([, v]) => v > 0);
    // 결제자 본인 몫은 본인이 낸 돈에서 먼저
    for (const need of needs) {
      const cap = caps.find(([id]) => id === need[0]);
      if (!cap) continue;
      const covered = Math.min(cap[1], need[1]);
      cap[1] -= covered;
      need[1] -= covered;
    }
    let c = 0;
    for (const need of needs) {
      while (need[1] > 0 && c < caps.length) {
        const cap = caps[c]!;
        const amount = Math.min(need[1], cap[1]);
        add(need[0], cap[0], amount);
        need[1] -= amount;
        cap[1] -= amount;
        if (cap[1] === 0) c++;
      }
    }
  }
  for (const t of repayments) add(t.to, t.from, t.amount);

  const rank = (id: MemberId) => {
    const i = order.indexOf(id);
    return i === -1 ? order.length : i;
  };
  const people = [...new Set([...owed.keys(), ...[...owed.values()].flatMap((row) => [...row.keys()])])].sort(
    (a, b) => rank(a) - rank(b),
  );
  const transfers: Transfer[] = [];
  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      const a = people[i]!;
      const b = people[j]!;
      const net = get(a, b) - get(b, a);
      if (net > 0) transfers.push({ from: a, to: b, amount: net });
      else if (net < 0) transfers.push({ from: b, to: a, amount: -net });
    }
  }
  // 받는 사람별로 모아 보이게
  return transfers.sort((x, y) => rank(x.to) - rank(y.to) || rank(x.from) - rank(y.from));
}
