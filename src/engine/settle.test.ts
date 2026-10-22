import { describe, expect, it } from 'vitest';
import { SettleError } from './errors';
import { settle } from './settle';
import type { Gathering, Member, Participant, Round } from './types';

const members: Member[] = ['철수', '영희', '민수', '지은', '현우'].map((name) => ({ id: name, name }));

// 1차 고깃집: 음식 9만 + 술 7만, 지은은 술 안 마심, 현우는 일찍 감 / 2차 술집: 3명만
const gathering: Gathering = {
  members,
  rounds: [
    {
      id: 'r1',
      name: '1차 고깃집',
      total: 160_000,
      items: [{ name: '술', category: '술', amount: 70_000 }],
      participants: [
        { memberId: '철수' },
        { memberId: '영희' },
        { memberId: '민수' },
        { memberId: '지은', excludes: ['술'] },
        { memberId: '현우', weight: 0.5 },
      ],
      payments: { 철수: 160_000 },
    },
    {
      id: 'r2',
      name: '2차 술집',
      total: 60_000,
      participants: [{ memberId: '철수' }, { memberId: '영희' }, { memberId: '민수' }],
      payments: { 영희: 60_000 },
    },
  ],
};

const balances = (g: Gathering) => Object.fromEntries(settle(g).members.map((m) => [m.memberId, m.balance]));

describe('settle', () => {
  it('차수별 부담액, 사람별 잔액, 송금 목록을 계산한다', () => {
    const result = settle(gathering);

    expect(result.rounds.map((r) => r.shares)).toEqual([
      { 철수: 40_000, 영희: 40_000, 민수: 40_000, 지은: 20_000, 현우: 20_000 },
      { 철수: 20_000, 영희: 20_000, 민수: 20_000 },
    ]);
    expect(result.members.find((m) => m.memberId === '철수')).toEqual({
      memberId: '철수',
      paid: 160_000,
      owed: 60_000,
      sent: 0,
      received: 0,
      balance: 100_000,
    });
    expect(balances(gathering)).toEqual({ 철수: 100_000, 영희: 0, 민수: -60_000, 지은: -20_000, 현우: -20_000 });
    // 차수별로 따로 정산하면 6번, 합쳐서 상계하면 3번
    expect(result.transfers).toEqual([
      { from: '민수', to: '철수', amount: 60_000 },
      { from: '지은', to: '철수', amount: 20_000 },
      { from: '현우', to: '철수', amount: 20_000 },
    ]);
  });

  it('이미 보낸 송금은 빼고 남은 것만 알려준다', () => {
    const result = settle({ ...gathering, repayments: [{ from: '민수', to: '철수', amount: 60_000 }] });
    expect(result.members.find((m) => m.memberId === '민수')).toMatchObject({ sent: 60_000, balance: 0 });
    expect(result.transfers).toEqual([
      { from: '지은', to: '철수', amount: 20_000 },
      { from: '현우', to: '철수', amount: 20_000 },
    ]);
  });

  it('일부만 보냈으면 나머지만 보내면 된다', () => {
    const result = settle({ ...gathering, repayments: [{ from: '지은', to: '철수', amount: 15_000 }] });
    expect(result.transfers).toContainEqual({ from: '지은', to: '철수', amount: 5_000 });
  });

  it('어느 차수에도 없던 멤버는 0원', () => {
    const result = settle({ ...gathering, members: [...members, { id: '길동', name: '길동' }] });
    expect(result.members.at(-1)).toEqual({ memberId: '길동', paid: 0, owed: 0, sent: 0, received: 0, balance: 0 });
  });

  it('정산 단위 옵션이 모든 차수에 적용된다', () => {
    const result = settle(
      {
        members,
        rounds: [
          {
            id: 'r1',
            total: 100_000,
            participants: [{ memberId: '철수' }, { memberId: '영희' }, { memberId: '민수' }],
            payments: { 철수: 100_000 },
          },
        ],
      },
      { unit: 1_000 },
    );
    expect(result.rounds[0]!.shares).toEqual({ 철수: 34_000, 영희: 33_000, 민수: 33_000 });
  });

  describe('잘못된 입력', () => {
    const code = (fn: () => unknown) => {
      try {
        fn();
      } catch (e) {
        return e instanceof SettleError ? e.code : e;
      }
    };

    it('정산 단위가 정수가 아님', () => {
      expect(code(() => settle(gathering, { unit: 0 }))).toBe('INVALID_UNIT');
      expect(code(() => settle(gathering, { unit: 10.5 }))).toBe('INVALID_UNIT');
    });

    it('멤버·차수 id 중복', () => {
      expect(code(() => settle({ ...gathering, members: [...members, members[0]!] }))).toBe('DUPLICATE_ID');
      expect(code(() => settle({ ...gathering, rounds: [gathering.rounds[0]!, gathering.rounds[0]!] }))).toBe('DUPLICATE_ID');
    });

    it('잘못된 송금 기록', () => {
      const withRepayment = (from: string, to: string, amount: number) =>
        code(() => settle({ ...gathering, repayments: [{ from, to, amount }] }));
      expect(withRepayment('민수', '길동', 1_000)).toBe('UNKNOWN_MEMBER');
      expect(withRepayment('민수', '민수', 1_000)).toBe('INVALID_TRANSFER');
      expect(withRepayment('민수', '철수', 0)).toBe('INVALID_TRANSFER');
      expect(withRepayment('민수', '철수', 10.5)).toBe('INVALID_TRANSFER');
    });
  });
});

describe('settle: 무작위 모임에서도 항상 맞아떨어진다', () => {
  // 재현 가능한 의사 난수 (mulberry32)
  function random(seed: number) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomGathering(rand: () => number): Gathering {
    const int = (max: number) => Math.floor(rand() * max);
    const people: Member[] = Array.from({ length: 2 + int(10) }, (_, i) => ({ id: `p${i}`, name: `p${i}` }));
    const rounds: Round[] = Array.from({ length: 1 + int(4) }, (_, r) => {
      const attendees = people.filter(() => rand() < 0.7);
      if (attendees.length === 0) attendees.push(people[0]!);
      const total = 1_000 + int(500) * 1_000 + int(1_000);
      const discount = rand() < 0.2 ? int(total / 10) : 0;
      const alcohol = rand() < 0.6 ? int(total / 2) : 0;
      const participants: Participant[] = attendees.map((m, i) => {
        const p: Participant = { memberId: m.id };
        if (rand() < 0.2) p.weight = [0.5, 1 / 3, 1.5, 2][int(4)]!;
        // 첫 참석자는 항상 술을 마셔서 술값을 낼 사람이 있게
        if (i > 0 && rand() < 0.3) p.excludes = ['술'];
        if (i > 0 && rand() < 0.1) p.fixed = int((total - discount) / attendees.length);
        return p;
      });
      // 결제는 한두 명이
      const payer = people[int(people.length)]!.id;
      const charged = total - discount;
      const split = int(charged);
      const payments = rand() < 0.3 && payer !== 'p0' ? { [payer]: split, p0: charged - split } : { [payer]: charged };
      return {
        id: `r${r}`,
        total,
        discount,
        participants,
        items: alcohol > 0 ? [{ category: '술', amount: alcohol }] : [],
        payments,
      };
    });
    return { members: people, rounds };
  }

  it.each(Array.from({ length: 300 }, (_, i) => i))('seed %i', (seed) => {
    const g = randomGathering(random(seed));
    const unit = [1, 10, 100, 1_000][seed % 4]!;
    const result = settle(g, { unit });

    for (const [i, r] of result.rounds.entries()) {
      const shares = Object.values(r.shares);
      expect(shares.reduce((a, b) => a + b, 0)).toBe(r.charged);
      expect(shares.every((s) => Number.isSafeInteger(s) && s >= 0)).toBe(true);
      expect(r.charged).toBe(g.rounds[i]!.total - (g.rounds[i]!.discount ?? 0));
    }

    const balance = Object.fromEntries(result.members.map((m) => [m.memberId, m.balance]));
    expect(Object.values(balance).reduce((a, b) => a + b, 0)).toBe(0);
    for (const t of result.transfers) {
      expect(t.amount).toBeGreaterThan(0);
      balance[t.from]! += t.amount;
      balance[t.to]! -= t.amount;
    }
    expect(Object.values(balance).every((v) => v === 0)).toBe(true);

    const nonZero = result.members.filter((m) => m.balance !== 0).length;
    expect(result.transfers.length).toBeLessThanOrEqual(Math.max(0, nonZero - 1));

    // 결제한 사람에게 바로 보내는 방식도 잔액을 정확히 0으로 만든다
    const sent = g.rounds.length > 0 && seed % 3 === 0 ? result.transfers.slice(0, 1) : [];
    const direct = settle({ ...g, repayments: sent }, { unit, transfers: 'direct' });
    const left = Object.fromEntries(direct.members.map((m) => [m.memberId, m.balance]));
    for (const t of direct.transfers) {
      expect(t.amount).toBeGreaterThan(0);
      expect(t.from).not.toBe(t.to);
      left[t.from]! += t.amount;
      left[t.to]! -= t.amount;
    }
    expect(Object.values(left).every((v) => v === 0)).toBe(true);
  });
});

describe('송금 방식: 결제한 사람에게 바로', () => {
  const people: Member[] = [{ id: 'me', name: '나' }, { id: 'x', name: 'X' }, { id: 'y', name: 'Y' }];
  const all: Participant[] = people.map((p) => ({ memberId: p.id }));
  const forgotten = (payer: string): Gathering => ({
    members: people,
    rounds: [
      { id: 'r1', total: 90_000, participants: all, payments: { me: 90_000 } },
      { id: 'r2', total: 30_000, participants: all, payments: { [payer]: 30_000 } },
    ],
  });

  it('최소 송금은 X가 받을 돈을 X가 낼 돈과 상계해서 X에게 보낼 게 없어 보인다', () => {
    expect(settle(forgotten('x')).transfers).toEqual([
      { from: 'y', to: 'me', amount: 40_000 },
      { from: 'x', to: 'me', amount: 10_000 },
    ]);
  });

  it('결제한 사람에게 바로: 2차 몫은 X에게, 나와 X 사이만 상계', () => {
    expect(settle(forgotten('x'), { transfers: 'direct' }).transfers).toEqual([
      { from: 'x', to: 'me', amount: 20_000 },
      { from: 'y', to: 'me', amount: 30_000 },
      { from: 'y', to: 'x', amount: 10_000 },
    ]);
  });

  it('예시 모임: 각 차수 결제자에게, 두 사람 사이에 오가는 돈만 상계', () => {
    expect(settle(gathering, { transfers: 'direct' }).transfers).toEqual([
      { from: '영희', to: '철수', amount: 20_000 },
      { from: '민수', to: '철수', amount: 40_000 },
      { from: '지은', to: '철수', amount: 20_000 },
      { from: '현우', to: '철수', amount: 20_000 },
      { from: '민수', to: '영희', amount: 20_000 },
    ]);
  });

  it('여러 명이 결제하면 결제자 본인 몫을 먼저 빼고 나머지를 차례로 채운다', () => {
    const four: Member[] = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id }));
    const g: Gathering = {
      members: four,
      rounds: [{ id: 'r', total: 100_000, participants: four.map((m) => ({ memberId: m.id })), payments: { a: 60_000, b: 40_000 } }],
    };
    expect(settle(g, { transfers: 'direct' }).transfers).toEqual([
      { from: 'c', to: 'a', amount: 25_000 },
      { from: 'd', to: 'a', amount: 10_000 },
      { from: 'd', to: 'b', amount: 15_000 },
    ]);
  });

  it('이미 보낸 돈은 빼고 남은 것만', () => {
    const g = { ...gathering, repayments: [{ from: '민수', to: '철수', amount: 40_000 }] };
    const transfers = settle(g, { transfers: 'direct' }).transfers;
    expect(transfers).not.toContainEqual(expect.objectContaining({ from: '민수', to: '철수' }));
    expect(transfers).toContainEqual({ from: '민수', to: '영희', amount: 20_000 });
  });
});

describe('실제 사례: 까먹은 피자를 송우가 낸 것으로 추가', () => {
  // 1~7차는 햅도가 다 냈고(304,100원), 각자 부담은 아래와 같았다. 8차 피자 47,000원은 송우가 냈고 5명이 9,400원씩
  const names = ['햅도', '송우', '신동', '핑핑', '런고', '고콰니', '윤'];
  const before: Record<string, number> = { 햅도: 59_500, 송우: 59_400, 신동: 59_400, 핑핑: 30_900, 런고: 26_400, 고콰니: 47_000, 윤: 21_500 };
  const g: Gathering = {
    members: names.map((n) => ({ id: n, name: n })),
    rounds: [
      { id: '1~7차', total: 304_100, participants: names.map((n) => ({ memberId: n, fixed: before[n]! })), payments: { 햅도: 304_100 } },
      {
        id: '8차 피자',
        total: 47_000,
        participants: ['햅도', '송우', '신동', '핑핑', '고콰니'].map((memberId) => ({ memberId })),
        payments: { 송우: 47_000 },
      },
    ],
  };

  it('결제한 사람에게 바로: 송우는 햅도에게 59,400 − 9,400 = 50,000원, 피자 먹은 사람은 송우에게 9,400원', () => {
    expect(settle(g, { transfers: 'direct' }).transfers).toEqual([
      { from: '송우', to: '햅도', amount: 50_000 },
      { from: '신동', to: '햅도', amount: 59_400 },
      { from: '핑핑', to: '햅도', amount: 30_900 },
      { from: '런고', to: '햅도', amount: 26_400 },
      { from: '고콰니', to: '햅도', amount: 47_000 },
      { from: '윤', to: '햅도', amount: 21_500 },
      { from: '신동', to: '송우', amount: 9_400 },
      { from: '핑핑', to: '송우', amount: 9_400 },
      { from: '고콰니', to: '송우', amount: 9_400 },
    ]);
  });

  it('최소 송금은 피자값이 햅도를 거쳐 가서 송우 → 햅도가 21,800원이 된다 (합계는 같음)', () => {
    const transfers = settle(g).transfers;
    expect(transfers).toContainEqual({ from: '송우', to: '햅도', amount: 21_800 });
    expect(transfers.every((t) => t.to === '햅도')).toBe(true);
  });
});
