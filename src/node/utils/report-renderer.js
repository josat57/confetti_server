import zlib from "zlib";
import PDFDocument from "pdfkit";

/**
 * Render arbitrary report data (nested objects / arrays of rows) into a
 * downloadable file. Supported formats: json, csv, pdf, xlsx.
 *
 *   const { buffer, contentType, extension } = await renderReport({
 *     title: "Monthly revenue", format: "csv", data, meta: { "Date range": "..." }
 *   });
 */

export const REPORT_FORMATS = ["json", "csv", "pdf", "xlsx"];

const CONTENT_TYPES = {
  json: "application/json",
  csv: "text/csv; charset=utf-8",
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const MAX_DEPTH = 4;

const isPlainObject = (v) =>
  v !== null &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  !(v instanceof Date) &&
  !Buffer.isBuffer(v) &&
  !(v._bsontype); // ObjectId, Decimal128, ...

const formatScalar = (v) => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return isNaN(v) ? "" : v.toISOString();
  if (v?._bsontype) return v.toString();
  if (Buffer.isBuffer(v)) return `<${v.length} bytes>`;
  if (Array.isArray(v)) return v.map(formatScalar).join("; ");
  if (typeof v === "object") return JSON.stringify(v);
  return v;
};

const humanize = (key) =>
  String(key)
    .replace(/[._]/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());

/** Flatten one row object into { "a.b": value } form. */
const flattenRow = (obj, prefix = "", out = {}, depth = 0) => {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (isPlainObject(v) && depth < MAX_DEPTH) flattenRow(v, key, out, depth + 1);
    else out[key] = formatScalar(v);
  }
  return out;
};

/**
 * Convert report data into { summary: [[label, value]], tables: [{ name, columns, rows }] }.
 * Arrays of objects become tables; everything else becomes a key/value summary row.
 */
export const toTables = (data) => {
  const summary = [];
  const tables = [];

  const addTable = (name, items) => {
    const rows = items.map((item) => (isPlainObject(item) ? flattenRow(item) : { value: formatScalar(item) }));
    const columns = [];
    for (const r of rows) for (const c of Object.keys(r)) if (!columns.includes(c)) columns.push(c);
    tables.push({ name, columns, rows: rows.map((r) => columns.map((c) => r[c] ?? "")) });
  };

  const walk = (obj, prefix, depth) => {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (Array.isArray(v) && v.length && v.some(isPlainObject)) addTable(humanize(key), v);
      else if (isPlainObject(v) && depth < MAX_DEPTH) walk(v, key, depth + 1);
      else summary.push([humanize(key), formatScalar(v)]);
    }
  };

  if (Array.isArray(data)) addTable("Data", data);
  else if (isPlainObject(data)) walk(data, "", 0);
  else if (data !== undefined && data !== null) summary.push(["Value", formatScalar(data)]);

  return { summary, tables };
};

// ─── CSV ─────────────────────────────────────────────────────────────────────

const csvCell = (v) => {
  let s = String(formatScalar(v));
  // Neutralise spreadsheet formula injection
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const renderCsv = ({ title, meta, summary, tables }) => {
  const lines = [];
  const row = (cells) => lines.push(cells.map(csvCell).join(","));
  if (title) row([title]);
  for (const [k, v] of Object.entries(meta)) row([k, v]);
  if (summary.length) {
    if (lines.length) lines.push("");
    row(["Summary"]);
    row(["Metric", "Value"]);
    summary.forEach(row);
  }
  for (const t of tables) {
    lines.push("");
    row([t.name]);
    row(t.columns.map(humanize));
    t.rows.forEach(row);
  }
  return Buffer.from("﻿" + lines.join("\r\n") + "\r\n", "utf8"); // BOM so Excel detects UTF-8
};

// ─── PDF ─────────────────────────────────────────────────────────────────────

// The built-in PDF fonts only cover WinAnsi (Latin-1 + a few symbols).
const PDF_REPLACEMENTS = { "→": "->", "←": "<-", "₦": "NGN ", "…": "...", "≥": ">=", "≤": "<=" };
const pdfText = (v) => {
  const s = String(formatScalar(v));
  if (s === "") return "-";
  return s
    .replace(/[→←₦…≥≤]/g, (c) => PDF_REPLACEMENTS[c])
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF€‚ƒ„†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/g, "?");
};

const renderPdf = ({ title, meta, summary, tables }) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const ensureSpace = (h) => {
      if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage();
    };

    doc.font("Helvetica-Bold").fontSize(18).text(pdfText(title || "Report"));
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(9).fillColor("#555555");
    for (const [k, v] of Object.entries(meta)) doc.text(`${pdfText(k)}: ${pdfText(v)}`);
    doc.fillColor("#000000").moveDown();

    if (summary.length) {
      doc.font("Helvetica-Bold").fontSize(13).text("Summary");
      doc.moveDown(0.3);
      doc.fontSize(10);
      for (const [k, v] of summary) {
        ensureSpace(14);
        doc.font("Helvetica-Bold").text(`${pdfText(k)}: `, { continued: true }).font("Helvetica").text(pdfText(v));
      }
      doc.moveDown();
    }

    for (const t of tables) {
      ensureSpace(40);
      doc.font("Helvetica-Bold").fontSize(13).text(pdfText(t.name));
      doc.moveDown(0.3);
      if (!t.rows.length) {
        doc.font("Helvetica").fontSize(10).text("No records");
        doc.moveDown();
        continue;
      }

      if (t.columns.length <= 6) {
        // Grid layout
        const colW = width / t.columns.length;
        const drawRow = (cells, bold) => {
          doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8);
          const texts = cells.map(pdfText);
          const heights = texts.map((c) => doc.heightOfString(c, { width: colW - 4 }));
          const h = Math.max(...heights, 10) + 4;
          ensureSpace(h);
          const y = doc.y;
          texts.forEach((c, i) => {
            doc.text(c, doc.page.margins.left + i * colW, y, { width: colW - 4 });
          });
          doc.x = doc.page.margins.left;
          doc.y = y + h;
          doc.moveTo(doc.page.margins.left, doc.y - 2).lineTo(doc.page.margins.left + width, doc.y - 2)
            .strokeColor("#dddddd").lineWidth(0.5).stroke();
        };
        drawRow(t.columns.map(humanize), true);
        t.rows.forEach((r) => drawRow(r, false));
      } else {
        // Too many columns for a grid: one block per record
        doc.fontSize(8);
        t.rows.forEach((r, idx) => {
          ensureSpace(20);
          doc.font("Helvetica-Bold").text(`#${idx + 1}`);
          r.forEach((v, i) => {
            if (v === "") return;
            doc.font("Helvetica-Bold").text(`${pdfText(humanize(t.columns[i]))}: `, { continued: true })
              .font("Helvetica").text(pdfText(v));
          });
          doc.moveDown(0.4);
        });
      }
      doc.moveDown();
    }

    doc.end();
  });

// ─── XLSX (minimal OOXML writer, stored ZIP — no extra dependency) ──────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

const crc32 = (buf) => {
  if (typeof zlib.crc32 === "function") return zlib.crc32(buf) >>> 0;
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const zipStore = (files) => {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt32LE(0, 10); // time/date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
};

const xmlEscape = (s) =>
  String(s)
    // strip characters that are illegal in XML 1.0
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const colName = (i) => {
  let s = "";
  for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
};

const sheetXml = (rows) => {
  const body = rows
    .map((cells, r) => {
      const cs = cells
        .map((v, c) => {
          const ref = `${colName(c)}${r + 1}`;
          if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
          if (typeof v === "boolean") return `<c r="${ref}" t="b"><v>${v ? 1 : 0}</v></c>`;
          const s = String(formatScalar(v));
          if (s === "") return "";
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(s.slice(0, 32767))}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cs}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
};

const renderXlsx = ({ title, meta, summary, tables }) => {
  const sheets = [];
  const used = new Set();
  const sheetName = (n) => {
    let base = String(n).replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Sheet";
    let name = base;
    for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base.slice(0, 28)} ${i}`;
    used.add(name.toLowerCase());
    return name;
  };

  const summaryRows = [[title || "Report"], ...Object.entries(meta), []];
  summaryRows.push(["Metric", "Value"], ...summary);
  sheets.push({ name: sheetName("Summary"), rows: summaryRows });
  for (const t of tables) sheets.push({ name: sheetName(t.name), rows: [t.columns.map(humanize), ...t.rows] });

  const files = [
    {
      name: "[Content_Types].xml",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets
          .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
          .join("")}</Types>`
      ),
    },
    {
      name: "_rels/.rels",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
      ),
    },
    {
      name: "xl/workbook.xml",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets
          .map((s, i) => `<sheet name="${xmlEscape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
          .join("")}</sheets></workbook>`
      ),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
          .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
          .join("")}</Relationships>`
      ),
    },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: Buffer.from(sheetXml(s.rows)) })),
  ];
  return zipStore(files);
};

// ─── PUBLIC API ──────────────────────────────────────────────────────────────

const jsonReplacer = (_k, v) => (v && v._bsontype ? v.toString() : v);

export const renderReport = async ({ title, format = "json", data, meta = {} }) => {
  const fmt = REPORT_FORMATS.includes(format) ? format : "json";
  const cleanMeta = Object.fromEntries(
    Object.entries(meta).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => [k, formatScalar(v)])
  );

  let buffer;
  if (fmt === "json") {
    buffer = Buffer.from(JSON.stringify({ title, ...cleanMeta, data }, jsonReplacer, 2), "utf8");
  } else {
    const { summary, tables } = toTables(data);
    const input = { title, meta: cleanMeta, summary, tables };
    if (fmt === "csv") buffer = renderCsv(input);
    else if (fmt === "pdf") buffer = await renderPdf(input);
    else buffer = renderXlsx(input);
  }
  return { buffer, contentType: CONTENT_TYPES[fmt], extension: fmt };
};

/** Safe Content-Disposition filename */
export const reportFileName = (name, extension) =>
  `${String(name || "report").replace(/[^\w.-]+/g, "_").slice(0, 100) || "report"}.${extension}`;

/** Send a rendered report as a download. */
export const sendReportFile = (res, { buffer, contentType, extension }, name) => {
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${reportFileName(name, extension)}"`);
  res.setHeader("Content-Length", buffer.length);
  res.status(200).end(buffer);
};

export const formatDateRange = (dateRange) => {
  if (!dateRange) return undefined;
  const f = (d) => {
    const date = d ? new Date(d) : null;
    return date && !isNaN(date) ? date.toISOString().slice(0, 10) : "any";
  };
  if (!dateRange.startDate && !dateRange.endDate) return undefined;
  return `${f(dateRange.startDate)} to ${f(dateRange.endDate)}`;
};
