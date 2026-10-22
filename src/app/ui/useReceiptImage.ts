import { useEffect, useState } from 'react';
import { compute } from '../compute';
import type { Meeting } from '../model';
import { imageFileName, renderReceiptImage } from '../receiptImage';

export type ReceiptImage = { file: File; url: string } | 'failed' | null;

/**
 * 결과 화면이 열려 있는 동안 영수증 이미지를 미리 만들어 둔다.
 * 아이폰은 버튼을 누른 직후에만 공유 창을 허락해서, 누른 다음 그리기 시작하면 막힐 수 있다.
 */
export function useReceiptImage(meeting: Meeting): ReceiptImage {
  const [image, setImage] = useState<ReceiptImage>(null);

  useEffect(() => {
    const computed = compute(meeting);
    if (!computed.ok || meeting.rounds.length === 0) {
      setImage(null);
      return;
    }
    let alive = true;
    let url: string | null = null;
    // 연달아 고칠 때마다 다시 그리지 않도록 잠깐 기다린다
    const timer = window.setTimeout(() => {
      renderReceiptImage(meeting, computed.result).then(
        (blob) => {
          if (!alive) return;
          url = URL.createObjectURL(blob);
          setImage({ file: new File([blob], imageFileName(meeting), { type: 'image/png' }), url });
        },
        () => alive && setImage('failed'),
      );
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
    };
  }, [meeting]);

  return image;
}
