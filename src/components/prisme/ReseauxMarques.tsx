"use client";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight, X } from "lucide-react";
import type { MarqueReseaux, Reseaux } from "@/lib/reseaux";

const compact = (v: number) => new Intl.NumberFormat("fr-FR", { notation: v >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(v);
const TICK = { fontSize: 15, fill: "#5e4f45" };
const SERIF = "[font-family:'Cormorant_Garamond',Georgia,serif]";
const fr = (v: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(v);
const TIP = { contentStyle: { borderRadius: 10, border: "1px solid #e6dccf", fontSize: 13 }, cursor: { fill: "rgb(27 20 17 / 0.05)" } };
const PF: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube" };
type Filtre = "toutes" | "loreal" | "concurrents";

function Graph({ titre, mesure, data, cle, unite }: { titre: string; mesure: string; data: MarqueReseaux[]; cle: "engagement_moy" | "vues_moy" | "avis_positifs_pct"; unite: string }) {
  const rows = data.filter((m) => m[cle] != null).sort((a, b) => Number(b[cle]) - Number(a[cle])).map((m) => ({ marque: m.marque, v: Number(m[cle]), loreal: m.est_loreal }));
  return (
    <section className="min-w-0 rounded-[16px] border border-line bg-paper p-5">
      <h3 className={`${SERIF} text-[26px] font-semibold leading-tight`}>{titre}</h3>
      <p className="mb-3 mt-1 text-[14.5px] leading-snug text-ink-soft">{mesure}</p>
      <p className="mb-2 flex gap-4 text-[13.5px] text-ink-soft"><span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-[#a9471f]" />Groupe L&apos;Oréal</span><span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-[#cfc3b6]" />Concurrents</span></p>
      <ResponsiveContainer width="100%" height={Math.max(260, rows.length * 34)}>
        <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 16 }}>
          <CartesianGrid stroke="#efe7de" horizontal={false} />
          <XAxis type="number" tick={TICK} tickFormatter={(v) => (unite === "vues" ? compact(v) : `${fr(v)} %`)} />
          <YAxis type="category" dataKey="marque" tick={TICK} width={140} />
          <Tooltip {...TIP} formatter={(v) => [unite === "vues" ? `${compact(Number(v))} vues` : `${fr(Number(v))} %`, titre]} />
          <Bar isAnimationActive={false} dataKey="v" radius={[0, 5, 5, 0]}>{rows.map((r, i) => <Cell key={i} fill={r.loreal ? "#a9471f" : "#cfc3b6"} />)}</Bar>
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}

const pctFr = (v: number | null) => (v == null ? "—" : `${fr(v)} %`);

function Chiffres({ m, grand = false }: { m: MarqueReseaux; grand?: boolean }) {
  const c = grand ? "text-[26px]" : "text-[21px]";
  return (
    <dl className="grid grid-cols-3 gap-2 text-center">
      <div className="rounded-xl bg-paper/80 p-2"><dt className="text-[13px] text-ink-soft">engagement</dt><dd className={`${c} font-semibold`}>{pctFr(m.engagement_moy)}</dd></div>
      <div className="rounded-xl bg-paper/80 p-2"><dt className="text-[13px] text-ink-soft">vues / post</dt><dd className={`${c} font-semibold`}>{m.vues_moy == null ? "—" : compact(m.vues_moy)}</dd></div>
      <div className="rounded-xl bg-paper/80 p-2"><dt className="text-[13px] text-ink-soft">avis positifs</dt><dd className={`${c} font-semibold ${m.avis_positifs_pct != null && m.avis_positifs_pct < 60 ? "text-[#a9471f]" : "text-[#4a382c]"}`}>{pctFr(m.avis_positifs_pct)}</dd></div>
    </dl>
  );
}

const Badge = ({ m }: { m: MarqueReseaux }) => (
  <span className={`shrink-0 rounded-full px-3 py-1 text-[12.5px] font-semibold ${m.est_loreal ? "bg-[#a9471f] text-white" : "bg-ground text-ink-soft"}`}>{m.est_loreal ? "Groupe L'Oréal" : "Concurrent"}</span>
);

/** Carte résumée : tout le bloc est un bouton (doigt ou souris) qui ouvre la fiche complète. */
function Carte({ m, ouvrir }: { m: MarqueReseaux; ouvrir: () => void }) {
  return (
    <button type="button" onClick={ouvrir} aria-haspopup="dialog" aria-label={`Ouvrir la fiche ${m.marque}`}
      className={`press group w-full min-w-0 rounded-[18px] border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-18px_rgb(27_20_17/0.5)] ${m.est_loreal ? "border-[#b98a5e]/50 bg-gradient-to-br from-[#f4ebe1] to-paper" : "border-line bg-paper"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className={`${SERIF} text-[30px] font-semibold leading-none`}>{m.marque}</h4>
          <p className="mt-1.5 text-[15px] text-ink-soft">{compact(m.abonnes)} abonnés · {m.publications} publication{m.publications > 1 ? "s" : ""}</p>
        </div>
        <Badge m={m} />
      </div>
      <div className="mt-4"><Chiffres m={m} /></div>
      {!!m.top.length && (
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {m.top.map((p, i) => (
            <span key={i} className="relative block aspect-[3/4] overflow-hidden rounded-lg bg-gradient-to-br from-[#1b1411] to-[#a9471f]">
              {p.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = "none"; }} className="h-full w-full object-cover" />
              )}
            </span>
          ))}
        </div>
      )}
      <span className="mt-4 inline-flex items-center gap-1.5 text-[15px] font-semibold text-[#7a4b2e] group-hover:underline">Voir la fiche complète <ArrowUpRight size={15} aria-hidden /></span>
    </button>
  );
}

/** Fiche complète : fenêtre centrée sur ordinateur, panneau plein écran qui monte du bas sur téléphone. */
function Fiche({ m, fermer }: { m: MarqueReseaux; fermer: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && fermer();
    window.addEventListener("keydown", k);
    const avant = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = avant; };
  }, [fermer]);
  return (
    <div role="dialog" aria-modal="true" aria-label={`Fiche ${m.marque}`} className="fixed inset-0 z-50 flex items-end justify-center bg-[#1b1411]/70 backdrop-blur-sm sm:items-center sm:p-6" onClick={fermer}>
      <div className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto overscroll-contain rounded-t-[22px] bg-paper p-5 shadow-2xl sm:rounded-[22px] sm:p-7" onClick={(e) => e.stopPropagation()}>
        <div className="sticky -top-5 z-10 -mx-5 -mt-5 mb-3 flex items-start justify-between gap-3 bg-paper px-5 pb-3 pt-5 sm:-top-7 sm:-mx-7 sm:-mt-7 sm:px-7 sm:pt-7">
          <div className="min-w-0">
            <h3 className={`${SERIF} text-[38px] font-semibold leading-none`}>{m.marque}</h3>
            <p className="mt-1.5 text-[15.5px] text-ink-soft">{compact(m.abonnes)} abonnés · {m.publications} publications analysées · {compact(m.commentaires_lus)} commentaires lus</p>
          </div>
          <div className="flex shrink-0 items-center gap-2"><Badge m={m} />
            <button type="button" onClick={fermer} aria-label="Fermer" className="press grid h-11 w-11 place-items-center rounded-full bg-ground text-ink hover:bg-line"><X size={20} /></button>
          </div>
        </div>
        <ul className="flex flex-wrap gap-2">
          {m.comptes.map((c) => (
            <li key={c.plateforme + c.compte}><a href={c.url ?? undefined} target="_blank" rel="noopener noreferrer" className="press inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-paper px-4 text-[15px] hover:border-[#b98a5e]">{PF[c.plateforme] ?? c.plateforme} · {compact(c.abonnes)} abonnés<ArrowUpRight size={14} /></a></li>
          ))}
        </ul>
        <div className="mt-5"><Chiffres m={m} grand /></div>
        {!!Object.keys(m.contenus).length && (
          <p className="mt-5 text-[16px]"><b>Ce qu&apos;ils publient :</b> {Object.entries(m.contenus).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} (${v})`).join(" · ")}</p>
        )}
        {!!m.hashtags.length && <p className="mt-2 text-[15px] text-ink-soft">{m.hashtags.join("  ")}</p>}
        {!!m.top.length && (
          <>
            <h4 className={`${SERIF} mt-6 text-[26px] font-semibold`}>Leurs publications les plus vues</h4>
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {m.top.map((p, i) => (
                <li key={i}><a href={p.url} target="_blank" rel="noopener noreferrer" className="press group block">
                  <span className="relative block aspect-[3/4] overflow-hidden rounded-xl bg-gradient-to-br from-[#1b1411] to-[#a9471f]">
                    {p.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = "none"; }} className="h-full w-full object-cover transition group-hover:scale-105" />
                    )}
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2 pb-1.5 pt-6 text-[13px] font-semibold text-white">{PF[p.plateforme] ?? p.plateforme} · {p.vues ? `${compact(p.vues)} vues` : `${compact(p.likes)} j'aime`}</span>
                  </span>
                  <span className="mt-1.5 line-clamp-2 block text-[13.5px] text-ink-soft">{p.legende || "—"}</span>
                </a></li>
              ))}
            </ul>
          </>
        )}
        {!!m.verbatims.length && (
          <>
            <h4 className={`${SERIF} mt-6 text-[26px] font-semibold`}>Ce que répond leur public</h4>
            <ul className="mt-3 space-y-2">
              {m.verbatims.map((c, i) => (
                <li key={i} className={`rounded-xl border-l-[3px] bg-ground px-4 py-2.5 text-[15.5px] leading-relaxed ${c.sentiment === "positif" ? "border-[#9a8676]" : "border-[#a9471f]"}`}>
                  « {c.texte} »{c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-0.5 text-[13px] text-ink-faint underline">voir<ArrowUpRight size={12} /></a>}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

/** Onglet « Réseaux des marques » : comptes officiels L'Oréal vs concurrents. */
export function ReseauxMarques({ r }: { r: Reseaux }) {
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const [ouverte, setOuverte] = useState<MarqueReseaux | null>(null);
  const ms = r.marques.filter((m) => filtre === "toutes" || (filtre === "loreal" ? m.est_loreal : !m.est_loreal));
  const moy = (rows: MarqueReseaux[], k: "engagement_moy" | "avis_positifs_pct") => {
    const v = rows.map((m) => m[k]).filter((x): x is number => x != null);
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  };
  const L = r.marques.filter((m) => m.est_loreal), Co = r.marques.filter((m) => !m.est_loreal);
  return (
    <div className="w-full min-w-0 [contain:inline-size] space-y-6">
      <header className="relative overflow-hidden rounded-[20px] bg-[#1b1411] p-6 text-white md:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle, #a9471f, transparent 65%)" }} />
        <p className="relative text-[12.5px] font-semibold uppercase tracking-[0.1em] text-[#d9a35e]">Réseaux des marques</p>
        <h2 className={`${SERIF} relative mt-2 max-w-3xl text-[clamp(30px,4vw,46px)] font-semibold leading-[1.05] text-balance`}>Ce que publient les comptes officiels, et comment leur public réagit</h2>
        <p className="relative mt-3 max-w-2xl text-[#e9ddd1]">{r.marques.length} marques · {r.publications} publications récentes sur TikTok, Instagram et YouTube · {compact(r.commentaires)} commentaires lus par l&apos;IA. Seuls les comptes au badge « vérifié » sont analysés.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[["Engagement moyen · L'Oréal", moy(L, "engagement_moy"), "%", true], ["Engagement moyen · concurrents", moy(Co, "engagement_moy"), "%", false],
          ["Avis positifs · L'Oréal", moy(L, "avis_positifs_pct"), "%", true], ["Avis positifs · concurrents", moy(Co, "avis_positifs_pct"), "%", false]].map(([l, v, u, lo]) => (
          <div key={String(l)} className={`rounded-[16px] border p-5 ${lo ? "border-[#b98a5e]/50 bg-gradient-to-br from-[#f4ebe1] to-paper" : "border-line bg-paper"}`}>
            <p className={`${SERIF} text-[44px] font-semibold leading-none ${lo ? "text-[#7a4b2e]" : "text-ink"}`}>{v == null ? "—" : `${String(v).replace(".", ",")} ${u}`}</p>
            <p className="mt-2 text-[15px] font-medium">{String(l)}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer les marques">
        {(["toutes", "loreal", "concurrents"] as Filtre[]).map((f) => (
          <button key={f} onClick={() => setFiltre(f)} aria-pressed={filtre === f} className={`press rounded-full border px-4 py-1.5 text-sm font-medium ${filtre === f ? "border-[#1b1411] bg-[#1b1411] text-white" : "border-line bg-paper text-ink-soft"}`}>
            {{ toutes: "Toutes les marques", loreal: "Groupe L'Oréal", concurrents: "Concurrents" }[f]}
          </button>
        ))}
      </div>

      {/* deux graphiques par rangée : plus lisible en projection */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Graph titre="Engagement moyen" mesure="(likes + commentaires) ÷ vues, moyenne des publications vidéo de la marque (tous réseaux)." data={ms} cle="engagement_moy" unite="%" />
        <Graph titre="Avis positifs" mesure="Part des commentaires positifs parmi les commentaires positifs ou négatifs (au moins 10 commentaires)." data={ms} cle="avis_positifs_pct" unite="%" />
        <div className="lg:col-span-2"><Graph titre="Vues par publication" mesure="Vues moyennes des publications vidéo récentes de la marque." data={ms} cle="vues_moy" unite="vues" /></div>
      </div>

      <h3 className="px-1 text-[30px] leading-none">Les marques une par une <span className="font-sans text-[15px] font-normal text-ink-soft">· touchez une carte pour ouvrir sa fiche</span></h3>
      <div className="grid gap-5 md:grid-cols-2">{ms.map((m) => <Carte key={m.marque} m={m} ouvrir={() => setOuverte(m)} />)}</div>
      {ouverte && <Fiche m={ouverte} fermer={() => setOuverte(null)} />}
      <p className="text-xs text-ink-faint">Données : dernières publications des comptes officiels vérifiés (collecte Apify et API YouTube), commentaires classés par des modèles Hugging Face. Dernière publication collectée : {r.derniere_publication ? new Date(r.derniere_publication).toLocaleDateString("fr-FR") : "—"}.</p>
    </div>
  );
}
