import { describe, expect, it } from 'vitest';
import {
  accountCopyText,
  accountText,
  cleanPay,
  hasPay,
  isKakaopayLink,
  migrateFriend,
  normalizeTossId,
  parseAccount,
  payLines,
  tossLink,
} from './pay';

describe('받는 곳', () => {
  it('계좌 표시와 복사용 문구', () => {
    const p = { bank: '카카오뱅크', accountNo: '3333-00-0000000', holder: '김철수' };
    expect(accountText(p)).toBe('카카오뱅크 3333-00-0000000 (김철수)');
    expect(accountCopyText(p)).toBe('카카오뱅크 3333-00-0000000');
    expect(accountText({ accountNo: '123' })).toBe('123');
    expect(accountText({ bank: '국민은행' })).toBeUndefined();
  });

  it('토스 아이디는 링크나 @를 붙여 넣어도 아이디만 남긴다', () => {
    expect(normalizeTossId('https://toss.me/chulsoo/')).toBe('chulsoo');
    expect(normalizeTossId('toss.me/chulsoo/20000')).toBe('chulsoo');
    expect(normalizeTossId(' @chulsoo ')).toBe('chulsoo');
    expect(tossLink('chulsoo')).toBe('https://toss.me/chulsoo');
    expect(tossLink('chulsoo', 20_000)).toBe('https://toss.me/chulsoo/20000');
  });

  it('카카오페이는 kakaopay.com https 주소만 받는다', () => {
    expect(isKakaopayLink('https://qr.kakaopay.com/Ej7abc123')).toBe(true);
    expect(isKakaopayLink('http://qr.kakaopay.com/Ej7abc123')).toBe(false);
    expect(isKakaopayLink('https://evil.com/qr.kakaopay.com')).toBe(false);
    expect(isKakaopayLink('Ej7abc123')).toBe(false);
  });

  it('빈 칸과 잘못된 링크는 지우고, 다 비면 undefined', () => {
    expect(cleanPay({ bank: ' 토스뱅크 ', accountNo: '1000-0000-0000', toss: '', kakaopay: 'x' })).toEqual({
      bank: '토스뱅크',
      accountNo: '1000-0000-0000',
    });
    expect(cleanPay({ bank: '', holder: ' ' })).toBeUndefined();
  });

  it('예전 한 줄 계좌를 은행과 계좌번호로 나눈다', () => {
    expect(parseAccount('카카오뱅크 3333-01-1234567')).toEqual({ bank: '카카오뱅크', accountNo: '3333-01-1234567' });
    expect(parseAccount('110-123-456789')).toEqual({ accountNo: '110-123-456789' });
    expect(migrateFriend({ id: 'a', name: '철수', account: '신한 110-123' } as never)).toEqual({
      id: 'a',
      name: '철수',
      pay: { bank: '신한', accountNo: '110-123' },
    });
    expect(migrateFriend({ id: 'a', name: '철수' })).toEqual({ id: 'a', name: '철수' });
  });

  it('공유 글 줄', () => {
    const f = { id: 'a', name: '철수', pay: { bank: '카카오뱅크', accountNo: '3333', toss: 'cs', kakaopay: 'https://qr.kakaopay.com/X' } };
    expect(hasPay(f)).toBe(true);
    expect(payLines(f)).toEqual(['철수 계좌: 카카오뱅크 3333', '철수 토스: https://toss.me/cs', '철수 카카오페이: https://qr.kakaopay.com/X']);
    expect(hasPay({ id: 'b', name: '영희', pay: { bank: '국민은행' } })).toBe(false);
  });
});
