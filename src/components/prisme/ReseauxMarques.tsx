"use client";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight } from "lucide-react";
import type { MarqueReseaux, Reseaux } from "@/lib/reseaux";

const compact = (v: number) => new Intl.NumberFormat("fr-FR", { notation: v >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(v);
const TICK = { fontSize: 14, fill: "#4f5d73" };
const TIP = { contentStyle: { borderRadius: 10, border: "1px solid #e4e6eb", fontSize: 13 }, cursor: { fill: "rgb(19 35 63 / 0.05)" } };
const PF: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube" };
type Filtre = "toutes" | "loreal" | "concurrents";

function Graph({ titre, mesure, data, cle, unite }: { titre: string; mesure: string; data: MarqueReseaux[]; cle: "engagement_moy" | "vues_moy" | "avis_positifs_pct"; unite: string }) {
  const rows = data.filter((m) => m[cle] != null).sort((a, b) => Number(b[cle]) - Number(a[cle])).map((m) => ({ marque: m.marque, v: Number(m[cle]), loreal: m.est_loreal }));
  return (
    <section className="min-w-0 rounded-[16px] border border-line bg-paper p-5">
      <h3 className="text-[19px] font-semibold">{titre}</h3>
      <p className="mb-3 mt-1 text-[14.5px] leading-snug text-ink-soft">{mesure}</p>
      <p className="mb-2 flex gap-4 text-[13.5px] text-ink-soft"><span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-[#eb6834]" />Groupe L&apos;Oréal</span><span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-[#b8bfca]" />Concurrents</span></p>
      <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 30)}>
        <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 16 }}>
          <CartesianGrid stroke="#eef0f3" horizontal={false} />
          <XAxis type="number" tick={TICK} tickFormatter={(v) => (unite === "vues" ? compact(v) : `${v}`)} />
          <YAxis type="category" dataKey="marque" tick={TICK} width={130} />
          <Tooltip {...TIP} formatter={(v) => [unite === "vues" ? `${compact(Number(v))} vues` : `${v} %`, titre]} />
          <Bar dataKey="v" radius={[0, 5, 5, 0]}>{rows.map((r, i) => <Cell key={i} fill={r.loreal ? "#eb6834" : "#b8bfca"} />)}</Bar>
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}

function Carte({ m }: { m: MarqueReseaux }) {
  return (
    <article className={`min-w-0 rounded-[18px] border p-5 ${m.est_loreal ? "border-amber/50 bg-gradient-to-br from-amber-wash to-paper" : "border-line bg-paper"}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-xl font-semibold tracking-[-0.01em]">{m.marque}</h4>
          <p className="text-[14px] text-ink-soft">{compact(m.abonnes)} abonnés · {m.publications} publications analysées</p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${m.est_loreal ? "bg-amber text-night" : "bg-ground text-ink-soft"}`}>{m.est_loreal ? "Groupe L'Oréal" : "Concurrent"}</span>
      </div>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {m.comptes.map((c) => (
          <li key={c.plateforme + c.compte}><a href={c.url ?? "#"} target="_blank" rel="noopener noreferrer" className="press inline-flex items-center gap-1 rounded-full border border-line bg-paper px-2.5 py-0.5 text-[12.5px] hover:border-amber">{PF[c.plateforme]} · {compact(c.abonnes)}<ArrowUpRight size={12} /></a></li>
        ))}
      </ul>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-paper/80 p-2"><dt className="text-[12.5px] text-ink-soft">engagement</dt><dd className="text-lg font-semibold">{m.engagement_moy == null ? "—" : `${m.engagement_moy} %`}</dd></div>
        <div className="rounded-xl bg-paper/80 p-2"><dt className="text-[12.5px] text-ink-soft">vues / post</dt><dd className="text-lg font-semibold">{m.vues_moy == null ? "—" : compact(m.vues_moy)}</dd></div>
        <div className="rounded-xl bg-paper/80 p-2"><dt className="text-[12.5px] text-ink-soft">avis positifs</dt><dd className={`text-lg font-semibold ${m.avis_positifs_pct != null && m.avis_positifs_pct < 60 ? "text-bad" : "text-ok"}`}>{m.avis_positifs_pct == null ? "—" : `${m.avis_positifs_pct} %`}</dd></div>
      </dl>
      {!!Object.keys(m.contenus).length && (
        <p className="mt-3 text-[12.5px] text-ink-soft"><b>Ce qu&apos;ils publient :</b> {Object.entries(m.contenus).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} (${v})`).join(" · ")}</p>
      )}
      {!!m.hashtags.length && <p className="mt-1 truncate text-[12.5px] text-ink-faint">{m.hashtags.join(" ")}</p>}
      {!!m.top.length && (
        <ul className="mt-3 grid grid-cols-4 gap-1.5">
          {m.top.map((p, i) => (
            <li key={i}><a href={p.url} target="_blank" rel="noopener noreferrer" title={p.legende} className="press group relative block aspect-[3/4] overflow-hidden rounded-lg bg-gradient-to-br from-night to-[#8E3557]">
              {p.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = "none"; }} className="h-full w-full object-cover transition group-hover:scale-105" />
              )}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-4 text-[11px] font-semibold text-white">{p.vues ? `${compact(p.vues)} vues` : `${compact(p.likes)} ♥`}</span>
            </a></li>
          ))}
        </ul>
      )}
      {!!m.verbatims.length && (
        <ul className="mt-3 space-y-1.5">
          {m.verbatims.slice(0, 2).map((c, i) => (
            <li key={i} className={`rounded-lg border-l-[3px] bg-paper/80 px-2.5 py-1.5 text-[12.5px] ${c.sentiment === "positif" ? "border-ok" : "border-bad"}`}>« {c.texte} »</li>
          ))}
        </ul>
      )}
    </article>
  );
}

/** Onglet « Réseaux des marques » : comptes officiels L'Oréal vs concurrents. */
export function ReseauxMarques({ r }: { r: Reseaux }) {
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const ms = r.marques.filter((m) => filtre === "toutes" || (filtre === "loreal" ? m.est_loreal : !m.est_loreal));
  const moy = (rows: MarqueReseaux[], k: "engagement_moy" | "avis_positifs_pct") => {
    const v = rows.map((m) => m[k]).filter((x): x is number => x != null);
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  };
  const L = r.marques.filter((m) => m.est_loreal), Co = r.marques.filter((m) => !m.est_loreal);
  return (
    <div className="w-full min-w-0 [contain:inline-size] space-y-6">
      <header className="relative overflow-hidden rounded-[20px] bg-night p-6 text-white md:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle, #F2A33A, transparent 65%)" }} />
        <p className="relative text-[12.5px] font-semibold uppercase tracking-[0.1em] text-amber">Réseaux des marques</p>
        <h2 className="relative mt-2 max-w-3xl text-[clamp(24px,3.2vw,36px)] font-semibold leading-[1.12] tracking-[-0.025em] text-balance">Ce que publient les comptes officiels, et comment leur public réagit</h2>
        <p className="relative mt-3 max-w-2xl text-night-text">{r.marques.length} marques · {r.publications} publications récentes sur TikTok, Instagram et YouTube · {compact(r.commentaires)} commentaires lus par l&apos;IA. Seuls les comptes au badge « vérifié » sont analysés.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[["Engagement moyen · L'Oréal", moy(L, "engagement_moy"), "%", true], ["Engagement moyen · concurrents", moy(Co, "engagement_moy"), "%", false],
          ["Avis positifs · L'Oréal", moy(L, "avis_positifs_pct"), "%", true], ["Avis positifs · concurrents", moy(Co, "avis_positifs_pct"), "%", false]].map(([l, v, u, lo]) => (
          <div key={String(l)} className={`rounded-[16px] border p-5 ${lo ? "border-amber/50 bg-gradient-to-br from-amber-wash to-paper" : "border-line bg-paper"}`}>
            <p className={`text-[36px] font-semibold leading-none tracking-[-0.02em] ${lo ? "text-amber-dark" : "text-ink"}`}>{v == null ? "—" : `${String(v).replace(".", ",")} ${u}`}</p>
            <p className="mt-2 text-[15px] font-medium">{String(l)}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer les marques">
        {(["toutes", "loreal", "concurrents"] as Filtre[]).map((f) => (
          <button key={f} onClick={() => setFiltre(f)} aria-pressed={filtre === f} className={`press rounded-full border px-4 py-1.5 text-sm font-medium ${filtre === f ? "border-night bg-night text-white" : "border-line bg-paper text-ink-soft"}`}>
            {{ toutes: "Toutes les marques", loreal: "Groupe L'Oréal", concurrents: "Concurrents" }[f]}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Graph titre="Engagement moyen" mesure="(likes + commentaires) ÷ vues, moyenne des publications vidéo de la marque (tous réseaux)." data={ms} cle="engagement_moy" unite="%" />
        <Graph titre="Vues par publication" mesure="Vues moyennes des publications vidéo récentes de la marque." data={ms} cle="vues_moy" unite="vues" />
        <Graph titre="Avis positifs" mesure="Part des commentaires positifs parmi les commentaires positifs ou négatifs (au moins 10 commentaires)." data={ms} cle="avis_positifs_pct" unite="%" />
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{ms.map((m) => <Carte key={m.marque} m={m} />)}</div>
      <p className="text-xs text-ink-faint">Données : dernières publications des comptes officiels vérifiés (collecte Apify et API YouTube), commentaires classés par des modèles Hugging Face. Dernière publication collectée : {r.derniere_publication ? new Date(r.derniere_publication).toLocaleDateString("fr-FR") : "—"}.</p>
    </div>
  );
}
