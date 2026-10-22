import { describe, expect, it } from 'vitest';
import { sampleMeeting } from './model';
import { fitText, imageFileName, wrapText } from './receiptImage';

// 글자당 폭 10으로 재는 가짜 측정
const width = (s: string) => Array.from(s).length * 10;

describe('영수증 이미지 글자 배치', () => {
  it('폭을 넘으면 줄을 바꾸고, 띄어쓰기가 뒤쪽에 있으면 거기서 끊는다', () => {
    expect(wrapText('금요일 치킨 모임', 100, width)).toEqual(['금요일 치킨 모임']);
    expect(wrapText('우리 동기 송년회 2차까지', 100, width)).toEqual(['우리 동기 송년회', '2차까지']);
    expect(wrapText('아주아주긴모임이름입니다', 50, width)).toEqual(['아주아주긴', '모임이름입', '니다']);
    expect(wrapText('', 50, width)).toEqual(['']);
  });

  it('폭을 넘는 이름은 말줄임', () => {
    expect(fitText('철수', 50, width)).toBe('철수');
    expect(fitText('김수한무거북이와두루미', 50, width)).toBe('김수한무…');
  });

  it('파일 이름에서 쓸 수 없는 글자는 뺀다', () => {
    expect(imageFileName({ ...sampleMeeting(), title: '10/22 회식: 1차', date: '2026-10-22' })).toBe('10 22 회식 1차 2026-10-22.png');
    expect(imageFileName({ ...sampleMeeting(), title: '', date: '2026-10-22' })).toBe('정산 2026-10-22.png');
  });
});
