import type { SettlementResult } from '../../engine';
import { num, participantTags, roundLabel } from '../format';
import type { Meeting } from '../model';
import { Avatars } from './Avatars';

interface Props {
  meeting: Meeting;
  result: SettlementResult;
  onShareImage: () => void;
}

/** 따지고 싶은 사람을 위한 표: 사람 × 차수 부담액, 예외, 낸 돈, 받을·보낼 돈 */
export function Breakdown({ meeting, result, onShareImage }: Props) {
  const name = (id: string) => meeting.members.find((f) => f.id === id)?.name ?? id;
  const hasRepayments = meeting.repayments.length > 0;
  const signed = (v: number) => (v > 0 ? `+${num(v)}` : v < 0 ? `−${num(-v)}` : '0');
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

  return (
    <details className="breakdown">
      <summary>표로 자세히 보기</summary>
      <div className="table-wrap">
        <table className="breakdown-table">
          <thead>
            <tr>
              <th scope="col">이름</th>
              {meeting.rounds.map((r, i) => (
                <th key={r.id} scope="col">
                  {roundLabel(r.name, i)}
                </th>
              ))}
              <th scope="col">부담</th>
              <th scope="col">낸 돈</th>
              {hasRepayments && <th scope="col">이미 보냄</th>}
              <th scope="col">받을·보낼</th>
            </tr>
          </thead>
          <tbody>
            {result.members.map((m) => (
              <tr key={m.memberId}>
                <th scope="row">
                  <span className="breakdown-name">
                    <Avatars ids={[m.memberId]} members={meeting.members} />
                    {name(m.memberId)}
                  </span>
                </th>
                {meeting.rounds.map((r, i) => {
                  const p = r.participants.find((x) => x.memberId === m.memberId);
                  if (!p) {
                    return (
                      <td key={r.id} className="is-absent" aria-label="불참">
                        —
                      </td>
                    );
                  }
                  const tags = participantTags(p);
                  return (
                    <td key={r.id}>
                      <span className="amount">{num(result.rounds[i]?.shares[m.memberId] ?? 0)}</span>
                      {tags.length > 0 && <span className="cell-tags">{tags.join(' ')}</span>}
                    </td>
                  );
                })}
                <td className="amount is-strong">{num(m.owed)}</td>
                <td className="amount">{m.paid ? num(m.paid) : '—'}</td>
                {hasRepayments && <td className="amount">{m.sent || m.received ? signed(m.sent - m.received) : '—'}</td>}
                <td className={`amount is-strong ${m.balance > 0 ? 'is-plus' : m.balance < 0 ? 'is-minus' : ''}`}>{signed(m.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">합계</th>
              {result.rounds.map((r) => (
                <td key={r.roundId} className="amount">
                  {num(r.charged)}
                </td>
              ))}
              <td className="amount is-strong">{num(sum(result.members.map((m) => m.owed)))}</td>
              <td className="amount">{num(sum(result.members.map((m) => m.paid)))}</td>
              {hasRepayments && <td />}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="hint">— 는 그 차수에 없었던 사람이에요. 술X·반만·고정·면제는 그 차수에서의 예외예요. 표가 넓으면 옆으로 밀어 보세요.</p>
      <button type="button" className="btn btn-outline btn-block" onClick={onShareImage}>
        표를 이미지로 공유
      </button>
    </details>
  );
}
