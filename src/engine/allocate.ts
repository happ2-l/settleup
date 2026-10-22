import type { MemberId, Won } from './types';

const EPSILON = 1e-9;

/**
 * total을 weights 비율대로 unit 단위로 나눈다. 결과 합계는 항상 정확히 total.
 * - 내림하고 남는 단위는 소수점 아래가 큰 사람부터 하나씩 (같으면 앞사람부터)
 * - unit으로 나눠떨어지지 않는 잔돈은 absorber가, absorber가 없으면 가장 많이 내는 사람이 떠안음
 */
export function allocate(
  total: Won,
  weights: ReadonlyArray<readonly [MemberId, number]>,
  unit = 1,
  absorber?: MemberId,
): Map<MemberId, Won> {
  const result = new Map<MemberId, Won>(weights.map(([id]) => [id, 0]));
  if (total === 0) return result;

  const weightSum = weights.reduce((sum, [, w]) => sum + w, 0);
  if (!(weightSum > 0)) throw new RangeError('나눌 사람이 없습니다');

  const units = Math.floor(total / unit);
  const parts = weights
    .filter(([, w]) => w > 0)
    .map(([id, w], index) => {
      const exact = (units * w) / weightSum;
      const base = Math.floor(exact + EPSILON);
      return { id, index, base, fraction: exact - base };
    });

  let leftover = units - parts.reduce((sum, p) => sum + p.base, 0);
  const byFraction = [...parts].sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let i = 0; leftover > 0; i = (i + 1) % byFraction.length, leftover--) {
    byFraction[i]!.base++;
  }
  // 부동소수점 오차로 넘친 경우 소수점이 작은 사람부터 되돌림
  for (let i = byFraction.length - 1; leftover < 0; i = (i - 1 + byFraction.length) % byFraction.length) {
    const p = byFraction[i]!;
    if (p.base > 0) {
      p.base--;
      leftover++;
    }
  }

  for (const p of parts) result.set(p.id, p.base * unit);

  const change = total - units * unit;
  if (change > 0) {
    const taker = parts.some((p) => p.id === absorber)
      ? absorber!
      : parts.reduce((max, p) => (p.base > max.base ? p : max)).id;
    result.set(taker, result.get(taker)! + change);
  }
  return result;
}
