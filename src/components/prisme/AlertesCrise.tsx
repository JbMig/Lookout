"use client";
import { useState } from "react";
import { AlertTriangle, ArrowUpRight, ShieldAlert } from "lucide-react";
import type { Alertes, Gravite } from "@/lib/alertes";

const STYLE: Record<Gravite, { bande: string; badge: string; libelle: string }> = {
  critique: { bande: "bg-bad", badge: "bg-bad text-white", libelle: "Critique" },
  "élevée": { bande: "bg-amber", badge: "bg-amber text-night", libelle: "Élevée" },
  "à surveiller": { bande: "bg-[#8597b2]", badge: "bg-ground text-ink-soft", libelle: "À surveiller" },
};
const TYPE: Record<string, string> = { viral_negatif: "Contenu viral négatif", terme_sensible: "Termes sensibles", aspect_critique: "Aspect produit critiqué", compte_officiel: "Compte officiel" };

/** Onglet « Alertes » : veille de crise sur les marques du groupe L'Oréal. */
export function AlertesCrise({ a }: { a: Alertes }) {
  const marques = [...new Set(a.alertes.map((x) => x.marque))].sort();
  const [marque, setMarque] = useState<string>("toutes");
  const liste = a.alertes.filter((x) => marque === "toutes" || x.marque === marque);
  const compte = (g: Gravite) => liste.filter((x) => x.gravite === g).length;
  return (
    <div className="w-full min-w-0 [contain:inline-size] space-y-6">
      <header className="relative overflow-hidden rounded-[20px] bg-night p-6 text-white md:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle, #B33939, transparent 65%)" }} />
        <p className="relative flex items-center gap-2 text-[12.5px] font-semibold uppercase tracking-[0.1em] text-[#f2a3a3]"><ShieldAlert size={15} aria-hidden />Veille de crise · groupe L&apos;Oréal</p>
        <h2 className="relative mt-2 max-w-3xl text-[clamp(24px,3.2vw,36px)] font-semibold leading-[1.12] tracking-[-0.025em] text-balance">
          {compte("critique") ? `${compte("critique")} ${compte("critique") > 1 ? "signaux critiques" : "signal critique"} à traiter` : "Aucun signal critique"}
        </h2>
        <p className="relative mt-3 max-w-2xl text-night-text">Marques surveillées : {marques.length ? marques.join(", ") : "—"} et toutes les autres marques du groupe présentes dans les données.</p>
        <p className="relative mt-2 max-w-2xl text-[14px] text-night-muted">Signaux détectés automatiquement sur toutes les données collectées : contenus négatifs à forte audience, termes sensibles dans les commentaires, aspects produit majoritairement critiqués, réactions négatives sur les comptes officiels.</p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        {(["critique", "élevée", "à surveiller"] as Gravite[]).map((g) => (
          <div key={g} className="rounded-[16px] border border-line bg-paper p-4">
            <div className="flex items-center gap-2"><i className={`h-2.5 w-2.5 rounded-full ${STYLE[g].bande}`} /><span className="text-sm font-medium">{STYLE[g].libelle}</span></div>
            <p className="mt-1 text-[34px] font-semibold leading-none">{compte(g)}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par marque">
        {["toutes", ...marques].map((m) => (
          <button key={m} onClick={() => setMarque(m)} aria-pressed={marque === m} className={`press rounded-full border px-4 py-1.5 text-sm font-medium ${marque === m ? "border-night bg-night text-white" : "border-line bg-paper text-ink-soft"}`}>{m === "toutes" ? "Toutes les marques" : m}</button>
        ))}
      </div>

      <ul className="space-y-3">
        {liste.map((x) => (
          <li key={x.id} className="relative overflow-hidden rounded-[16px] border border-line bg-paper p-5 pl-6">
            <i className={`absolute inset-y-0 left-0 w-1.5 ${STYLE[x.gravite].bande}`} aria-hidden />
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${STYLE[x.gravite].badge}`}>{STYLE[x.gravite].libelle}</span>
              <span className="rounded-full bg-ground px-2.5 py-0.5 text-[11.5px] font-medium text-ink-soft">{TYPE[x.type]}</span>
              <span className="text-[12.5px] text-ink-faint">{x.marque}{x.date ? ` · ${new Date(x.date).toLocaleDateString("fr-FR")}` : ""}</span>
            </div>
            <h3 className="mt-2 flex items-start gap-2 text-lg font-semibold"><AlertTriangle size={17} className="mt-0.5 shrink-0 text-bad" aria-hidden />{x.titre}</h3>
            <p className="mt-1 text-[15px] text-ink-soft">{x.constat}</p>
            {!!x.exemples.length && (
              <ul className="mt-3 grid gap-2 md:grid-cols-2">
                {x.exemples.map((e, i) => (
                  <li key={i} className="rounded-lg bg-ground px-3 py-2 text-[14.5px]">
                    « {e.texte} »
                    <span className="mt-1 flex items-center justify-between text-xs text-ink-faint">{e.detail}{e.url && <a href={e.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline">source<ArrowUpRight size={12} /></a>}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[15px]"><b>Action recommandée :</b> {x.action}</p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink-faint">Seuils : contenu négatif ≥ 100 000 vues ; termes sensibles ≥ 3 commentaires ou ≥ 200 j&apos;aime ; aspect ≥ 15 avis dont ≥ 60 % négatifs ; publication officielle ≥ 8 avis dont ≥ 40 % négatifs. Commentaires classés par des modèles Hugging Face ; chaque alerte est à confirmer par l&apos;équipe.</p>
    </div>
  );
}
