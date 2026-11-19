import "server-only";
import { coupe } from "./texte";
import { config } from "./config";
import { HttpError } from "./auth";
import { db } from "./social";
import { OUTILS, lire, prisme, type ReponsePrisme } from "./prisme";
import { estLoreal, marqueCanon } from "./marques";

/**
 * Dashboard Prisme à partir d'un SUJET tapé par l'utilisateur (« blush de luxe »).
 * 1. On retrouve la veille la plus riche déjà collectée sur ce sujet (aucune collecte en direct ici).
 * 2. Prisme (agent) consulte ses outils, répond et choisit ses graphiques.
 * 3. Le code calcule les KPI et les jeux de données interactifs (jamais le LLM).
 * 4. L'Éditeur (2e appel LLM, court) écrit le titre et l'accroche à partir des KPI, sans aller au-delà des chiffres.
 */

type Ligne = Record<string, unknown>;
const n = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0) || 0);

export interface Kpi { id: string; label: string; valeur: number | string; unite?: string; detail?: string; ton?: "loreal" | "bad" | "ok" | "neutre" }
export interface DashboardPrisme {
  sujet: string;
  veille: { id: string; sujet: string; pays: string; date: string; videos: number; commentaires: number };
  autres_veilles: { id: string; sujet: string; date: string }[];
  titre: string;
  accroche: string;
  kpis: Kpi[];
  agent: ReponsePrisme;
  comparaison: { pays: string; veille_id: string; videos: number; pdv_loreal: number; marques: Ligne[]; produits: Ligne[]; hashtags: Ligne[]; sources: Ligne[] } | null;
  sources: Ligne[];
  evolution: { mois: Ligne[]; marques: { nom: string; loreal: boolean }[]; recherche: Ligne[]; mots: { nom: string; loreal: boolean }[]; lecture_mois: string; lecture_google: string };
  consolidation: { veilles: number } | null;
  pays_disponibles: string[];
  donnees: {
    marques: Ligne[];
    aspects_par_marque: Ligne[];
    verbatims: Ligne[];
    hashtags: Ligne[];
    produits: Ligne[];
    formats: Ligne[];
    contenus: Ligne[];
    recherche: Ligne[];
    montantes: Ligne[];
    videos: Ligne[];
    demandes: Ligne[];
  };
}

async function sources(veilleId: string): Promise<Ligne[]> {
  const { data } = await db().from("sl_v_sources").select("platform, videos, vues, commentaires").eq("veille_id", veilleId);
  return (data ?? []) as Ligne[];
}

export async function sujetsDisponibles() {
  const { data } = await db().from("sl_veilles").select("sujet").in("statut", ["termine", "partiel"]).order("started_at", { ascending: false }).limit(100);
  return [...new Set((data ?? []).map((d) => String(d.sujet).toLowerCase().trim()))];
}

async function trouverVeille(sujet: string, pays?: string) {
  const mots = sujet.toLowerCase().split(/\s+/).filter((m) => m.length >= 4);
  const { data } = await db().from("sl_veilles").select("id, sujet, pays, stats, started_at").in("statut", ["termine", "partiel"])
    .order("started_at", { ascending: false }).limit(100);
  const candidates = (data ?? []).filter((v) => !pays || v.pays === pays).map((v) => {
    const s = String(v.sujet).toLowerCase();
    const score = (s === sujet.toLowerCase() ? 100 : mots.filter((m) => s.includes(m)).length * 10) + (String(v.id).startsWith("consolide") ? 1000 : 0);
    return { ...v, score, videos: n((v.stats as Ligne | null)?.videos) };
  }).filter((v) => v.score > 0);
  if (!candidates.length) return null;
  // la plus pertinente, puis la plus riche ; on écarte les veilles sans données exploitables pour les graphiques
  candidates.sort((a, b) => b.score - a.score || b.videos - a.videos);
  const utilisables = [];
  for (const c of candidates.slice(0, 8)) {
    const { count } = await db().from("sl_veille_videos").select("video_id", { count: "exact", head: true }).eq("veille_id", c.id);
    if ((count ?? 0) > 0) utilisables.push(c);
  }
  if (!utilisables.length) return null;
  return { meilleure: utilisables[0], autres: utilisables.slice(1, 6) };
}

async function editeur(sujet: string, faits: string[], reponse: string) {
  const secours = { titre: faits[0] ? faits[0][0].toUpperCase() + faits[0].slice(1) : `${sujet} : ce que disent les réseaux` };
  if (!config.hf.token) return secours;
  try {
    const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.hf.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.PRISME_MODEL || "Qwen/Qwen3-235B-A22B-Instruct-2507", max_tokens: 400, temperature: 0.3,
        messages: [
          { role: "system", content: `Tu es l'Éditeur de Lookout. Tu écris le titre d'un dashboard marketing beauté pour L'Oréal.
Règles : le titre ne dit RIEN de plus que les chiffres fournis ; phrase simple, sans jargon, 14 mots maximum ; pas de lien de cause non mesuré
(n'écris pas « freine l'achat » si on n'a que des critiques) ; n'utilise que les faits fournis, sans changer ce qu'un pourcentage mesure ; pas de mot comme « frein », « échec », « domine » s'il n'est pas dans les faits.
Réponds UNIQUEMENT en JSON : {"titre": str}` },
          { role: "user", content: JSON.stringify({ sujet, faits, analyse: reponse.slice(0, 1500) }) },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const out = JSON.parse(json.choices?.[0]?.message?.content?.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as { titre?: string };
    // garde-fou : tout chiffre du titre doit figurer dans les faits
    const chiffres = (out.titre ?? "").match(/\d+(?:[.,]\d+)?/g) ?? [];
    const ok = chiffres.every((c) => faits.join(" ").includes(c.replace(".", ",")) || faits.join(" ").includes(c));
    return { titre: out.titre && ok ? out.titre : secours.titre };
  } catch {
    return secours;
  }
}

/** Classement des produits : d'abord le nombre de vidéos qui les citent (une tendance), puis les vues (une seule vidéo virale ne suffit pas). */
function parVideos(rows: Ligne[]) {
  return [...rows].sort((a, b) => n(b.videos) - n(a.videos) || n(b.vues) - n(a.vues));
}

/** Ce que les gens demandent dans les commentaires (champ « demande » lu par l'IA), limité aux demandes qui portent sur un produit. */
const SUR_PRODUIT = /(teinte|shade|couleur|colou?r|prix|price|cher|expensive|tenue|stay|last|formul|texture|packag|emballage|dupe|waterproof|peau|skin|version|restock|stock|dispo|availab|achet|buy|taille|size|mat+e?\b|glow|liqui|stick|cr[eè]me|cream|poudre|powder|pigment|sensib|sensitiv|vegan|parfum|scent|fragrance|recharge|refill|mini|travel|fini|finish|dewy|blend)/i;
/** Autres catégories et bruit : hors du sujet d'un produit de teint/blush. */
const HORS_SUJET = /\b(lip|lips|lipstick|liner|mascara|eyeliner|eyeshadow|lash|brow|boyfriend|girlfriend)/i;
async function demandesClientes(veilleId: string): Promise<Ligne[]> {
  const sb = db();
  const ids: Ligne[] = [];
  for (let off = 0; off < 6000; off += 1000) {
    const { data } = await sb.from("sl_veille_videos").select("platform, video_id").eq("veille_id", veilleId).range(off, off + 999);
    ids.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  const parPf = new Map<string, string[]>();
  for (const r of ids) parPf.set(String(r.platform), [...(parPf.get(String(r.platform)) ?? []), String(r.video_id)]);
  const lots: Promise<Ligne[]>[] = [];
  for (const [pf, vids] of parPf) for (let i = 0; i < vids.length; i += 100) {
    lots.push(Promise.resolve(sb.from("sl_comments").select("demande, likes").eq("platform", pf).in("video_id", vids.slice(i, i + 100)).not("demande", "is", null).limit(500)).then((r) => (r.data ?? []) as Ligne[]));
  }
  const coms = (await Promise.all(lots)).flat();
  const m = new Map<string, { demande: string; fois: number; likes: number }>();
  for (const c of coms) {
    const d = String(c.demande ?? "").trim();
    if (d.length < 8 || d.length > 70 || !SUR_PRODUIT.test(d) || HORS_SUJET.test(d)) continue;
    const k = d.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, "").replace(/\s+/g, " ").trim();
    const x = m.get(k) ?? { demande: d, fois: 0, likes: 0 };
    x.fois++; x.likes += n(c.likes); m.set(k, x);
  }
  return [...m.values()].sort((a, b) => b.fois - a.fois || b.likes - a.likes).slice(0, 8);
}

export async function dashboardPrisme(sujet: string, question?: string, pays = "FR"): Promise<DashboardPrisme> {
  const trouve = (await trouverVeille(sujet, pays)) ?? (await trouverVeille(sujet));
  if (!trouve) throw new HttpError(404, `Aucune donnée collectée sur « ${sujet} » pour l'instant. Lancez d'abord une veille sur ce sujet.`);
  const v = trouve.meilleure;
  const q = question?.trim() || `Que devrait lancer L'Oréal sur « ${v.sujet} » ? Qu'est-ce qui marche (produits, formats, hashtags), et que disent les gens des marques L'Oréal et des concurrents ?`;

  // L'agent et les jeux de données tournent en parallèle.
  const run = (outil: string, args: Ligne = {}) => OUTILS[outil].run(v.id, args).catch(() => [] as Ligne[]);
  const [agent, marques, verbatims, aspects, hashtags, produits, fc, recherche, montantes, videos, demandes] = await Promise.all([
    prisme(v.id, q),
    run("scores_marques", { limite: 40 }),
    lire("sl_v_verbatims", v.id, { order: ["likes", false], limit: 80 }).catch(() => [] as Ligne[]),
    lire("sl_v_aspects", v.id, { limit: 2000 }).catch(() => [] as Ligne[]),
    (async () => {
      const { data } = await db().from("sl_veilles").select("plan").eq("id", v.id).maybeSingle();
      const cat = String((data?.plan as Ligne | null)?.categorie ?? v.sujet.split(" ")[0]).toLowerCase();
      const lies = await run("top_hashtags", { limite: 10, contient: cat });
      return lies.length >= 4 ? lies : run("top_hashtags", { limite: 10 });
    })(),
    run("top_produits", { limite: 300 }).then(parVideos).then((r) => r.slice(0, 10)),
    run("formats_et_contenus"),
    run("recherche_google"),
    run("recherches_montantes"),
    run("videos_phares", { limite: 40 }).then((vs) => {
      const avec = vs.filter((x) => x.image), sans = vs.filter((x) => !x.image);
      return avec.length >= 6 ? avec.slice(0, 14) : [...avec, ...sans].slice(0, 14);
    }),
    demandesClientes(v.id).catch(() => [] as Ligne[]),
  ]);

  // KPI calculés par le code
  const stats = (v.stats ?? {}) as Ligne;
  const pdvLoreal = marques.filter((m) => m.est_loreal).reduce((s, m) => s + n(m.part_de_voix_pct), 0);
  const asp = new Map<string, { aspect: string; positif: number; negatif: number }>();
  for (const a of aspects) {
    a.marque = marqueCanon(a.marque);
    const d = asp.get(String(a.aspect)) ?? { aspect: String(a.aspect), positif: 0, negatif: 0 };
    d.positif += n(a.positif); d.negatif += n(a.negatif); asp.set(String(a.aspect), d);
  }
  const pire = [...asp.values()].filter((a) => a.positif + a.negatif >= 30).sort((a, b) => b.negatif / (b.positif + b.negatif) - a.negatif / (a.positif + a.negatif))[0];
  const star = produits[0];

  const fr = (x: number, d = 1) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: d }).format(x);
  const n1 = marques[0];
  const pctNeg = pire ? Math.round((100 * pire.negatif) / (pire.negatif + pire.positif)) : 0;
  const kpis: Kpi[] = [
    { id: "pdv", label: "de la conversation pour les marques L'Oréal", valeur: Math.round(pdvLoreal * 10) / 10, unite: "%",
      detail: marques.filter((m) => m.est_loreal).slice(0, 3).map((m) => `${m.marque} ${fr(n(m.part_de_voix_pct))} %`).join(" · "), ton: "loreal" },
    ...(n1 ? [{ id: "n1", label: "marque la plus présente", valeur: String(n1.marque), detail: `${fr(n(n1.part_de_voix_pct))} % de la part de voix${n1.est_loreal ? " · groupe L'Oréal" : " · concurrent"}`, ton: (n1.est_loreal ? "loreal" : "neutre") as Kpi["ton"] }] : []),
    ...(star ? [{ id: "star", label: "produit le plus vu", valeur: String(star.produit), detail: `${star.marque ?? ""} · ${new Intl.NumberFormat("fr-FR", { notation: "compact" }).format(n(star.vues))} vues`, ton: "ok" as const }] : []),
    ...(pire ? [{ id: "critique", label: `d'avis négatifs sur « ${pire.aspect} »`, valeur: pctNeg, unite: "%", detail: `point faible n°1 · ${pire.negatif} négatifs, ${pire.positif} positifs`, ton: "bad" as const }] : []),
  ];


  const faits = [
    n1 && `${n1.marque} est la marque la plus présente (${fr(n(n1.part_de_voix_pct))} % de la part de voix)`,
    `les marques L'Oréal totalisent ${fr(pdvLoreal)} % de la part de voix`,
    star && `le produit le plus vu est « ${star.produit} » (${star.marque ?? ""})`,
    pire && `${pctNeg} % des commentaires qui parlent de « ${pire.aspect} » sont négatifs (${pire.negatif} sur ${pire.negatif + pire.positif})`,
  ].filter(Boolean) as string[];
  const { titre } = await editeur(v.sujet, faits, agent.reponse);

  // Évolution dans le temps : mentions par mois (date de publication) pour les marques principales, et demande Google sur 12 mois
  const pubs: Ligne[] = [];
  for (let off = 0; off < 6000; off += 1000) {
    const { data } = await db().from("sl_v_videos").select("posted_at, marques, views, focus").eq("veille_id", v.id).range(off, off + 999);
    pubs.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  // 4 courbes lisibles : les 2 premières marques L'Oréal et les 2 premiers concurrents
  const principales = [...marques.filter((m) => m.est_loreal).slice(0, 2), ...marques.filter((m) => !m.est_loreal).slice(0, 2)]
    .map((m) => ({ nom: String(m.marque), loreal: Boolean(m.est_loreal) }));
  const parMois = new Map<string, Ligne>();
  for (const p of pubs) {
    const mo = coupe(String(p.posted_at ?? ""), 7);
    if (!/^\d{4}-\d{2}$/.test(mo)) continue;
    const row = parMois.get(mo) ?? { mois: mo, total: 0 };
    row.total = n(row.total) + 1;
    const ms = new Set(((p.marques as string[] | null) ?? []).map(marqueCanon));
    for (const b of principales) if (ms.has(b.nom)) row[b.nom] = n(row[b.nom]) + 1;
    parMois.set(mo, row);
  }
  // en % des vidéos du mois : le volume collecté varie selon les mois (sources différentes), la part reste comparable
  // seulement les mois assez fournis (≥ 50 vidéos), et les 5 derniers : les mois creux donnent des pourcentages trompeurs
  const mois = [...parMois.values()].sort((a, b) => String(a.mois).localeCompare(String(b.mois))).filter((r) => n(r.total) >= 50).slice(-5)
    .map((r) => { const o: Ligne = { mois: r.mois, total: r.total }; for (const b of principales) o[b.nom] = Math.round((1000 * n(r[b.nom])) / n(r.total)) / 10; return o; });
  const rech = await lire("sl_v_recherche", v.id, { order: ["week", true], limit: 3000 }).catch(() => [] as Ligne[]);
  const parSemaine = new Map<string, Ligne>();
  for (const r of rech) { const w = String(r.week); const x = parSemaine.get(w) ?? { semaine: w }; x[String(r.keyword)] = n(r.value); parSemaine.set(w, x); }
  // Google : 6 derniers mois, moyenne glissante sur 4 semaines, uniquement les recherches qui ont un vrai volume
  const semaines = [...parSemaine.values()].sort((a, b) => String(a.semaine).localeCompare(String(b.semaine)));
  const motsTous = [...new Set(rech.map((r) => String(r.keyword)))];
  const moyenne = (k: string) => semaines.reduce((x, w) => x + n(w[k]), 0) / (semaines.length || 1);
  const motsG = motsTous.filter((k) => moyenne(k) >= 5).sort((a, b) => moyenne(b) - moyenne(a)).slice(0, 4);
  const lisse = semaines.map((w, i) => {
    const o: Ligne = { semaine: w.semaine };
    for (const k of motsG) { const f = semaines.slice(Math.max(0, i - 3), i + 1); o[k] = Math.round((f.reduce((x, y) => x + n(y[k]), 0) / f.length) * 10) / 10; }
    return o;
  }).slice(-26);
  const MOIS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const lib = (m: string) => `${MOIS_FR[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
  let lecture_mois = "";
  if (mois.length >= 2 && principales.length) {
    const a = mois[0], b = mois[mois.length - 1];
    const chg = principales.map((m) => ({ m, d: n(b[m.nom]) - n(a[m.nom]) })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d))[0];
    lecture_mois = `${chg.m.nom} passe de ${fr(n(a[chg.m.nom]))} % des vidéos en ${lib(String(a.mois))} à ${fr(n(b[chg.m.nom]))} % en ${lib(String(b.mois))} (${chg.d >= 0 ? "+" : ""}${fr(chg.d)} points).`;
  }
  let lecture_google = "";
  if (lisse.length >= 8 && motsG.length) {
    const a = lisse[0], b = lisse[lisse.length - 1];
    const k = motsG[0];
    lecture_google = `« ${k} » est la recherche la plus forte : indice ${fr(n(b[k]))} fin de période, contre ${fr(n(a[k]))} six mois plus tôt.`;
  }
  const evolution = { mois, marques: principales, recherche: lisse, mots: motsG.map((k) => ({ nom: k, loreal: estLoreal(k) })), lecture_mois, lecture_google };
  const etapesV = ((await db().from("sl_veilles").select("etapes").eq("id", v.id).maybeSingle()).data?.etapes ?? []) as Ligne[];
  const conso = etapesV.find((e) => e.etape === "consolidation");

  // Comparaison avec l'autre zone (France ↔ États-Unis) si une veille existe sur le même sujet
  // comparaison : avec les États-Unis depuis la France ou l'Europe ; depuis les États-Unis, avec l'Europe (sinon la France)
  const candidats = v.pays === "US" ? ["EU", "FR"] : ["US"];
  let autre = null;
  for (const c of candidats) { autre = await trouverVeille(sujet, c); if (autre) break; }
  let comparaison: DashboardPrisme["comparaison"] = null;
  if (autre) {
    const a = autre.meilleure;
    const runA = (outil: string, args: Ligne = {}) => OUTILS[outil].run(a.id, args).catch(() => [] as Ligne[]);
    const [mA, pA, hA, sA] = await Promise.all([runA("scores_marques", { limite: 12 }), runA("top_produits", { limite: 6 }), runA("top_hashtags", { limite: 6, contient: v.sujet.split(" ")[0].toLowerCase() }), sources(a.id).catch(() => [])]);
    comparaison = { pays: a.pays, veille_id: a.id, videos: n((a.stats as Ligne | null)?.videos), pdv_loreal: Math.round(mA.filter((m) => m.est_loreal).reduce((x, m) => x + n(m.part_de_voix_pct), 0) * 10) / 10,
      marques: mA, produits: pA, hashtags: hA, sources: sA };
  }
  const { data: tousPays } = await db().from("sl_veilles").select("pays, sujet").in("statut", ["termine", "partiel"]).limit(200);
  const mots = sujet.toLowerCase().split(/\s+/).filter((m) => m.length >= 4);
  const pays_disponibles = [...new Set((tousPays ?? []).filter((x) => mots.some((m) => String(x.sujet).toLowerCase().includes(m))).map((x) => String(x.pays)))];
  const accroche = `${faits[0] ? faits[0][0].toUpperCase() + faits[0].slice(1) : ""}${faits[1] ? ` ; ${faits[1]}` : ""}.${pire ? ` Point faible : ${faits[faits.length - 1]}.` : ""}`;
  return {
    sujet,
    veille: { id: v.id, sujet: v.sujet, pays: v.pays, date: v.started_at, videos: n(stats.videos), commentaires: n(stats.commentaires) },
    autres_veilles: trouve.autres.map((a) => ({ id: a.id, sujet: a.sujet, date: a.started_at })),
    titre, accroche, kpis, agent, comparaison, pays_disponibles, sources: await sources(v.id).catch(() => []),
    evolution, consolidation: conso ? { veilles: n(conso.veilles) } : null,
    donnees: {
      marques, aspects_par_marque: aspects,
      verbatims: verbatims.map((c) => ({ marque: marqueCanon(c.marque), sentiment: c.sentiment, texte: coupe(String(c.text), 260), likes: c.likes, plateforme: c.platform, url: c.url ?? null })),
      hashtags, produits,
      formats: fc.filter((x) => x.categorie === "format"), contenus: fc.filter((x) => x.categorie === "contenu"),
      recherche, montantes, videos, demandes,
    },
  };
}

/** Fiche produit : on cherche le produit dans TOUTE la base (toutes veilles, tous pays), pas seulement dans la veille affichée. */
export async function detailProduit(veilleId: string, noms: string[], produit = noms[0]) {
  void veilleId;
  const sb = db();
  // nom court pour élargir la recherche dans les légendes (« Patrick Ta · Transition Blush » -> « transition blush »)
  const court = String(produit).split("·").pop()!.trim();
  const [parFiche, parLegende] = await Promise.all([
    sb.from("sl_video_insights").select("platform, video_id").overlaps("produits", noms).limit(80),
    court.length >= 6 ? sb.from("sl_videos").select("platform, video_id").ilike("caption", `%${court}%`).limit(80) : Promise.resolve({ data: [] as Ligne[] }),
  ]);
  const cles = new Map<string, { platform: string; video_id: string }>();
  for (const r of [...(parFiche.data ?? []), ...((parLegende.data ?? []) as Ligne[])]) cles.set(`${r.platform}:${r.video_id}`, { platform: String(r.platform), video_id: String(r.video_id) });
  const parPf = new Map<string, string[]>();
  for (const k of cles.values()) parPf.set(k.platform, [...(parPf.get(k.platform) ?? []), k.video_id]);

  const videos: Ligne[] = [], fiches: Ligne[] = [], commentaires: Ligne[] = [];
  for (const [platform, ids] of parPf) {
    for (let i = 0; i < ids.length; i += 60) {
      const lot = ids.slice(i, i + 60);
      const [v, f, c] = await Promise.all([
        sb.from("sl_videos").select("platform, video_id, url, image_url, views, likes, caption, country").eq("platform", platform).in("video_id", lot),
        sb.from("sl_video_insights").select("platform, video_id, teintes, sentiment, insight, resume, format, fini, marques").eq("platform", platform).in("video_id", lot),
        sb.from("sl_comments").select("platform, video_id, text, likes, sentiment, aspects, intention_achat, demande").eq("platform", platform).in("video_id", lot).order("likes", { ascending: false }).limit(200),
      ]);
      videos.push(...(v.data ?? [])); fiches.push(...(f.data ?? [])); commentaires.push(...(c.data ?? []));
    }
  }
  const url = new Map(videos.map((v) => [`${v.platform}:${v.video_id}`, v.url]));
  const vuesTot = videos.reduce((x, v) => x + n(v.views), 0);

  // teintes citées / vues (avec couleur quand l'IA l'a lue sur l'image)
  const teintes = new Map<string, { nom: string; hex: string | null; n: number }>();
  for (const f of fiches) for (const t of ((f.teintes as Ligne[] | null) ?? [])) {
    const nom = String(t?.nom ?? "").trim(); if (!nom || nom.length > 40) continue;
    const k = nom.toLowerCase(); const x = teintes.get(k) ?? { nom, hex: null, n: 0 };
    x.n++; if (!x.hex && typeof t.hex === "string" && /^#[0-9a-f]{6}$/i.test(t.hex)) x.hex = t.hex; teintes.set(k, x);
  }
  const asp = new Map<string, { aspect: string; positif: number; negatif: number }>();
  const intention: Record<string, number> = {};
  for (const c of commentaires) {
    for (const a of ((c.aspects as Ligne[] | null) ?? [])) {
      const k = String(a.aspect); const x = asp.get(k) ?? { aspect: k, positif: 0, negatif: 0 };
      if (a.sentiment === "positif") x.positif++; else if (a.sentiment === "négatif") x.negatif++; asp.set(k, x);
    }
    if (c.intention_achat && c.intention_achat !== "aucune") intention[String(c.intention_achat)] = (intention[String(c.intention_achat)] ?? 0) + 1;
  }
  const s = fiches.map((f) => ({ positif: 1, "négatif": -1 } as Record<string, number>)[String(f.sentiment)] ?? 0);
  const pays: Record<string, number> = {};
  for (const v of videos) if (v.country) pays[String(v.country)] = (pays[String(v.country)] ?? 0) + 1;
  const tri = [...videos].sort((a, b) => n(b.views) - n(a.views));
  return {
    produit,
    marque: produit.includes("·") ? produit.split("·")[0].trim() : marqueCanon(((fiches.find((f) => ((f.marques as string[] | null) ?? []).length)?.marques as string[] | undefined) ?? [])[0] ?? ""),
    image: (tri.find((v) => v.image_url)?.image_url as string | undefined) ?? null,
    stats: { videos: videos.length, vues: vuesTot, likes: videos.reduce((x, v) => x + n(v.likes), 0), commentaires: commentaires.length,
      sentiment: s.length ? Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 100) / 100 : null,
      formats: [...new Set(fiches.map((f) => f.format).filter((f) => f && f !== "inconnu"))].slice(0, 3) as string[],
      finis: [...new Set(fiches.map((f) => f.fini).filter((f) => f && f !== "inconnu"))].slice(0, 2) as string[], pays },
    teintes: [...teintes.values()].sort((a, b) => b.n - a.n).slice(0, 8),
    intention,
    ce_que_disent_les_videos: [...new Set(fiches.map((f) => String(f.resume || f.insight || "")).filter((x) => x.length > 20))].slice(0, 4),
    videos: tri.slice(0, 8).map((v) => ({ plateforme: String(v.platform), url: String(v.url ?? ""), image: (v.image_url as string | null) ?? null, vues: n(v.views), legende: coupe(String(v.caption ?? ""), 140) })),
    aspects: [...asp.values()].sort((a, b) => b.positif + b.negatif - (a.positif + a.negatif)).slice(0, 6),
    commentaires: commentaires.filter((c) => c.sentiment === "positif" || c.sentiment === "négatif").sort((a, b) => n(b.likes) - n(a.likes)).slice(0, 6)
      .map((c) => ({ texte: coupe(String(c.text), 240), sentiment: String(c.sentiment), likes: n(c.likes), plateforme: String(c.platform), url: (url.get(`${c.platform}:${c.video_id}`) as string | undefined) ?? null })),
    demandes: [...new Set(commentaires.map((c) => String(c.demande ?? "")).filter((d) => d.length > 8))].slice(0, 4),
  };
}
export type DetailProduit = Awaited<ReturnType<typeof detailProduit>>;

/**
 * Vue « micro » d'une marque (ou de tout le groupe L'Oréal si marque = "groupe") dans la veille affichée :
 * ses produits, ses vidéos, ce qu'on en dit. Calculé par le code à partir de la base, sans LLM (réponse rapide).
 */
export async function focusMarque(veilleId: string, marque: string) {
  const groupe = marque === "groupe";
  const garde = (m: unknown) => (groupe ? estLoreal(m) : marqueCanon(m) === marqueCanon(marque));
  const run = (outil: string, args: Ligne = {}) => OUTILS[outil].run(veilleId, args).catch(() => [] as Ligne[]);
  const [produits, videos, verbatims, aspects] = await Promise.all([
    run("top_produits", groupe ? { limite: 300 } : { marque, limite: 300 }).then((r) => parVideos(r.filter((p) => garde(p.marque))).slice(0, 8)),
    groupe ? run("videos_phares", { limite: 200 }).then((r) => r.filter((v) => ((v.marques as string[]) ?? []).some(garde)).slice(0, 10)) : run("videos_phares", { marque, limite: 10 }),
    lire("sl_v_verbatims", veilleId, { order: ["likes", false], limit: 400 }).then((r) => r.filter((c) => garde(c.marque)).slice(0, 6)
      .map((c) => ({ marque: marqueCanon(c.marque), sentiment: c.sentiment, texte: coupe(String(c.text), 240), likes: c.likes, plateforme: c.platform, url: c.url ?? null }))).catch(() => [] as Ligne[]),
    lire("sl_v_aspects", veilleId, { limit: 3000 }).then((r) => {
      const m = new Map<string, { aspect: string; positif: number; negatif: number }>();
      for (const a of r) { if (!garde(a.marque)) continue; const k = String(a.aspect); const x = m.get(k) ?? { aspect: k, positif: 0, negatif: 0 }; x.positif += n(a.positif); x.negatif += n(a.negatif); m.set(k, x); }
      return [...m.values()].sort((a, b) => b.positif + b.negatif - (a.positif + a.negatif)).slice(0, 7);
    }).catch(() => []),
  ]);
  return { marque, produits, videos, verbatims, aspects };
}

export type FocusMarque = Awaited<ReturnType<typeof focusMarque>>;
