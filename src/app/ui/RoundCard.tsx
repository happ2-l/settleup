import { useState } from 'react';
import type { MemberId, Won } from '../../engine';
import {
  addMenuItem,
  alcoholOf,
  charged,
  isAttending,
  payerOf,
  removeItem,
  setAlcohol,
  setAllAttending,
  setAllEaters,
  setDiscount,
  setDrinks,
  setFixed,
  setMultiPay,
  setPayer,
  setPayment,
  setTotal,
  setWeight,
  toggleAttendance,
  toggleEater,
  updateItem,
} from '../edit';
import { num, participantTags, roundLabel, WEIGHT_PRESETS, won } from '../format';
import { ALCOHOL, type Friend, type MeetingRound } from '../model';
import { ConfirmButton, MoneyInput, PeoplePicker, Segmented, Sheet } from './controls';

interface Props {
  index: number;
  round: MeetingRound;
  members: Friend[];
  /** 계산이 됐으면 참석자별 부담액 */
  shares: Record<MemberId, Won> | undefined;
  error: string | undefined;
  onChange: (fn: (r: MeetingRound) => MeetingRound) => void;
  onRemove: () => void;
}

export function RoundCard({ index, round, members, shares, error, onChange, onRemove }: Props) {
  const [person, setPerson] = useState<MemberId | null>(null);
  const [showDiscount, setShowDiscount] = useState(!!round.discount);
  const id = (field: string) => `r-${round.id}-${field}`;
  const name = (memberId: MemberId) => members.find((f) => f.id === memberId)?.name ?? memberId;
  const alcohol = alcoholOf(round);
  const menus = (round.items ?? []).map((item, i) => ({ item, i })).filter(({ item }) => item.category !== ALCOHOL);
  const paidSum = Object.values(round.payments).reduce((a, b) => a + b, 0);

  return (
    <section className="round" aria-labelledby={id('name')}>
      <div className="round-head">
        <span className="round-no">{index + 1}차</span>
        <label className="sr-only" htmlFor={id('name')}>
          차수 이름
        </label>
        <input
          id={id('name')}
          className="round-name"
          value={round.name ?? ''}
          placeholder="가게 이름 (선택)"
          onChange={(e) => onChange((r) => ({ ...r, name: e.target.value }))}
        />
      </div>

      <div className="fields">
        <label className="field" htmlFor={id('total')}>
          <span className="field-label">영수증 총액</span>
          <MoneyInput id={id('total')} value={round.total} onChange={(v) => onChange((r) => setTotal(r, v))} />
        </label>

        <label className="field" htmlFor={id('alcohol')}>
          <span className="field-label">
            그중 술값 <span className="field-note">술 안 마신 사람이 있을 때만</span>
          </span>
          <MoneyInput id={id('alcohol')} value={alcohol} onChange={(v) => onChange((r) => setAlcohol(r, v))} />
        </label>

        {showDiscount ? (
          <label className="field" htmlFor={id('discount')}>
            <span className="field-label">할인·쿠폰</span>
            <MoneyInput id={id('discount')} value={round.discount ?? 0} onChange={(v) => onChange((r) => setDiscount(r, v))} />
          </label>
        ) : null}

        {round.multiPay ? (
          <fieldset className="field">
            <legend className="field-label">
              누가 얼마 결제했나요 <span className="field-note">합계 {won(paidSum)} / {won(charged(round))}</span>
            </legend>
            <div className="pay-grid">
              {members.map((f) => (
                <label key={f.id} className="pay-row" htmlFor={id(`pay-${f.id}`)}>
                  <span>{f.name}</span>
                  <MoneyInput
                    id={id(`pay-${f.id}`)}
                    value={round.payments[f.id] ?? 0}
                    onChange={(v) => onChange((r) => setPayment(r, f.id, v))}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <label className="field" htmlFor={id('payer')}>
            <span className="field-label">결제한 사람</span>
            <select id={id('payer')} value={payerOf(round) ?? ''} onChange={(e) => onChange((r) => setPayer(r, e.target.value))}>
              {!payerOf(round) && <option value="">선택</option>}
              {members.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="links">
          <button type="button" className="link" onClick={() => onChange((r) => setMultiPay(r, !r.multiPay))}>
            {round.multiPay ? '한 명이 다 냈어요' : '여러 명이 나눠 냈어요'}
          </button>
          {!showDiscount && (
            <button type="button" className="link" onClick={() => setShowDiscount(true)}>
              할인·쿠폰 있어요
            </button>
          )}
        </div>
      </div>

      <PeoplePicker
        label="누가 있었나요"
        people={members}
        isSelected={(memberId) => isAttending(round, memberId)}
        onToggle={(memberId) => onChange((r) => toggleAttendance(r, memberId, members))}
        onAll={(all) => onChange((r) => setAllAttending(r, all, members))}
      />

      {round.participants.length > 0 && (
        <div className="exceptions">
          <p className="field-label">
            예외 <span className="field-note">술 안 마심·먼저 감·더 냄·금액 고정은 이름을 눌러서</span>
          </p>
          <ul className="chips chips-small">
            {round.participants.map((p) => {
              const tags = participantTags(p);
              return (
                <li key={p.memberId}>
                  <button
                    type="button"
                    className={`chip chip-set ${tags.length ? 'has-tags' : ''}`}
                    aria-label={`${name(p.memberId)} 예외 설정${tags.length ? `: ${tags.join(', ')}` : ''}`}
                    onClick={() => setPerson(p.memberId)}
                  >
                    {name(p.memberId)}
                    {tags.map((t) => (
                      <span key={t} className="chip-tag">
                        {t}
                      </span>
                    ))}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {menus.length > 0 && (
        <div className="menus">
          {menus.map(({ item, i }) => (
            <div key={i} className="menu">
              <div className="menu-row">
                <label className="sr-only" htmlFor={id(`menu-${i}-name`)}>
                  메뉴 이름
                </label>
                <input
                  id={id(`menu-${i}-name`)}
                  className="menu-name"
                  placeholder="메뉴 이름"
                  value={item.name ?? ''}
                  onChange={(e) => onChange((r) => updateItem(r, i, { name: e.target.value }))}
                />
                <MoneyInput
                  id={id(`menu-${i}-amount`)}
                  label="메뉴 금액"
                  value={item.amount}
                  onChange={(v) => onChange((r) => updateItem(r, i, { amount: v }))}
                />
                <button type="button" className="btn btn-quiet" onClick={() => onChange((r) => removeItem(r, i))} aria-label="메뉴 빼기">
                  ✕
                </button>
              </div>
              {round.participants.length > 0 ? (
                <PeoplePicker
                  small
                  label="누가 먹었나요"
                  people={round.participants.map((p) => ({ id: p.memberId, name: name(p.memberId) }))}
                  isSelected={(memberId) => !!item.shares && memberId in item.shares}
                  onToggle={(memberId) => onChange((r) => toggleEater(r, i, memberId))}
                  onAll={(all) => onChange((r) => setAllEaters(r, i, all))}
                />
              ) : (
                <p className="hint">위 '누가 있었나요'에서 참석자를 먼저 골라 주세요.</p>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="links">
        <button type="button" className="link" onClick={() => onChange(addMenuItem)}>
          + 몇 명만 먹은 메뉴
        </button>
      </div>

      {error ? (
        <p className="notice notice-warn">{error.replace(/^[^:]*: /, '')}</p>
      ) : shares && round.total > 0 ? (
        <ul className="split" aria-label={`${roundLabel(round.name, index)} 1인 부담`}>
          {round.participants.map((p) => (
            <li key={p.memberId}>
              <span>{name(p.memberId)}</span>
              <span className="amount">{num(shares[p.memberId] ?? 0)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="round-foot">
        <ConfirmButton label={`${index + 1}차 지우기`} confirmLabel="한 번 더 누르면 지워져요" onConfirm={onRemove} />
      </div>

      {person && isAttending(round, person) && (
        <PersonSheet
          round={round}
          label={roundLabel(round.name, index)}
          memberId={person}
          name={name(person)}
          onChange={onChange}
          onClose={() => setPerson(null)}
          members={members}
        />
      )}
    </section>
  );
}

interface PersonSheetProps {
  round: MeetingRound;
  label: string;
  memberId: MemberId;
  name: string;
  members: Friend[];
  onChange: (fn: (r: MeetingRound) => MeetingRound) => void;
  onClose: () => void;
}

/** 한 사람의 이번 차수 예외: 술, 머문 정도, 고정금액, 불참 */
function PersonSheet({ round, label, memberId, name, members, onChange, onClose }: PersonSheetProps) {
  const p = round.participants.find((x) => x.memberId === memberId)!;
  const drinks = !p.excludes?.includes(ALCOHOL);
  const mode = p.fixed === undefined ? 'share' : p.fixed === 0 ? 'free' : 'fixed';
  const alcohol = alcoholOf(round);

  return (
    <Sheet title={name} subtitle={label} onClose={onClose}>
      <div className="field">
        <span className="field-label">
          술 <span className="field-note">{alcohol > 0 ? `술값 ${won(alcohol)}` : '술값을 적어야 적용돼요'}</span>
        </span>
        <Segmented
          label="술"
          value={drinks}
          options={[
            { value: true, label: '마셨어요' },
            { value: false, label: '안 마셨어요' },
          ]}
          onChange={(v) => onChange((r) => setDrinks(r, memberId, v))}
        />
      </div>

      <div className="field">
        <span className="field-label">얼마나 낼까요</span>
        <Segmented
          label="내는 방식"
          value={mode}
          options={[
            { value: 'share', label: '비율대로' },
            { value: 'fixed', label: '금액 고정' },
            { value: 'free', label: '면제' },
          ]}
          onChange={(v) => onChange((r) => setFixed(r, memberId, v === 'share' ? undefined : v === 'free' ? 0 : p.fixed || 10_000))}
        />
      </div>

      {mode === 'share' && (
        <div className="field">
          <span className="field-label">
            있었던 시간 <span className="field-note">먼저 갔거나 늦게 왔으면 줄이고, 더 낼 사람은 늘려요</span>
          </span>
          <Segmented
            label="비율"
            value={WEIGHT_PRESETS.find((w) => Math.abs(w.weight - (p.weight ?? 1)) < 1e-9)?.weight}
            options={WEIGHT_PRESETS.map((w) => ({ value: w.weight, label: w.label }))}
            onChange={(v) => onChange((r) => setWeight(r, memberId, v))}
          />
        </div>
      )}

      {mode === 'fixed' && (
        <label className="field" htmlFor="person-fixed">
          <span className="field-label">
            이번 차수에 낼 금액 <span className="field-note">나머지는 다른 사람들이 나눠요</span>
          </span>
          <MoneyInput id="person-fixed" value={p.fixed ?? 0} onChange={(v) => onChange((r) => setFixed(r, memberId, v))} />
        </label>
      )}

      <div className="sheet-actions">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            onChange((r) => toggleAttendance(r, memberId, members));
            onClose();
          }}
        >
          이번 차수엔 없었어요
        </button>
      </div>
    </Sheet>
  );
}
