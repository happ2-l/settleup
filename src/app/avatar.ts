import type { Friend } from './model';

// 참석자 동그라미: 이름 글자와 사람마다 정해진 색. 흰 글씨가 잘 보이는 중간 톤만 쓴다

export const AVATAR_COLORS = [
  '#2b6a4c',
  '#3d5a98',
  '#b0562b',
  '#7a4fa0',
  '#2f7f86',
  '#a63d5a',
  '#5f6b2e',
  '#8a6a1f',
  '#4b5563',
  '#9c4a2f',
];

const HANGUL = /^[가-힣]+$/;

/**
 * 동그라미에 넣을 글자. 한글 세 글자 이상이면 성을 빼고 이름 쪽(김철수 → 철수),
 * 영문 등은 첫 글자 대문자. max로 글자 수를 줄인다.
 */
export function avatarText(name: string, max = 2): string {
  const chars = Array.from(name.trim());
  if (chars.length === 0) return '?';
  if (HANGUL.test(name.trim())) {
    const given = chars.length >= 3 ? chars.slice(-2) : chars.slice(0, 2);
    return given.slice(0, max).join('');
  }
  return chars[0]!.toUpperCase();
}

/** 모임 안에서의 순서로 색을 정한다. 같은 사람은 어느 차수에서든 같은 색 */
export function avatarColor(members: readonly Friend[], id: string): string {
  const index = Math.max(0, members.findIndex((f) => f.id === id));
  return AVATAR_COLORS[index % AVATAR_COLORS.length]!;
}

/** max명까지만 보여주고 나머지는 '+N'으로. 정확히 max명이면 다 보여준다 */
export function visibleAvatars<T>(items: readonly T[], max: number): { shown: T[]; more: number } {
  if (items.length <= max) return { shown: [...items], more: 0 };
  return { shown: items.slice(0, max - 1), more: items.length - (max - 1) };
}
