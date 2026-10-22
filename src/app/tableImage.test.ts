import { describe, expect, it } from 'vitest';
import { compute } from './compute';
import { markSent } from './edit';
import { sampleMeeting } from './model';
import { tableModel } from './tableImage';

describe('표 이미지에 들어갈 내용', () => {
  it('사람 × 차수 부담액, 예외, 불참, 합계', () => {
    const meeting = sampleMeeting();
    const computed = compute(meeting);
    if (!computed.ok) throw computed.error;
    const model = tableModel(meeting, computed.result);

    expect(model.rounds).toEqual([
      { no: '1차', place: '고깃집', total: '160,000' },
      { no: '2차', place: '술집', total: '60,000' },
    ]);
    const row = (name: string) => model.rows.find((r) => r.name === name)!;
    expect(row('철수')).toMatchObject({ cells: [{ amount: '40,000', tags: '' }, { amount: '20,000', tags: '' }], owed: '60,000', paid: '160,000', balance: '+100,000', sign: 1 });
    expect(row('지은')).toMatchObject({ cells: [{ amount: '20,000', tags: '술X' }, null], paid: '—', balance: '−20,000', sign: -1 });
    expect(row('현우').cells[0]).toEqual({ amount: '20,000', tags: '반만' });
    expect(model).toMatchObject({ owedTotal: '220,000', paidTotal: '220,000', hasSent: false });
  });

  it('보낸 기록이 있으면 이미 보냄 칸', () => {
    const meeting = markSent(sampleMeeting(), { from: 's2', to: 's0', amount: 40_000 });
    const computed = compute(meeting);
    if (!computed.ok) throw computed.error;
    const model = tableModel(meeting, computed.result);
    expect(model.hasSent).toBe(true);
    expect(model.rows.find((r) => r.name === '민수')).toMatchObject({ sent: '+40,000', balance: '−20,000' });
    expect(model.rows.find((r) => r.name === '철수')).toMatchObject({ sent: '−40,000' });
  });
});
