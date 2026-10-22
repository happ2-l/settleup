import { avatarColor, avatarText, visibleAvatars } from '../avatar';
import type { Friend } from '../model';

interface Props {
  ids: string[];
  members: Friend[];
  max?: number;
  /** 동그라미 뒤에 'N명'을 붙인다 */
  count?: boolean;
}

/** 겹쳐 놓은 참석자 동그라미. 많으면 '+N' */
export function Avatars({ ids, members, max = 8, count = false }: Props) {
  const name = (id: string) => members.find((f) => f.id === id)?.name ?? id;
  const { shown, more } = visibleAvatars(ids, max);

  return (
    <span className="avatars" role="img" aria-label={`${ids.length}명: ${ids.map(name).join(', ')}`}>
      {shown.map((id) => (
        <span key={id} className="avatar" style={{ background: avatarColor(members, id) }} aria-hidden="true">
          {avatarText(name(id), 1)}
        </span>
      ))}
      {more > 0 && (
        <span className="avatar avatar-more" aria-hidden="true">
          +{more}
        </span>
      )}
      {count && (
        <span className="avatars-count" aria-hidden="true">
          {ids.length}명
        </span>
      )}
    </span>
  );
}
