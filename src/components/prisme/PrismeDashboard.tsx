"use client";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight, ChevronDown, Hash, Lightbulb, MessageCircleQuestion, Play, ShoppingBag, ThumbsDown, TrendingUp, X } from "lucide-react";
import { Skeleton } from "@/components/ui";
import { estLuxe } from "@/lib/marques";
import type { DashboardPrisme, DetailProduit, FocusMarque } from "@/lib/prisme-dashboard";

type Ligne = Record<string, unknown>;
const n = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0) || 0);
const compact = (v: number) => new Intl.NumberFormat("fr-FR", { notation: v >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(v);
const pct = (v: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v)} %`;
const TICK = { fontSize: 14, fill: "#4f5d73" };   // lisible à l'écran pendant l'oral
const TIP = { contentStyle: { borderRadius: 10, border: "1px solid #e4e6eb", fontSize: 14 }, cursor: { fill: "rgb(19 35 63 / 0.05)" } };
const PLATEFORME: Record<string, string> = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube" };

function Bloc({ titre, mesure, children, className = "" }: { titre: string; mesure: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-[16px] border border-line bg-paper p-5 ${className}`}>
      <h3 className="text-[19px] font-semibold tracking-[-0.01em]">{titre}</h3>
      <p className="mb-4 mt-1 text-[14.5px] leading-snug text-ink-soft">{mesure}</p>
      {children}
    </section>
  );
}

const idTikTok = (url: unknown) => String(url ?? "").match(/video\/(\d+)/)?.[1] ?? null;

/** Lecteur officiel TikTok (intégration prévue par TikTok) dans une fenêtre au-dessus de la page. */
function LecteurTikTok({ id, onClose }: { id: string; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Vidéo TikTok" className="fixed inset-0 z-50 grid place-items-center bg-night/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-[340px]" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="press absolute -top-11 right-0 rounded-full bg-paper px-3 py-1 text-sm font-medium text-ink">Fermer ✕</button>
        <iframe title="Vidéo TikTok" src={`https://www.tiktok.com/player/v1/${id}?music_info=1&description=1&autoplay=1`} allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          className="aspect-[9/16] w-full rounded-[16px] border-0 bg-black shadow-2xl" />
        <a href={`https://www.tiktok.com/@_/video/${id}`} target="_blank" rel="noopener noreferrer" className="mt-2 block text-center text-sm text-white underline">Ouvrir sur TikTok</a>
      </div>
    </div>
  );
}

/** Fiche produit en panneau latéral : chiffres, vidéos qui le citent (cliquables), ce qu'on en dit. */
function PopupProduit({ nom, charger, onClose }: { nom: string; charger: (p: string) => Promise<DetailProduit>; onClose: () => void }) {
  const [p, setP] = useState<DetailProduit | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    charger(nom).then(setP).catch((e) => setErreur((e as Error).message));
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [nom, charger, onClose]);
  return (
    // Panneau latéral NON modal : la page reste visible et utilisable derrière (on garde le contexte).
    <aside role="dialog" aria-modal="false" aria-label={`Fiche produit ${nom}`} className="fixed inset-y-0 right-0 z-50 w-full max-w-[560px] overflow-y-auto border-l border-line bg-paper shadow-[-24px_0_48px_-24px_rgb(19_35_63/0.35)]">
      <div>
        <div className="relative">
          <div className="relative aspect-[16/7] bg-gradient-to-br from-night via-night-3 to-[#8E3557]">
            {p?.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 h-full w-full object-cover" />
            )}
          </div>
          <div className="p-5">
            <button onClick={onClose} aria-label="Fermer" className="press absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-paper/90 text-ink shadow"><X size={18} /></button>
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-amber-dark">{p?.marque || "Produit"}</p>
            <h3 className="mt-1 text-2xl font-semibold leading-tight tracking-[-0.02em] text-balance">{nom}</h3>
            {erreur && <p className="mt-3 text-sm text-bad">{erreur}</p>}
            {!p && !erreur && <p className="mt-3 text-sm text-ink-faint">Chargement de la fiche…</p>}
            {p && (
              <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-ground p-2"><dt className="text-[11px] text-ink-faint">vues</dt><dd className="text-lg font-semibold">{compact(p.stats.vues)}</dd></div>
                <div className="rounded-xl bg-ground p-2"><dt className="text-[11px] text-ink-faint">vidéos · commentaires</dt><dd className="text-lg font-semibold">{p.stats.videos} · {compact(p.stats.commentaires)}</dd></div>
                <div className="rounded-xl bg-ground p-2"><dt className="text-[11px] text-ink-faint">ton des vidéos</dt><dd className={`text-lg font-semibold ${n(p.stats.sentiment) > 0.2 ? "text-ok" : n(p.stats.sentiment) < -0.2 ? "text-bad" : ""}`}>{p.stats.sentiment == null ? "—" : n(p.stats.sentiment) > 0.2 ? "positif" : n(p.stats.sentiment) < -0.2 ? "négatif" : "neutre"}</dd></div>
              </dl>
            )}
            {p && (p.stats.formats.length > 0 || p.stats.finis.length > 0) && <p className="mt-3 text-[13px] text-ink-soft">Format : {[...p.stats.formats, ...p.stats.finis].join(" · ")}</p>}
            {p && Object.keys(p.stats.pays).length > 0 && <p className="mt-1 text-[13px] text-ink-soft">Vu dans : {Object.entries(p.stats.pays).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} (${v})`).join(" · ")}</p>}
            {p && !!p.teintes.length && (
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-ink-faint">Teintes citées</p>
                <ul className="flex flex-wrap gap-1.5">
                  {p.teintes.map((t) => (
                    <li key={t.nom} className="flex items-center gap-1.5 rounded-full border border-line py-0.5 pl-1 pr-2.5 text-[12.5px]">
                      <i className="h-4 w-4 rounded-full border border-line" style={{ background: t.hex ?? "repeating-linear-gradient(45deg,#e4e6eb,#e4e6eb 3px,#fff 3px,#fff 6px)" }} title={t.hex ?? "couleur non lue"} />{t.nom}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        {p && (
          <div className="space-y-5 border-t border-line p-5">
            {!!p.ce_que_disent_les_videos.length && (
              <div>
                <h4 className="mb-2 text-sm font-semibold">Ce que disent les vidéos (résumé par l&apos;IA)</h4>
                <ul className="space-y-1.5 text-[13.5px] text-ink-soft">{p.ce_que_disent_les_videos.map((t, i) => <li key={i} className="rounded-lg bg-ground px-3 py-2">{t}</li>)}</ul>
              </div>
            )}
            {Object.keys(p.intention).length > 0 && (
              <p className="text-[13.5px]"><b>Intention d&apos;achat dans les commentaires :</b> {Object.entries(p.intention).map(([k, v]) => `${v} « ${k} »`).join(" · ")}</p>
            )}
            {!!p.aspects.length && (
              <div>
                <h4 className="mb-2 text-sm font-semibold">Ce qu&apos;on en dit (commentaires de ces vidéos)</h4>
                <ul className="flex flex-wrap gap-2">
                  {p.aspects.map((a) => (
                    <li key={a.aspect} className="rounded-full border border-line px-3 py-1 text-[13px]">{a.aspect} <b className="text-ok">+{a.positif}</b> <b className="text-bad">−{a.negatif}</b></li>
                  ))}
                </ul>
              </div>
            )}
            {!!p.videos.length && (
              <div>
                <h4 className="mb-2 text-sm font-semibold">Vidéos qui en parlent</h4>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {p.videos.slice(0, 6).map((v, i) => (
                    <li key={i}><a href={String(v.url)} target="_blank" rel="noopener noreferrer" className="press flex items-center gap-3 rounded-xl border border-line p-2 hover:border-amber">
                      <span className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-night to-[#8E3557]">
                        {v.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={String(v.image)} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = "none"; }} className="h-full w-full object-cover" />
                        )}
                      </span>
                      <span className="min-w-0 text-[13px]"><b>{compact(n(v.vues))} vues</b> · {PLATEFORME[String(v.plateforme)] ?? String(v.plateforme)}<span className="block truncate text-ink-faint">{v.legende || "—"}</span></span>
                    </a></li>
                  ))}
                </ul>
              </div>
            )}
            {!!p.demandes.length && (
              <div>
                <h4 className="mb-2 text-sm font-semibold">Ce que les gens demandent</h4>
                <ul className="list-disc space-y-1 pl-5 text-[13.5px] text-ink-soft">{p.demandes.map((d, i) => <li key={i}>{d}</li>)}</ul>
              </div>
            )}
            {!!p.commentaires.length && (
              <div>
                <h4 className="mb-2 text-sm font-semibold">Commentaires les plus aimés</h4>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {p.commentaires.map((c, i) => (
                    <li key={i} className={`rounded-xl border-l-[3px] bg-ground px-3 py-2 text-[13px] ${c.sentiment === "positif" ? "border-ok" : "border-bad"}`}>
                      « {c.texte} » <span className="block text-xs text-ink-faint">{compact(n(c.likes))} j&apos;aime{c.url && <> · <a className="underline" href={String(c.url)} target="_blank" rel="noopener noreferrer">voir la vidéo</a></>}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

const DRAPEAU: Record<string, string> = { FR: "France", EU: "Europe (FR, DE, GB, ES, IT)", US: "États-Unis", GB: "Royaume-Uni", DE: "Allemagne" };

const COULEUR_PF: Record<string, string> = { tiktok: "#13233F", instagram: "#8E3557", youtube: "#C8243B" };
/** Répartition des données par plateforme (vidéos et commentaires), en % du total de la veille. */
function Sources({ rows, compact: petit = false }: { rows: Ligne[]; compact?: boolean }) {
  if (!rows.length) return null;
  const ligne = (cle: "videos" | "commentaires", titre: string) => {
    const tot = rows.reduce((x, r) => x + n(r[cle]), 0) || 1;
    return (
      <div>
        <p className="mb-1 flex justify-between text-[12.5px] text-ink-faint"><span>{titre}</span><span>{compact(tot)}</span></p>
        <div className="flex h-3 overflow-hidden rounded-full bg-ground">
          {rows.filter((r) => n(r[cle]) > 0).map((r) => <i key={String(r.platform)} title={`${PLATEFORME[String(r.platform)]} : ${Math.round((100 * n(r[cle])) / tot)} %`} style={{ width: `${(100 * n(r[cle])) / tot}%`, background: COULEUR_PF[String(r.platform)] ?? "#6f7b8e" }} />)}
        </div>
        {!petit && <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-ink-soft">{rows.map((r) => <span key={String(r.platform)}><i className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: COULEUR_PF[String(r.platform)] }} />{PLATEFORME[String(r.platform)]} {Math.round((100 * n(r[cle])) / tot)} %</span>)}</p>}
      </div>
    );
  };
  return <div className="grid gap-3">{ligne("videos", "Vidéos analysées")}{ligne("commentaires", "Commentaires lus")}</div>;
}

function Liste({ titre, rows, cle, nom }: { titre: string; rows: Ligne[]; cle: string; nom: string }) {
  return (
    <div className="min-w-0"><p className="mb-1.5 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-ink-faint">{titre}</p>
      <ol className="space-y-1 text-sm">{rows.slice(0, 5).map((r, i) => <li key={i} className="flex justify-between gap-2"><span className="truncate">{i + 1}. {String(r[nom])}</span><span className="tabular-nums text-ink-faint">{compact(n(r[cle]))}</span></li>)}</ol></div>
  );
}

/** France vs États-Unis : mêmes indicateurs côte à côte. */
function Comparaison({ d }: { d: DashboardPrisme }) {
  const c = d.comparaison;
  if (!c) return null;
  const pdvIci = d.donnees.marques.filter((m) => m.est_loreal).reduce((x, m) => x + n(m.part_de_voix_pct), 0);
  const noms = [...new Set([...d.donnees.marques.slice(0, 6), ...c.marques.slice(0, 6)].map((m) => String(m.marque)))].slice(0, 9);
  const val = (rows: Ligne[], nom: string) => n(rows.find((m) => m.marque === nom)?.part_de_voix_pct);
  const conf = (rows: Ligne[], nom: string) => String(rows.find((m) => m.marque === nom)?.confiance ?? "faible");
  const data = noms.map((nom) => ({ marque: nom, ici: val(d.donnees.marques, nom), la: val(c.marques, nom), fi: conf(d.donnees.marques, nom) === "faible", fl: conf(c.marques, nom) === "faible" }));
  const A = DRAPEAU[d.veille.pays] ?? d.veille.pays, B = DRAPEAU[c.pays] ?? c.pays;
  return (
    <section className="rounded-[20px] border border-line bg-paper p-5">
      <h3 className="text-lg font-semibold tracking-[-0.01em]">{A} vs {B}</h3>
      <p className="mb-4 mt-0.5 text-[13px] leading-snug text-ink-faint">Part de voix calculée au sein de chaque marché (base 100 par marché), comparable quel que soit le volume collecté. Barres atténuées : moins de 20 mentions, significativité limitée.</p>
      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="space-y-3 rounded-[14px] bg-gradient-to-br from-amber-wash to-paper p-4"><p className="text-[12.5px] font-semibold text-ink-faint">{A}</p><p className="text-[34px] font-semibold leading-none text-amber-dark">{pct(Math.round(pdvIci * 10) / 10)}</p><p className="text-[13px] text-ink-soft">de la conversation pour L&apos;Oréal</p></div>
        <div className="space-y-3 rounded-[14px] bg-gradient-to-br from-ground to-paper p-4"><p className="text-[12.5px] font-semibold text-ink-faint">{B}</p><p className="text-[34px] font-semibold leading-none text-night">{pct(c.pdv_loreal)}</p><p className="text-[13px] text-ink-soft">de la conversation pour L&apos;Oréal</p></div>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(240, data.length * 40)}>
        <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16 }} barGap={2}>
          <CartesianGrid stroke="#eef0f3" horizontal={false} />
          <XAxis type="number" tick={TICK} unit=" %" />
          <YAxis type="category" dataKey="marque" tick={TICK} width={130} />
          <Tooltip {...TIP} formatter={(v, k) => [pct(Number(v)), k === "ici" ? A : B]} />
          <Bar isAnimationActive={false} dataKey="ici" name={A} fill="#F2A33A" radius={[0, 4, 4, 0]}>{data.map((x, i) => <Cell key={i} fillOpacity={x.fi ? 0.35 : 1} />)}</Bar>
          <Bar isAnimationActive={false} dataKey="la" name={B} fill="#13233F" radius={[0, 4, 4, 0]}>{data.map((x, i) => <Cell key={i} fillOpacity={x.fl ? 0.35 : 1} />)}</Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-ink-soft"><span className="whitespace-nowrap"><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-amber" />{A}</span><span className="whitespace-nowrap"><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-night" />{B}</span><span>part de voix de chaque marque dans son pays</span></p>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div className="grid gap-4"><Liste titre={`Produits · ${A}`} rows={d.donnees.produits} cle="vues" nom="produit" /><Liste titre={`Hashtags · ${A}`} rows={d.donnees.hashtags} cle="vues" nom="hashtag" /></div>
        <div className="grid gap-4"><Liste titre={`Produits · ${B}`} rows={c.produits} cle="vues" nom="produit" /><Liste titre={`Hashtags · ${B}`} rows={c.hashtags} cle="vues" nom="hashtag" /></div>
      </div>
    </section>
  );
}

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const libMois = (m: string) => `${MOIS[Number(m.slice(5, 7)) - 1] ?? m} ${m.slice(2, 4)}`;

/** Couleurs bien distinctes : L'Oréal en traits pleins orangés, concurrents en pointillés bleu nuit / prune. */
// Palette validée (contrôle daltonisme et séparation réussis) : L'Oréal = orange / jaune, concurrents = bleu / vert.
// Encodage secondaire : traits pleins pour L'Oréal, pointillés pour les concurrents (jamais la couleur seule).
const STYLE_LIGNE = (loreal: boolean, rang: number) => loreal
  ? { stroke: rang === 0 ? "#eb6834" : "#eda100", strokeDasharray: undefined }
  : { stroke: rang === 0 ? "#2a78d6" : "#1baf7a", strokeDasharray: "7 5" };
const LEGENDE = { fontSize: 15, paddingTop: 10 };
const TICK_ORAL = { fontSize: 14, fill: "#4f5d73" };

/** Évolution : part des mentions par mois (5 derniers mois bien fournis) et demande Google (6 mois, lissée). */
function Evolution({ d }: { d: DashboardPrisme }) {
  const e = d.evolution;
  if (!e || (e.mois.length < 2 && e.recherche.length < 8)) return null;
  const rang = (liste: { loreal: boolean }[], i: number) => liste.slice(0, i).filter((x) => x.loreal === liste[i].loreal).length;
  return (
    <section className="space-y-4">
      <h3 className="px-1 text-lg font-semibold tracking-[-0.01em]">Évolution</h3>
      <div className="grid gap-5 lg:grid-cols-2">
        {e.mois.length >= 2 && (
          <Bloc titre="Part des mentions, mois par mois" mesure="Part des vidéos du mois qui citent la marque (en %). Seuls les mois avec au moins 50 vidéos sont affichés. Traits pleins : groupe L'Oréal · pointillés : concurrents.">
            {e.lecture_mois && <p className="-mt-1 mb-3 rounded-lg bg-amber-wash px-3 py-2.5 text-[15.5px] font-medium text-ink">{e.lecture_mois}</p>}
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={e.mois} margin={{ left: -6, right: 16, top: 8 }}>
                <CartesianGrid stroke="#eef0f3" vertical={false} />
                <XAxis dataKey="mois" tick={TICK_ORAL} tickFormatter={libMois} padding={{ left: 12, right: 12 }} />
                <YAxis tick={TICK_ORAL} unit=" %" width={52} />
                <Tooltip {...TIP} labelFormatter={(l) => libMois(String(l))} formatter={(v, k) => [`${String(v).replace(".", ",")} % des vidéos du mois`, String(k)]} />
                <Legend wrapperStyle={LEGENDE} />
                {e.marques.map((m, i) => <Line isAnimationActive={false} key={m.nom} type="monotone" dataKey={m.nom} {...STYLE_LIGNE(m.loreal, rang(e.marques, i))} strokeWidth={2.5} dot={{ r: 4.5, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 7 }} connectNulls />)}
              </LineChart>
            </ResponsiveContainer>
          </Bloc>
        )}
        {e.recherche.length >= 8 && !!e.mots.length && (
          <Bloc titre="Demande sur Google, 6 derniers mois" mesure="Indice Google Trends (100 = semaine la plus forte sur 12 mois), moyenne glissante sur 4 semaines. Seules les recherches avec un volume réel sont affichées.">
            {e.lecture_google && <p className="-mt-1 mb-3 rounded-lg bg-amber-wash px-3 py-2.5 text-[15.5px] font-medium text-ink">{e.lecture_google}</p>}
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={e.recherche} margin={{ left: -6, right: 16, top: 8 }}>
                <CartesianGrid stroke="#eef0f3" vertical={false} />
                <XAxis dataKey="semaine" tick={TICK_ORAL} tickFormatter={(w) => libMois(String(w).slice(0, 7))} minTickGap={40} />
                <YAxis tick={TICK_ORAL} width={40} />
                <Tooltip {...TIP} labelFormatter={(l) => `Semaine du ${new Date(String(l)).toLocaleDateString("fr-FR")}`} />
                <Legend wrapperStyle={LEGENDE} />
                {e.mots.map((k, i) => <Line isAnimationActive={false} key={k.nom} type="monotone" dataKey={k.nom} name={k.nom} {...STYLE_LIGNE(k.loreal, rang(e.mots, i))} strokeWidth={2.5} dot={false} activeDot={{ r: 6 }} />)}
              </LineChart>
            </ResponsiveContainer>
          </Bloc>
        )}
      </div>
    </section>
  );
}

const chargerProduitApi = (d: DashboardPrisme) => async (p: string) => {
  const noms = ((d.donnees.produits.find((x) => x.produit === p)?.noms as string[] | undefined) ?? [p]);
  const r = await fetch(`/api/prisme/produit?veille=${encodeURIComponent(d.veille.id)}&produit=${encodeURIComponent(p)}${noms.map((x) => `&nom=${encodeURIComponent(x)}`).join("")}`);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? `Erreur ${r.status}`);
  return j as DetailProduit;
};

/** Banderole de vidéos qui défile (pause au survol ; défilement manuel si animations réduites). */
function Banderole({ videos }: { videos: Ligne[] }) {
  const [lecture, setLecture] = useState<string | null>(null);
  if (!videos.length) return null;
  const carte = (v: Ligne, i: number, dup = false) => (
    <a key={`${dup ? "d" : ""}${i}`} href={String(v.url)} target="_blank" rel="noopener noreferrer" aria-hidden={dup || undefined} tabIndex={dup ? -1 : undefined}
      onClick={(e) => { const id = v.plateforme === "tiktok" ? idTikTok(v.url) : null; if (id) { e.preventDefault(); setLecture(id); } }}
      className="group relative flex w-[260px] shrink-0 flex-col overflow-hidden rounded-[14px] border border-line bg-paper transition hover:-translate-y-0.5 hover:border-amber hover:shadow-[0_10px_24px_-14px_rgb(19_35_63/0.45)]">
      <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-night via-night-3 to-[#8E3557]">
        <span className="absolute inset-0 grid place-items-center text-sm font-semibold uppercase tracking-[0.12em] text-white/70">{PLATEFORME[String(v.plateforme)] ?? String(v.plateforme)}</span>
        {Boolean(v.image) && (
          // Miniature de la plateforme ; si le lien a expiré, on garde le fond coloré.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={String(v.image)} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = "none"; }}
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        )}
        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">{PLATEFORME[String(v.plateforme)] ?? String(v.plateforme)}</span>
        <span className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-night opacity-90 transition group-hover:bg-amber"><Play size={14} fill="currentColor" aria-hidden /></span>
      </div>
      <div className="flex flex-1 flex-col p-3">
        <span className="text-lg font-semibold tabular-nums">{compact(n(v.vues))} <span className="text-xs font-normal text-ink-faint">vues</span></span>
        <span className="mt-0.5 line-clamp-2 text-[13px] text-ink-soft">{String(v.legende || "—")}</span>
      </div>
    </a>
  );
  return (
    <>
    {lecture && <LecteurTikTok id={lecture} onClose={() => setLecture(null)} />}
    <div className="banderole relative overflow-hidden" aria-label="Vidéos les plus vues sur le sujet">
      <div className="banderole-piste flex w-max gap-4 py-1">
        {videos.map((v, i) => carte(v, i))}
        {videos.map((v, i) => carte(v, i, true))}
      </div>
      <style>{`
        .banderole{mask-image:linear-gradient(90deg,transparent,#000 4%,#000 96%,transparent)}
        .banderole-piste{animation:defile ${Math.max(30, videos.length * 6)}s linear infinite}
        .banderole:hover .banderole-piste,.banderole:focus-within .banderole-piste{animation-play-state:paused}
        @keyframes defile{to{transform:translateX(calc(-50% - 8px))}}
        @media (prefers-reduced-motion: reduce){.banderole{overflow-x:auto;mask-image:none}.banderole-piste{animation:none}}
      `}</style>
    </div>
    </>
  );
}

function Cl({ nom, onClic, children, className }: { nom: string; onClic?: (nom: string) => void; children: React.ReactNode; className: string }) {
  return onClic ? <button onClick={() => onClic(nom)} className={`press block w-full text-left hover:bg-ground ${className}`}>{children}</button> : <div className={className}>{children}</div>;
}

/** Carte « macro » : le n°1 en grand, puis les suivants en liste classée. */
function CarteMacro({ icone, titre, mesure, lignes, onClic }: {
  icone: React.ReactNode; titre: string; mesure: string;
  lignes: { nom: string; valeur: string; detail?: string; accent?: boolean }[]; onClic?: (nom: string) => void;
}) {
  const [premier, ...suite] = lignes;
  return (
    <section className="flex min-w-0 flex-col rounded-[16px] border border-line bg-paper p-5">
      <h3 className="flex items-center gap-2 text-[17px] font-semibold">{icone}{titre}</h3>
      <p className="mt-0.5 text-[13.5px] leading-snug text-ink-soft">{mesure}</p>
      {premier ? (
        <>
          <Cl nom={premier.nom} onClic={onClic} className="mt-4 rounded-[12px] bg-ground px-4 py-3">
            <span className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-ink-faint">N°1</span>
            <span className={`mt-0.5 block text-[22px] font-semibold leading-tight tracking-[-0.02em] ${premier.accent ? "text-[#c4501f]" : "text-ink"}`}>{premier.nom}</span>
            <span className="mt-1 block text-[15px] font-medium tabular-nums text-ink">{premier.valeur}{premier.detail && <span className="font-normal text-ink-soft"> · {premier.detail}</span>}</span>
          </Cl>
          <ol className="mt-2 divide-y divide-line-soft">
            {suite.map((l, i) => (
              <li key={l.nom}>
                <Cl nom={l.nom} onClic={onClic} className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-baseline gap-2 rounded-lg px-1 py-2">
                  <span className="text-[13px] tabular-nums text-ink-faint">{i + 2}</span>
                  <span className={`truncate text-[15px] ${l.accent ? "font-semibold text-[#c4501f]" : "text-ink"}`}>{l.nom}</span>
                  <span className="text-[14px] tabular-nums text-ink-soft">{l.valeur}{l.detail && <span className="hidden text-ink-faint sm:inline"> · {l.detail}</span>}</span>
                </Cl>
              </li>
            ))}
          </ol>
        </>
      ) : <p className="py-8 text-center text-sm text-ink-faint">Pas de données.</p>}
    </section>
  );
}

/** Pour/contre par aspect (barres divergentes, axe symétrique et graduations entières). */
function Aspects({ rows }: { rows: { aspect: string; positif: number; negatif: number }[] }) {
  if (!rows.length) return <p className="py-10 text-center text-[15px] text-ink-faint">Pas encore assez de commentaires classés pour cette sélection.</p>;
  const data = rows.map((a) => ({ ...a, negatif: -a.negatif }));
  const brut = Math.max(1, ...rows.map((a) => Math.max(a.positif, a.negatif)));
  const pas = brut <= 4 ? 1 : brut <= 10 ? 2 : brut <= 25 ? 5 : brut <= 50 ? 10 : brut <= 100 ? 25 : Math.ceil(brut / 400) * 100;
  const M = Math.ceil(brut / pas) * pas;
  const ticks: number[] = []; for (let t = -M; t <= M; t += pas) ticks.push(t);
  return (
    <>
      <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 38)}>
        <BarChart data={data} layout="vertical" stackOffset="sign" margin={{ left: 4, right: 16 }}>
          <CartesianGrid stroke="#eef0f3" horizontal={false} />
          <XAxis type="number" tick={TICK} domain={[-M, M]} ticks={ticks.length <= 11 ? ticks : undefined} allowDecimals={false} tickFormatter={(v) => String(Math.abs(Number(v)))} />
          <YAxis type="category" dataKey="aspect" tick={TICK} width={128} />
          <Tooltip {...TIP} formatter={(v, name) => [`${Math.abs(Number(v))} commentaires`, name === "negatif" ? "critiques" : "éloges"]} />
          <Bar isAnimationActive={false} dataKey="negatif" stackId="s" fill="#B33939" radius={[5, 0, 0, 5]} />
          <Bar isAnimationActive={false} dataKey="positif" stackId="s" fill="#17784F" radius={[0, 5, 5, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-1 flex gap-4 text-[14px] text-ink-soft"><span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-bad" />◀ critiques</span><span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-ok" />éloges ▶</span></p>
    </>
  );
}

function Verbatims({ rows }: { rows: Ligne[] }) {
  if (!rows.length) return <p className="py-6 text-center text-[15px] text-ink-faint">Aucun commentaire pour cette sélection.</p>;
  return (
    <div className="grid gap-3">
      {rows.slice(0, 4).map((c, i) => {
        const contenu = (<>« {String(c.texte)} »<span className="mt-1.5 flex items-center justify-between gap-2 text-[13px] text-ink-faint">
          <span>{c.marque ? `${String(c.marque)} · ` : ""}{PLATEFORME[String(c.plateforme)] ?? String(c.plateforme ?? "")} · {compact(n(c.likes))} j&apos;aime</span>
          {Boolean(c.url) && <ArrowUpRight size={14} className="shrink-0 group-hover:text-amber-dark" aria-hidden />}</span></>);
        const cls = `group block rounded-[12px] border-l-[3px] bg-ground px-4 py-3 text-[15px] leading-relaxed ${c.sentiment === "positif" ? "border-ok" : "border-bad"}`;
        return c.url ? <a key={i} href={String(c.url)} target="_blank" rel="noopener noreferrer" className={`${cls} transition hover:bg-line-soft`}>{contenu}</a> : <blockquote key={i} className={cls}>{contenu}</blockquote>;
      })}
    </div>
  );
}

/** Benchmark : la marque suivie face à ses principaux concurrents, mêmes indicateurs. */
/** Concurrents de même gamme : marques prestige face à une marque prestige (Lancôme vs Dior, Chanel…), grand public face à NYX. */
function concurrentsDe(D: DashboardPrisme["donnees"], focus: string) {
  const luxe = focus === "groupe" || estLuxe(focus);
  const autres = D.marques.filter((m) => !m.est_loreal && n(m.part_de_voix_pct) > 0);
  const memeGamme = autres.filter((m) => estLuxe(m.marque) === luxe);
  return [...memeGamme, ...autres.filter((m) => !memeGamme.includes(m))].slice(0, 4);
}

function Benchmark({ D, focus }: { D: DashboardPrisme["donnees"]; focus: string }) {
  const groupe = focus === "groupe";
  const nous = D.marques.filter((m) => (groupe ? m.est_loreal && n(m.videos) >= 3 : m.marque === focus));
  const eux = concurrentsDe(D, focus);
  const rows = [...nous, ...eux];
  const max = Math.max(1, ...rows.map((m) => n(m.part_de_voix_pct)));
  const avis = (m: Ligne) => { const p = n(m.avis_positifs), q = n(m.avis_negatifs); return p + q >= 10 ? Math.round((100 * p) / (p + q)) : null; };
  return (
    <div>
      {/* téléphone : une carte par marque */}
      <ul className="space-y-2 sm:hidden">
        {rows.map((m) => {
          const lo = nous.includes(m), a = avis(m);
          return (
            <li key={String(m.marque)} className={`rounded-[12px] border border-line-soft px-3 py-2.5 ${lo ? "bg-amber-wash/60" : "bg-paper"}`}>
              <div className="flex items-center justify-between gap-2"><span className={`truncate text-[16px] ${lo ? "font-semibold" : "text-ink-soft"}`}>{String(m.marque)}</span><span className="text-[16px] font-semibold tabular-nums">{pct(n(m.part_de_voix_pct))}</span></div>
              <span className="mt-1.5 block h-2.5 rounded-r bg-ground"><span className="block h-full rounded-r" style={{ width: `${(100 * n(m.part_de_voix_pct)) / max}%`, background: lo ? "#eb6834" : "#b8bfca" }} /></span>
              <p className="mt-1.5 text-[13.5px] text-ink-soft">{compact(n(m.videos))} vidéos · {compact(n(m.vues))} vues · avis positifs {a === null ? "—" : `${a} %`} · « je l&apos;achète » {n(m.achete) || "—"}</p>
            </li>
          );
        })}
      </ul>
      <div className="hidden overflow-x-auto sm:block">
      <table className="w-full text-[15px]">
        <thead><tr className="border-b border-line text-left text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-faint">
          <th className="py-2 pr-3">Marque</th><th className="py-2 pr-3">Part de voix</th><th className="py-2 pr-3 text-right">Vidéos</th><th className="py-2 pr-3 text-right">Vues</th><th className="py-2 pr-3 text-right">Avis positifs</th><th className="py-2 text-right">« Je l&apos;achète »</th>
        </tr></thead>
        <tbody>
          {rows.map((m) => {
            const lo = nous.includes(m), a = avis(m);
            return (
              <tr key={String(m.marque)} className={`border-b border-line-soft ${lo ? "bg-amber-wash/60" : ""}`}>
                <td className={`py-2.5 pr-3 ${lo ? "font-semibold" : "text-ink-soft"}`}>{String(m.marque)}</td>
                <td className="py-2.5 pr-3"><span className="flex items-center gap-2"><span className="h-3 w-20 shrink-0 rounded-r bg-ground lg:w-28"><span className="block h-full rounded-r" style={{ width: `${(100 * n(m.part_de_voix_pct)) / max}%`, background: lo ? "#eb6834" : "#b8bfca" }} /></span><span className="tabular-nums">{pct(n(m.part_de_voix_pct))}</span></span></td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{compact(n(m.videos))}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{compact(n(m.vues))}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{a === null ? <span className="text-ink-faint" title="moins de 10 avis : pas assez pour un pourcentage">—</span> : `${a} %`}</td>
                <td className="py-2.5 text-right tabular-nums">{n(m.achete) || <span className="text-ink-faint">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      <p className="mt-2 text-[13.5px] text-ink-soft">Concurrents : les 4 marques hors groupe L&apos;Oréal les plus présentes sur le sujet, de même gamme ({focus === "groupe" || estLuxe(focus) ? "prestige" : "grand public"}). Avis positifs : part des commentaires positifs parmi les commentaires positifs ou négatifs (affichée à partir de 10 avis). « Je l&apos;achète » : commentaires qui expriment une intention d&apos;achat.</p>
    </div>
  );
}

type Asp = { aspect: string; positif: number; negatif: number };
function aspectsDe(D: DashboardPrisme["donnees"], garde: (m: unknown) => boolean) {
  const m = new Map<string, Asp>();
  for (const a of D.aspects_par_marque) {
    if (!garde(a.marque)) continue;
    const k = String(a.aspect); const x = m.get(k) ?? { aspect: k, positif: 0, negatif: 0 };
    x.positif += n(a.positif); x.negatif += n(a.negatif); m.set(k, x);
  }
  return [...m.values()];
}

/** Résumé de la marque suivie, écrit par le code à partir des chiffres (aucun texte inventé). */
function Resume({ D, focus, f }: { D: DashboardPrisme["donnees"]; focus: string; f: FocusMarque | null }) {
  const groupe = focus === "groupe";
  const nom = groupe ? "Le groupe L'Oréal" : focus;
  const nous = D.marques.filter((m) => (groupe ? m.est_loreal : m.marque === focus));
  const p = nous.reduce((x, m) => x + n(m.part_de_voix_pct), 0);
  const rang = groupe ? null : D.marques.findIndex((m) => m.marque === focus) + 1;
  const asp = (f?.aspects ?? []) as Asp[];
  const fort = [...asp].filter((a) => a.positif >= 3 && a.positif > a.negatif).sort((a, b) => b.positif - a.positif)[0];
  const faible = [...asp].filter((a) => a.negatif >= 3).sort((a, b) => b.negatif / (b.positif + b.negatif) - a.negatif / (a.positif + a.negatif))[0];
  const top = f?.produits[0];
  const fr = (x: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(x);
  const phrases = [
    `${nom} pèse ${fr(p)} % de la conversation${rang ? ` (n°${rang} sur ${D.marques.length} marques citées)` : ""}.`,
    top && `Produit le plus cité : ${String(top.produit).split("·").pop()?.trim()} (${n(top.videos)} vidéo${n(top.videos) > 1 ? "s" : ""}, ${compact(n(top.vues))} vues).`,
    fort && `Point fort : « ${fort.aspect} » (${fort.positif} éloges${fort.negatif ? `, ${fort.negatif} critiques` : ""}).`,
    faible && `Point à surveiller : « ${faible.aspect} » (${faible.negatif} critiques sur ${faible.negatif + faible.positif}).`,
  ].filter(Boolean);
  return <p className="rounded-[14px] border border-[#eb6834]/30 bg-paper px-5 py-4 text-[17px] leading-relaxed text-ink">{phrases.join(" ")}</p>;
}

/** Opportunités pour un nouveau produit : ce que les gens demandent, ce qu'on reproche aux concurrents, ce qu'on aime déjà chez nous. */
function Opportunites({ D, focus, f }: { D: DashboardPrisme["donnees"]; focus: string; f: FocusMarque | null }) {
  const eux = concurrentsDe(D, focus);
  const faibles = eux.flatMap((m) => aspectsDe(D, (x) => x === m.marque).filter((a) => a.negatif >= 3 && a.negatif / (a.positif + a.negatif) >= 0.3)
    .map((a) => ({ marque: String(m.marque), ...a }))).sort((a, b) => b.negatif - a.negatif).slice(0, 5);
  const forts = ((f?.aspects ?? []) as Asp[]).filter((a) => a.positif >= 3 && a.positif > a.negatif).sort((a, b) => b.positif - a.positif).slice(0, 4);
  const nom = focus === "groupe" ? "le groupe L'Oréal" : focus;
  const carte = (icone: React.ReactNode, titre: string, aide: string, contenu: React.ReactNode) => (
    <div className="min-w-0 rounded-[14px] border border-line bg-paper p-4">
      <h4 className="flex items-center gap-2 text-[16px] font-semibold">{icone}{titre}</h4>
      <p className="mb-3 mt-0.5 text-[13.5px] text-ink-soft">{aide}</p>{contenu}
    </div>
  );
  const vide = <p className="text-[14.5px] text-ink-faint">Pas assez de commentaires sur ce point.</p>;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {carte(<MessageCircleQuestion size={18} className="text-[#2a78d6]" aria-hidden />, "Ce que les gens demandent", "Demandes repérées par l'IA dans les commentaires du sujet (toutes marques).",
        D.demandes?.length ? <ul className="space-y-2">{D.demandes.slice(0, 5).map((x) => <li key={String(x.demande)} className="flex justify-between gap-3 text-[15px]"><span>« {String(x.demande)} »</span>{n(x.fois) > 1 && <span className="shrink-0 tabular-nums text-ink-faint">×{n(x.fois)}</span>}</li>)}</ul> : vide)}
      {carte(<ThumbsDown size={18} className="text-bad" aria-hidden />, "Ce qu'on reproche aux concurrents", "Aspects critiqués dans au moins 30 % des avis (3 critiques minimum).",
        faibles.length ? <ul className="space-y-2">{faibles.map((a) => <li key={a.marque + a.aspect} className="text-[15px]"><b>{a.marque}</b> · {a.aspect} <span className="text-ink-faint">({a.negatif} critiques sur {a.negatif + a.positif})</span></li>)}</ul> : vide)}
      {carte(<Lightbulb size={18} className="text-[#c4501f]" aria-hidden />, `Ce qu'on aime déjà chez ${nom}`, "Aspects les plus salués : à garder dans le nouveau produit.",
        forts.length ? <ul className="space-y-2">{forts.map((a) => <li key={a.aspect} className="text-[15px]">{a.aspect} <span className="text-ink-faint">({a.positif} éloges{a.negatif ? `, ${a.negatif} critiques` : ""})</span></li>)}</ul> : vide)}
    </div>
  );
}

const chargerFocusApi = (d: DashboardPrisme) => async (m: string) => {
  const r = await fetch(`/api/prisme/marque?veille=${encodeURIComponent(d.veille.id)}&marque=${encodeURIComponent(m)}`);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? `Erreur ${r.status}`);
  return j as FocusMarque;
};

export function PrismeDashboard({ d, chargerProduit, chargerFocus }: { d: DashboardPrisme; chargerProduit?: (p: string) => Promise<DetailProduit>; chargerFocus?: (m: string) => Promise<FocusMarque> }) {
  const D = d.donnees;
  const charger = useMemo(() => chargerProduit ?? chargerProduitApi(d), [chargerProduit, d]);
  const chargerF = useMemo(() => chargerFocus ?? chargerFocusApi(d), [chargerFocus, d]);
  // marques du groupe avec assez de matière pour un zoom (au moins 3 vidéos)
  const marquesLoreal = useMemo(() => D.marques.filter((m) => m.est_loreal && n(m.videos) >= 3).map((m) => String(m.marque)), [D.marques]);
  const [focus, setFocus] = useState("groupe");
  const [fCharge, setF] = useState<FocusMarque | null>(null);
  const [erreur, setErreurF] = useState<{ m: string; e: string } | null>(null);
  const [produitChoisi, setProduit] = useState<{ m: string; p: string } | null>(null);
  const [detailCharge, setDetail] = useState<DetailProduit | null>(null);
  // valeurs dérivées : on n'affiche que ce qui correspond à la sélection en cours (pas de remise à zéro dans les effets)
  const f = fCharge?.marque === focus ? fCharge : null;
  const erreurF = erreur?.m === focus ? erreur.e : null;
  const produit = produitChoisi?.m === focus ? produitChoisi.p : null;
  const detail = detailCharge && detailCharge.produit === produit ? detailCharge : null;
  const [panneau, setPanneau] = useState<string | null>(null);
  const nomFocus = focus === "groupe" ? "Groupe L'Oréal" : focus;
  const estGroupe = (m: unknown) => D.marques.some((x) => x.marque === m && x.est_loreal);

  useEffect(() => {
    let vivant = true;
    chargerF(focus).then((x) => vivant && setF(x)).catch((e) => vivant && setErreurF({ m: focus, e: (e as Error).message }));
    return () => { vivant = false; };
  }, [focus, chargerF]);
  useEffect(() => {
    let vivant = true;
    if (produit) charger(produit).then((x) => vivant && setDetail(x)).catch(() => null);
    return () => { vivant = false; };
  }, [produit, charger]);

  const pdv = D.marques.filter((m) => n(m.part_de_voix_pct) > 0).slice(0, 8);
  const tendances = [
    ...D.montantes.slice(0, 5).map((m) => ({ nom: String(m.recherche), valeur: n(m.hausse) >= 1000 ? "en très forte hausse" : `+${new Intl.NumberFormat("fr-FR").format(n(m.hausse))} %`, detail: "sur Google, 12 mois" })),
  ];
  const aspectsVue = detail ? detail.aspects : (f?.aspects ?? []);
  const verbatimsVue = detail ? detail.commentaires : (f?.verbatims ?? []);

  return (
    <div className="w-full min-w-0 space-y-8 [contain:inline-size]">
      {/* En-tête */}
      <header className="relative overflow-hidden rounded-[20px] bg-night p-6 text-white md:p-9">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full opacity-45 blur-3xl" style={{ background: "radial-gradient(circle, #F2A33A, transparent 65%)" }} />
        <p className="relative text-[13px] font-semibold uppercase tracking-[0.1em] text-amber">Prisme · {DRAPEAU[d.veille.pays] ?? d.veille.pays} · « {d.veille.sujet} »</p>
        <h2 className="relative mt-2 max-w-3xl text-[clamp(26px,3.6vw,40px)] font-semibold leading-[1.1] tracking-[-0.03em] text-balance">{d.titre}</h2>
        <p className="relative mt-3 max-w-3xl text-[17px] leading-relaxed text-night-text">{d.agent.reponse}</p>
      </header>

      {/* 1. MACRO : le marché en un coup d'œil */}
      <section className="space-y-4">
        <h3 className="px-1 text-[22px] font-semibold tracking-[-0.02em]">Le marché en un coup d&apos;œil</h3>
        <div className="grid gap-4 lg:grid-cols-3">
          <CarteMacro icone={<Hash size={18} className="text-[#2a78d6]" aria-hidden />} titre="Hashtags les plus vus" mesure="Total des vues des vidéos qui utilisent le hashtag (génériques comme #fyp exclus)."
            lignes={D.hashtags.slice(0, 5).map((h) => ({ nom: String(h.hashtag), valeur: `${compact(n(h.vues))} vues`, detail: `${n(h.videos)} vidéos` }))} />
          <CarteMacro icone={<ShoppingBag size={18} className="text-[#eb6834]" aria-hidden />} titre="Produits les plus cités" mesure="Classés par nombre de vidéos qui les citent, puis par vues. Orange : groupe L'Oréal. Cliquez pour la fiche."
            lignes={D.produits.slice(0, 5).map((p) => ({ nom: String(p.produit), valeur: `${n(p.videos)} vidéo${n(p.videos) > 1 ? "s" : ""}`, detail: `${compact(n(p.vues))} vues`, accent: estGroupe(p.marque) }))} onClic={setPanneau} />
          <CarteMacro icone={<TrendingUp size={18} className="text-ok" aria-hidden />} titre="Tendances qui montent" mesure="Recherches Google associées au sujet dont le volume a le plus augmenté sur 12 mois."
            lignes={tendances} />
        </div>
      </section>

      {/* 2. Les vidéos qui font la tendance */}
      <section className="space-y-3">
        <h3 className="px-1 text-[22px] font-semibold tracking-[-0.02em]">Les vidéos qui font la tendance</h3>
        <Banderole videos={[...D.videos].sort((a, b) => Number(Boolean(b.image)) - Number(Boolean(a.image)))} />
      </section>

      {/* 3. Qui occupe la conversation, et comment ça évolue */}
      <section className="space-y-4">
        <h3 className="px-1 text-[22px] font-semibold tracking-[-0.02em]">Les marques dans la conversation</h3>
        <Bloc titre="Qui occupe la conversation" mesure="Part de voix : part des vues des vidéos qui citent chaque marque (les publicités comptent à moitié).">
          <ul className="space-y-2.5" aria-label="Part de voix par marque">
            {pdv.map((m) => {
              const max = n(pdv[0]?.part_de_voix_pct) || 1, lo = Boolean(m.est_loreal);
              return (
                <li key={String(m.marque)} className="grid grid-cols-[minmax(0,150px)_1fr_70px] items-center gap-3 px-1.5 py-0.5">
                  <span className={`truncate text-[16px] ${lo ? "font-semibold text-ink" : "text-ink-soft"}`}>{String(m.marque)}</span>
                  <span className="h-[16px]"><span className="block h-full rounded-r transition-[width] duration-500" style={{ width: `${(100 * n(m.part_de_voix_pct)) / max}%`, background: lo ? "#eb6834" : "#b8bfca" }} /></span>
                  <span className="text-right text-[16px] font-semibold tabular-nums">{pct(n(m.part_de_voix_pct))}</span>
                </li>
              );
            })}
            <li className="flex gap-4 pt-1 text-[14px] text-ink-soft"><span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-[#eb6834]" />Groupe L&apos;Oréal</span><span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-[#b8bfca]" />Concurrents</span></li>
          </ul>
        </Bloc>
        <Evolution d={d} />
        <Comparaison d={d} />
      </section>

      {/* 4. MICRO : la marque suivie, ses produits */}
      <section className="space-y-4 rounded-[24px] border-2 border-[#eb6834]/30 bg-gradient-to-b from-amber-wash/70 to-transparent p-4 md:p-6">
        <div className="flex flex-col gap-3 px-1 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#c4501f]">Analyse ciblée</p>
            <h3 className="text-[24px] font-semibold tracking-[-0.02em]">{nomFocus} face à la concurrence</h3>
            <p className="mt-0.5 text-[14.5px] text-ink-soft">Choisissez la marque pour laquelle vous développez un produit : toute cette partie se recalcule pour elle.</p>
          </div>
          <label className="flex w-full shrink-0 flex-col gap-1 md:w-[300px]">
            <span className="text-[13px] font-semibold text-ink">Votre marque</span>
            <select value={focus} onChange={(e) => setFocus(e.target.value)} aria-label="Marque analysée"
              className="h-12 w-full rounded-[12px] border-2 border-[#eb6834] bg-paper px-3 text-[16px] font-semibold text-ink outline-none focus:ring-2 focus:ring-[#eb6834]/40">
              <option value="groupe">Tout le groupe L&apos;Oréal</option>
              {marquesLoreal.map((m) => {
                const x = D.marques.find((y) => y.marque === m);
                return <option key={m} value={m}>{m} · {pct(n(x?.part_de_voix_pct))} de la conversation</option>;
              })}
            </select>
          </label>
        </div>
        <Resume D={D} focus={focus} f={f} />
        <Bloc titre={`Benchmark : ${nomFocus} vs concurrents`} mesure="Mêmes indicateurs pour chaque marque, calculés sur les mêmes vidéos et commentaires.">
          <Benchmark D={D} focus={focus} />
        </Bloc>

        <div className="space-y-3">
          <h4 className="px-1 text-[19px] font-semibold">Opportunités pour un nouveau produit</h4>
          <Opportunites D={D} focus={focus} f={f} />
        </div>
        {erreurF && <p className="text-[15px] text-bad">{erreurF}</p>}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
          <Bloc titre={`Les produits ${focus === "groupe" ? "du groupe" : focus}`} mesure="Classés par nombre de vidéos qui les citent. Choisissez un produit : « ce qu'on en dit » et les commentaires passent sur ce produit.">
            {!f ? <Skeleton className="h-64" /> : f.produits.length ? (
              <ul className="space-y-1.5">
                <li><button onClick={() => setProduit(null)} aria-pressed={!produit}
                  className={`press w-full rounded-[10px] border px-3 py-2 text-left text-[15px] ${!produit ? "border-[#eb6834] bg-paper font-semibold" : "border-transparent hover:bg-ground"}`}>Tous les produits de {nomFocus}</button></li>
                {f.produits.map((p) => {
                  const max = Math.max(1, ...f.produits.map((x) => n(x.videos))), actif = produit === p.produit;
                  return (
                    <li key={String(p.produit)}>
                      <button onClick={() => setProduit({ m: focus, p: String(p.produit) })} aria-pressed={actif}
                        className={`press w-full rounded-[10px] border px-3 py-2 text-left ${actif ? "border-[#eb6834] bg-paper" : "border-transparent hover:bg-ground"}`}>
                        <span className={`block truncate text-[15px] ${actif ? "font-semibold" : ""}`}>{String(p.produit)}</span>
                        <span className="mt-1 flex items-center gap-2"><span className="h-2 flex-1 rounded-r bg-ground"><span className="block h-full rounded-r bg-[#eb6834]" style={{ width: `${(100 * n(p.videos)) / max}%` }} /></span><span className="text-[13px] tabular-nums text-ink-soft">{n(p.videos)} vidéo{n(p.videos) > 1 ? "s" : ""} · {compact(n(p.vues))} vues</span></span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="py-8 text-center text-[15px] text-ink-faint">Aucun produit de {nomFocus} identifié dans cette veille.</p>}
          </Bloc>

          <div className="grid min-w-0 gap-5">
            {produit && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-line bg-paper px-4 py-3">
                <div className="min-w-0"><p className="text-[13px] text-ink-faint">Produit sélectionné</p><p className="truncate text-[17px] font-semibold">{produit}</p></div>
                {detail ? <p className="text-[15px] tabular-nums text-ink-soft">{compact(detail.stats.vues)} vues · {detail.stats.videos} vidéos · {detail.stats.commentaires} commentaires</p> : <p className="text-[14px] text-ink-faint">Chargement…</p>}
                <button onClick={() => setPanneau(produit)} className="press rounded-full bg-night px-4 py-1.5 text-[14px] font-medium text-white">Fiche complète</button>
              </div>
            )}
            <Bloc titre={`Ce qu'on dit de ${produit ?? nomFocus}`} mesure="Nombre de commentaires qui parlent de chaque aspect, classés par l'IA.">
              {!f ? <Skeleton className="h-56" /> : <Aspects rows={aspectsVue} />}
            </Bloc>
            <Bloc titre={`Ce que disent les gens de ${produit ?? nomFocus}`} mesure="Les commentaires les plus aimés (sans pseudo). Cliquez pour ouvrir la vidéo d'origine.">
              {!f ? <Skeleton className="h-40" /> : <Verbatims rows={verbatimsVue} />}
            </Bloc>
          </div>
        </div>
        {f && f.videos.length > 0 && !produit && (
          <div className="space-y-3">
            <h4 className="px-1 text-[18px] font-semibold">Les vidéos qui parlent de {nomFocus}</h4>
            <Banderole videos={f.videos} />
          </div>
        )}
      </section>

      {panneau && <PopupProduit nom={panneau} charger={charger} onClose={() => setPanneau(null)} />}

      {/* 5. Pour aller plus loin, puis les sources */}
      <details className="group rounded-[16px] border border-line bg-paper">
        <summary className="flex cursor-pointer select-none items-center justify-between px-5 py-4 text-[17px] font-semibold">Plus de détails : formats et recherche Google <ChevronDown size={18} className="transition group-open:rotate-180" aria-hidden /></summary>
        <div className="grid gap-5 border-t border-line p-5 lg:grid-cols-2">
          <div>
            <h4 className="font-semibold">Engagement par format</h4>
            <p className="mb-3 text-[14px] text-ink-soft">(likes + commentaires) ÷ vues, en moyenne par vidéo de chaque format.</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={D.formats.map((x) => ({ format: String(x.nom), engagement: Math.round(n(x.engagement_moyen) * 1000) / 10, videos: n(x.videos) }))} margin={{ left: -16 }}>
                <CartesianGrid stroke="#eef0f3" vertical={false} />
                <XAxis dataKey="format" tick={TICK} interval={0} />
                <YAxis tick={TICK} unit=" %" />
                <Tooltip {...TIP} formatter={(v, _k, p) => [`${v} % · ${(p.payload as Ligne).videos} vidéos`, "Engagement"]} />
                <Bar isAnimationActive={false} dataKey="engagement" fill="#2a78d6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h4 className="font-semibold">Niveau de recherche Google</h4>
            <p className="mb-3 text-[14px] text-ink-soft">Indice des 4 dernières semaines (100 = semaine la plus forte sur 12 mois) et évolution vs les 4 précédentes.</p>
            <ul className="space-y-1.5 text-[15px]">
              {D.recherche.slice(0, 8).map((r) => (
                <li key={String(r.mot)} className="flex justify-between gap-3 border-b border-line-soft py-1"><span>{String(r.mot)}</span>
                  <span className="tabular-nums">{n(r.niveau)} {r.evolution_pct != null && <b className={n(r.evolution_pct) >= 0 ? "text-ok" : "text-bad"}>{n(r.evolution_pct) >= 0 ? "+" : ""}{n(r.evolution_pct)} %</b>}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </details>

      {!!d.sources.length && (
        <Bloc titre="D'où viennent les données" mesure="Part de chaque plateforme dans les vidéos analysées et dans les commentaires lus.">
          <Sources rows={d.sources} />
        </Bloc>
      )}

      <p className="text-[13px] leading-relaxed text-ink-faint">
        Source : données collectées le {new Date(d.veille.date).toLocaleDateString("fr-FR")} sur TikTok, Instagram, YouTube et Google Trends, analysées par des modèles Hugging Face.
        Chiffres et graphiques calculés à partir de la base ; textes rédigés par {d.agent.modele}{d.agent.secours ? " (analyse enregistrée : modèles indisponibles)" : ""}.
      </p>
    </div>
  );
}
