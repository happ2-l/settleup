import { compute } from '../compute';
import { dateLabel, won } from '../format';
import type { Meeting } from '../model';

interface Props {
  meetings: Meeting[];
  onOpen: (id: string) => void;
  onCreate: () => void;
}

export function Home({ meetings, onOpen, onCreate }: Props) {
  const sorted = [...meetings].sort((a, b) => Number(!!a.sample) - Number(!!b.sample) || b.updatedAt - a.updatedAt);

  return (
    <main className="page home">
      <header className="home-head">
        <h1 className="wordmark">
          정산<span className="wordmark-dot">.</span>
        </h1>
        <p className="home-lede">1차, 2차, 술 안 마신 친구, 먼저 간 친구까지 한 번에 나눠요.</p>
      </header>

      <button type="button" className="btn btn-primary btn-block" onClick={onCreate}>
        새 정산 시작
      </button>

      {sorted.length > 0 ? (
        <ul className="meeting-list">
          {sorted.map((m) => (
            <li key={m.id}>
              <MeetingCard meeting={m} onOpen={() => onOpen(m.id)} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">아직 정산이 없어요. 위 버튼으로 첫 정산을 시작하세요.</p>
      )}
    </main>
  );
}

function MeetingCard({ meeting, onOpen }: { meeting: Meeting; onOpen: () => void }) {
  const computed = compute(meeting);
  const total = meeting.rounds.reduce((sum, r) => sum + r.total - (r.discount ?? 0), 0);
  const status = !computed.ok
    ? { label: '입력 중', tone: 'warn' }
    : meeting.rounds.length === 0
      ? { label: '입력 전', tone: 'muted' }
      : computed.result.transfers.length === 0
        ? { label: '정산 끝', tone: 'done' }
        : { label: `송금 ${computed.result.transfers.length}건 남음`, tone: 'todo' };

  return (
    <button type="button" className="meeting-card" onClick={onOpen}>
      <span className="meeting-card-main">
        <span className="meeting-card-title">
          {meeting.sample && <span className="badge">예시</span>}
          {meeting.title || '이름 없는 정산'}
        </span>
        <span className="meeting-card-meta">
          {dateLabel(meeting.date)} · {meeting.members.length}명 · {meeting.rounds.length}차
        </span>
      </span>
      <span className="meeting-card-side">
        <span className="amount">{won(total)}</span>
        <span className={`pill pill-${status.tone}`}>{status.label}</span>
      </span>
    </button>
  );
}
