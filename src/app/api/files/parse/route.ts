import { handle } from "@/lib/http";
import { requireUser, HttpError } from "@/lib/auth";
import { CATALOG_FIELDS, CIRCANA_FIELDS, parseCsv, parseJson, suggestMapping, type ParsedTable } from "@/lib/tabular";
import { parseXlsx } from "@/lib/excel";

const MAX_BYTES = 8 * 1024 * 1024;

/** Lit un fichier importé et propose la correspondance des colonnes. */
export const POST = handle(async (req: Request) => {
  await requireUser("analyst");
  const form = await req.formData();
  const file = form.get("file");
  const kind = form.get("kind") === "catalog" ? "catalog" : "circana";
  if (!(file instanceof File)) throw new HttpError(400, "Aucun fichier reçu");
  if (file.size > MAX_BYTES) throw new HttpError(413, "Fichier trop volumineux (8 Mo max)");

  const name = file.name.toLowerCase();
  let table: ParsedTable;
  try {
    if (name.endsWith(".xlsx")) table = await parseXlsx(await file.arrayBuffer());
    else if (name.endsWith(".json")) table = parseJson(await file.text());
    else if (name.endsWith(".csv") || name.endsWith(".txt") || name.endsWith(".tsv")) table = parseCsv(await file.text());
    else throw new HttpError(415, "Formats acceptés : CSV, Excel (.xlsx), JSON");
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(422, `Fichier illisible : ${(e as Error).message}`);
  }
  if (!table.rows.length) throw new HttpError(422, "Le fichier ne contient aucune ligne");

  const fields = kind === "catalog" ? CATALOG_FIELDS : CIRCANA_FIELDS;
  return { kind, fileName: file.name, headers: table.headers, rows: table.rows, fields, mapping: suggestMapping(table.headers, fields) };
});
