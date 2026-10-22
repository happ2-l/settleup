import { useEffect, useState } from 'react';
import type { Computed } from '../compute';
import { markSent, unmarkSent, updateMember } from '../edit';
import { dateLabel, num, roundLabel, won } from '../format';
import type { Meeting } from '../model';
import { encodeMeeting, paymentText, shareLink, shareText } from '../share';
import { Segmented } from './controls';
import { Avatars } from './Avatars';
import { Breakdown } from './Breakdown';
import { FriendSheet } from './FriendSheet';
import { ImageSheet } from './ImageSheet';
import { PayTo } from './PayTo';
import { useReceiptImage } from './useReceiptImage';

interface Props {
  meeting: Meeting;
  computed: Computed;
  onChange: (meeting: Meeting) => void;
  onEdit: () => void;
  notify: (message: string) => void;
}

/** 공유 링크가 가리킬 주소. 미리보기 빌드에서는 실제 배포 주소를 넣어 둔다 */
const SHARE_BASE: string = import.meta.env.VITE_SHARE_BASE || `${location.origin}${location.pathname}`;

const UNITS = [1, 10, 100, 1000].map((unit) => ({ value: unit, label: `${num(unit)}원` }));

export function Receipt({ meeting, computed, onChange, onEdit, notify }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [manualCopy, setManualCopy] = useState<string | null>(null);
  const [showImage, setShowImage] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const image = useReceiptImage(meeting);
  const name = (id: string) => meeting.members.find((f) => f.id === id)?.name ?? id;

  // 링크는 미리 만들어 둔다. 아이폰 사파리는 버튼을 누른 직후에만 복사·공유를 허락해서
  // 누른 다음에 압축을 기다리면 막힐 수 있다
  useEffect(() => {
    let alive = true;
    setCode(null);
    void encodeMeeting(meeting).then((next) => alive && setCode(next));
    return () => {
      alive = false;
    };
  }, [meeting]);

  if (meeting.rounds.length === 0) {
    return (
      <div className="notice">
        <p>아직 차수가 없어요. 입력 화면에서 1차를 추가하면 여기서 누가 누구에게 얼마 보낼지 바로 보여요.</p>
        <button type="button" className="btn btn-outline" onClick={onEdit}>
          입력하러 가기
        </button>
      </div>
    );
  }

  if (!computed.ok) {
    return (
      <div className="notice notice-warn">
        <p>{computed.error.message}</p>
        <button type="button" className="btn btn-outline" onClick={onEdit}>
          고치러 가기
        </button>
      </div>
    );
  }

  const { result } = computed;
  const total = result.rounds.reduce((sum, r) => sum + r.charged, 0);

  const copy = (text: string, done: string) => {
    if (!navigator.clipboard?.writeText) {
      setManualCopy(text);
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => {
        setManualCopy(null);
        notify(done);
      },
      () => setManualCopy(text),
    );
  };

  /** 송금 안내만 글로: 이미지·링크 없이 누가 얼마, 어디로 */
  const sharePayment = () => {
    const text = paymentText(meeting, result);
    const done = '송금 안내를 복사했어요. 단톡방에 붙여 넣으세요';
    if (typeof navigator.share !== 'function') {
      copy(text, done);
      return;
    }
    navigator.share({ text }).catch((e: unknown) => {
      if (!(e instanceof DOMException && e.name === 'AbortError')) copy(text, done);
    });
  };

  const share = (mode: 'share' | 'link') => {
    if (!code) return;
    const link = shareLink(SHARE_BASE, code);
    if (mode === 'link') {
      copy(link, '링크를 복사했어요');
      return;
    }
    const text = shareText(meeting, result, link);
    const done = '정산 내용을 복사했어요. 단톡방에 붙여넣으세요';
    if (typeof navigator.share !== 'function') {
      copy(text, done);
      return;
    }
    // 영수증 이미지가 준비됐고 파일 공유가 되는 폰이면 이미지와 글을 같이 보낸다
    const file = image && image !== 'failed' ? image.file : null;
    const withImage = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file], text });
    navigator.share(withImage ? { files: [file!], text } : { text }).catch((e: unknown) => {
      if (!(e instanceof DOMException && e.name === 'AbortError')) copy(text, done);
    });
  };

  return (
    <>
      <article className="receipt" aria-label="정산 결과">
        <header className="receipt-head">
          <p className="receipt-kicker">정산서</p>
          <h1 className="receipt-title">{meeting.title || '이름 없는 정산'}</h1>
          <p className="receipt-meta">
            {dateLabel(meeting.date)} · {meeting.members.length}명
          </p>
        </header>

        <dl className="receipt-lines">
          {meeting.rounds.map((r, i) => (
            <div key={r.id} className="receipt-line receipt-round">
              <dt>
                {roundLabel(r.name, i)}
                <Avatars ids={r.participants.map((p) => p.memberId)} members={meeting.members} max={10} count />
              </dt>
              <dd>
                {num(result.rounds[i]!.charged)}
                {r.discount ? <span className="receipt-sub">할인 −{num(r.discount)}</span> : null}
              </dd>
            </div>
          ))}
          <div className="receipt-line receipt-total">
            <dt>합계</dt>
            <dd>{num(total)}</dd>
          </div>
        </dl>

        <h2 className="receipt-section">보낼 돈</h2>
        {result.transfers.length === 0 && meeting.repayments.length === 0 && <p className="receipt-empty">보낼 돈이 없어요.</p>}
        <ul className="transfers">
          {result.transfers.map((t) => (
            <li key={`${t.from}-${t.to}`} className="transfer">
              <span className="transfer-who">
                {name(t.from)} <span className="transfer-arrow">→</span> {name(t.to)}
              </span>
              <span className="amount transfer-amount">{num(t.amount)}</span>
              <button type="button" className="btn btn-small" onClick={() => onChange(markSent(meeting, t))}>
                보냈어요
              </button>
            </li>
          ))}
          {meeting.repayments.map((t, i) => (
            <li key={`sent-${i}`} className="transfer is-sent">
              <span className="transfer-who">
                {name(t.from)} <span className="transfer-arrow">→</span> {name(t.to)}
              </span>
              <span className="amount transfer-amount">{num(t.amount)}</span>
              <button
                type="button"
                className="stamp"
                onClick={() => onChange(unmarkSent(meeting, i))}
                aria-label={`${name(t.from)} → ${name(t.to)} 보냄 취소`}
              >
                보냄
              </button>
            </li>
          ))}
        </ul>
        {result.transfers.length === 0 && meeting.repayments.length > 0 && <p className="receipt-done">정산 끝! 모두 보냈어요.</p>}

        <h2 className="receipt-section">사람별</h2>
        <div className="people-head" aria-hidden="true">
          <span>이름</span>
          <span>부담</span>
          <span>받을 돈 / 보낼 돈</span>
        </div>
        <ul className="people">
          {result.members.map((m) => {
            const expanded = open === m.memberId;
            return (
              <li key={m.memberId} className="person">
                <button
                  type="button"
                  className="person-row"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : m.memberId)}
                >
                  <span className="person-name">{name(m.memberId)}</span>
                  <span className="person-owed amount">{num(m.owed)}</span>
                  <span className={`person-balance amount ${m.balance > 0 ? 'is-plus' : m.balance < 0 ? 'is-minus' : ''}`}>
                    {m.balance > 0 ? `+${num(m.balance)}` : m.balance < 0 ? `−${num(-m.balance)}` : '0'}
                  </span>
                </button>
                {expanded && (
                  <dl className="person-detail">
                    {meeting.rounds.map((r, i) =>
                      m.memberId in result.rounds[i]!.shares ? (
                        <div key={r.id}>
                          <dt>{roundLabel(r.name, i)}</dt>
                          <dd>{won(result.rounds[i]!.shares[m.memberId]!)}</dd>
                        </div>
                      ) : null,
                    )}
                    <div>
                      <dt>결제한 돈</dt>
                      <dd>{won(m.paid)}</dd>
                    </div>
                    {m.sent > 0 && (
                      <div>
                        <dt>보낸 돈</dt>
                        <dd>{won(m.sent)}</dd>
                      </div>
                    )}
                    {m.received > 0 && (
                      <div>
                        <dt>받은 돈</dt>
                        <dd>{won(m.received)}</dd>
                      </div>
                    )}
                  </dl>
                )}
              </li>
            );
          })}
        </ul>
      </article>

      <Breakdown meeting={meeting} result={result} />

      <PayTo transfers={result.transfers} members={meeting.members} onCopy={copy} onEdit={setEditing} />

      <div className="share-actions">
        <button type="button" className="btn btn-primary btn-block" onClick={() => share('share')} disabled={!code}>
          단톡방에 공유하기
        </button>
        <div className="share-row">
          <button type="button" className="btn btn-outline" onClick={() => setShowImage(true)}>
            이미지만
          </button>
          <button type="button" className="btn btn-outline" onClick={sharePayment}>
            송금 안내만
          </button>
          <button type="button" className="btn btn-outline" onClick={() => share('link')} disabled={!code}>
            링크만
          </button>
        </div>
        {manualCopy && (
          <div className="copy-box">
            <label className="field-label" htmlFor="share-text">
              자동 복사가 막혀 있어요. 아래 글을 길게 눌러 전체 선택 후 복사하세요
            </label>
            <textarea
              id="share-text"
              readOnly
              rows={Math.min(10, Math.max(4, manualCopy.split('\n').length + 1))}
              value={manualCopy}
              ref={(el) => el?.select()}
              onFocus={(e) => e.currentTarget.select()}
            />
            <button type="button" className="btn btn-quiet" onClick={() => setManualCopy(null)}>
              닫기
            </button>
          </div>
        )}
        <p className="hint center">
          '단톡방에 공유하기'는 이미지·정산 내용·링크를 한 번에, '송금 안내만'은 누가 얼마를 어디로 보낼지만 글로 보내요. 고친 뒤엔 다시 공유해 주세요.
        </p>
        {showImage && <ImageSheet meeting={meeting} image={image} onClose={() => setShowImage(false)} notify={notify} />}
        {editing && meeting.members.some((f) => f.id === editing) && (
          <FriendSheet
            friend={meeting.members.find((f) => f.id === editing)!}
            onClose={() => setEditing(null)}
            onChange={(patch) => onChange(updateMember(meeting, editing, patch))}
          />
        )}
      </div>

      <section className="section">
        <div className="field">
          <span className="field-label">
            정산 단위 <span className="field-note">자투리는 결제한 사람이 떠안아요</span>
          </span>
          <Segmented
            label="정산 단위"
            value={meeting.unit}
            options={UNITS}
            onChange={(unit) => onChange({ ...meeting, unit, updatedAt: Date.now() })}
          />
        </div>
      </section>
    </>
  );
}
