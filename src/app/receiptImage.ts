import type { SettlementResult } from '../engine';
import { dateLabel, num, roundLabel } from './format';
import type { Meeting } from './model';

// 단톡방에 올릴 영수증 이미지. 초록 바탕 위에 위아래가 톱니로 찢긴 감열지 한 장.
// 화면 CSS를 캡처하지 않고 캔버스에 직접 그려서 어느 폰에서나 같은 모양이 나온다.

const W = 1080;
const MARGIN = 64;
const PAD = 64;
const TOOTH = 16;
const LEFT = MARGIN + PAD;
const RIGHT = W - MARGIN - PAD;
const CONTENT = RIGHT - LEFT;

const COLOR = {
  table: '#2b6a4c',
  paper: '#ffffff',
  ink: '#141917',
  muted: '#5b6863',
  line: '#c8d1cc',
  plus: '#2b6a4c',
  minus: '#b0362b',
  stamp: '#c4382c',
};

const FONT = {
  display: '"Do Hyeon", "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
  body: '"IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
  mono: '"IBM Plex Mono", "Nanum Gothic Coding", ui-monospace, Menlo, monospace',
};

const font = (family: keyof typeof FONT, size: number, weight = 400) => `${weight} ${size}px ${FONT[family]}`;

type Width = (text: string) => number;

/** 폭에 맞춰 줄바꿈. 띄어쓰기에서 끊을 수 있으면 거기서, 아니면 글자 단위로 */
export function wrapText(text: string, maxWidth: number, width: Width): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of Array.from(text)) {
    if (line && width(line + ch) > maxWidth) {
      const space = line.lastIndexOf(' ');
      if (space > line.length / 2) {
        lines.push(line.slice(0, space));
        line = line.slice(space + 1) + ch;
      } else {
        lines.push(line);
        line = ch === ' ' ? '' : ch;
      }
    } else {
      line += ch;
    }
  }
  if (line || lines.length === 0) lines.push(line);
  return lines;
}

/** 폭을 넘으면 뒤를 잘라 '…'을 붙인다 */
export function fitText(text: string, maxWidth: number, width: Width): string {
  if (width(text) <= maxWidth) return text;
  const chars = Array.from(text);
  while (chars.length > 0 && width(`${chars.join('')}…`) > maxWidth) chars.pop();
  return `${chars.join('')}…`;
}

interface Block {
  height: number;
  draw: (ctx: CanvasRenderingContext2D, top: number) => void;
}

export async function renderReceiptImage(meeting: Meeting, result: SettlementResult): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이 브라우저에서는 이미지를 만들 수 없어요');

  const blocks = layout(ctx, meeting, result);
  await loadFonts(blocks.text);
  // 글꼴이 바뀌면 폭도 바뀌므로 글꼴을 불러온 뒤 다시 배치
  const { list } = layout(ctx, meeting, result);

  const paperHeight = PAD * 2 + list.reduce((sum, b) => sum + b.height, 0);
  canvas.width = W;
  canvas.height = MARGIN * 2 + TOOTH * 2 + paperHeight;

  ctx.fillStyle = COLOR.table;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const top = MARGIN + TOOTH;
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = COLOR.paper;
  paperPath(ctx, MARGIN, top, W - MARGIN, top + paperHeight);
  ctx.fill();
  ctx.restore();

  ctx.textBaseline = 'middle';
  let y = top + PAD;
  for (const block of list) {
    block.draw(ctx, y);
    y += block.height;
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('이미지를 만들지 못했어요'))), 'image/png'),
  );
}

/** 공유·저장할 때 쓸 파일 이름 */
export function imageFileName(meeting: Meeting): string {
  const title = (meeting.title || '정산').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  return `${title} ${meeting.date}.png`;
}

function layout(ctx: CanvasRenderingContext2D, meeting: Meeting, result: SettlementResult) {
  const list: Block[] = [];
  const texts: string[] = [];
  const name = (id: string) => meeting.members.find((f) => f.id === id)?.name ?? id;
  const widthIn = (f: string): Width => (s) => {
    ctx.font = f;
    return ctx.measureText(s).width;
  };

  const gap = (height: number) => list.push({ height, draw: () => {} });

  const centered = (text: string, f: string, color: string, lineHeight: number) => {
    texts.push(text);
    for (const line of wrapText(text, CONTENT, widthIn(f))) {
      list.push({
        height: lineHeight,
        draw: (c, top) => {
          c.font = f;
          c.fillStyle = color;
          c.textAlign = 'center';
          c.fillText(line, W / 2, top + lineHeight / 2);
        },
      });
    }
  };

  const row = (left: string, right: string, opts: { size: number; height: number; weight?: number; color?: string; strong?: boolean }) => {
    texts.push(left, right);
    const leftFont = font('body', opts.size, opts.strong ? 700 : (opts.weight ?? 400));
    const rightFont = font('mono', opts.strong ? opts.size + 6 : opts.size, opts.strong ? 600 : (opts.weight ?? 400));
    const rightWidth = widthIn(rightFont)(right);
    const fitted = fitText(left, CONTENT - rightWidth - 32, widthIn(leftFont));
    list.push({
      height: opts.height,
      draw: (c, top) => {
        const mid = top + opts.height / 2;
        c.fillStyle = opts.color ?? COLOR.ink;
        c.font = leftFont;
        c.textAlign = 'left';
        c.fillText(fitted, LEFT, mid);
        c.font = rightFont;
        c.textAlign = 'right';
        c.fillText(right, RIGHT, mid);
      },
    });
  };

  const dashed = () =>
    list.push({
      height: 2,
      draw: (c, top) => {
        c.save();
        c.strokeStyle = COLOR.line;
        c.lineWidth = 2;
        c.setLineDash([10, 8]);
        c.beginPath();
        c.moveTo(LEFT, top + 1);
        c.lineTo(RIGHT, top + 1);
        c.stroke();
        c.restore();
      },
    });

  const double = () =>
    list.push({
      height: 8,
      draw: (c, top) => {
        c.fillStyle = COLOR.line;
        c.fillRect(LEFT, top, CONTENT, 2);
        c.fillRect(LEFT, top + 6, CONTENT, 2);
      },
    });

  const section = (label: string) => {
    texts.push(label);
    list.push({
      height: 44,
      draw: (c, top) => {
        c.font = font('body', 26, 700);
        c.fillStyle = COLOR.muted;
        c.textAlign = 'left';
        c.fillText(label, LEFT, top + 22);
      },
    });
  };

  // ── 머리말
  centered('정 산 서', font('display', 32), COLOR.muted, 48);
  gap(8);
  centered(meeting.title || '이름 없는 정산', font('display', 76), COLOR.ink, 90);
  gap(6);
  centered(`${dateLabel(meeting.date)} · ${meeting.members.length}명`, font('body', 30), COLOR.muted, 44);
  gap(30);
  dashed();
  gap(26);

  // ── 차수별 금액
  meeting.rounds.forEach((r, i) => {
    row(roundLabel(r.name, i), num(result.rounds[i]?.charged ?? 0), { size: 32, height: 54 });
    if (r.discount) row('  할인·쿠폰', `−${num(r.discount)}`, { size: 26, height: 40, color: COLOR.muted });
  });
  gap(16);
  dashed();
  gap(22);
  const total = result.rounds.reduce((sum, r) => sum + r.charged, 0);
  row('합계', `${num(total)}원`, { size: 40, height: 66, strong: true });
  gap(26);
  double();
  gap(34);

  // ── 보낼 돈
  section('보낼 돈');
  const transfers = [
    ...result.transfers.map((t) => ({ ...t, sent: false })),
    ...meeting.repayments.map((t) => ({ ...t, sent: true })),
  ];
  if (transfers.length === 0) {
    gap(8);
    centered('보낼 돈이 없어요', font('body', 32), COLOR.muted, 56);
  }
  for (const t of transfers) {
    const from = name(t.from);
    const to = name(t.to);
    const amount = `${num(t.amount)}원`;
    texts.push(from, to, amount);
    const nameFont = font('body', 40, 500);
    const amountFont = font('mono', 44, 600);
    const amountWidth = widthIn(amountFont)(amount);
    // 보낸 줄은 금액 왼쪽에 도장 자리를 비워 둔다
    const stampRoom = t.sent ? 140 : 0;
    const nameRoom = (CONTENT - amountWidth - 48 - stampRoom - widthIn(nameFont)(' → ')) / 2;
    const fromText = fitText(from, nameRoom, widthIn(nameFont));
    const toText = fitText(to, nameRoom, widthIn(nameFont));
    list.push({
      height: 86,
      draw: (c, top) => {
        const mid = top + 43;
        c.textAlign = 'left';
        c.font = nameFont;
        let x = LEFT;
        c.fillStyle = t.sent ? COLOR.muted : COLOR.ink;
        c.fillText(fromText, x, mid);
        x += c.measureText(fromText).width;
        c.fillStyle = COLOR.muted;
        c.fillText(' → ', x, mid);
        x += c.measureText(' → ').width;
        c.fillStyle = t.sent ? COLOR.muted : COLOR.ink;
        c.fillText(toText, x, mid);
        c.font = amountFont;
        c.textAlign = 'right';
        c.fillText(amount, RIGHT, mid);
        if (t.sent) stamp(c, RIGHT - amountWidth - 24 - 60, mid, '보냄', 40);
      },
    });
  }
  if (result.transfers.length === 0 && meeting.repayments.length > 0) {
    gap(12);
    list.push({ height: 96, draw: (c, top) => stamp(c, W / 2, top + 48, '정산 끝', 56) });
  }

  // ── 받을 사람 계좌
  const receivers = new Set(result.transfers.map((t) => t.to));
  const accounts = meeting.members.filter((f) => receivers.has(f.id) && f.account);
  if (accounts.length > 0) {
    gap(18);
    for (const f of accounts) row(`${f.name} 계좌`, f.account!, { size: 28, height: 46 });
  }
  gap(28);
  double();
  gap(34);

  // ── 사람별
  section('사람별');
  const col2 = RIGHT - 250;
  list.push({
    height: 40,
    draw: (c, top) => {
      c.font = font('body', 24);
      c.fillStyle = COLOR.muted;
      c.textAlign = 'left';
      c.fillText('이름', LEFT, top + 18);
      c.textAlign = 'right';
      c.fillText('부담', col2, top + 18);
      c.fillText('받을 돈 / 보낼 돈', RIGHT, top + 18);
      c.fillStyle = COLOR.line;
      c.fillRect(LEFT, top + 38, CONTENT, 2);
    },
  });
  for (const m of result.members) {
    const who = fitText(name(m.memberId), col2 - LEFT - 180, widthIn(font('body', 30)));
    const balance = m.balance > 0 ? `+${num(m.balance)}` : m.balance < 0 ? `−${num(-m.balance)}` : '0';
    texts.push(who, balance, num(m.owed));
    list.push({
      height: 58,
      draw: (c, top) => {
        const mid = top + 30;
        c.font = font('body', 30);
        c.fillStyle = COLOR.ink;
        c.textAlign = 'left';
        c.fillText(who, LEFT, mid);
        c.font = font('mono', 30);
        c.fillStyle = COLOR.muted;
        c.textAlign = 'right';
        c.fillText(num(m.owed), col2, mid);
        c.font = font('mono', 30, 600);
        c.fillStyle = m.balance > 0 ? COLOR.plus : m.balance < 0 ? COLOR.minus : COLOR.ink;
        c.fillText(balance, RIGHT, mid);
      },
    });
  }

  // ── 꼬리말
  gap(30);
  dashed();
  gap(40);
  centered('잘 먹었습니다!', font('display', 50), COLOR.ink, 66);
  gap(22);
  list.push({ height: 84, draw: (c, top) => barcode(c, `${meeting.id}${meeting.updatedAt}`, top) });
  gap(12);
  centered(`SETTLEUP · ${meeting.date.replace(/-/g, '.')}`, font('mono', 22), COLOR.muted, 30);

  return { list, text: texts.join('') };
}

function paperPath(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  const teeth = Math.round((x1 - x0) / (TOOTH * 2));
  const step = (x1 - x0) / teeth;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  for (let i = 0; i < teeth; i++) {
    ctx.lineTo(x0 + step * (i + 0.5), y0 - TOOTH);
    ctx.lineTo(x0 + step * (i + 1), y0);
  }
  ctx.lineTo(x1, y1);
  for (let i = teeth; i > 0; i--) {
    ctx.lineTo(x0 + step * (i - 0.5), y1 + TOOTH);
    ctx.lineTo(x0 + step * (i - 1), y1);
  }
  ctx.closePath();
}

/** 살짝 기울어진 빨간 도장 */
function stamp(ctx: CanvasRenderingContext2D, cx: number, cy: number, text: string, size: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-9 * Math.PI) / 180);
  ctx.globalAlpha = 0.88;
  ctx.font = font('display', size);
  const w = ctx.measureText(text).width + size * 0.7;
  const h = size * 1.3;
  ctx.strokeStyle = COLOR.stamp;
  ctx.lineWidth = Math.max(3, size / 12);
  ctx.beginPath();
  // roundRect가 없는 옛 사파리(15 이하)는 네모 도장
  if (typeof ctx.roundRect === 'function') ctx.roundRect(-w / 2, -h / 2, w, h, size / 5);
  else ctx.rect(-w / 2, -h / 2, w, h);
  ctx.stroke();
  ctx.fillStyle = COLOR.stamp;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, size * 0.04);
  ctx.restore();
}

/** 정산마다 모양이 다른 장식용 바코드 */
function barcode(ctx: CanvasRenderingContext2D, seed: string, top: number) {
  let s = 0;
  for (const ch of seed) s = (Math.imul(s, 31) + ch.charCodeAt(0)) | 0;
  const random = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const width = 520;
  let x = (W - width) / 2;
  ctx.fillStyle = COLOR.ink;
  while (x < (W + width) / 2 - 8) {
    const bar = 2 + Math.floor(random() * 4) * 2;
    ctx.fillRect(x, top, bar, 84);
    x += bar + 3 + Math.floor(random() * 3) * 2;
  }
}

async function loadFonts(text: string) {
  if (!document.fonts?.load) return;
  const specs = [font('display', 40), font('body', 30), font('body', 30, 500), font('body', 30, 700), font('mono', 30), font('mono', 30, 600)];
  const sample = `${text}0123456789,+−→원`;
  // 글꼴을 못 불러와도 3초 뒤엔 기본 글꼴로 그린다
  await Promise.race([
    Promise.allSettled(specs.map((spec) => document.fonts.load(spec, sample))),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
}
