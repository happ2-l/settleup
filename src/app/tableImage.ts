import type { SettlementResult } from '../engine';
import { avatarColor, avatarText } from './avatar';
import { dateLabel, num, participantTags } from './format';
import type { Meeting } from './model';
import { COLOR, MARGIN, PAD, TOOTH, fitText, font, loadFonts, paperPath, toPng, wrapText } from './receiptImage';

// 따지고 싶은 사람을 위한 표 이미지: 사람 × 차수 부담액. 차수가 많으면 그림이 옆으로 넓어진다

export interface TableModel {
  rounds: { no: string; place: string; total: string }[];
  rows: {
    id: string;
    name: string;
    cells: ({ amount: string; tags: string } | null)[];
    owed: string;
    paid: string;
    sent: string;
    balance: string;
    sign: -1 | 0 | 1;
  }[];
  owedTotal: string;
  paidTotal: string;
  hasSent: boolean;
}

/** 그림과 상관없이 표에 들어갈 글자만 만든다 */
export function tableModel(meeting: Meeting, result: SettlementResult): TableModel {
  const name = (id: string) => meeting.members.find((f) => f.id === id)?.name ?? id;
  const signed = (v: number) => (v > 0 ? `+${num(v)}` : v < 0 ? `−${num(-v)}` : '0');
  const hasSent = meeting.repayments.length > 0;
  return {
    rounds: meeting.rounds.map((r, i) => ({
      no: `${i + 1}차`,
      place: r.name?.trim() ?? '',
      total: num(result.rounds[i]?.charged ?? 0),
    })),
    rows: result.members.map((m) => ({
      id: m.memberId,
      name: name(m.memberId),
      cells: meeting.rounds.map((r, i) => {
        const p = r.participants.find((x) => x.memberId === m.memberId);
        if (!p) return null;
        return { amount: num(result.rounds[i]?.shares[m.memberId] ?? 0), tags: participantTags(p).join(' ') };
      }),
      owed: num(m.owed),
      paid: m.paid ? num(m.paid) : '—',
      sent: m.sent || m.received ? signed(m.sent - m.received) : '—',
      balance: signed(m.balance),
      sign: m.balance > 0 ? 1 : m.balance < 0 ? -1 : 0,
    })),
    owedTotal: num(result.members.reduce((s, m) => s + m.owed, 0)),
    paidTotal: num(result.members.reduce((s, m) => s + m.paid, 0)),
    hasSent,
  };
}

const ROW = 74;
const HEAD_ROW = 92;
const FOOT_ROW = 66;
const CELL_PAD = 18;
const AVATAR = 38;

const F = {
  name: font('body', 28, 500),
  head: font('body', 22, 700),
  headSub: font('body', 20),
  amount: font('mono', 26),
  strong: font('mono', 26, 600),
  tag: font('body', 18, 700),
  avatar: font('body', 17, 700),
};

export async function renderTableImage(meeting: Meeting, result: SettlementResult): Promise<Blob> {
  const model = tableModel(meeting, result);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이 브라우저에서는 이미지를 만들 수 없어요');

  const title = meeting.title || '이름 없는 정산';
  const meta = `${dateLabel(meeting.date)} · ${meeting.members.length}명 · ${meeting.rounds.length}차`;
  const legend = '— 그 차수에 없었음 · 술X 술 안 마심 · 반만/⅓만 먼저 감 · 고정 금액 고정';
  const allText = [
    title,
    meta,
    legend,
    '정 산 표 이름 부담 낸 돈 이미 보냄 받을·보낼 합계',
    ...model.rounds.flatMap((r) => [r.no, r.place, r.total]),
    ...model.rows.flatMap((r) => [r.name, avatarText(r.name, 1), r.owed, r.paid, r.sent, r.balance, ...r.cells.flatMap((c) => (c ? [c.amount, c.tags] : []))]),
  ].join('');
  await loadFonts(allText);

  const width = (f: string, s: string) => {
    ctx.font = f;
    return ctx.measureText(s).width;
  };
  const widest = (f: string, list: string[]) => Math.max(0, ...list.map((s) => width(f, s)));
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  // ── 열 너비
  const nameCol = clamp(widest(F.name, model.rows.map((r) => r.name)) + AVATAR + 12, 150, 270) + CELL_PAD * 2;
  const roundCols = model.rounds.map((r, i) =>
    clamp(
      Math.max(
        width(F.head, r.no),
        width(F.headSub, r.place),
        width(F.strong, r.total),
        widest(F.amount, model.rows.map((row) => row.cells[i]?.amount ?? '')),
        widest(F.tag, model.rows.map((row) => row.cells[i]?.tags ?? '')),
      ),
      90,
      200,
    ) + CELL_PAD * 2,
  );
  const sumCol = (label: string, values: string[]) => Math.max(width(F.head, label), widest(F.strong, values)) + CELL_PAD * 2;
  const tail = [
    { label: '부담', values: [...model.rows.map((r) => r.owed), model.owedTotal], strong: true },
    { label: '낸 돈', values: [...model.rows.map((r) => r.paid), model.paidTotal], strong: false },
    ...(model.hasSent ? [{ label: '이미 보냄', values: model.rows.map((r) => r.sent), strong: false }] : []),
    { label: '받을·보낼', values: model.rows.map((r) => r.balance), strong: true },
  ].map((c) => ({ ...c, width: sumCol(c.label, c.values) }));
  const tableWidth = nameCol + roundCols.reduce((a, b) => a + b, 0) + tail.reduce((a, c) => a + c.width, 0);

  const W = Math.max(1080, Math.ceil(tableWidth) + (MARGIN + PAD) * 2);
  const content = W - (MARGIN + PAD) * 2;
  const titleLines = wrapText(title, content, (s) => width(font('display', 72), s));
  const headHeight = 48 + 8 + titleLines.length * 86 + 6 + 44 + 34 + 2 + 30;
  const bodyHeight = HEAD_ROW + model.rows.length * ROW + FOOT_ROW;
  const footHeight = 26 + 34 + 30;
  const paperHeight = PAD * 2 + headHeight + bodyHeight + footHeight;

  canvas.width = W;
  canvas.height = MARGIN * 2 + TOOTH * 2 + paperHeight;
  ctx.fillStyle = COLOR.table;
  ctx.fillRect(0, 0, W, canvas.height);
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

  // ── 머리말
  const text = (s: string, x: number, y: number, f: string, color: string, align: CanvasTextAlign) => {
    ctx.font = f;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
  };
  let y = top + PAD;
  text('정 산 표', W / 2, y + 24, font('display', 32), COLOR.muted, 'center');
  y += 56;
  for (const line of titleLines) {
    text(line, W / 2, y + 43, font('display', 72), COLOR.ink, 'center');
    y += 86;
  }
  y += 6;
  text(meta, W / 2, y + 22, font('body', 28), COLOR.muted, 'center');
  y += 44;
  text(fitText(legend, content, (s) => width(font('body', 20), s)), W / 2, y + 17, font('body', 20), COLOR.muted, 'center');
  y += 34;
  ctx.save();
  ctx.strokeStyle = COLOR.line;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(MARGIN + PAD, y + 1);
  ctx.lineTo(W - MARGIN - PAD, y + 1);
  ctx.stroke();
  ctx.restore();
  y += 32;

  // ── 표
  const x0 = (W - tableWidth) / 2;
  const columnsRight: number[] = [];
  let x = x0 + nameCol;
  for (const w of roundCols) columnsRight.push((x += w));
  for (const c of tail) columnsRight.push((x += c.width));
  const right = (i: number) => columnsRight[i]! - CELL_PAD;

  // 머리줄
  text('이름', x0 + CELL_PAD, y + HEAD_ROW / 2, F.head, COLOR.muted, 'left');
  model.rounds.forEach((r, i) => {
    const room = roundCols[i]! - CELL_PAD * 2;
    if (r.place) {
      text(r.no, right(i), y + HEAD_ROW / 2 - 14, F.head, COLOR.ink, 'right');
      text(fitText(r.place, room, (s) => width(F.headSub, s)), right(i), y + HEAD_ROW / 2 + 16, F.headSub, COLOR.muted, 'right');
    } else {
      text(r.no, right(i), y + HEAD_ROW / 2, F.head, COLOR.ink, 'right');
    }
  });
  tail.forEach((c, k) => text(c.label, right(model.rounds.length + k), y + HEAD_ROW / 2, F.head, COLOR.muted, 'right'));
  y += HEAD_ROW;
  ctx.fillStyle = COLOR.ink;
  ctx.fillRect(x0, y - 2, tableWidth, 2);

  // 사람별 줄
  model.rows.forEach((row, r) => {
    if (r % 2 === 1) {
      ctx.fillStyle = '#f3f6f4';
      ctx.fillRect(x0, y, tableWidth, ROW);
    }
    const mid = y + ROW / 2;
    // 이름 + 동그라미
    const cx = x0 + CELL_PAD + AVATAR / 2;
    ctx.beginPath();
    ctx.arc(cx, mid, AVATAR / 2, 0, Math.PI * 2);
    ctx.fillStyle = avatarColor(meeting.members, row.id);
    ctx.fill();
    text(avatarText(row.name, 1), cx, mid + 1, F.avatar, '#ffffff', 'center');
    const nameRoom = nameCol - CELL_PAD * 2 - AVATAR - 12;
    text(fitText(row.name, nameRoom, (s) => width(F.name, s)), x0 + CELL_PAD + AVATAR + 12, mid, F.name, COLOR.ink, 'left');

    row.cells.forEach((cell, i) => {
      if (!cell) {
        text('—', right(i), mid, F.amount, COLOR.line, 'right');
        return;
      }
      if (cell.tags) {
        text(cell.amount, right(i), mid - 11, F.amount, COLOR.ink, 'right');
        text(cell.tags, right(i), mid + 20, F.tag, COLOR.plus, 'right');
      } else {
        text(cell.amount, right(i), mid, F.amount, COLOR.ink, 'right');
      }
    });
    const n = model.rounds.length;
    let k = 0;
    text(row.owed, right(n + k++), mid, F.strong, COLOR.ink, 'right');
    text(row.paid, right(n + k++), mid, F.amount, row.paid === '—' ? COLOR.line : COLOR.ink, 'right');
    if (model.hasSent) text(row.sent, right(n + k++), mid, F.amount, row.sent === '—' ? COLOR.line : COLOR.ink, 'right');
    const balanceColor = row.sign > 0 ? COLOR.plus : row.sign < 0 ? COLOR.minus : COLOR.ink;
    text(row.balance, right(n + k), mid, F.strong, balanceColor, 'right');
    y += ROW;
  });

  // 합계 줄
  ctx.fillStyle = COLOR.ink;
  ctx.fillRect(x0, y, tableWidth, 2);
  const mid = y + FOOT_ROW / 2 + 1;
  text('합계', x0 + CELL_PAD, mid, font('body', 26, 700), COLOR.ink, 'left');
  model.rounds.forEach((r, i) => text(r.total, right(i), mid, F.strong, COLOR.ink, 'right'));
  text(model.owedTotal, right(model.rounds.length), mid, F.strong, COLOR.ink, 'right');
  text(model.paidTotal, right(model.rounds.length + 1), mid, F.strong, COLOR.ink, 'right');
  y += FOOT_ROW;

  // ── 꼬리말
  y += 26;
  text(`SETTLEUP · ${meeting.date.replace(/-/g, '.')}`, W / 2, y + 17, font('mono', 22), COLOR.muted, 'center');

  return toPng(canvas);
}
