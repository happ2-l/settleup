import type { SettlementResult } from '../engine';
import { won } from './format';
import type { Meeting } from './model';
import { migrateFriend, payMethods } from './pay';

// 공유 링크: 정산 내용을 통째로 URL에 담는다. 서버 없이 링크만으로 친구가 같은 화면을 본다.
// 형식: 'z' + base64url(deflate(JSON)), 압축을 못 쓰는 브라우저면 'j' + base64url(JSON)

export async function encodeMeeting(meeting: Meeting): Promise<string> {
  const { sample: _, ...data } = meeting;
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  if (typeof CompressionStream === 'undefined') return `j${toBase64Url(bytes)}`;
  return `z${toBase64Url(await pipe(bytes, new CompressionStream('deflate-raw')))}`;
}

export async function decodeMeeting(code: string): Promise<Meeting> {
  const kind = code[0];
  let bytes = fromBase64Url(code.slice(1));
  if (kind === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  else if (kind !== 'j') throw new Error('알 수 없는 링크 형식');
  const data = JSON.parse(new TextDecoder().decode(bytes)) as Partial<Meeting>;
  if (typeof data.id !== 'string' || !Array.isArray(data.members) || !Array.isArray(data.rounds)) {
    throw new Error('정산 내용이 아닙니다');
  }
  return {
    id: data.id,
    title: data.title ?? '',
    date: data.date ?? '',
    members: data.members.map(migrateFriend),
    rounds: data.rounds,
    repayments: data.repayments ?? [],
    unit: data.unit ?? 1,
    ...(data.transferMode ? { transferMode: data.transferMode } : {}),
    updatedAt: data.updatedAt ?? 0,
  };
}

export function shareLink(base: string, code: string): string {
  return `${base.replace(/#.*$/, '')}#/s/${code}`;
}

/** 카톡 등에 붙여넣을 문구 */
export function shareText(meeting: Meeting, result: SettlementResult, link?: string): string {
  const name = (id: string) => meeting.members.find((f) => f.id === id)?.name ?? id;
  const total = result.rounds.reduce((sum, r) => sum + r.charged, 0);
  const lines = [`[${meeting.title || '정산'}] 총 ${won(total)}`];
  if (result.transfers.length === 0) {
    lines.push('보낼 돈 없이 정산 끝!');
  } else {
    for (const t of result.transfers) lines.push(`${name(t.from)} → ${name(t.to)} ${won(t.amount)}`);
  }
  for (const r of receivers(meeting, result)) {
    if (r.methods.length) lines.push('', `${r.name}에게 보내기`, ...r.methods);
  }
  if (link) lines.push('', `자세히: ${link}`);
  return lines.join('\n');
}

/** 송금 안내만: 받는 사람별로 누가 얼마, 어디로. 이미지·링크 없이 짧게 */
export function paymentText(meeting: Meeting, result: SettlementResult): string {
  const lines = [`[${meeting.title || '정산'}] 송금 안내`];
  const list = receivers(meeting, result);
  if (list.length === 0) lines.push('보낼 돈이 없어요');
  for (const r of list) {
    lines.push('', `${r.name}에게 보내기`, r.from, ...r.methods);
  }
  return lines.join('\n');
}

/** 남은 송금을 받는 사람별로 묶는다 */
function receivers(meeting: Meeting, result: SettlementResult) {
  const name = (id: string) => meeting.members.find((f) => f.id === id)?.name ?? id;
  return [...new Set(result.transfers.map((t) => t.to))].map((id) => ({
    name: name(id),
    from: result.transfers
      .filter((t) => t.to === id)
      .map((t) => `${name(t.from)} ${won(t.amount)}`)
      .join(' · '),
    methods: payMethods(meeting.members.find((f) => f.id === id)?.pay),
  }));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
