"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
import { api, fmtDate } from "@/lib/client";
import { Private } from "@/components/Session";
import { StatusBadge } from "@/components/StatusBadge";
import { AgentButton } from "@/components/agents/kit";
import { Card, CardHead, Empty, ErrorText, PageHeader, Skeleton } from "@/components/ui";
import type { ImportView } from "@/app/api/imports/route";

const period = (a: string | null, b: string | null) => (a && b ? `${a.slice(0, 4)} → ${b.slice(0, 4)}` : "—");

function qualityAlerts(i: ImportView): string[] {
  const out: string[] = [];
  const q = i.quality;
  if (q.duplicates) out.push(`${q.duplicates} ligne${q.duplicates > 1 ? "s" : ""} en double`);
  if (q.overlap) out.push(`${q.overlap} ligne${q.overlap > 1 ? "s" : ""} déjà couverte${q.overlap > 1 ? "s" : ""} par un import plus récent (comptées une seule fois)`);
  if (q.missingCurrency) out.push(`${q.missingCurrency} sans devise`);
  if (q.missingZone) out.push(`${q.missingZone} sans zone`);
  if (q.missingFormat) out.push(`${q.missingFormat} sans format`);
  return [...out, ...i.alerts];
}

function Import() {
  const [imports, setImports] = useState<ImportView[] | null>(null);
  const [file, setFile] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(() => api<{ imports: ImportView[] }>("/api/imports").then((r) => setImports(r.imports)).catch((e) => setError(e.message)), []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function upload(f: File | undefined) {
    if (!f) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", f);
      const r = await api<{ file: string }>("/api/imports", { method: "POST", body: fd });
      setFile(r.file);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Import Circana" meta={<span>Déposez l&apos;export Circana : l&apos;Agent 1 le lit dans le bucket circana-uploads et écrit les ventes dans circana_sales.</span>} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <Card>
          <CardHead title="1. Déposer le fichier" sub="CSV à plat ou classeur « Benchmark » (.xlsx), 20 Mo maximum." />
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); void upload(e.dataTransfer.files[0]); }}
            className={`press flex w-full flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed px-6 py-10 text-center transition-colors ${drag ? "border-amber bg-amber-wash" : "border-[#d5d9e0] bg-ground hover:border-ink-faint"}`}
          >
            {uploading ? <Loader2 size={26} className="animate-spin text-ink-soft" aria-hidden /> : file ? <FileSpreadsheet size={26} className="text-ok" aria-hidden /> : <UploadCloud size={26} className="text-ink-soft" aria-hidden />}
            <span className="font-medium">{uploading ? "Dépôt en cours…" : file ? file : "Glissez le fichier ici ou cliquez pour le choisir"}</span>
            <span className="text-[13px] text-ink-faint">{file ? "Déposé dans circana-uploads. Lancez l'import pour le traiter." : ".csv, .xlsx, .xls"}</span>
          </button>
          <input ref={input} type="file" accept=".csv,.txt,.xlsx,.xls" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} aria-label="Choisir un fichier Circana" />
          <div className="mt-3"><ErrorText>{error}</ErrorText></div>
        </Card>
        <Card>
          <CardHead title="2. Lancer l'import" sub={file ? "Importe le fichier déposé." : "Sans nouveau fichier, importe tout ce qui attend dans le bucket."} />
          <AgentButton agent="1" label="Lancer l'import" params={file ? { file } : {}} onDone={() => { setFile(null); void load(); }} />
        </Card>
      </div>

      <Card flush>
        <div className="px-5 pt-5"><CardHead title="Imports" sub="Statut, volume et contrôles qualité de chaque fichier." /></div>
        {!imports ? (
          <div className="space-y-2 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : !imports.length ? (
          <div className="p-5"><Empty title="Aucun import pour l'instant">Déposez un premier fichier Circana ci-dessus.</Empty></div>
        ) : (
          <ul className="divide-y divide-line">
            {imports.map((i) => {
              const alerts = qualityAlerts(i);
              return (
                <li key={i.id} className="grid gap-2 px-5 py-4 md:grid-cols-[minmax(0,1.6fr)_130px_110px_120px] md:items-start">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{i.filename}</p>
                    <p className="text-[13px] text-ink-faint">{fmtDate(i.createdAt)}</p>
                    {i.error && <p className="mt-1 text-[13px] text-bad">{i.error}</p>}
                    {alerts.length > 0 && (
                      <details className="mt-1.5 text-[13px]">
                        <summary className="flex cursor-pointer items-center gap-1.5 text-warn"><AlertTriangle size={14} aria-hidden />{alerts.length} alerte{alerts.length > 1 ? "s" : ""} qualité</summary>
                        <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-ink-soft">{alerts.slice(0, 12).map((a, n) => <li key={n}>{a}</li>)}</ul>
                      </details>
                    )}
                  </div>
                  <div><StatusBadge status={i.status} /></div>
                  <p className="text-sm tabular-nums"><span className="text-ink-faint md:hidden">Lignes : </span>{i.rowCount?.toLocaleString("fr-FR") ?? "—"} <span className="hidden text-ink-faint md:inline">lignes</span></p>
                  <p className="text-sm"><span className="text-ink-faint md:hidden">Période : </span>{period(i.periodStart, i.periodEnd)}</p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function ImportPage() {
  return <Private><Import /></Private>;
}
