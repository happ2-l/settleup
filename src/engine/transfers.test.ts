import { describe, expect, it } from 'vitest';
import { minimizeTransfers } from './transfers';
import type { Transfer } from './types';

function apply(balances: Record<string, number>, transfers: Transfer[]): Record<string, number> {
  const after = { ...balances };
  for (const t of transfers) {
    after[t.from]! += t.amount;
    after[t.to]! -= t.amount;
  }
  return after;
}

const allZero = (balances: Record<string, number>) => Object.values(balances).every((v) => v === 0);

describe('minimizeTransfers', () => {
  it('보낼 사람이 받을 사람에게 보낸다', () => {
    expect(minimizeTransfers({ a: 20_000, b: -10_000, c: -10_000 })).toEqual([
      { from: 'b', to: 'a', amount: 10_000 },
      { from: 'c', to: 'a', amount: 10_000 },
    ]);
  });

  it('정산할 게 없으면 빈 목록', () => {
    expect(minimizeTransfers({ a: 0, b: 0 })).toEqual([]);
  });

  it('단순 그리디가 4번 보내는 경우도 3번으로 끝낸다', () => {
    // 그리디: e→a 4, c→b 3, d→a 2, d→b 1 (4번) / 최적: {b,e}, {a,c,d}로 나누면 3번
    const balances = { a: 6, b: 4, c: -3, d: -3, e: -4 };
    const transfers = minimizeTransfers(balances);
    expect(transfers).toHaveLength(3);
    expect(allZero(apply(balances, transfers))).toBe(true);
  });

  it('인원이 많으면 그리디로도 정확히 정리된다', () => {
    const balances: Record<string, number> = {};
    for (let i = 0; i < 30; i++) balances[`p${i}`] = i < 15 ? (i + 1) * 1_000 : -(i - 14) * 1_000;
    const transfers = minimizeTransfers(balances);
    expect(allZero(apply(balances, transfers))).toBe(true);
    expect(transfers.length).toBeLessThanOrEqual(29);
  });

  it('잔액 합이 0이 아니면 에러', () => {
    expect(() => minimizeTransfers({ a: 1, b: 0 })).toThrow(RangeError);
  });
});
