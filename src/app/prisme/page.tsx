"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Private } from "@/components/Session";
import { ArrowRight, History, Search, Sparkles } from "lucide-react";
import { ErrorText, PageHeader, Skeleton } from "@/components/ui";
import { PrismeDashboard } from "@/components/prisme/PrismeDashboard";
import { ReseauxMarques } from "@/components/prisme/ReseauxMarques";
import { AlertesCrise } from "@/components/prisme/AlertesCrise";
import type { Alertes } from "@/lib/alertes";
import type { DashboardPrisme } from "@/lib/prisme-dashboard";
import type { Reseaux } from "@/lib/reseaux";

const ETAPES = ["Recherche des données collectées…", "Lecture des scores par marque…", "Ce que disent les commentaires…", "Hashtags, formats, recherche Google…", "Choix des graphiques…", "Rédaction de l'analyse…"];

function Prisme() {
  const [sujet, setSujet] = useState("");
  const [question, setQuestion] = useState("");
  const [sujets, setSujets] = useState<string[]>([]);
  const [d, setD] = useState<(DashboardPrisme & { analyse_id?: string | null }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [etape, setEtape] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<"sujet" | "reseaux" | "alertes">("sujet");
  const [alertes, setAlertes] = useState<Alertes | null>(null);
  function ouvrirAlertes() {
    setOnglet("alertes");
    if (!alertes) api<Alertes>("/api/prisme/alertes").then(setAlertes).catch((e) => setError(e.message));
  }
  const [reseaux, setReseaux] = useState<Reseaux | null>(null);
  const [pays, setPays] = useState("FR");
  function ouvrirReseaux() {
    setOnglet("reseaux");
    if (!reseaux) api<Reseaux>("/api/prisme/reseaux").then(setReseaux).catch((e) => setError(e.message));
  }

  useEffect(() => { api<{ sujets: string[] }>("/api/prisme").then((r) => setSujets(r.sujets)).catch(() => null); }, []);
  // « Relancer avec Prisme » depuis l'historique : le formulaire est prérempli.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = setTimeout(() => {
      if (q.get("sujet")) setSujet(q.get("sujet")!);
      if (q.get("pays")) setPays(q.get("pays")!);
      if (q.get("question")) setQuestion(q.get("question")!);
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setEtape((e) => Math.min(e + 1, ETAPES.length - 1)), 5000);
    return () => clearInterval(t);
  }, [busy]);

  async function analyser(e?: React.FormEvent, s = sujet) {
    e?.preventDefault();
    if (s.trim().length < 2) return;
    setSujet(s); setEtape(0); setBusy(true); setError(null); setD(null);
    try {
      setD(await api<DashboardPrisme & { analyse_id?: string | null }>("/api/prisme", { method: "POST", json: { sujet: s, question: question || undefined, pays } }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-6 [contain:inline-size]">
      <PageHeader title="Prisme" meta={<span>L&apos;agent analyste du social listening : tapez ce que vous cherchez, il construit le dashboard. Chaque analyse est gardée dans Social listening.</span>} />
      <div className="flex max-w-full overflow-x-auto rounded-full border border-line bg-paper p-1 sm:inline-flex" role="tablist">
        <button role="tab" aria-selected={onglet === "sujet"} onClick={() => setOnglet("sujet")} className={`press shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ${onglet === "sujet" ? "bg-[#1b1411] text-white" : "text-ink-soft"}`}>Analyse d&apos;un sujet</button>
        <button role="tab" aria-selected={onglet === "alertes"} onClick={ouvrirAlertes} className={`press shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ${onglet === "alertes" ? "bg-[#1b1411] text-white" : "text-ink-soft"}`}>Alertes</button>
        <button role="tab" aria-selected={onglet === "reseaux"} onClick={ouvrirReseaux} className={`press shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ${onglet === "reseaux" ? "bg-[#1b1411] text-white" : "text-ink-soft"}`}>Réseaux des marques</button>
      </div>
      {onglet === "alertes" ? (alertes ? <AlertesCrise a={alertes} /> : <Skeleton className="h-96" />) : onglet === "reseaux" ? (reseaux ? <ReseauxMarques r={reseaux} /> : <Skeleton className="h-96" />) : <>
      <form onSubmit={analyser} className="rounded-[16px] border border-line bg-paper p-3 shadow-[0_8px_24px_-18px_rgb(27_20_17/0.35)]">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-[12px] bg-ground px-3">
            <Search size={18} className="shrink-0 text-ink-faint" aria-hidden />
            <span className="sr-only">Ce que vous cherchez</span>
            <input id="prisme-sujet" className="h-12 w-full min-w-0 bg-transparent text-[16px] outline-none" placeholder="blush de luxe, mascara waterproof, sérum vitamine C…"
              value={sujet} onChange={(e) => setSujet(e.target.value)} list="prisme-sujets" autoComplete="off" />
            <datalist id="prisme-sujets">{sujets.map((s) => <option key={s} value={s} />)}</datalist>
          </label>
          <select id="prisme-pays" aria-label="Pays" className="h-12 rounded-[12px] border border-line bg-paper px-3 text-sm" value={pays} onChange={(e) => setPays(e.target.value)}>
            <option value="FR">France</option><option value="EU">Europe</option><option value="US">États-Unis</option>
          </select>
          <button className="press inline-flex h-12 items-center justify-center gap-2 rounded-[12px] bg-[#a9471f] px-5 font-semibold text-white hover:bg-[#8f3b19] disabled:opacity-50" disabled={busy || sujet.trim().length < 2}><Sparkles size={17} aria-hidden />{busy ? "Analyse…" : "Analyser"}</button>
        </div>
        <details className="mt-2 px-1 text-sm text-ink-soft">
          <summary className="cursor-pointer select-none">Poser une question précise (facultatif)</summary>
          <input id="prisme-question" className="mt-2 h-10 w-full rounded-[10px] border border-line bg-paper px-3 outline-none" maxLength={500}
            placeholder="ex. Que disent les clientes du packaging Armani face à Dior ?" value={question} onChange={(e) => setQuestion(e.target.value)} />
        </details>
        {!!sujets.length && !d && !busy && (
          <div className="mt-3 flex flex-wrap gap-2 px-1">
            <span className="text-[13px] text-ink-faint">Sujets disponibles :</span>
            {sujets.slice(0, 8).map((s) => <button type="button" key={s} onClick={() => analyser(undefined, s)} className="press rounded-full border border-line px-3 py-0.5 text-[13px] hover:border-[#b98a5e]">{s}</button>)}
          </div>
        )}
      </form>
      {error && <ErrorText>{error}</ErrorText>}
      {busy && (
        <div className="space-y-4" aria-live="polite">
          <div className="flex items-center gap-3 rounded-[14px] bg-[#1b1411] px-5 py-4 text-white">
            <Sparkles size={18} className="animate-pulse text-[#d9a35e]" aria-hidden />
            <span>Prisme travaille · <span className="text-[#e9ddd1]">{ETAPES[etape]}</span></span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
          <div className="grid gap-5 lg:grid-cols-2"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
        </div>
      )}
      {d && (
        <p className="flex flex-wrap items-center gap-2 rounded-[12px] border border-line bg-paper px-4 py-2.5 text-sm" role="status">
          <History size={15} className="text-ink-faint" aria-hidden />
          {d.analyse_id ? (
            <>Analyse enregistrée dans l&apos;historique Social listening.<Link href={`/social/${d.analyse_id}`} className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline">La retrouver<ArrowRight size={13} aria-hidden /></Link></>
          ) : (
            <span className="text-ink-soft">Cette analyse n&apos;a pas pu être enregistrée dans l&apos;historique.</span>
          )}
        </p>
      )}
      {d && <PrismeDashboard d={d} />}
      </>}
    </div>
  );
}

export default function PrismePage() {
  return (
    <Private>
      <Prisme />
    </Private>
  );
}
