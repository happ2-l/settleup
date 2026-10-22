import type { Transfer } from '../../engine';
import { num } from '../format';
import type { Friend } from '../model';
import { accountCopyText, tossLink } from '../pay';

interface Props {
  /** 남은 송금 목록. 받는 사람별로 카드 하나 */
  transfers: Transfer[];
  members: Friend[];
  onCopy: (text: string, done: string) => void;
  onEdit: (memberId: string) => void;
}

/** 받는 사람마다 계좌 복사, 토스 송금 버튼, 카카오페이 가능 여부 */
export function PayTo({ transfers, members, onCopy, onEdit }: Props) {
  const name = (id: string) => members.find((f) => f.id === id)?.name ?? id;
  const receivers = [...new Set(transfers.map((t) => t.to))]
    .map((id) => members.find((f) => f.id === id))
    .filter((f): f is Friend => !!f);
  if (receivers.length === 0) return null;

  return (
    <section className="section" aria-labelledby="payto-title">
      <div className="section-head">
        <h2 id="payto-title">어디로 보내나요</h2>
      </div>
      {receivers.map((f) => {
        const p = f.pay ?? {};
        const incoming = transfers.filter((t) => t.to === f.id);
        const account = accountCopyText(p);
        const copyDone = '계좌를 복사했어요. 은행 앱에서 붙여 넣으세요';
        return (
          <div key={f.id} className="payto">
            <div className="payto-head">
              <p className="payto-name">
                <strong>{f.name}</strong>에게
              </p>
              <p className="payto-from">{incoming.map((t) => `${name(t.from)} ${num(t.amount)}`).join(' · ')}</p>
            </div>

            {account && (
              <div className="payto-account">
                <div className="payto-account-text">
                  {p.bank && <span className="payto-bank">{p.bank}</span>}
                  <span className="amount payto-number">{p.accountNo}</span>
                  {p.holder && <span className="payto-holder">예금주 {p.holder}</span>}
                </div>
                <button type="button" className="btn btn-small" onClick={() => onCopy(account, copyDone)}>
                  계좌 복사
                </button>
              </div>
            )}

            {p.toss && (
              <div className="payto-row">
                <span className="payto-label">토스</span>
                <div className="payto-links">
                  {incoming.map((t) => (
                    <a key={t.from} className="btn btn-small btn-pay" href={tossLink(p.toss!, t.amount)} target="_blank" rel="noopener noreferrer">
                      {incoming.length > 1 ? `${name(t.from)} ` : ''}
                      {num(t.amount)}원 보내기
                    </a>
                  ))}
                </div>
              </div>
            )}

            {p.kakaopay && <p className="payto-note">카카오페이로도 받아요 · 카톡방에서 바로 송금하세요</p>}

            <button type="button" className="link payto-edit" onClick={() => onEdit(f.id)}>
              {account || p.toss || p.kakaopay ? '받는 곳 고치기' : `+ ${f.name} 계좌·토스·카카오페이 적기`}
            </button>
          </div>
        );
      })}
    </section>
  );
}
