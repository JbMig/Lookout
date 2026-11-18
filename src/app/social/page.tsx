"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, fmtDate } from "@/lib/client";
import { Private } from "@/components/Session";
import { ChevronRight, Radar } from "lucide-react";
import { Card, CardHead, Empty, ErrorText, Field, PageHeader, Pill, Skeleton, btnAccent, inputCls } from "@/components/ui";
import type { Veille } from "@/lib/social";

const STATUT: Record<Veille["statut"], { label: string; tone: "wait" | "ok" | "bad" | "neutral" }> = {
  en_cours: { label: "En cours", tone: "wait" },
  termine: { label: "Terminée", tone: "ok" },
  partiel: { label: "Partielle", tone: "neutral" },
  echec: { label: "Échec", tone: "bad" },
};

function Veilles() {
  const [veilles, setVeilles] = useState<Veille[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [sujet, setSujet] = useState("");
  const [pays, setPays] = useState("FR");
  const [mode, setMode] = useState("economique");
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      api<{ veilles: Veille[] }>("/api/social")
        .then((r) => {
          setVeilles(r.veilles);
          setListError(null);
        })
        .catch((e) => setListError(e.message)),
    [],
  );
  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // suit les veilles en cours
    return () => clearInterval(t);
  }, [load]);

  async function lancer(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/social", { method: "POST", json: { sujet, pays, mode } });
      setSujet("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-7">
      <PageHeader
        title="Social listening"
        meta={<span>Ce qui se dit sur TikTok, Instagram, YouTube et Google, analysé par des IA Hugging Face</span>}
      />
      <Card>
        <CardHead title="Nouvelle veille" sub="Elle tourne en arrière-plan (10 à 15 min) ; vous pouvez fermer la page." />
        <form onSubmit={lancer} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_110px] lg:grid-cols-[minmax(0,1fr)_110px_minmax(0,300px)_auto] lg:items-end">
          <Field label="Sujet">
            <input className={inputCls} value={sujet} onChange={(e) => setSujet(e.target.value)} placeholder="blush de luxe" required minLength={2} />
          </Field>
          <Field label="Pays">
            <select className={inputCls} value={pays} onChange={(e) => setPays(e.target.value)}>
              {["FR", "US", "GB", "DE"].map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2 lg:col-span-1">
            <Field label="Sources">
              <select className={`${inputCls} truncate`} value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="economique">Économique : TikTok (HF), YouTube, Google</option>
                <option value="complet">Complet : + TikTok et Instagram récents</option>
                <option value="secours">Données déjà collectées</option>
              </select>
            </Field>
          </div>
          <button className={`${btnAccent} py-2.5 sm:col-span-2 lg:col-span-1`} disabled={busy}><Radar size={16} aria-hidden />{busy ? "Lancement…" : "Lancer la veille"}</button>
        </form>
        {error && <ErrorText>{error}</ErrorText>}
      </Card>

      {!veilles && listError ? (
        <Empty title="Veilles indisponibles pour le moment">{listError}</Empty>
      ) : !veilles ? (
        <Skeleton className="h-60" />
      ) : !veilles.length ? (
        <Empty title="Aucune veille pour l'instant">Lancez une première veille sur un produit ou une catégorie.</Empty>
      ) : (
        <Card flush>
          <ul className="divide-y divide-line">
            {veilles.map((v) => (
              <li key={v.id}>
                <Link href={`/social/${v.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-ground">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{v.sujet} <span className="font-normal text-ink-faint">· {v.pays}</span></p>
                    <p className="text-[13px] text-ink-faint">
                      {fmtDate(v.started_at)}
                      {v.stats?.videos != null && ` · ${v.stats.videos} vidéos · ${v.stats.commentaires ?? 0} commentaires`}
                      {v.statut === "en_cours" && v.etape && ` · étape : ${v.etape}`}
                    </p>
                  </div>
                  <Pill tone={STATUT[v.statut]?.tone ?? "neutral"}>{STATUT[v.statut]?.label ?? v.statut}</Pill>
                  <ChevronRight size={16} className="text-ink-faint" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

export default function SocialPage() {
  return (
    <Private>
      <Veilles />
    </Private>
  );
}
