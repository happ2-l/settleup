/**
 * 머문 시간 비율 (0~1). 참석자 weight로 쓰면 "잠깐 있다 감"을 시간으로 계산할 수 있다.
 * 시각은 모두 같은 단위의 숫자 (Date.getTime(), 분 등).
 */
export function stayRatio(roundStart: number, roundEnd: number, arrivedAt = roundStart, leftAt = roundEnd): number {
  if (!(roundEnd > roundStart)) throw new RangeError('끝난 시각이 시작 시각보다 뒤여야 합니다');
  const from = Math.max(roundStart, arrivedAt);
  const to = Math.min(roundEnd, leftAt);
  return Math.max(0, to - from) / (roundEnd - roundStart);
}
