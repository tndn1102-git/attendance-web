/* CSV 생성 — 엑셀(한국어 Windows)에서 바로 열리도록 UTF-8 BOM + CRLF. */
export function toCSV(headers, rows) {
  const esc = (v) => {
    if (v == null) return "";
    if (v instanceof Date) return v.toISOString();
    const s = String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [headers.map(esc).join(",")];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}
