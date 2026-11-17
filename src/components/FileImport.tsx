"use client";
import { useState } from "react";
import type { FieldDef, Mapping, RawRow } from "@/lib/tabular";

export interface ImportedTable {
  fileName: string;
  headers: string[];
  rows: RawRow[];
  fields: FieldDef[];
  mapping: Mapping;
}

/** Import d'un fichier (CSV, Excel, JSON) puis correspondance des colonnes. */
export function FileImport({
  kind,
  title,
  description,
  value,
  onChange,
  sampleUrl,
}: {
  kind: "circana" | "catalog";
  title: string;
  description: string;
  value: ImportedTable | null;
  onChange: (t: ImportedTable | null) => void;
  sampleUrl?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      const res = await fetch("/api/files/parse", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fichier illisible");
      onChange(json as ImportedTable);
    } catch (e) {
      setError((e as Error).message);
      onChange(null);
    } finally {
      setBusy(false);
    }
  }

  async function useSample() {
    if (!sampleUrl) return;
    const res = await fetch(sampleUrl);
    const blob = await res.blob();
    await upload(new File([blob], sampleUrl.split("/").pop()!, { type: "text/csv" }));
  }

  return (
    <div className="rounded-xl border border-line bg-paper p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-ink-soft">{description}</p>
        </div>
        {value && (
          <button type="button" className="text-sm text-ink-soft underline underline-offset-2" onClick={() => onChange(null)}>
            Retirer
          </button>
        )}
      </div>

      {!value && (
        <div className="mt-4 rounded-lg border border-dashed border-line p-5 text-center">
          <label className="cursor-pointer text-sm font-medium underline underline-offset-2">
            {busy ? "Lecture du fichier…" : "Choisir un fichier"}
            <input
              type="file"
              className="sr-only"
              accept=".csv,.tsv,.txt,.xlsx,.json"
              disabled={busy}
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
          </label>
          <p className="mt-1 text-xs text-ink-soft">CSV, Excel (.xlsx) ou JSON · 8 Mo max</p>
          {sampleUrl && (
            <button type="button" onClick={useSample} className="mt-3 text-sm text-ink underline underline-offset-2">
              Utiliser le fichier d&apos;exemple
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-3 text-sm text-bad" role="alert">{error}</p>}

      {value && (
        <div className="mt-4 space-y-4">
          <p className="text-sm">
            <span className="font-medium">{value.fileName}</span> · {value.rows.length} lignes · {value.headers.length} colonnes
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {value.fields.map((f) => (
              <label key={f.key} className="block text-sm">
                <span className="font-medium">
                  {f.label}
                  {f.required && <span className="text-bad"> *</span>}
                </span>
                <select
                  className={`mt-1 w-full rounded-md border bg-paper px-2 py-1.5 ${f.required && !value.mapping[f.key] ? "border-bad" : "border-line"}`}
                  value={value.mapping[f.key] ?? ""}
                  onChange={(e) => onChange({ ...value, mapping: { ...value.mapping, [f.key]: e.target.value || null } })}
                >
                  <option value="">— Aucune colonne —</option>
                  {value.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-left text-xs">
              <thead className="bg-cream">
                <tr>{value.headers.map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {value.rows.slice(0, 4).map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    {value.headers.map((h) => <td key={h} className="whitespace-nowrap px-3 py-1.5">{r[h]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
