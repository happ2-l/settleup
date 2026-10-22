import { describe, expect, it } from 'vitest';
import { AVATAR_COLORS, avatarColor, avatarText, visibleAvatars } from './avatar';

describe('참석자 동그라미', () => {
  it('한글 이름은 성을 빼고 이름 쪽 글자', () => {
    expect(avatarText('철수')).toBe('철수');
    expect(avatarText('김철수')).toBe('철수');
    expect(avatarText('김철수', 1)).toBe('철');
    expect(avatarText('남궁민수')).toBe('민수');
    expect(avatarText('솔')).toBe('솔');
  });

  it('영문·섞인 이름은 첫 글자', () => {
    expect(avatarText('tom')).toBe('T');
    expect(avatarText('민수2')).toBe('민');
    expect(avatarText('  ')).toBe('?');
  });

  it('색은 모임 안 순서로 정해지고 돌아가며 쓴다', () => {
    const members = Array.from({ length: 12 }, (_, i) => ({ id: `m${i}`, name: `${i}` }));
    expect(avatarColor(members, 'm0')).toBe(AVATAR_COLORS[0]);
    expect(avatarColor(members, 'm10')).toBe(AVATAR_COLORS[0]);
    expect(avatarColor(members, 'm3')).toBe(AVATAR_COLORS[3]);
  });

  it('많으면 일부만 보여주고 +N', () => {
    expect(visibleAvatars([1, 2, 3], 3)).toEqual({ shown: [1, 2, 3], more: 0 });
    expect(visibleAvatars([1, 2, 3, 4, 5], 3)).toEqual({ shown: [1, 2], more: 3 });
  });
});
