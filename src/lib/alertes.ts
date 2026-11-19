import "server-only";
import { coupe } from "./texte";
import { db } from "./social";
import { estLoreal, marqueCanon } from "./marques";

/**
 * Veille de crise : signaux faibles et alertes sur les marques du groupe L'Oréal, calculés par le CODE sur toute la base.
 * Inspiré des outils de veille de réputation (alertes sur pics de mentions négatives, termes sensibles, contenus viraux).
 * Quatre signaux :
 *  1. contenu viral négatif sur une marque L'Oréal ;
 *  2. termes sensibles dans les commentaires (allergie, arnaque, boycott, tests sur animaux…) ;
 *  3. aspect produit majoritairement critiqué (ex. packaging) ;
 *  4. publication d'un compte officiel L'Oréal à forte proportion de commentaires négatifs.
 */
type Ligne = Record<string, unknown>;
const n = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0) || 0);

export type Gravite = "critique" | "élevée" | "à surveiller";
export interface Alerte {
  id: string;
  gravite: Gravite;
  type: "viral_negatif" | "terme_sensible" | "aspect_critique" | "compte_officiel";
  marque: string;
  titre: string;
  constat: string;
  action: string;
  date: string | null;
  exemples: { texte: string; url: string | null; detail: string }[];
}

const SENSIBLES: { cle: string; motif: RegExp; libelle: string; action: string }[] = [
  { cle: "sante", motif: /allerg|r[ée]action cutan|irritation|br[uû]l(é|ure|ing)|rash|eczema|ecz[ée]ma|bouton(s)? apr[eè]s|breakout/i, libelle: "tolérance / réaction cutanée",
    action: "Faire vérifier par l'équipe réglementaire et consommateurs ; préparer une réponse factuelle sur la formule et les tests de tolérance." },
  { cle: "confiance", motif: /arnaque|scam|mensong|\blying\b|\bliar\b|trompe|misleading|fake review|publicit[ée] mensong/i, libelle: "accusation de tromperie",
    action: "Identifier la publication d'origine ; vérifier les allégations produit ; réponse transparente par le service client et la marque." },
  { cle: "ethique", motif: /boycott|test(s|é|ed)? (sur|on) (les )?animaux|animal test|cruelty|cruaut[ée]|racis|greenwashing/i, libelle: "éthique / appel au boycott",
    action: "Alerter la communication corporate ; rappeler les engagements publics du groupe avec des sources vérifiables." },
  { cle: "qualite", motif: /contrefa|counterfeit|p[ée]rim[ée]|moisi|mold|cass[ée] (à|a) la livraison|d[ée]fectueux|defective/i, libelle: "qualité / contrefaçon",
    action: "Transmettre au service qualité ; vérifier les canaux de distribution cités ; contacter les clientes concernées." },
];

export async function alertes(): Promise<{ alertes: Alerte[]; analyse: { commentaires: number; videos: number } }> {
  const sb = db();
  const out: Alerte[] = [];

  // 1. Contenus viraux négatifs (vidéos centrées sur une marque L'Oréal, ton négatif)
  const { data: negs } = await sb.from("sl_video_insights").select("platform, video_id, marques, insight, resume").eq("sentiment", "négatif").limit(2000);
  const cles = (negs ?? []).filter((x) => ((x.marques as string[] | null) ?? []).some(estLoreal));
  const parPf = new Map<string, string[]>();
  for (const x of cles) parPf.set(String(x.platform), [...(parPf.get(String(x.platform)) ?? []), String(x.video_id)]);
  const vids = new Map<string, Ligne>();
  for (const [pf, ids] of parPf) for (let i = 0; i < ids.length; i += 80) {
    const { data } = await sb.from("sl_videos").select("platform, video_id, url, views, caption, posted_at, source").eq("platform", pf).in("video_id", ids.slice(i, i + 80));
    for (const v of data ?? []) vids.set(`${v.platform}:${v.video_id}`, v);
  }
  for (const x of cles) {
    const v = vids.get(`${x.platform}:${x.video_id}`);
    if (!v || v.source === "compte_officiel") continue;
    const vues = n(v.views);
    if (vues < 100_000) continue;
    const marque = marqueCanon(((x.marques as string[]) ?? []).find(estLoreal));
    out.push({
      id: `viral-${x.platform}-${x.video_id}`, type: "viral_negatif", marque,
      gravite: vues >= 1_000_000 ? "critique" : vues >= 300_000 ? "élevée" : "à surveiller",
      titre: `Contenu négatif à forte audience sur ${marque}`,
      constat: `${new Intl.NumberFormat("fr-FR", { notation: "compact" }).format(vues)} vues sur ${x.platform}. ${coupe(String(x.resume || x.insight || ""), 220)}`,
      action: "Analyser la publication et sa propagation ; décider d'une prise de parole (réponse, contenu correctif, contact du créateur).",
      date: (v.posted_at as string | null) ?? null,
      exemples: [{ texte: coupe(String(v.caption ?? ""), 200), url: (v.url as string | null) ?? null, detail: `${new Intl.NumberFormat("fr-FR", { notation: "compact" }).format(vues)} vues` }],
    });
  }

  // 2. Termes sensibles dans les commentaires rattachés à une marque L'Oréal
  const motsSql = ["allerg", "irritation", "brûl", "burn", "rash", "arnaque", "scam", "lying", "mensong", "boycott", "animal", "animaux", "cruelty", "racis", "contrefa", "counterfeit", "périm", "defective", "moisi", "mold"];
  const { data: coms } = await sb.from("sl_comments").select("platform, video_id, text, likes, marque, posted_at")
    .or(motsSql.map((m) => `text.ilike.*${m}*`).join(",")).not("marque", "is", null).limit(3000);
  const groupes = new Map<string, { s: (typeof SENSIBLES)[number]; marque: string; c: Ligne[] }>();
  for (const c of coms ?? []) {
    if (!estLoreal(c.marque)) continue;
    const s = SENSIBLES.find((x) => x.motif.test(String(c.text)));
    if (!s) continue;
    const marque = marqueCanon(c.marque);
    const k = `${marque}|${s.cle}`;
    const g = groupes.get(k) ?? { s, marque, c: [] };
    g.c.push(c); groupes.set(k, g);
  }
  const urlDe = async (rows: Ligne[]) => {
    const m = new Map<string, string>();
    for (const r of rows) {
      const { data } = await sb.from("sl_videos").select("url").eq("platform", String(r.platform)).eq("video_id", String(r.video_id)).maybeSingle();
      if (data?.url) m.set(`${r.platform}:${r.video_id}`, String(data.url));
    }
    return m;
  };
  for (const g of groupes.values()) {
    const likes = g.c.reduce((x, c) => x + n(c.likes), 0);
    if (g.c.length < 3 && likes < 200) continue;
    const top = [...g.c].sort((a, b) => n(b.likes) - n(a.likes)).slice(0, 3);
    const urls = await urlDe(top);
    out.push({
      id: `terme-${g.marque}-${g.s.cle}`, type: "terme_sensible", marque: g.marque,
      gravite: g.c.length >= 15 || likes >= 2000 ? "critique" : g.c.length >= 6 || likes >= 500 ? "élevée" : "à surveiller",
      titre: `${g.marque} : signaux « ${g.s.libelle} »`,
      constat: `${g.c.length} commentaires (${new Intl.NumberFormat("fr-FR").format(likes)} j'aime au total) mentionnent ce sujet.`,
      action: g.s.action,
      date: top.map((c) => String(c.posted_at ?? "")).sort().pop() || null,
      exemples: top.map((c) => ({ texte: coupe(String(c.text), 200), url: urls.get(`${c.platform}:${c.video_id}`) ?? null, detail: `${n(c.likes)} j'aime` })),
    });
  }

  // 3. Aspects majoritairement critiqués pour une marque L'Oréal (toutes veilles)
  // chaque commentaire compté une seule fois (la vue par veille compterait deux fois un commentaire présent dans deux veilles)
  const agg = new Map<string, { marque: string; aspect: string; p: number; ng: number }>();
  for (let off = 0; off < 40000; off += 1000) {
    const { data } = await sb.from("sl_comments").select("marque, aspects").not("marque", "is", null).neq("aspects", "[]").range(off, off + 999);
    for (const c of data ?? []) {
      if (!estLoreal(c.marque)) continue;
      const marque = marqueCanon(c.marque);
      for (const a of (c.aspects as Ligne[] | null) ?? []) {
        const k = `${marque}|${a.aspect}`;
        const x = agg.get(k) ?? { marque, aspect: String(a.aspect), p: 0, ng: 0 };
        if (a.sentiment === "positif") x.p++; else if (a.sentiment === "négatif") x.ng++;
        agg.set(k, x);
      }
    }
    if ((data ?? []).length < 1000) break;
  }
  for (const x of agg.values()) {
    const tot = x.p + x.ng, part = tot ? x.ng / tot : 0;
    if (tot < 15 || part < 0.6) continue;
    out.push({
      id: `aspect-${x.marque}-${x.aspect}`, type: "aspect_critique", marque: x.marque,
      gravite: part >= 0.8 && tot >= 30 ? "critique" : part >= 0.7 ? "élevée" : "à surveiller",
      titre: `${x.marque} : « ${x.aspect} » majoritairement critiqué`,
      constat: `${Math.round(part * 100)} % d'avis négatifs sur cet aspect (${x.ng} négatifs, ${x.p} positifs).`,
      action: "Partager avec l'équipe produit ; vérifier si la critique porte sur une référence précise ; adapter le discours ou le produit.",
      date: null, exemples: [],
    });
  }

  // 4. Publications de comptes officiels L'Oréal avec beaucoup de commentaires négatifs
  const { data: off } = await sb.from("sl_videos").select("platform, video_id, url, caption, creator, posted_at").eq("source", "compte_officiel").limit(2000);
  const offL = (off ?? []).filter((p) => estLoreal(p.creator));
  const pfs = new Map<string, string[]>();
  for (const p of offL) pfs.set(String(p.platform), [...(pfs.get(String(p.platform)) ?? []), String(p.video_id)]);
  const parPost = new Map<string, { pos: number; neg: number; ex: Ligne[] }>();
  for (const [pf, ids] of pfs) for (let i = 0; i < ids.length; i += 80) {
    const { data } = await sb.from("sl_comments").select("platform, video_id, text, likes, sentiment").eq("platform", pf).in("video_id", ids.slice(i, i + 80)).in("sentiment", ["positif", "négatif"]).limit(3000);
    for (const c of data ?? []) {
      const k = `${c.platform}:${c.video_id}`, x = parPost.get(k) ?? { pos: 0, neg: 0, ex: [] };
      if (c.sentiment === "négatif") { x.neg++; x.ex.push(c); } else x.pos++;
      parPost.set(k, x);
    }
  }
  for (const p of offL) {
    const x = parPost.get(`${p.platform}:${p.video_id}`);
    if (!x || x.pos + x.neg < 8) continue;
    const part = x.neg / (x.pos + x.neg);
    if (part < 0.4) continue;
    out.push({
      id: `officiel-${p.platform}-${p.video_id}`, type: "compte_officiel", marque: String(p.creator),
      gravite: part >= 0.6 ? "élevée" : "à surveiller",
      titre: `Publication officielle ${p.creator} : réactions négatives`,
      constat: `${Math.round(part * 100)} % de commentaires négatifs (${x.neg} sur ${x.pos + x.neg}) sur une publication ${p.platform} du compte officiel.`,
      action: "Lire les commentaires avec le community manager ; répondre aux questions récurrentes ; ajuster les prochaines publications.",
      date: (p.posted_at as string | null) ?? null,
      exemples: x.ex.sort((a, b) => n(b.likes) - n(a.likes)).slice(0, 2).map((c) => ({ texte: coupe(String(c.text), 200), url: (p.url as string | null) ?? null, detail: `${n(c.likes)} j'aime` })),
    });
  }

  const ordre: Record<Gravite, number> = { critique: 0, "élevée": 1, "à surveiller": 2 };
  out.sort((a, b) => ordre[a.gravite] - ordre[b.gravite] || String(b.date ?? "").localeCompare(String(a.date ?? "")));
  return { alertes: out, analyse: { commentaires: (coms ?? []).length, videos: vids.size } };
}
export type Alertes = Awaited<ReturnType<typeof alertes>>;
