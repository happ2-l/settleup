import { useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { num, parseWon } from '../format';

interface MoneyInputProps {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  label?: string;
}

/** 쉼표가 자동으로 붙는 원 단위 입력칸 */
export function MoneyInput({ id, value, onChange, placeholder = '0', label }: MoneyInputProps) {
  const fallbackId = useId();
  const [text, setText] = useState(value ? num(value) : '');

  useEffect(() => {
    // 밖에서 값이 바뀌었을 때만 칸을 다시 채운다 (입력 중인 글자는 건드리지 않음)
    if (parseWon(text) !== value) setText(value ? num(value) : '');
  }, [value]);

  return (
    <span className="money">
      <input
        id={id ?? fallbackId}
        inputMode="numeric"
        autoComplete="off"
        enterKeyHint="done"
        placeholder={placeholder}
        aria-label={label}
        value={text}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const next = parseWon(e.target.value);
          setText(next ? num(next) : '');
          onChange(next);
        }}
      />
      <span className="money-unit" aria-hidden="true">
        원
      </span>
    </span>
  );
}

interface SheetProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}

/** 화면 아래에서 올라오는 설정 창 */
export function Sheet({ title, subtitle, onClose, children }: SheetProps) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('sheet-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('sheet-open');
    };
  }, [onClose]);

  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p className="sheet-sub">{subtitle}</p>}
          </div>
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            완료
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

interface SegmentedProps<T> {
  label: string;
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (value: T) => void;
}

export function Segmented<T>({ label, options, value, onChange }: SegmentedProps<T>) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className="segment"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 한 번 누르면 '정말 ~할까요?'로 바뀌고 다시 눌러야 실행되는 버튼 */
export function ConfirmButton({ label, confirmLabel, onConfirm }: { label: string; confirmLabel: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      className={`btn btn-danger ${armed ? 'is-armed' : ''}`}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
