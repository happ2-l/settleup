import { describe, expect, it } from 'vitest';
import { allocate } from './allocate';

const total = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

describe('allocate', () => {
  it('나눠떨어지지 않는 1원은 앞사람부터 하나씩 더 낸다', () => {
    const result = allocate(10_000, [['a', 1], ['b', 1], ['c', 1]]);
    expect(Object.fromEntries(result)).toEqual({ a: 3_334, b: 3_333, c: 3_333 });
  });

  it('소수점 아래가 큰 사람이 먼저 1원을 더 낸다', () => {
    // a: 1428.57…, b: 2857.14…, c: 5714.28… → 소수점이 큰 a가 1원 더
    const result = allocate(10_000, [['a', 1], ['b', 2], ['c', 4]]);
    expect(Object.fromEntries(result)).toEqual({ a: 1_429, b: 2_857, c: 5_714 });
  });

  it('비율이 0인 사람도 결과에 0원으로 남는다', () => {
    expect(Object.fromEntries(allocate(9_000, [['a', 1], ['b', 0], ['c', 2]]))).toEqual({ a: 3_000, b: 0, c: 6_000 });
  });

  it('1/3 같은 부동소수점 비율이어도 합계가 정확하다', () => {
    const result = allocate(100_001, [['a', 1 / 3], ['b', 1 / 3], ['c', 1 / 3]]);
    expect(total(result)).toBe(100_001);
  });

  it('100원 단위로 나누고 단위 미만 잔돈은 absorber가 떠안는다', () => {
    const result = allocate(100_050, [['a', 1], ['b', 1], ['c', 1]], 100, 'c');
    expect(Object.fromEntries(result)).toEqual({ a: 33_400, b: 33_300, c: 33_350 });
  });

  it('absorber가 없으면 가장 많이 내는 사람이 잔돈을 떠안는다', () => {
    const result = allocate(10_050, [['a', 1], ['b', 3]], 100);
    expect(Object.fromEntries(result)).toEqual({ a: 2_500, b: 7_550 });
  });

  it('0원은 모두 0원', () => {
    expect(Object.fromEntries(allocate(0, [['a', 0]]))).toEqual({ a: 0 });
  });

  it('나눌 사람이 없으면 에러', () => {
    expect(() => allocate(1_000, [['a', 0]])).toThrow(RangeError);
  });
});
