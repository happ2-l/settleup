import { useCallback, useEffect, useRef, useState } from 'react';
import { newMeeting, sampleMeeting, type Meeting } from '../model';
import { decodeMeeting } from '../share';
import { loadMeetings, saveMeetings } from '../storage';
import { Home } from './Home';
import { MeetingScreen, type Tab } from './MeetingScreen';

type Route = { name: 'home' } | { name: 'meeting'; id: string; tab: Tab } | { name: 'import'; code: string };

function parseHash(hash: string): Route {
  const meeting = /^#\/m\/([^/]+)(\/result)?$/.exec(hash);
  if (meeting) return { name: 'meeting', id: meeting[1]!, tab: meeting[2] ? 'result' : 'input' };
  const shared = /^#\/s\/(.+)$/.exec(hash);
  if (shared) return { name: 'import', code: shared[1]! };
  return { name: 'home' };
}

const hashOf = (id: string, tab: Tab) => `#/m/${id}${tab === 'result' ? '/result' : ''}`;

/** 주소창 해시를 바꾼다. 막힌 환경에서도 화면 전환은 state로 되므로 실패는 무시 */
function setHash(hash: string, replace = false) {
  try {
    if (location.hash === hash) return;
    if (replace) history.replaceState(null, '', hash);
    else location.hash = hash;
  } catch {
    // 무시
  }
}

/** 아무것도 안 적고 나간 정산은 목록에 남기지 않는다 */
const isBlank = (m: Meeting) => !m.title && m.members.length === 0 && m.rounds.length === 0;

export function App() {
  const [meetings, setMeetings] = useState<Meeting[]>(() => loadMeetings() ?? [sampleMeeting()]);
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number>(undefined);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(() => saveMeetings(meetings), [meetings]);

  useEffect(() => {
    const onHash = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (route.name === 'home') setMeetings((list) => (list.some(isBlank) ? list.filter((m) => !isBlank(m)) : list));
    window.scrollTo(0, 0);
  }, [route.name, route.name === 'meeting' ? route.id : '']);

  // 공유 링크로 들어오면 내 목록에 넣고 결과 화면을 연다. 내 쪽이 더 최신이면 내 것을 연다
  useEffect(() => {
    if (route.name !== 'import') return;
    let cancelled = false;
    decodeMeeting(route.code)
      .then((shared) => {
        if (cancelled) return;
        setMeetings((list) => {
          const mine = list.find((m) => m.id === shared.id);
          if (mine && mine.updatedAt >= shared.updatedAt) return list;
          return [shared, ...list.filter((m) => m.id !== shared.id)];
        });
        setHash(hashOf(shared.id, 'result'), true);
        setRoute({ name: 'meeting', id: shared.id, tab: 'result' });
      })
      .catch(() => {
        if (cancelled) return;
        setHash('#/', true);
        setRoute({ name: 'home' });
        notify('링크가 잘렸거나 잘못됐어요. 링크 전체를 다시 복사해 주세요');
      });
    return () => {
      cancelled = true;
    };
  }, [route, notify]);

  const navigate = (next: Route) => {
    setHash(next.name === 'meeting' ? hashOf(next.id, next.tab) : '#/');
    setRoute(next);
  };

  const update = (next: Meeting) => setMeetings((list) => list.map((m) => (m.id === next.id ? next : m)));

  const meeting = route.name === 'meeting' ? meetings.find((m) => m.id === route.id) : undefined;

  return (
    <>
      {route.name === 'meeting' && meeting ? (
        <MeetingScreen
          meeting={meeting}
          tab={route.tab}
          onTab={(tab) => {
            setHash(hashOf(meeting.id, tab), true);
            setRoute({ ...route, tab });
            window.scrollTo(0, 0);
          }}
          onChange={update}
          onBack={() => navigate({ name: 'home' })}
          onDelete={() => {
            setMeetings((list) => list.filter((m) => m.id !== meeting.id));
            navigate({ name: 'home' });
            notify(`'${meeting.title || '이름 없는 정산'}'을 지웠어요`);
          }}
          notify={notify}
        />
      ) : route.name === 'import' ? (
        <p className="loading">정산 내용을 여는 중…</p>
      ) : (
        <Home
          meetings={meetings}
          onOpen={(id) => navigate({ name: 'meeting', id, tab: 'input' })}
          onCreate={() => {
            const m = newMeeting();
            setMeetings((list) => [m, ...list]);
            navigate({ name: 'meeting', id: m.id, tab: 'input' });
          }}
        />
      )}
      <div className="toast" role="status" aria-live="polite" hidden={!toast}>
        {toast}
      </div>
    </>
  );
}
