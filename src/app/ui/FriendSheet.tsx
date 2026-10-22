import { useState } from 'react';
import type { Friend, PayInfo } from '../model';
import { BANKS, normalizeTossId } from '../pay';
import { ConfirmButton, Sheet } from './controls';

interface Props {
  friend: Friend;
  onClose: () => void;
  onChange: (patch: { name?: string; pay?: PayInfo }) => void;
  /** 없으면 '모임에서 빼기' 버튼을 숨긴다 (결과 화면에서 받는 곳만 적을 때) */
  onRemove?: () => void;
}

/** 친구 이름과 돈 받을 곳. 닫을 때 저장 */
export function FriendSheet({ friend, onClose, onChange, onRemove }: Props) {
  const [name, setName] = useState(friend.name);
  const [pay, setPay] = useState<PayInfo>(friend.pay ?? {});
  const set = (key: keyof PayInfo) => (e: React.ChangeEvent<HTMLInputElement>) => setPay((p) => ({ ...p, [key]: e.target.value }));

  const close = () => {
    onChange({ name, pay });
    onClose();
  };

  return (
    <Sheet title={friend.name} subtitle="이름과 돈 받을 곳" onClose={close}>
      <label className="field">
        <span className="field-label">이름</span>
        <input id="friend-edit-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      </label>

      <fieldset className="field pay-fields">
        <legend className="field-label">
          받는 곳 <span className="field-note">돈 받을 사람만 적으면 돼요</span>
        </legend>
        <div className="pay-account">
          <label className="field">
            <span className="field-label field-label-small">은행</span>
            <input id="friend-edit-bank" list="bank-list" placeholder="카카오뱅크" value={pay.bank ?? ''} onChange={set('bank')} autoComplete="off" />
            <datalist id="bank-list">
              {BANKS.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </label>
          <label className="field">
            <span className="field-label field-label-small">계좌번호</span>
            <input
              id="friend-edit-account"
              inputMode="tel"
              placeholder="3333-01-1234567"
              value={pay.accountNo ?? ''}
              onChange={set('accountNo')}
              autoComplete="off"
            />
          </label>
        </div>
        <label className="field">
          <span className="field-label field-label-small">예금주 (선택)</span>
          <input id="friend-edit-holder" placeholder={name} value={pay.holder ?? ''} onChange={set('holder')} autoComplete="off" />
        </label>
        <label className="field">
          <span className="field-label field-label-small">토스 아이디 (선택)</span>
          <span className="prefixed">
            <span className="prefix" aria-hidden="true">
              toss.me/
            </span>
            <input
              id="friend-edit-toss"
              placeholder="아이디"
              value={pay.toss ?? ''}
              onChange={(e) => setPay((p) => ({ ...p, toss: normalizeTossId(e.target.value) }))}
              autoComplete="off"
              autoCapitalize="none"
            />
          </span>
        </label>
        <label className="check-row" htmlFor="friend-edit-kakaopay">
          <input
            id="friend-edit-kakaopay"
            type="checkbox"
            checked={!!pay.kakaopay}
            onChange={(e) => setPay((p) => ({ ...p, kakaopay: e.target.checked }))}
          />
          <span>
            카카오페이로도 받아요
            <span className="hint">카톡방에서 바로 송금하면 돼서 링크는 필요 없어요</span>
          </span>
        </label>
      </fieldset>

      {onRemove && (
        <div className="sheet-actions">
          <ConfirmButton label="모임에서 빼기" confirmLabel="모든 차수에서도 빠져요. 한 번 더 누르기" onConfirm={onRemove} />
        </div>
      )}
    </Sheet>
  );
}
