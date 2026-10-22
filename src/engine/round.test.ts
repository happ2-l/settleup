import { describe, expect, it } from 'vitest';
import { SettleError, type SettleErrorCode } from './errors';
import { splitRound } from './round';
import type { Member, Participant, Round } from './types';

const members: Member[] = ['철수', '영희', '민수', '지은', '현우'].map((name) => ({ id: name, name }));

const people = (...ids: string[]): Participant[] => ids.map((memberId) => ({ memberId }));

function round(overrides: Partial<Round> & Pick<Round, 'total' | 'participants'>): Round {
  return { id: 'r1', name: '1차', payments: { 철수: overrides.total - (overrides.discount ?? 0) }, ...overrides };
}

const shares = (r: Round, unit?: number) => splitRound(r, members, unit ? { unit } : {}).shares;

function errorCode(fn: () => unknown): SettleErrorCode | undefined {
  try {
    fn();
  } catch (e) {
    if (e instanceof SettleError) return e.code;
    throw e;
  }
  return undefined;
}

describe('splitRound: 상황별 나누기', () => {
  it('기본은 N빵', () => {
    expect(shares(round({ total: 50_000, participants: people('철수', '영희', '민수', '지은', '현우') }))).toEqual({
      철수: 10_000,
      영희: 10_000,
      민수: 10_000,
      지은: 10_000,
      현우: 10_000,
    });
  });

  it('술 안 마신 사람은 술값에서 빠진다', () => {
    const r = round({
      total: 160_000,
      participants: [...people('철수', '영희', '민수', '현우'), { memberId: '지은', excludes: ['술'] }],
      items: [{ name: '소주·맥주', category: '술', amount: 70_000 }],
    });
    // 음식 90,000 / 5 = 18,000, 술 70,000 / 4 = 17,500
    expect(shares(r)).toEqual({ 철수: 35_500, 영희: 35_500, 민수: 35_500, 현우: 35_500, 지은: 18_000 });
  });

  it('잠깐 있다 간 사람은 비율만큼만 낸다', () => {
    const r = round({ total: 90_000, participants: [...people('철수', '영희', '민수', '지은'), { memberId: '현우', weight: 0.5 }] });
    expect(shares(r)).toEqual({ 철수: 20_000, 영희: 20_000, 민수: 20_000, 지은: 20_000, 현우: 10_000 });
  });

  it('술 안 마심 + 일찍 감이 한 차수에 같이 있어도 항목마다 따로 적용된다', () => {
    const r = round({
      total: 160_000,
      participants: [
        ...people('철수', '영희', '민수'),
        { memberId: '지은', excludes: ['술'] },
        { memberId: '현우', weight: 0.5 },
      ],
      items: [{ category: '술', amount: 70_000 }],
    });
    // 음식 90,000 / 4.5 = 20,000, 술 70,000 / 3.5 = 20,000
    expect(shares(r)).toEqual({ 철수: 40_000, 영희: 40_000, 민수: 40_000, 지은: 20_000, 현우: 20_000 });
  });

  it('특정 메뉴는 먹은 사람만 낸다', () => {
    const r = round({
      total: 100_000,
      participants: people('철수', '영희', '민수', '지은'),
      items: [{ name: '랍스터', amount: 40_000, shares: { 철수: 1 } }],
    });
    expect(shares(r)).toEqual({ 철수: 55_000, 영희: 15_000, 민수: 15_000, 지은: 15_000 });
  });

  it('메뉴를 몇 명이 다른 비율로 나눌 수도 있다', () => {
    const r = round({
      total: 60_000,
      participants: people('철수', '영희', '민수'),
      items: [{ name: '와인', amount: 30_000, shares: { 철수: 2, 영희: 1 } }],
    });
    expect(shares(r)).toEqual({ 철수: 30_000, 영희: 20_000, 민수: 10_000 });
  });

  it('선배는 비율을 높여 더 낸다', () => {
    const r = round({ total: 100_000, participants: [{ memberId: '철수', weight: 2 }, ...people('영희', '민수')] });
    expect(shares(r)).toEqual({ 철수: 50_000, 영희: 25_000, 민수: 25_000 });
  });

  it('"난 만원만 낼게" — 나머지는 다른 사람들이 나눈다', () => {
    const r = round({ total: 100_000, participants: [...people('철수', '영희', '민수'), { memberId: '지은', fixed: 10_000 }] });
    expect(shares(r)).toEqual({ 철수: 30_000, 영희: 30_000, 민수: 30_000, 지은: 10_000 });
  });

  it('생일자는 면제 (고정금액 0 또는 비율 0)', () => {
    const expected = { 철수: 30_000, 영희: 30_000, 민수: 30_000, 지은: 0 };
    const base = { total: 90_000, participants: people('철수', '영희', '민수') };
    expect(shares(round({ ...base, participants: [...base.participants, { memberId: '지은', fixed: 0 }] }))).toEqual(expected);
    expect(shares(round({ ...base, participants: [...base.participants, { memberId: '지은', weight: 0 }] }))).toEqual(expected);
  });

  it('한 사람이 다 쏘면 나머지는 0원', () => {
    const r = round({ total: 80_000, participants: [...people('철수'), ...['영희', '민수'].map((memberId) => ({ memberId, fixed: 0 }))] });
    expect(shares(r)).toEqual({ 철수: 80_000, 영희: 0, 민수: 0 });
  });

  it('할인은 각자 몫에 비례해서 줄어든다', () => {
    const r = round({
      total: 100_000,
      discount: 10_000,
      participants: [...people('철수', '영희', '민수'), { memberId: '지은', excludes: ['술'] }],
      items: [{ category: '술', amount: 40_000 }],
    });
    // 할인 전: 28,333.33 ×3 / 15,000 → 90% 적용
    const result = splitRound(r, members);
    expect(result.charged).toBe(90_000);
    expect(result.shares).toEqual({ 철수: 25_500, 영희: 25_500, 민수: 25_500, 지은: 13_500 });
  });

  it('여러 명이 나눠 결제해도 부담액은 같다', () => {
    const r = round({ total: 100_000, participants: people('철수', '영희', '민수', '지은'), payments: { 철수: 60_000, 영희: 40_000 } });
    expect(shares(r)).toEqual({ 철수: 25_000, 영희: 25_000, 민수: 25_000, 지은: 25_000 });
  });

  it('결제자가 참석자가 아니어도 된다 (먼저 간 친구가 계산하고 감)', () => {
    const r = round({ total: 30_000, participants: people('영희', '민수'), payments: { 철수: 30_000 } });
    expect(shares(r)).toEqual({ 영희: 15_000, 민수: 15_000 });
  });

  it('혼자 먹은 메뉴의 주인이 고정금액이면 그 메뉴값은 나머지가 나눠 낸다', () => {
    const r = round({
      total: 90_000,
      participants: [{ memberId: '철수', fixed: 20_000 }, ...people('영희', '민수', '지은')],
      items: [{ name: '와인', amount: 30_000, shares: { 철수: 1 } }],
    });
    expect(shares(r)).toEqual({ 철수: 20_000, 영희: 23_334, 민수: 23_333, 지은: 23_333 });
  });

  it('100원 단위로 맞추고 잔돈은 결제자가 떠안는다', () => {
    const r = round({ total: 100_050, participants: people('철수', '영희', '민수'), payments: { 민수: 100_050 } });
    expect(shares(r, 100)).toEqual({ 철수: 33_400, 영희: 33_300, 민수: 33_350 });
  });

  it('0원짜리 차수도 처리된다', () => {
    expect(shares(round({ total: 0, participants: people('철수', '영희') }))).toEqual({ 철수: 0, 영희: 0 });
  });
});

describe('splitRound: 잘못된 입력', () => {
  const ok = { total: 30_000, participants: people('철수', '영희', '민수') };

  it.each<[string, Round, SettleErrorCode]>([
    ['결제 합계가 안 맞음', round({ ...ok, payments: { 철수: 20_000 } }), 'PAYMENT_MISMATCH'],
    ['소수점 금액', round({ ...ok, total: 100.5, payments: { 철수: 100.5 } }), 'INVALID_AMOUNT'],
    ['음수 금액', round({ ...ok, total: -1, payments: { 철수: -1 } }), 'INVALID_AMOUNT'],
    ['할인이 총액보다 큼', round({ ...ok, discount: 40_000, payments: { 철수: 0 } }), 'DISCOUNT_EXCEEDS_TOTAL'],
    ['항목 합계가 총액보다 큼', round({ ...ok, items: [{ amount: 40_000 }] }), 'ITEMS_EXCEED_TOTAL'],
    ['모임에 없는 사람', round({ ...ok, participants: people('철수', '길동') }), 'UNKNOWN_MEMBER'],
    ['모임에 없는 결제자', round({ ...ok, payments: { 길동: 30_000 } }), 'UNKNOWN_MEMBER'],
    ['참석자 중복', round({ ...ok, participants: people('철수', '철수') }), 'DUPLICATE_ID'],
    ['음수 비율', round({ ...ok, participants: [{ memberId: '철수', weight: -1 }] }), 'INVALID_WEIGHT'],
    ['참석 안 한 사람이 메뉴를 나눔', round({ ...ok, items: [{ amount: 10_000, shares: { 지은: 1 } }] }), 'NOT_A_PARTICIPANT'],
    [
      '아무도 안 마신 술',
      round({
        ...ok,
        participants: ['철수', '영희', '민수'].map((memberId) => ({ memberId, excludes: ['술'] })),
        items: [{ category: '술', amount: 10_000 }],
      }),
      'ITEM_NO_CONSUMER',
    ],
    ['고정금액이 결제액보다 큼', round({ ...ok, participants: [{ memberId: '철수', fixed: 40_000 }] }), 'FIXED_EXCEEDS_TOTAL'],
    ['남은 돈을 낼 사람이 없음', round({ ...ok, participants: [{ memberId: '철수', fixed: 10_000 }, { memberId: '영희', weight: 0 }] }), 'NO_ONE_TO_PAY'],
    ['참석자가 없음', round({ ...ok, participants: [] }), 'NO_ONE_TO_PAY'],
  ])('%s', (_, r, code) => {
    expect(errorCode(() => splitRound(r, members))).toBe(code);
  });

  it('에러 메시지는 차수 이름과 사람 이름으로 보여준다', () => {
    expect(() => splitRound(round({ ...ok, participants: [{ memberId: '영희', weight: -1 }] }), members)).toThrow(
      '1차: 영희의 비율은 0 이상의 숫자여야 합니다',
    );
  });
});

describe('splitRound: 이름 없는 항목', () => {
  it('항목 이름이 빈 문자열이면 카테고리나 "항목"으로 부른다', () => {
    const r = round({ total: 30_000, participants: people('철수'), items: [{ name: ' ', amount: 10_000, shares: {} }] });
    expect(() => splitRound(r, members)).toThrow("1차: '항목'을(를) 나눠 낼 사람이 없습니다");
  });
});
