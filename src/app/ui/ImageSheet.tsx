import type { Meeting } from '../model';
import { Sheet } from './controls';
import type { ReceiptImage } from './useReceiptImage';

interface Props {
  meeting: Meeting;
  image: ReceiptImage;
  onClose: () => void;
  notify: (message: string) => void;
}

/** 영수증 이미지를 미리 보여주고 공유·저장한다 */
export function ImageSheet({ meeting, image, onClose, notify }: Props) {
  const ready = image && image !== 'failed' ? image : null;
  const canShare = !!ready && typeof navigator.canShare === 'function' && navigator.canShare({ files: [ready.file] });

  const share = () => {
    if (!ready) return;
    navigator.share({ files: [ready.file] }).catch((e: unknown) => {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      notify('공유 창을 열 수 없어요. 이미지를 길게 눌러 저장한 뒤 보내 주세요');
    });
  };

  return (
    <Sheet title="이미지로 공유" subtitle="단톡방에 올리기 좋은 영수증 한 장" onClose={onClose}>
      <div className="image-preview">
        {ready ? (
          <img src={ready.url} alt={`${meeting.title || '정산'} 영수증 이미지`} />
        ) : (
          <p className="hint center">{image === 'failed' ? '이미지를 만들지 못했어요. 다시 열어 주세요.' : '영수증 뽑는 중…'}</p>
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
      <p className="hint center">이미지를 길게 눌러 저장하거나 복사할 수도 있어요.</p>
    </Sheet>
  );
}
