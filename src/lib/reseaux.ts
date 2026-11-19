import "server-only";
import { coupe } from "./texte";
import { db } from "./social";

/**
 * Réseaux des marques : ce que publient les comptes OFFICIELS (L'Oréal et concurrents) sur TikTok, Instagram et YouTube,
 * et comment leur public réagit. Données : sl_comptes (comptes vérifiés) + sl_videos (source = compte_officiel)
 * + sl_video_insights (type de contenu, ton) + sl_comments (classés par l'IA).
 */
type Ligne = Record<string, unknown>;
const n = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0) || 0);

export interface MarqueReseaux {
  marque: string;
  est_loreal: boolean;
  comptes: { plateforme: string; compte: string; url: string | null; abonnes: number }[];
  abonnes: number;
  publications: number;
  vues_moy: number | null;          // vues moyennes par publication (TikTok, YouTube, reels)
  engagement_moy: number | null;    // (likes + commentaires) ÷ vues, moyenne
  likes_moy: number;
  commentaires_lus: number;
  avis_positifs_pct: number | null; // parmi les commentaires positifs ou négatifs
  contenus: Record<string, number>; // types de contenu publiés
  hashtags: string[];
  top: { plateforme: string; url: string; image: string | null; vues: number; likes: number; legende: string }[];
  verbatims: { texte: string; sentiment: string; likes: number; url: string | null }[];
}

export async function reseauxMarques() {
  const sb = db();
  const [{ data: comptes }, { data: posts }] = await Promise.all([
    sb.from("sl_comptes").select("*").eq("verifie", true),
    sb.from("sl_videos").select("platform, video_id, compte, url, image_url, views, likes, comments, caption, hashtags, engagement_rate, posted_at").eq("source", "compte_officiel").limit(2000),
  ]);
  const C = (comptes ?? []) as Ligne[], P = (posts ?? []) as Ligne[];
  const compteDe = new Map(C.map((c) => [`${c.plateforme}:${String(c.compte).toLowerCase()}`, c]));

  // fiches (type de contenu) et commentaires des publications
  const fiches = new Map<string, Ligne>(), coms: Ligne[] = [];
  const parPf = new Map<string, string[]>();
  for (const p of P) parPf.set(String(p.platform), [...(parPf.get(String(p.platform)) ?? []), String(p.video_id)]);
  for (const [platform, ids] of parPf) {
    for (let i = 0; i < ids.length; i += 80) {
      const lot = ids.slice(i, i + 80);
      const [f, c] = await Promise.all([
        sb.from("sl_video_insights").select("platform, video_id, type_contenu, sentiment").eq("platform", platform).in("video_id", lot),
        sb.from("sl_comments").select("platform, video_id, text, likes, sentiment").eq("platform", platform).in("video_id", lot).limit(2000),
      ]);
      for (const x of f.data ?? []) fiches.set(`${x.platform}:${x.video_id}`, x);
      coms.push(...(c.data ?? []));
    }
  }
  const comsDe = new Map<string, Ligne[]>();
  for (const c of coms) comsDe.set(`${c.platform}:${c.video_id}`, [...(comsDe.get(`${c.platform}:${c.video_id}`) ?? []), c]);

  const parMarque = new Map<string, { m: MarqueReseaux; vues: number[]; eng: number[]; likes: number[]; pos: number; neg: number; tags: Map<string, number> }>();
  for (const c of C) {
    const k = String(c.marque);
    const x = parMarque.get(k) ?? { m: { marque: k, est_loreal: Boolean(c.est_loreal), comptes: [] as MarqueReseaux["comptes"], abonnes: 0, publications: 0, vues_moy: null, engagement_moy: null, likes_moy: 0,
      commentaires_lus: 0, avis_positifs_pct: null, contenus: {}, hashtags: [], top: [], verbatims: [] as MarqueReseaux["verbatims"] } as MarqueReseaux, vues: [] as number[], eng: [] as number[], likes: [] as number[], pos: 0, neg: 0, tags: new Map<string, number>() };
    x.m.comptes.push({ plateforme: String(c.plateforme), compte: String(c.compte), url: (c.url as string | null) ?? null, abonnes: n(c.abonnes) });
    x.m.abonnes += n(c.abonnes);
    parMarque.set(k, x);
  }
  const tous: { k: string; p: Ligne }[] = [];
  for (const p of P) {
    const c = compteDe.get(`${p.platform}:${String(p.compte).toLowerCase()}`);
    if (!c) continue;
    const x = parMarque.get(String(c.marque))!;
    const cle = `${p.platform}:${p.video_id}`;
    x.m.publications++;
    if (n(p.views) > 0) { x.vues.push(n(p.views)); x.eng.push((n(p.likes) + n(p.comments)) / n(p.views)); }
    x.likes.push(n(p.likes));
    const t = String(fiches.get(cle)?.type_contenu ?? "autre"); x.m.contenus[t] = (x.m.contenus[t] ?? 0) + 1;
    for (const h of ((p.hashtags as string[] | null) ?? []).slice(0, 15)) x.tags.set(h, (x.tags.get(h) ?? 0) + 1);
    for (const cm of comsDe.get(cle) ?? []) {
      x.m.commentaires_lus++;
      if (cm.sentiment === "positif") x.pos++; else if (cm.sentiment === "négatif") x.neg++;
      if ((cm.sentiment === "positif" || cm.sentiment === "négatif") && String(cm.text).length >= 20)
        x.m.verbatims.push({ texte: coupe(String(cm.text), 220), sentiment: String(cm.sentiment), likes: n(cm.likes), url: (p.url as string | null) ?? null });
    }
    tous.push({ k: String(c.marque), p });
  }
  const moy = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const marques = [...parMarque.values()].map(({ m, vues, eng, likes, pos, neg, tags }) => {
    const mesPosts = tous.filter((t) => t.k === m.marque).map((t) => t.p).sort((a, b) => (n(b.views) || n(b.likes) * 20) - (n(a.views) || n(a.likes) * 20));
    return {
      ...m,
      vues_moy: moy(vues) === null ? null : Math.round(moy(vues)!),
      engagement_moy: moy(eng) === null ? null : Math.round(moy(eng)! * 10000) / 100,
      likes_moy: Math.round(moy(likes) ?? 0),
      avis_positifs_pct: pos + neg >= 10 ? Math.round((100 * pos) / (pos + neg)) : null,
      hashtags: [...tags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([h]) => `#${h}`),
      top: mesPosts.slice(0, 4).map((p) => ({ plateforme: String(p.platform), url: String(p.url ?? ""), image: (p.image_url as string | null) ?? null, vues: n(p.views), likes: n(p.likes), legende: coupe(String(p.caption ?? ""), 120) })),
      verbatims: m.verbatims.sort((a, b) => b.likes - a.likes).slice(0, 4),
    } satisfies MarqueReseaux;
  }).filter((m) => m.publications > 0).sort((a, b) => b.abonnes - a.abonnes);

  const date = P.map((p) => String(p.posted_at ?? "")).sort().pop() ?? null;
  return { marques, publications: P.length, commentaires: coms.length, derniere_publication: date };
}
export type Reseaux = Awaited<ReturnType<typeof reseauxMarques>>;
