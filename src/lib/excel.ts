import "server-only";
import ExcelJS from "exceljs";
import { MAX_IMPORT_ROWS, type ParsedTable } from "./tabular";

/** Lecture de la première feuille d'un fichier Excel (.xlsx). */
export async function parseXlsx(buf: ArrayBuffer): Promise<ParsedTable> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  if (!ws) return { headers: [], rows: [] };
  const cell = (v: ExcelJS.CellValue): string => {
    if (v === null || v === undefined) return "";
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === "object") {
      if ("result" in v) return cell(v.result as ExcelJS.CellValue);
      if ("text" in v) return String(v.text);
      if ("richText" in v) return v.richText.map((t) => t.text).join("");
      return "";
    }
    return String(v);
  };
  const values: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const arr = (row.values as ExcelJS.CellValue[]).slice(1).map(cell);
    if (arr.some((x) => x.trim())) values.push(arr);
  });
  const [head = [], ...body] = values;
  const headers = head.map((h, i) => h.trim() || `Colonne ${i + 1}`);
  const rows = body.slice(0, MAX_IMPORT_ROWS).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
  return { headers, rows };
}
