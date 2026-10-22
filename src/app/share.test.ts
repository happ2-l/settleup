import { describe, expect, it } from 'vitest';
import { compute } from './compute';
import { markSent } from './edit';
import { dateLabel, parseWon, participantTags } from './format';
import { sampleMeeting } from './model';
import { decodeMeeting, encodeMeeting, paymentText, shareLink, shareText } from './share';

describe('공유 링크', () => {
  it('인코딩한 정산을 그대로 되살린다 (예시 표시는 빠짐)', async () => {
    const meeting = markSent(sampleMeeting(), { from: 's2', to: 's0', amount: 60_000 });
    const code = await encodeMeeting(meeting);
    expect(code).toMatch(/^z[\w-]+$/);
    const { sample: _, ...expected } = meeting;
    expect(await decodeMeeting(code)).toEqual(expected);
  });

  it('카톡에 붙여도 될 만큼 짧다', async () => {
    expect((await encodeMeeting(sampleMeeting())).length).toBeLessThan(600);
  });

  it('잘린 링크는 에러', async () => {
    const code = await encodeMeeting(sampleMeeting());
    await expect(decodeMeeting(code.slice(0, 40))).rejects.toThrow();
    await expect(decodeMeeting('x123')).rejects.toThrow();
  });

  it('링크 주소에서 기존 해시는 버린다', () => {
    expect(shareLink('https://example.com/settleup/#/m/abc', 'zXYZ')).toBe('https://example.com/settleup/#/s/zXYZ');
  });

  it('공유 문구: 송금 목록과 받을 사람 계좌', () => {
    const meeting = sampleMeeting();
    const computed = compute(meeting);
    if (!computed.ok) throw computed.error;
    expect(shareText(meeting, computed.result, 'https://x/#/s/z1')).toBe(
      [
        '[예시: 동기 모임] 총 220,000원',
        '민수 → 철수 60,000원',
        '지은 → 철수 20,000원',
        '현우 → 철수 20,000원',
        '',
        '철수에게 보내기',
        '카카오뱅크 3333-00-0000000 (김철수)',
        '',
        '자세히: https://x/#/s/z1',
      ].join('\n'),
    );
  });

  it('송금 안내만: 받는 사람별로 누가 얼마, 어디로', () => {
    const meeting = {
      ...sampleMeeting(),
      title: '치킨',
      members: [
        { id: 'a', name: '가람', pay: { toss: 'garam', kakaopay: true } },
        { id: 'b', name: '나래' },
        { id: 'c', name: '다온' },
      ],
      rounds: [
        { id: 'r', total: 30_000, participants: [{ memberId: 'a' }, { memberId: 'b' }, { memberId: 'c' }], payments: { a: 30_000 } },
      ],
    };
    const computed = compute(meeting);
    if (!computed.ok) throw computed.error;
    expect(paymentText(meeting, computed.result)).toBe(
      ['[치킨] 송금 안내', '', '가람에게 보내기', '나래 10,000원 · 다온 10,000원', '토스 https://toss.me/garam', '카카오페이로도 받아요'].join('\n'),
    );
  });

  it('송금 안내: 보낼 돈이 없으면 그렇게 적는다', () => {
    const meeting = { ...sampleMeeting(), rounds: [] };
    const computed = compute(meeting);
    if (!computed.ok) throw computed.error;
    expect(paymentText(meeting, computed.result)).toBe('[예시: 동기 모임] 송금 안내\n보낼 돈이 없어요');
  });
});

describe('표시 형식', () => {
  it('금액 입력에서 숫자만 뽑고, "16만"도 알아듣는다', () => {
    expect(parseWon('160,000')).toBe(160_000);
    expect(parseWon('16만')).toBe(160_000);
    expect(parseWon('1.5만')).toBe(15_000);
    expect(parseWon('abc')).toBe(0);
    expect(parseWon('99999999999999')).toBe(9_999_999_999);
  });

  it('참석자 칩 표시', () => {
    expect(participantTags({ memberId: 'a' })).toEqual([]);
    expect(participantTags({ memberId: 'a', weight: 0.5, excludes: ['술'] })).toEqual(['반만', '술X']);
    expect(participantTags({ memberId: 'a', fixed: 0 })).toEqual(['면제']);
    expect(participantTags({ memberId: 'a', fixed: 10_000, weight: 2 })).toEqual(['10,000 고정']);
  });

  it('날짜 표시', () => {
    expect(dateLabel('2026-10-22')).toBe('10월 22일 (목)');
  });
});
