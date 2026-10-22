import type { Friend, PayInfo } from './model';

// 돈 받을 곳: 은행 계좌, 토스 아이디, 카카오페이로도 받는지

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

/** 예전 버전의 한 줄 계좌("카카오뱅크 3333-01-1234567")를 은행·계좌번호로 나눈다 */
export function parseAccount(text: string): PayInfo {
  const trimmed = text.trim();
  const firstDigit = trimmed.search(/\d/);
  if (firstDigit <= 0) return trimmed ? { accountNo: trimmed } : {};
  const bank = trimmed.slice(0, firstDigit).trim();
  const accountNo = trimmed.slice(firstDigit).trim();
  return bank ? { bank, accountNo } : { accountNo };
}

type LegacyFriend = Omit<Friend, 'pay'> & { account?: string; pay?: Omit<PayInfo, 'kakaopay'> & { kakaopay?: unknown } };

/** 예전 저장 형식을 지금 형식으로: 한 줄 계좌(account) → pay, 카카오페이 링크 → 받음 표시 */
export function migrateFriend(f: LegacyFriend): Friend {
  const { account, pay, ...rest } = f;
  if (pay) {
    const { kakaopay, ...others } = pay;
    return { ...rest, pay: kakaopay ? { ...others, kakaopay: true } : others };
  }
  return account ? { ...rest, pay: parseAccount(account) } : rest;
}

/** 빈 칸은 지우고 앞뒤 공백 정리. 다 비면 undefined */
export function cleanPay(p: PayInfo): PayInfo | undefined {
  const out: PayInfo = {};
  const bank = p.bank?.trim();
  const accountNo = p.accountNo?.trim();
  const holder = p.holder?.trim();
  const toss = p.toss ? normalizeTossId(p.toss) : '';
  if (bank) out.bank = bank;
  if (accountNo) out.accountNo = accountNo;
  if (holder) out.holder = holder;
  if (toss) out.toss = toss;
  if (p.kakaopay) out.kakaopay = true;
  return Object.keys(out).length ? out : undefined;
}

/** 받는 방법 한 줄씩: 계좌, 토스, 카카오페이 */
export function payMethods(p: PayInfo | undefined): string[] {
  if (!p) return [];
  const methods: string[] = [];
  const account = accountText(p);
  if (account) methods.push(account);
  if (p.toss) methods.push(`토스 ${tossLink(p.toss)}`);
  if (p.kakaopay) methods.push('카카오페이로도 받아요');
  return methods;
}
