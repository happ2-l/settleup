import { useState } from 'react';
import { compute } from '../compute';
import { addMembers, addRound, removeMember, removeRound, updateMember, updateRound } from '../edit';
import type { Friend, Meeting } from '../model';
import { hasPay } from '../pay';
import { ConfirmButton } from './controls';
import { FriendSheet } from './FriendSheet';
import { Receipt } from './Receipt';
import { RoundCard } from './RoundCard';

export type Tab = 'input' | 'result';

interface Props {
  meeting: Meeting;
  tab: Tab;
  onTab: (tab: Tab) => void;
  onChange: (meeting: Meeting) => void;
  onBack: () => void;
  onDelete: () => void;
  notify: (message: string) => void;
}

export function MeetingScreen({ meeting, tab, onTab, onChange, onBack, onDelete, notify }: Props) {
  const computed = compute(meeting);
  const pending = computed.ok ? computed.result.transfers.length : 0;
  const roundError = (roundId: string) => (!computed.ok && computed.error.roundId === roundId ? computed.error.message : undefined);
  const globalError = !computed.ok && !computed.error.roundId ? computed.error.message : undefined;

  return (
    <>
      <header className="bar">
        <div className="bar-inner">
          <button type="button" className="btn btn-quiet bar-back" onClick={onBack} aria-label="정산 목록으로">
            ‹ 목록
          </button>
          <div className="tabs" role="tablist" aria-label="화면">
            <button type="button" role="tab" aria-selected={tab === 'input'} className="tab" onClick={() => onTab('input')}>
              입력
            </button>
            <button type="button" role="tab" aria-selected={tab === 'result'} className="tab" onClick={() => onTab('result')}>
              결과
              {pending > 0 && <span className="tab-count">{pending}</span>}
            </button>
          </div>
        </div>
      </header>

      <main className="page">
        {tab === 'input' ? (
          <>
            <section className="title-block">
              <label className="sr-only" htmlFor="meeting-title">
                모임 이름
              </label>
              <input
                id="meeting-title"
                className="title-input"
                placeholder="모임 이름 (예: 10월 동기 모임)"
                value={meeting.title}
                onChange={(e) => onChange({ ...meeting, title: e.target.value, updatedAt: Date.now() })}
              />
              <label className="date-field">
                <span className="sr-only">날짜</span>
                <input
                  id="meeting-date"
                  type="date"
                  value={meeting.date}
                  onChange={(e) => onChange({ ...meeting, date: e.target.value, updatedAt: Date.now() })}
                />
              </label>
            </section>

            <Friends meeting={meeting} onChange={onChange} />

            {globalError && <p className="notice notice-warn">{globalError}</p>}

            {meeting.rounds.map((round, index) => (
              <RoundCard
                key={round.id}
                index={index}
                round={round}
                members={meeting.members}
                shares={computed.ok ? computed.result.rounds[index]?.shares : undefined}
                error={roundError(round.id)}
                onChange={(fn) => onChange(updateRound(meeting, round.id, fn))}
                onRemove={() => onChange(removeRound(meeting, round.id))}
              />
            ))}

            <button
              type="button"
              className="btn btn-outline btn-block"
              onClick={() => onChange(addRound(meeting))}
              disabled={meeting.members.length === 0}
            >
              + {meeting.rounds.length + 1}차 추가
            </button>
            {meeting.members.length === 0 && <p className="hint center">친구를 먼저 추가하면 차수를 만들 수 있어요.</p>}

            {meeting.rounds.length > 0 && (
              <div className="dock">
                <button type="button" className="btn btn-primary btn-block" onClick={() => onTab('result')}>
                  {computed.ok
                    ? pending > 0
                      ? `누가 누구에게 보낼지 보기 · ${pending}건`
                      : '결과 보기'
                    : '결과 보기 (입력 확인 필요)'}
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <Receipt meeting={meeting} computed={computed} onChange={onChange} onEdit={() => onTab('input')} notify={notify} />
            <div className="danger-zone">
              <ConfirmButton label="이 정산 지우기" confirmLabel="한 번 더 누르면 지워져요" onConfirm={onDelete} />
            </div>
          </>
        )}
      </main>
    </>
  );
}

function Friends({ meeting, onChange }: { meeting: Meeting; onChange: (m: Meeting) => void }) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<Friend | null>(null);

  const add = () => {
    if (!draft.trim()) return;
    onChange(addMembers(meeting, draft));
    setDraft('');
  };

  return (
    <section className="section" aria-labelledby="friends-title">
      <div className="section-head">
        <h2 id="friends-title">친구 {meeting.members.length > 0 && <span className="count">{meeting.members.length}명</span>}</h2>
      </div>
      {meeting.members.length > 0 && (
        <ul className="chips">
          {meeting.members.map((f) => (
            <li key={f.id}>
              <button type="button" className="chip chip-friend" onClick={() => setEditing(f)}>
                {f.name}
                {hasPay(f) && <span className="chip-tag">받는 곳</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="add-row"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label className="sr-only" htmlFor="friend-name">
          친구 이름
        </label>
        <input
          id="friend-name"
          placeholder={meeting.members.length ? '친구 더 추가' : '이름 (여러 명은 띄어쓰기로: 철수 영희 민수)'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          enterKeyHint="done"
          autoComplete="off"
        />
        <button type="submit" className="btn btn-outline" disabled={!draft.trim()}>
          추가
        </button>
      </form>

      {editing && (
        <FriendSheet
          friend={meeting.members.find((f) => f.id === editing.id) ?? editing}
          onClose={() => setEditing(null)}
          onChange={(patch) => onChange(updateMember(meeting, editing.id, patch))}
          onRemove={() => {
            onChange(removeMember(meeting, editing.id));
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}
