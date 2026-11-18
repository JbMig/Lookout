"use client";
import { inputCls, btnSecondary } from "./ui";
import { UploadCloud } from "lucide-react";
import { useState } from "react";
import type { FieldDef, Mapping, RawRow } from "@/lib/tabular";

export interface ImportedTable {
  fileName: string;
  storagePath?: string | null;
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
  const [over, setOver] = useState(false);

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
    <div className="rounded-[14px] border border-line bg-paper p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-ink-soft">{description}</p>
        </div>
        {value && (
          <button type="button" className="press text-sm font-semibold text-ink-soft hover:text-bad" onClick={() => onChange(null)}>
            Retirer
          </button>
        )}
      </div>

      {!value && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) upload(f);
          }}
          className={`mt-4 flex flex-col items-center rounded-[12px] border border-dashed px-5 py-7 text-center transition-colors duration-150 ${over ? "border-night bg-ground" : "border-[#d5d9e0]"}`}
        >
          <UploadCloud size={22} className="text-ink-faint" aria-hidden />
          <p className="mt-2 text-sm text-ink-soft">Déposez le fichier ici ou</p>
          <label className={`${btnSecondary} mt-3 cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-amber`}>
            {busy ? "Lecture du fichier…" : "Choisir un fichier"}
            <input
              type="file"
              className="sr-only"
              accept=".csv,.tsv,.txt,.xlsx,.json"
              disabled={busy}
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
          </label>
          <p className="mt-2 text-xs text-ink-faint">CSV, Excel (.xlsx) ou JSON · 8 Mo max</p>
          {sampleUrl && (
            <button type="button" onClick={useSample} className="press mt-3 text-sm font-semibold text-ink-soft hover:text-ink hover:underline">
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
                  className={`${inputCls} ${f.required && !value.mapping[f.key] ? "border-bad" : ""}`}
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
              <thead className="bg-ground text-ink-faint">
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
