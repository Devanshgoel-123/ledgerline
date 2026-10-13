/** A one-page, uncompressed text PDF with one line of text per entry, top to bottom. */
export function textPdf(lines: string[]): Buffer {
  const escape = (text: string) => text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const content = lines
    .map((line, index) => `BT /F1 9 Tf 30 ${800 - index * 14} Td (${escape(line)}) Tj ET`)
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

/** HDFC-style statement text: opening balance, then one row per payment. */
export function hdfcStatement(
  opening: number,
  rows: Array<{ date: string; narration: string; amount: number; type: "debit" | "credit"; closing?: number }>,
): Buffer {
  const money = (n: number) =>
    n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  let balance = opening;
  const body = rows.map((row, index) => {
    balance = row.closing ?? Math.round((balance + (row.type === "credit" ? row.amount : -row.amount)) * 100) / 100;
    const [y, m, d] = row.date.split("-");
    const short = `${d}/${m}/${y!.slice(2)}`;
    return `${short} ${row.narration} ${String(1000000000000 + index).padStart(16, "0")} ${short} ${money(row.amount)} ${money(balance)}`;
  });
  return textPdf([
    "HDFC BANK Ltd. Statement of account",
    `Opening Balance ${money(opening)}`,
    "Date Narration Chq./Ref.No. Value Dt Withdrawal Amt. Deposit Amt. Closing Balance",
    ...body,
  ]);
}

type Cell = { x: number; y: number; text: string };

/** A multi-page PDF with text placed at exact positions, one object per cell. */
export function positionedPdf(pages: Cell[][]): Buffer {
  const escape = (text: string) => text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const objects: string[] = [];
  const add = (body: string) => objects.push(body) - 1 + 1; // 1-based object number
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add(""); // pages tree, filled in below
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const kids: number[] = [];
  for (const cells of pages) {
    const content = cells
      .map((cell) => `BT /F1 8 Tf ${cell.x} ${cell.y} Td (${escape(cell.text)}) Tj ET`)
      .join("\n");
    const stream = add(`<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`);
    kids.push(
      add(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${stream} 0 R >>`,
      ),
    );
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

export interface IciciRow {
  date: string; // YYYY-MM-DD
  /** PARTICULARS as the bank wraps it, one string per printed line. */
  particulars: string[];
  amount: number;
  type: "debit" | "credit";
}

/**
 * ICICI NetBanking statement layout: furniture on every page, the column header,
 * a B/F row with the opening balance, and rows whose date and amounts sit at the
 * vertical middle of a one-to-four line PARTICULARS cell.
 */
export function iciciStatement(opening: number, rows: IciciRow[], rowsPerPage = 6): Buffer {
  const money = (n: number) =>
    n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dmy = (iso: string) => iso.split("-").reverse().join("-");
  const header = (y: number): Cell[] => [
    { x: 40, y, text: "DATE" },
    { x: 100, y, text: "MODE**" },
    { x: 190, y, text: "PARTICULARS" },
    { x: 400, y, text: "DEPOSITS" },
    { x: 460, y, text: "WITHDRAWALS" },
    { x: 545, y, text: "BALANCE" },
  ];
  const furniture = (page: number, total: number): Cell[] => [
    { x: 480, y: 820, text: `Page ${page} of ${total}` },
    { x: 40, y: 800, text: "ICICI Bank khayaal aapka" },
    { x: 40, y: 780, text: "MR.TEST CUSTOMER" },
  ];

  const chunks: IciciRow[][] = [];
  for (let i = 0; i < rows.length; i += rowsPerPage) chunks.push(rows.slice(i, i + rowsPerPage));
  if (chunks.length === 0) chunks.push([]);

  let balance = opening;
  const pages = chunks.map((chunk, pageIndex) => {
    const cells = [...furniture(pageIndex + 1, chunks.length)];
    let y = 740;
    if (pageIndex === 0) {
      cells.push({ x: 40, y: 760, text: "Summary of Accounts held under Cust ID: 000000000 as on October 11, 2026" });
      cells.push({ x: 40, y: 750, text: "Savings A/c 000000000000 1,234.56 0.00 1,234.56 Registered" });
    }
    cells.push(...header(y));
    y -= 14;
    if (pageIndex === 0) {
      const first = chunk[0]?.date ?? "2026-09-01";
      cells.push({ x: 40, y, text: dmy(first) }, { x: 190, y, text: "B/F" }, { x: 545, y, text: money(opening) });
      y -= 14;
    }
    for (const row of chunk) {
      balance = Math.round((balance + (row.type === "credit" ? row.amount : -row.amount)) * 100) / 100;
      const lines = row.particulars.length;
      row.particulars.forEach((text, i) => cells.push({ x: 190, y: y - i * 10, text }));
      const middle = y - ((lines - 1) * 10) / 2;
      cells.push(
        { x: 40, y: middle, text: dmy(row.date) },
        { x: row.type === "credit" ? 400 : 460, y: middle, text: money(row.amount) },
        { x: 545, y: middle, text: money(balance) },
      );
      y -= lines * 10 + 8;
    }
    return cells;
  });
  return positionedPdf(pages);
}
