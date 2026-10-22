import type { Friend, PayInfo } from './model';

// 돈 받을 곳: 은행 계좌, 토스 아이디, 카카오페이 송금 링크

/** 은행 입력칸 추천 목록 (직접 입력도 됨) */
export const BANKS = [
  '카카오뱅크',
  '토스뱅크',
  '국민은행',
  '신한은행',
  '우리은행',
  '하나은행',
  '농협은행',
  '기업은행',
  '케이뱅크',
  '새마을금고',
  '우체국',
  '신협',
  'SC제일은행',
  '수협은행',
  'iM뱅크',
  '부산은행',
  '경남은행',
  '광주은행',
  '전북은행',
  '제주은행',
  '씨티은행',
  '산업은행',
];

export function hasPay(f: Friend): boolean {
  const p = f.pay;
  return !!p && !!(p.accountNo || p.toss || p.kakaopay);
}

/** "카카오뱅크 3333-01-1234567 (김철수)" */
export function accountText(p: PayInfo): string | undefined {
  if (!p.accountNo) return undefined;
  const account = [p.bank, p.accountNo].filter(Boolean).join(' ');
  return p.holder ? `${account} (${p.holder})` : account;
}

/** 은행 앱에 붙여넣기 좋은 형태: 예금주 없이 "카카오뱅크 3333-01-1234567" */
export function accountCopyText(p: PayInfo): string | undefined {
  if (!p.accountNo) return undefined;
  return [p.bank, p.accountNo].filter(Boolean).join(' ');
}

/** "toss.me/chulsoo", "https://toss.me/chulsoo/" 같은 입력에서 아이디만 */
export function normalizeTossId(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^toss\.me\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/^@/, '');
}

/** 토스 아이디 송금 페이지. 금액을 붙이면 미리 채워진다 */
export function tossLink(id: string, amount?: number): string {
  return `https://toss.me/${encodeURIComponent(id)}${amount ? `/${amount}` : ''}`;
}

/** 카카오페이 송금 링크로 쓸 수 있는 주소인지. 앱의 '송금코드'에서 복사한 https 주소 */
export function isKakaopayLink(input: string): boolean {
  try {
    const url = new URL(input.trim());
    return url.protocol === 'https:' && /(^|\.)kakaopay\.com$/.test(url.hostname);
  } catch {
    return false;
  }
}

/** 예전 버전의 한 줄 계좌("카카오뱅크 3333-01-1234567")를 은행·계좌번호로 나눈다 */
export function parseAccount(text: string): PayInfo {
  const trimmed = text.trim();
  const firstDigit = trimmed.search(/\d/);
  if (firstDigit <= 0) return trimmed ? { accountNo: trimmed } : {};
  const bank = trimmed.slice(0, firstDigit).trim();
  const accountNo = trimmed.slice(firstDigit).trim();
  return bank ? { bank, accountNo } : { accountNo };
}

/** 예전 저장 형식(account 문자열)을 지금 형식(pay)으로 */
export function migrateFriend(f: Friend & { account?: string }): Friend {
  const { account, ...rest } = f;
  if (!account || rest.pay) return rest;
  return { ...rest, pay: parseAccount(account) };
}

/** 빈 칸은 지우고 앞뒤 공백 정리. 다 비면 undefined */
export function cleanPay(p: PayInfo): PayInfo | undefined {
  const out: PayInfo = {};
  const bank = p.bank?.trim();
  const accountNo = p.accountNo?.trim();
  const holder = p.holder?.trim();
  const toss = p.toss ? normalizeTossId(p.toss) : '';
  const kakaopay = p.kakaopay?.trim();
  if (bank) out.bank = bank;
  if (accountNo) out.accountNo = accountNo;
  if (holder) out.holder = holder;
  if (toss) out.toss = toss;
  if (kakaopay && isKakaopayLink(kakaopay)) out.kakaopay = kakaopay;
  return Object.keys(out).length ? out : undefined;
}

/** 공유 글에 넣을 받는 곳 줄들 */
export function payLines(f: Friend): string[] {
  const p = f.pay;
  if (!p) return [];
  const lines: string[] = [];
  const account = accountText(p);
  if (account) lines.push(`${f.name} 계좌: ${account}`);
  if (p.toss) lines.push(`${f.name} 토스: ${tossLink(p.toss)}`);
  if (p.kakaopay) lines.push(`${f.name} 카카오페이: ${p.kakaopay}`);
  return lines;
}
