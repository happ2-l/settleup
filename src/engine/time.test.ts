import { describe, expect, it } from 'vitest';
import { stayRatio } from './time';

// 18:00 ~ 21:00, 분 단위
const start = 18 * 60;
const end = 21 * 60;

describe('stayRatio', () => {
  it('끝까지 있으면 1', () => {
    expect(stayRatio(start, end)).toBe(1);
  });

  it('19:30에 먼저 가면 0.5', () => {
    expect(stayRatio(start, end, start, 19 * 60 + 30)).toBe(0.5);
  });

  it('20:00에 늦게 오면 1/3', () => {
    expect(stayRatio(start, end, 20 * 60)).toBeCloseTo(1 / 3);
  });

  it('차수 시간 밖은 잘라낸다', () => {
    expect(stayRatio(start, end, start - 60, end + 60)).toBe(1);
    expect(stayRatio(start, end, end + 10, end + 60)).toBe(0);
  });

  it('끝 시각이 시작보다 앞서면 에러', () => {
    expect(() => stayRatio(end, start)).toThrow(RangeError);
  });
});
