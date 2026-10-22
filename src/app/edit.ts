import type { Item, MemberId, Participant, Transfer } from '../engine';
import { ALCOHOL, shortId, type Friend, type Meeting, type MeetingRound } from './model';

// 화면에서 쓰는 수정 함수들. 모두 새 객체를 돌려준다.

const touch = (m: Meeting): Meeting => ({ ...m, updatedAt: Date.now() });

function omit<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const { [key]: _, ...rest } = obj;
  return rest;
}

function omitKey<V>(record: Record<string, V>, key: string): Record<string, V> {
  const { [key]: _, ...rest } = record;
  return rest;
}

// ── 멤버 ──────────────────────────────────────────────

/** "철수 영희, 민수"처럼 여러 명을 한 번에 추가. 새 멤버는 기존 차수에도 참석자로 들어간다 */
export function addMembers(m: Meeting, text: string): Meeting {
  const taken = new Set(m.members.map((f) => f.name));
  const ids = new Set(m.members.map((f) => f.id));
  const fresh: Friend[] = [];
  for (const name of text.split(/[\s,]+/).filter(Boolean)) {
    if (taken.has(name)) continue;
    taken.add(name);
    let id = shortId();
    while (ids.has(id)) id = shortId();
    ids.add(id);
    fresh.push({ id, name });
  }
  if (fresh.length === 0) return m;
  return touch({
    ...m,
    members: [...m.members, ...fresh],
    rounds: m.rounds.map((r) => ({ ...r, participants: [...r.participants, ...fresh.map((f) => ({ memberId: f.id }))] })),
  });
}

export function updateMember(m: Meeting, id: MemberId, patch: { name?: string; account?: string }): Meeting {
  return touch({
    ...m,
    members: m.members.map((f) => {
      if (f.id !== id) return f;
      const next: Friend = { ...f, ...(patch.name !== undefined && patch.name.trim() ? { name: patch.name.trim() } : {}) };
      if (patch.account === undefined) return next;
      return patch.account.trim() ? { ...next, account: patch.account.trim() } : omit(next, 'account');
    }),
  });
}

/** 멤버를 빼면 모든 차수의 참석자·메뉴·결제와 송금 기록에서도 빠진다 */
export function removeMember(m: Meeting, id: MemberId): Meeting {
  const members = m.members.filter((f) => f.id !== id);
  return touch({
    ...m,
    members,
    rounds: m.rounds.map((r) => {
      const next = withoutParticipant(r, id);
      if (!(id in r.payments)) return next;
      if (r.multiPay) return { ...next, payments: omitKey(r.payments, id) };
      return { ...next, payments: members[0] ? { [members[0].id]: charged(r) } : {} };
    }),
    repayments: m.repayments.filter((t) => t.from !== id && t.to !== id),
  });
}

// ── 차수 ──────────────────────────────────────────────

export function addRound(m: Meeting): Meeting {
  const previous = m.rounds.at(-1);
  const payer = (previous && payerOf(previous)) ?? m.members[0]?.id;
  const round: MeetingRound = {
    id: shortId(),
    name: '',
    total: 0,
    participants: m.members.map((f) => ({ memberId: f.id })),
    payments: payer ? { [payer]: 0 } : {},
  };
  return touch({ ...m, rounds: [...m.rounds, round] });
}

export function updateRound(m: Meeting, roundId: string, fn: (r: MeetingRound) => MeetingRound): Meeting {
  return touch({ ...m, rounds: m.rounds.map((r) => (r.id === roundId ? fn(r) : r)) });
}

export function removeRound(m: Meeting, roundId: string): Meeting {
  return touch({ ...m, rounds: m.rounds.filter((r) => r.id !== roundId) });
}

/** 실제 결제액 (총액 − 할인) */
export const charged = (r: MeetingRound) => r.total - (r.discount ?? 0);

/** 결제자 한 명 모드에서의 결제자 (여러 명이면 가장 많이 낸 사람) */
export function payerOf(r: MeetingRound): MemberId | undefined {
  let top: [MemberId, number] | undefined;
  for (const entry of Object.entries(r.payments)) if (!top || entry[1] > top[1]) top = entry;
  return top?.[0];
}

/** 결제자 한 명 모드면 그 사람이 결제액 전부를 낸 것으로 맞춘다 */
function syncPayment(r: MeetingRound): MeetingRound {
  if (r.multiPay) return r;
  const payer = payerOf(r);
  return payer ? { ...r, payments: { [payer]: charged(r) } } : r;
}

export const setTotal = (r: MeetingRound, total: number) => syncPayment({ ...r, total });

export const setDiscount = (r: MeetingRound, discount: number) =>
  syncPayment(discount > 0 ? { ...r, discount } : omit(r, 'discount'));

export const setPayer = (r: MeetingRound, id: MemberId): MeetingRound => ({ ...r, payments: { [id]: charged(r) } });

export function setMultiPay(r: MeetingRound, on: boolean): MeetingRound {
  return on ? { ...r, multiPay: true } : syncPayment(omit(r, 'multiPay'));
}

export function setPayment(r: MeetingRound, id: MemberId, amount: number): MeetingRound {
  return { ...r, payments: amount > 0 ? { ...r.payments, [id]: amount } : omitKey(r.payments, id) };
}

export const alcoholOf = (r: MeetingRound) => r.items?.find((i) => i.category === ALCOHOL)?.amount ?? 0;

export function setAlcohol(r: MeetingRound, amount: number): MeetingRound {
  const others = (r.items ?? []).filter((i) => i.category !== ALCOHOL);
  const items = amount > 0 ? [{ name: '술', category: ALCOHOL, amount }, ...others] : others;
  return items.length ? { ...r, items } : omit(r, 'items');
}

// ── 참석자 ────────────────────────────────────────────

export const isAttending = (r: MeetingRound, id: MemberId) => r.participants.some((p) => p.memberId === id);

function withoutParticipant(r: MeetingRound, id: MemberId): MeetingRound {
  const items = r.items?.map((item) => (item.shares ? { ...item, shares: omitKey(item.shares, id) } : item));
  return { ...r, participants: r.participants.filter((p) => p.memberId !== id), ...(items ? { items } : {}) };
}

/** 참석 여부를 바꾼다. 참석자 순서는 멤버 순서를 따른다 */
export function toggleAttendance(r: MeetingRound, id: MemberId, order: readonly Friend[]): MeetingRound {
  if (isAttending(r, id)) return withoutParticipant(r, id);
  const rank = (memberId: MemberId) => order.findIndex((f) => f.id === memberId);
  const participants = [...r.participants, { memberId: id }].sort((a, b) => rank(a.memberId) - rank(b.memberId));
  return { ...r, participants };
}

function patchParticipant(r: MeetingRound, id: MemberId, fn: (p: Participant) => Participant): MeetingRound {
  return { ...r, participants: r.participants.map((p) => (p.memberId === id ? fn(p) : p)) };
}

export const setDrinks = (r: MeetingRound, id: MemberId, drinks: boolean) =>
  patchParticipant(r, id, (p) => {
    const excludes = (p.excludes ?? []).filter((c) => c !== ALCOHOL);
    if (!drinks) excludes.push(ALCOHOL);
    return excludes.length ? { ...p, excludes } : omit(p, 'excludes');
  });

export const setWeight = (r: MeetingRound, id: MemberId, weight: number) =>
  patchParticipant(r, id, (p) => (weight === 1 ? omit(p, 'weight') : { ...p, weight }));

/** undefined면 고정 해제 (비율대로 냄), 0이면 면제 */
export const setFixed = (r: MeetingRound, id: MemberId, fixed: number | undefined) =>
  patchParticipant(r, id, (p) => (fixed === undefined ? omit(p, 'fixed') : { ...p, fixed }));

// ── 따로 나눌 메뉴 ─────────────────────────────────────

export function addMenuItem(r: MeetingRound): MeetingRound {
  return { ...r, items: [...(r.items ?? []), { name: '', amount: 0, shares: {} }] };
}

export function updateItem(r: MeetingRound, index: number, patch: Partial<Pick<Item, 'name' | 'amount'>>): MeetingRound {
  return { ...r, items: (r.items ?? []).map((item, i) => (i === index ? { ...item, ...patch } : item)) };
}

export function removeItem(r: MeetingRound, index: number): MeetingRound {
  const items = (r.items ?? []).filter((_, i) => i !== index);
  return items.length ? { ...r, items } : omit(r, 'items');
}

export function toggleEater(r: MeetingRound, index: number, id: MemberId): MeetingRound {
  return {
    ...r,
    items: (r.items ?? []).map((item, i) => {
      if (i !== index) return item;
      const shares = item.shares ?? {};
      return { ...item, shares: id in shares ? omitKey(shares, id) : { ...shares, [id]: 1 } };
    }),
  };
}

// ── 송금 ──────────────────────────────────────────────

export const markSent = (m: Meeting, t: Transfer) => touch({ ...m, repayments: [...m.repayments, t] });

export const unmarkSent = (m: Meeting, index: number) =>
  touch({ ...m, repayments: m.repayments.filter((_, i) => i !== index) });
