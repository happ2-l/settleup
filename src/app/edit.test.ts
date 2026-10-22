import { describe, expect, it } from 'vitest';
import { compute } from './compute';
import {
  addMembers,
  addMenuItem,
  addRound,
  alcoholOf,
  markSent,
  removeMember,
  setAlcohol,
  setAllAttending,
  setAllEaters,
  setDiscount,
  setDrinks,
  setFixed,
  setMultiPay,
  setPayer,
  setPayment,
  setTotal,
  setWeight,
  toggleAttendance,
  toggleEater,
  unmarkSent,
  updateItem,
  updateMember,
  updateRound,
} from './edit';
import { newMeeting, sampleMeeting, type Meeting } from './model';

const ids = (m: Meeting) => Object.fromEntries(m.members.map((f) => [f.name, f.id]));

function withFriends(names: string): Meeting {
  return addMembers(newMeeting(), names);
}

describe('멤버', () => {
  it('띄어쓰기·쉼표로 여러 명을 한 번에 추가하고 같은 이름은 건너뛴다', () => {
    const m = addMembers(withFriends('철수 영희'), '영희, 민수  지은 민수');
    expect(m.members.map((f) => f.name)).toEqual(['철수', '영희', '민수', '지은']);
    expect(new Set(m.members.map((f) => f.id)).size).toBe(4);
  });

  it('나중에 추가한 친구는 기존 차수에도 참석자로 들어간다', () => {
    const m = addMembers(addRound(withFriends('철수 영희')), '민수');
    expect(m.rounds[0]!.participants.map((p) => p.memberId)).toEqual(m.members.map((f) => f.id));
  });

  it('받는 곳은 정리해서 저장하고, 다 지우면 필드가 없어진다', () => {
    const m = withFriends('철수');
    const id = m.members[0]!.id;
    const withPay = updateMember(m, id, {
      pay: { bank: ' 카카오뱅크 ', accountNo: '3333-00-0000000', holder: '', toss: 'https://toss.me/abc/', kakaopay: 'not a link' },
    });
    expect(withPay.members[0]!.pay).toEqual({ bank: '카카오뱅크', accountNo: '3333-00-0000000', toss: 'abc' });
    expect('pay' in updateMember(withPay, id, { pay: { bank: '', accountNo: ' ' } }).members[0]!).toBe(false);
  });

  it('빈 이름으로는 바뀌지 않는다', () => {
    const m = withFriends('철수');
    expect(updateMember(m, m.members[0]!.id, { name: '  ' }).members[0]!.name).toBe('철수');
  });

  it('멤버를 빼면 참석자·메뉴·결제·송금 기록에서도 빠진다', () => {
    let m = sampleMeeting();
    const { 철수, 영희, 민수 } = ids(m);
    m = updateRound(m, 'r1', (r) => toggleEater(addMenuItem(r), 1, 민수!));
    m = markSent(m, { from: 민수!, to: 철수!, amount: 1000 });
    m = removeMember(m, 민수!);
    expect(m.rounds.every((r) => r.participants.every((p) => p.memberId !== 민수))).toBe(true);
    expect(m.rounds[0]!.items![1]!.shares).toEqual({});
    expect(m.repayments).toEqual([]);

    // 결제자가 빠지면 남은 첫 멤버가 결제자가 된다
    const without = removeMember(m, 영희!);
    expect(without.rounds[1]!.payments).toEqual({ [철수!]: 60_000 });
  });
});

describe('차수', () => {
  it('새 차수는 전원 참석, 결제자는 직전 차수 결제자', () => {
    const m = addRound(addRound(withFriends('철수 영희 민수')));
    expect(m.rounds[1]!.participants).toHaveLength(3);
    expect(Object.keys(m.rounds[1]!.payments)).toEqual([m.members[0]!.id]);
  });

  it('결제자 한 명이면 총액·할인을 바꿀 때 결제액이 따라간다', () => {
    const m = addRound(withFriends('철수 영희'));
    const { 영희 } = ids(m);
    let r = setTotal(m.rounds[0]!, 50_000);
    r = setPayer(r, 영희!);
    r = setDiscount(r, 5_000);
    expect(r.payments).toEqual({ [영희!]: 45_000 });
    r = setDiscount(r, 0);
    expect('discount' in r).toBe(false);
    expect(r.payments).toEqual({ [영희!]: 50_000 });
  });

  it('여러 명 결제 모드에서는 각자 금액을 그대로 두고, 끄면 가장 많이 낸 사람으로 합친다', () => {
    const m = addRound(withFriends('철수 영희'));
    const { 철수, 영희 } = ids(m);
    let r = setMultiPay(setTotal(m.rounds[0]!, 50_000), true);
    r = setPayment(setPayment(r, 철수!, 20_000), 영희!, 30_000);
    r = setTotal(r, 60_000);
    expect(r.payments).toEqual({ [철수!]: 20_000, [영희!]: 30_000 });
    r = setMultiPay(r, false);
    expect(r.payments).toEqual({ [영희!]: 60_000 });
    expect('multiPay' in r).toBe(false);
  });

  it('술값은 항목 하나로 관리되고 0원이면 사라진다', () => {
    let r = addRound(withFriends('철수')).rounds[0]!;
    r = setAlcohol(r, 30_000);
    expect(alcoholOf(r)).toBe(30_000);
    r = setAlcohol(r, 40_000);
    expect(r.items).toHaveLength(1);
    expect(alcoholOf(r)).toBe(40_000);
    r = setAlcohol(r, 0);
    expect('items' in r).toBe(false);
  });

  it('불참으로 바꾸면 메뉴 나눔에서도 빠지고, 다시 넣으면 멤버 순서대로 들어간다', () => {
    const m = addRound(withFriends('철수 영희 민수'));
    const { 철수, 민수 } = ids(m);
    let r = toggleEater(updateItem(addMenuItem(m.rounds[0]!), 0, { amount: 10_000 }), 0, 철수!);
    r = toggleAttendance(r, 철수!, m.members);
    expect(r.participants.map((p) => p.memberId)).not.toContain(철수);
    expect(r.items![0]!.shares).toEqual({});
    r = toggleAttendance(toggleAttendance(r, 민수!, m.members), 철수!, m.members);
    expect(r.participants.map((p) => p.memberId)).toEqual([철수, m.members[1]!.id]);
  });

  it('전원 참석은 멤버 순서대로 넣고 기존 예외는 유지, 모두 빼기는 메뉴 나눔도 비운다', () => {
    const m = addRound(withFriends('철수 영희 민수'));
    const { 철수, 영희, 민수 } = ids(m);
    let r = setDrinks(m.rounds[0]!, 영희!, false);
    r = toggleAttendance(toggleAttendance(r, 철수!, m.members), 민수!, m.members);
    r = setAllAttending(r, true, m.members);
    expect(r.participants).toEqual([{ memberId: 철수 }, { memberId: 영희, excludes: ['술'] }, { memberId: 민수 }]);

    r = setAllEaters(updateItem(addMenuItem(r), 0, { amount: 9_000 }), 0, true);
    expect(r.items![0]!.shares).toEqual({ [철수!]: 1, [영희!]: 1, [민수!]: 1 });
    expect(setAllEaters(r, 0, false).items![0]!.shares).toEqual({});

    r = setAllAttending(r, false, m.members);
    expect(r.participants).toEqual([]);
    expect(r.items![0]!.shares).toEqual({});
  });

  it('참석자 예외: 술, 비율, 고정금액을 켜고 끈다', () => {
    const m = addRound(withFriends('철수'));
    const { 철수 } = ids(m);
    let r = setFixed(setWeight(setDrinks(m.rounds[0]!, 철수!, false), 철수!, 0.5), 철수!, 0);
    expect(r.participants[0]).toEqual({ memberId: 철수, excludes: ['술'], weight: 0.5, fixed: 0 });
    r = setFixed(setWeight(setDrinks(r, 철수!, true), 철수!, 1), 철수!, undefined);
    expect(r.participants[0]).toEqual({ memberId: 철수 });
  });

  it('송금 체크와 취소', () => {
    const m = markSent(newMeeting(), { from: 'a', to: 'b', amount: 1 });
    expect(m.repayments).toHaveLength(1);
    expect(unmarkSent(m, 0).repayments).toEqual([]);
  });
});

describe('화면에서 입력한 그대로 정산된다', () => {
  it('예시 모임을 수정 함수로 처음부터 만들면 같은 결과가 나온다', () => {
    let m = withFriends('철수 영희 민수 지은 현우');
    const { 철수, 영희, 민수, 지은, 현우 } = ids(m);
    m = addRound(m);
    const r1 = m.rounds[0]!.id;
    m = updateRound(m, r1, (r) => setWeight(setDrinks(setAlcohol(setTotal(setPayer(r, 철수!), 160_000), 70_000), 지은!, false), 현우!, 0.5));
    m = addRound(m);
    const r2 = m.rounds[1]!.id;
    m = updateRound(m, r2, (r) =>
      setPayer(toggleAttendance(toggleAttendance(setTotal(r, 60_000), 지은!, m.members), 현우!, m.members), 영희!),
    );

    const computed = compute(m);
    if (!computed.ok) throw computed.error;
    expect(computed.result.transfers).toEqual([
      { from: 민수, to: 철수, amount: 60_000 },
      { from: 지은, to: 철수, amount: 20_000 },
      { from: 현우, to: 철수, amount: 20_000 },
    ]);
  });

  it('입력이 덜 됐으면 에러를 돌려준다', () => {
    let m = addRound(withFriends('철수 영희'));
    // 여러 명 결제로 바꾼 뒤 총액만 적고 각자 낸 금액은 아직 안 적음
    m = updateRound(m, m.rounds[0]!.id, (r) => setTotal(setMultiPay(r, true), 10_000));
    const computed = compute(m);
    expect(computed.ok).toBe(false);
    if (!computed.ok) expect(computed.error.code).toBe('PAYMENT_MISMATCH');
  });
});
