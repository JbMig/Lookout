"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Radar, Sparkles, Trash2 } from "lucide-react";
import { api, fmtDateTime } from "@/lib/client";
import { Private } from "@/components/Session";
import { Card, Empty, ErrorText, Field, PageHeader, Skeleton, btnAccent, btnSecondary, inputCls } from "@/components/ui";
import type { AnalyseResume } from "@/lib/prisme-historique";

const nf = (v: number | string, unite?: string) =>
  typeof v === "number" ? `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v)}${unite ? ` ${unite}` : ""}` : v;

/** Collecte d'un nouveau sujet (n8n → Hugging Face → Supabase) : les données qu'analyse ensuite Prisme. */
function Collecte() {
  const [sujet, setSujet] = useState("");
  const [pays, setPays] = useState("FR");
  const [mode, setMode] = useState("economique");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function lancer(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setMsg(null);
    try {
      await api("/api/social", { method: "POST", json: { sujet, pays, mode } });
      setMsg(`Collecte lancée sur « ${sujet} » : elle tourne en arrière-plan (10 à 15 min), puis le sujet sera disponible dans Prisme.`);
      setSujet("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="group rounded-[14px] border border-line bg-paper">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
        <span><span className="font-semibold">Collecter un nouveau sujet</span><span className="block text-[13px] text-ink-faint">Si Prisme n&apos;a pas encore de données sur ce que vous cherchez.</span></span>
        <ChevronRight size={16} className="text-ink-faint transition-transform group-open:rotate-90" aria-hidden />
      </summary>
      <form onSubmit={lancer} className="grid gap-4 border-t border-line px-5 py-4 sm:grid-cols-[minmax(0,1fr)_110px] lg:grid-cols-[minmax(0,1fr)_110px_minmax(0,300px)_auto] lg:items-end">
        <Field label="Sujet"><input className={inputCls} value={sujet} onChange={(e) => setSujet(e.target.value)} placeholder="blush de luxe" required minLength={2} /></Field>
        <Field label="Pays">
          <select className={inputCls} value={pays} onChange={(e) => setPays(e.target.value)}>{[["FR", "France"], ["US", "États-Unis"], ["GB", "Royaume-Uni"], ["DE", "Allemagne"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </Field>
        <div className="sm:col-span-2 lg:col-span-1">
          <Field label="Sources">
            <select className={`${inputCls} truncate`} value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="economique">Économique : TikTok, YouTube, Google</option>
              <option value="complet">Complet : + TikTok et Instagram récents</option>
              <option value="secours">Données déjà collectées</option>
            </select>
          </Field>
        </div>
        <button className={`${btnSecondary} py-2.5 sm:col-span-2 lg:col-span-1`} disabled={busy}><Radar size={16} aria-hidden />{busy ? "Lancement…" : "Lancer la collecte"}</button>
      </form>
      {(msg || error) && <div className="px-5 pb-4">{msg && <p className="text-sm text-ok" role="status">{msg}</p>}<ErrorText>{error}</ErrorText></div>}
    </details>
  );
}

function Historique() {
  const [analyses, setAnalyses] = useState<AnalyseResume[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = useCallback(
    () => api<{ analyses: AnalyseResume[] }>("/api/social").then((r) => { setAnalyses(r.analyses); setError(null); }).catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function supprimer(id: string) {
    await api(`/api/social/${id}`, { method: "DELETE" }).catch((e) => setError(e.message));
    setConfirm(null);
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Social listening"
        meta={<span>L&apos;historique des analyses de tendances faites avec Prisme : chaque recherche est enregistrée et se rouvre à l&apos;identique.</span>}
        actions={<Link href="/prisme" className={btnAccent}><Sparkles size={16} aria-hidden />Nouvelle analyse</Link>}
      />
      {error && !analyses ? (
        <Empty title="Historique indisponible pour le moment">{error}</Empty>
      ) : !analyses ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : !analyses.length ? (
        <Empty title="Aucune analyse pour l'instant">Lancez une recherche dans Prisme : elle apparaîtra ici.</Empty>
      ) : (
        <ul className="space-y-3">
          {analyses.map((a) => (
            <li key={a.id}>
              <Card className="lift p-0">
                <div className="flex items-start gap-3 px-5 pt-4">
                  <Link href={`/social/${a.id}`} className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-faint">
                      <span className="rounded-full bg-night px-2.5 py-0.5 font-medium text-white">{a.sujet}</span>
                      {a.pays && <span>{a.pays}</span>}
                      <span>· {fmtDateTime(a.created_at)}</span>
                      {a.created_by_email && <span>· {a.created_by_email}</span>}
                      {a.videos > 0 && <span>· {new Intl.NumberFormat("fr-FR").format(a.videos)} vidéos analysées</span>}
                    </div>
                    <h2 className="mt-2 text-[17px] font-semibold leading-snug">{a.titre || a.sujet}</h2>
                    {a.question && <p className="mt-0.5 text-[13.5px] text-ink-soft">Question : {a.question}</p>}
                  </Link>
                  {confirm === a.id ? (
                    <span className="flex shrink-0 items-center gap-2 text-[13px]">
                      <button type="button" onClick={() => supprimer(a.id)} className="press rounded-[8px] bg-bad px-2.5 py-1 font-medium text-white">Supprimer</button>
                      <button type="button" onClick={() => setConfirm(null)} className="press text-ink-soft hover:underline">Annuler</button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setConfirm(a.id)} aria-label={`Supprimer l'analyse « ${a.titre || a.sujet} »`} className="press shrink-0 rounded-[8px] p-1.5 text-ink-faint hover:bg-ground hover:text-bad"><Trash2 size={16} aria-hidden /></button>
                  )}
                </div>
                <Link href={`/social/${a.id}`} className={`mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-b-[14px] border-t border-line bg-line ${["", "sm:grid-cols-1", "sm:grid-cols-2", "sm:grid-cols-3", "sm:grid-cols-4"][Math.min(4, a.kpis.length)]}`}>
                  {a.kpis.slice(0, 4).map((k) => (
                    <div key={k.id} className="bg-paper px-5 py-3">
                      <p className="truncate text-[15px] font-semibold tabular-nums">{nf(k.valeur, k.unite)}</p>
                      <p className="truncate text-[12px] text-ink-faint">{k.label}</p>
                    </div>
                  ))}
                  {!a.kpis.length && <div className="col-span-full bg-paper px-5 py-3 text-[13px] text-ink-faint">Ouvrir le dashboard</div>}
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Collecte />
    </div>
  );
}

export default function SocialPage() {
  return <Private><Historique /></Private>;
}
