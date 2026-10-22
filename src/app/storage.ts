import type { Meeting } from './model';

const KEY = 'settleup:v1';

/** 저장된 정산 목록. 처음이거나 저장소를 못 쓰면 null */
export function loadMeetings(): Meeting[] | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { meetings?: Meeting[] };
    return Array.isArray(data.meetings) ? data.meetings : null;
  } catch {
    return null;
  }
}

export function saveMeetings(meetings: Meeting[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ meetings }));
  } catch {
    // 시크릿 모드 등 저장소를 못 쓰면 이번 화면에서만 유지된다
  }
}
