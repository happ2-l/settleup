import { useEffect, useState } from 'react';
import { compute } from '../compute';
import type { Meeting } from '../model';
import { imageFileName } from '../receiptImage';
import { renderTableImage } from '../tableImage';
import { Segmented, Sheet } from './controls';
import type { ReceiptImage } from './useReceiptImage';

export type ImageKind = 'receipt' | 'table';

interface Props {
  meeting: Meeting;
  /** 미리 만들어 둔 영수증 이미지 */
  receipt: ReceiptImage;
  kind: ImageKind;
  onKind: (kind: ImageKind) => void;
  onClose: () => void;
  notify: (message: string) => void;
}

const KINDS: { value: ImageKind; label: string }[] = [
  { value: 'receipt', label: '영수증' },
  { value: 'table', label: '표' },
];

/** 영수증 또는 표 이미지를 미리 보여주고 공유·저장한다 */
export function ImageSheet({ meeting, receipt, kind, onKind, onClose, notify }: Props) {
  const table = useTableImage(meeting, kind === 'table');
  const image = kind === 'table' ? table : receipt;
  const ready = image && image !== 'failed' ? image : null;
  // 이미지가 준비된 뒤 버튼을 누르므로 바로 공유 창을 띄울 수 있다 (아이폰은 누른 직후에만 허락)
  const canShare = !!ready && typeof navigator.canShare === 'function' && navigator.canShare({ files: [ready.file] });

  const share = () => {
    if (!ready) return;
    navigator.share({ files: [ready.file] }).catch((e: unknown) => {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      notify('공유 창을 열 수 없어요. 이미지를 길게 눌러 저장한 뒤 보내 주세요');
    });
  };

  return (
    <Sheet title="이미지로 공유" subtitle={kind === 'table' ? '사람별·차수별로 따져 보는 표' : '단톡방에 올리기 좋은 영수증 한 장'} onClose={onClose}>
      <Segmented label="이미지 종류" value={kind} options={KINDS} onChange={onKind} />
      <div className={`image-preview ${kind === 'table' ? 'is-wide' : ''}`}>
        {ready ? (
          <img src={ready.url} alt={`${meeting.title || '정산'} ${kind === 'table' ? '표' : '영수증'} 이미지`} />
        ) : (
          <p className="hint center">{image === 'failed' ? '이미지를 만들지 못했어요. 다시 열어 주세요.' : '이미지 만드는 중…'}</p>
        )}
      </div>
      <div className="image-actions">
        {canShare && (
          <button type="button" className="btn btn-primary" onClick={share}>
            공유하기
          </button>
        )}
        {ready && (
          <a className={`btn ${canShare ? 'btn-outline' : 'btn-primary'}`} href={ready.url} download={ready.file.name}>
            이미지 저장
          </a>
        )}
      </div>
      <p className="hint center">
        {kind === 'table' ? '차수가 많으면 옆으로 넓은 이미지가 돼요. ' : ''}이미지를 길게 눌러 저장하거나 복사할 수도 있어요.
      </p>
    </Sheet>
  );
}

/** 표 이미지는 고를 때만 만든다 */
function useTableImage(meeting: Meeting, enabled: boolean): ReceiptImage {
  const [image, setImage] = useState<ReceiptImage>(null);

  useEffect(() => {
    if (!enabled) return;
    const computed = compute(meeting);
    if (!computed.ok) return;
    let alive = true;
    let url: string | null = null;
    setImage(null);
    renderTableImage(meeting, computed.result).then(
      (blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setImage({ file: new File([blob], imageFileName(meeting, 'table'), { type: 'image/png' }), url });
      },
      () => alive && setImage('failed'),
    );
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [meeting, enabled]);

  return image;
}
