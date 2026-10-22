import { useEffect, useState } from 'react';
import { compute } from '../compute';
import type { Meeting } from '../model';
import { imageFileName, renderReceiptImage } from '../receiptImage';
import { Sheet } from './controls';

interface Props {
  meeting: Meeting;
  onClose: () => void;
  notify: (message: string) => void;
}

/** 영수증 이미지를 미리 보여주고 공유·저장한다 */
export function ImageSheet({ meeting, onClose, notify }: Props) {
  const [image, setImage] = useState<{ file: File; url: string } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const computed = compute(meeting);
    if (!computed.ok) return;
    let alive = true;
    let url: string | null = null;
    renderReceiptImage(meeting, computed.result).then(
      (blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setImage({ file: new File([blob], imageFileName(meeting), { type: 'image/png' }), url });
      },
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [meeting]);

  // 이미지가 준비된 뒤 버튼을 누르므로 바로 공유 창을 띄울 수 있다 (아이폰은 누른 직후에만 허락)
  const canShare = !!image && typeof navigator.canShare === 'function' && navigator.canShare({ files: [image.file] });

  const share = () => {
    if (!image) return;
    navigator.share({ files: [image.file] }).catch((e: unknown) => {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      notify('공유 창을 열 수 없어요. 이미지를 길게 눌러 저장한 뒤 보내 주세요');
    });
  };

  return (
    <Sheet title="이미지로 공유" subtitle="단톡방에 올리기 좋은 영수증 한 장" onClose={onClose}>
      <div className="image-preview">
        {image ? (
          <img src={image.url} alt={`${meeting.title || '정산'} 영수증 이미지`} />
        ) : (
          <p className="hint center">{failed ? '이미지를 만들지 못했어요. 다시 열어 주세요.' : '영수증 뽑는 중…'}</p>
        )}
      </div>
      <div className="image-actions">
        {canShare && (
          <button type="button" className="btn btn-primary" onClick={share}>
            공유하기
          </button>
        )}
        {image && (
          <a className={`btn ${canShare ? 'btn-outline' : 'btn-primary'}`} href={image.url} download={image.file.name}>
            이미지 저장
          </a>
        )}
      </div>
      <p className="hint center">이미지를 길게 눌러 저장하거나 복사할 수도 있어요.</p>
    </Sheet>
  );
}
