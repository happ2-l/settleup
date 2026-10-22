import type { Participant } from '../engine';
import { ALCOHOL } from './model';

/** 160000 → "160,000" */
export const num = (amount: number) => amount.toLocaleString('ko-KR');

/** 160000 → "160,000원" */
export const won = (amount: number) => `${num(amount)}원`;

/** 사용자가 친 금액 문자열에서 숫자만 뽑는다. "16만 원" 같은 건 160000으로 */
export function parseWon(text: string): number {
  const man = /^\s*([\d,.]+)\s*만/.exec(text);
  if (man) return Math.min(Math.round(Number(man[1]!.replace(/,/g, '')) * 10_000), MAX_WON);
  const digits = text.replace(/\D/g, '');
  return digits ? Math.min(Number(digits), MAX_WON) : 0;
}

/** 금액 입력칸 최대값 (99억) */
export const MAX_WON = 9_999_999_999;

export const WEIGHT_PRESETS: { weight: number; label: string }[] = [
  { weight: 1, label: '끝까지' },
  { weight: 0.5, label: '반만' },
  { weight: 1 / 3, label: '⅓만' },
  { weight: 1.5, label: '1.5배' },
  { weight: 2, label: '2배' },
];

export function weightLabel(weight: number): string {
  const preset = WEIGHT_PRESETS.find((p) => Math.abs(p.weight - weight) < 1e-9);
  if (preset) return preset.label;
  return `${Math.round(weight * 100) / 100}배`;
}

/** 참석자 칩에 붙는 짧은 표시. 예외가 없으면 빈 배열 */
export function participantTags(p: Participant): string[] {
  const tags: string[] = [];
  if (p.fixed !== undefined) tags.push(p.fixed === 0 ? '면제' : `${num(p.fixed)} 고정`);
  else if (p.weight !== undefined && p.weight !== 1) tags.push(p.weight === 0 ? '면제' : weightLabel(p.weight));
  if (p.excludes?.includes(ALCOHOL)) tags.push('술X');
  return tags;
}

/** 화면에 보이는 차수 이름: "1차 고깃집", 가게 이름이 없으면 "1차" */
export function roundLabel(name: string | undefined, index: number): string {
  const place = name?.trim();
  return place ? `${index + 1}차 ${place}` : `${index + 1}차`;
}

/** "2026-10-22" → "10월 22일 (목)" */
export function dateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return date;
  const day = '일월화수목금토'[new Date(y, m - 1, d).getDay()];
  return `${m}월 ${d}일 (${day})`;
}
