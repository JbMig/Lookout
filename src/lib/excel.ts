import "server-only";
import ExcelJS from "exceljs";
import { MAX_IMPORT_ROWS, type ParsedTable, type Sheet } from "./tabular";

const cell = (v: ExcelJS.CellValue): string => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("result" in v) return cell(v.result as ExcelJS.CellValue);
    if ("formula" in v || "sharedFormula" in v) return "";
    if ("text" in v) return String(v.text);
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    return "";
  }
  return String(v);
};

/** Toutes les feuilles d'un classeur, sous forme de matrices de texte (lignes et colonnes conservées). */
export async function readXlsxSheets(buf: ArrayBuffer): Promise<Sheet[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb.worksheets.map((ws) => {
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: true }, (row, n) => {
      rows[n - 1] = (row.values as ExcelJS.CellValue[]).slice(1).map(cell);
    });
    return { name: ws.name, rows: Array.from(rows, (r) => r ?? []) };
  });
}

/** Lecture simple : première feuille, en-tête sur la première ligne non vide. */
export function firstSheetTable(sheets: Sheet[]): ParsedTable {
  const values = (sheets[0]?.rows ?? []).filter((r) => r.some((x) => x.trim()));
  const [head = [], ...body] = values;
  const headers = head.map((h, i) => h.trim() || `Colonne ${i + 1}`);
  const rows = body.slice(0, MAX_IMPORT_ROWS).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
  return { headers, rows };
}
