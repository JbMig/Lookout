import "server-only";
import { config } from "./config";
import { HttpError } from "./auth";
import { db, type Graphique } from "./social";

/**
 * Prisme : agent analyste du social listening, indépendant de n8n.
 * Il lit directement les données déjà collectées dans Supabase (tables et vues sl_*), avec des outils en LECTURE SEULE,
 * décide lui-même quoi consulter (plusieurs tours), puis rédige une réponse et demande des graphiques.
 * Garde-fou : un graphique est construit par le serveur à partir du résultat d'un outil (référence r1, r2…) ;
 * le LLM ne fournit jamais lui-même les chiffres d'un graphique.
 */

const MODELES = [process.env.PRISME_MODEL || "Qwen/Qwen3-235B-A22B-Instruct-2507", "openai/gpt-oss-120b"];
const MAX_TOURS = 8;

type Ligne = Record<string, unknown>;
interface Resultat { id: string; outil: string; args: Ligne; lignes: Ligne[] }
export interface EtapeAgent { outil: string; args: Ligne; lignes: number; resultat: string }
export interface ReponsePrisme {
  veille: { id: string; sujet: string; pays: string } | null;
  reponse: string;
  recommandations: string[];
  graphiques: Graphique[];
  etapes: EtapeAgent[];
  modele: string;
  secours: boolean;
}

const nombre = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0) || 0);

/* ---------------- Outils (lecture seule, bornés à une veille) ---------------- */

async function lire(vue: string, veilleId: string, opts: { order?: [string, boolean]; limit?: number; eq?: Ligne; ilike?: [string, string] } = {}) {
  let q = db().from(vue).select("*").eq("veille_id", veilleId);
  for (const [k, v] of Object.entries(opts.eq ?? {})) if (v !== undefined && v !== null && v !== "") q = q.eq(k, v as string);
  if (opts.ilike) q = q.ilike(opts.ilike[0], `%${opts.ilike[1]}%`);
  if (opts.order) q = q.order(opts.order[0], { ascending: opts.order[1] });
  const { data, error } = await q.limit(opts.limit ?? 50);
  if (error) throw new Error(`${vue} : ${error.message}`);
  return (data ?? []) as Ligne[];
}

const GENERIQUES = new Set(["fyp", "foryou", "foryoupage", "pourtoi", "viral", "trending", "makeup", "maquillage", "beauty", "beaute", "beauté",
  "makeuptutorial", "makeuptutorials", "makeupartist", "tiktok", "beautytok", "makeuptok", "grwm", "explore", "explorepage", "reels", "shorts", "mua"]);

type Outil = { description: string; parametres: Record<string, { type: string; description: string }>; run: (v: string, a: Ligne) => Promise<Ligne[]> };

const OUTILS: Record<string, Outil> = {
  scores_marques: {
    description: "Scores par marque : part de voix pondérée (%), sentiment pondéré (-1 à 1), nb de commentaires, borne de Wilson (part d'avis positifs minimale crédible), intention d'achat, confiance, est_loreal.",
    parametres: { limite: { type: "integer", description: "nombre de marques (défaut 12)" } },
    run: async (v, a) => (await lire("sl_brand_scores", v, { order: ["vues", false], limit: nombre(a.limite) || 12 }))
      .map((s) => ({ marque: s.marque, est_loreal: s.est_loreal, part_de_voix_pct: s.part_de_voix_pct, sentiment_pondere: s.sentiment_pondere,
        videos: s.videos, commentaires: s.commentaires, wilson_pos: s.wilson_pos, confiance: s.confiance,
        achete: (s.intention as Ligne | null)?.["achète"] ?? 0, hesite: (s.intention as Ligne | null)?.["hésite"] ?? 0, n_achete_pas: (s.intention as Ligne | null)?.["n'achète pas"] ?? 0 })),
  },
  top_hashtags: {
    description: "Hashtags les plus vus de la veille, hors hashtags génériques (fyp, makeup…). Option : seulement ceux qui contiennent un mot.",
    parametres: { contient: { type: "string", description: "filtre facultatif, ex. 'blush'" }, limite: { type: "integer", description: "défaut 10" } },
    run: async (v, a) => (await lire("sl_v_hashtags", v, { order: ["vues", false], limit: 300, ilike: a.contient ? ["hashtag", String(a.contient)] : undefined }))
      .filter((h) => !GENERIQUES.has(String(h.hashtag)) && nombre(h.videos) >= 2).slice(0, nombre(a.limite) || 10)
      .map((h) => ({ hashtag: `#${h.hashtag}`, vues: h.vues, videos: h.videos, engagement_moyen: h.engagement_moyen })),
  },
  top_produits: {
    description: "Produits les plus vus (vidéos centrées sur le sujet), avec marque, nb de vidéos, sentiment moyen (-1 à 1).",
    parametres: { marque: { type: "string", description: "filtre facultatif" }, limite: { type: "integer", description: "défaut 10" } },
    run: async (v, a) => (await lire("sl_v_produits", v, { order: ["vues", false], limit: nombre(a.limite) || 10, ilike: a.marque ? ["marque", String(a.marque)] : undefined }))
      .map((p) => ({ produit: p.produit, marque: p.marque, vues: p.vues, videos: p.videos, sentiment: p.sentiment })),
  },
  aspects: {
    description: "Ce que disent les commentaires : nombre de mentions positives / négatives par aspect (teinte, prix, packaging, tenue…), toutes marques ou une marque.",
    parametres: { marque: { type: "string", description: "filtre facultatif" } },
    run: async (v, a) => {
      const rows = await lire("sl_v_aspects", v, { limit: 2000, ilike: a.marque ? ["marque", String(a.marque)] : undefined });
      const m = new Map<string, { aspect: string; positif: number; negatif: number }>();
      for (const r of rows) {
        const k = String(r.aspect); const d = m.get(k) ?? { aspect: k, positif: 0, negatif: 0 };
        d.positif += nombre(r.positif); d.negatif += nombre(r.negatif); m.set(k, d);
      }
      return [...m.values()].sort((x, y) => y.positif + y.negatif - (x.positif + x.negatif)).slice(0, 10);
    },
  },
  verbatims: {
    description: "Commentaires réels les plus aimés (sans pseudo), filtrables par marque et sentiment ('positif' ou 'négatif').",
    parametres: { marque: { type: "string", description: "facultatif" }, sentiment: { type: "string", description: "positif | négatif" }, limite: { type: "integer", description: "défaut 6" } },
    run: async (v, a) => (await lire("sl_v_verbatims", v, { order: ["likes", false], limit: nombre(a.limite) || 6, eq: { sentiment: a.sentiment },
      ilike: a.marque ? ["marque", String(a.marque)] : undefined })).map((c) => ({ marque: c.marque, sentiment: c.sentiment, texte: String(c.text).slice(0, 220), likes: c.likes, plateforme: c.platform })),
  },
  formats_et_contenus: {
    description: "Formats (poudre, liquide, crème…) et types de contenu (tuto, avis, dupe…) : nb de vidéos, vues, engagement moyen.",
    parametres: {},
    run: async (v) => [
      ...(await lire("sl_v_formats", v, { order: ["videos", false], limit: 8 })).filter((f) => f.format !== "inconnu").map((f) => ({ categorie: "format", nom: f.format, videos: f.videos, vues: f.vues, engagement_moyen: f.engagement_moyen })),
      ...(await lire("sl_v_contenus", v, { order: ["videos", false], limit: 8 })).map((c) => ({ categorie: "contenu", nom: c.type_contenu, videos: c.videos, vues: c.vues, engagement_moyen: c.engagement_moyen })),
    ],
  },
  recherche_google: {
    description: "Demande Google (12 mois, échelle commune) : niveau des 4 dernières semaines et évolution vs les 4 précédentes, par mot-clé.",
    parametres: {},
    run: async (v) => {
      const rows = await lire("sl_v_recherche", v, { order: ["week", true], limit: 2000 });
      const parMot = new Map<string, number[]>();
      for (const r of rows) parMot.set(String(r.keyword), [...(parMot.get(String(r.keyword)) ?? []), nombre(r.value)]);
      return [...parMot.entries()].map(([mot, s]) => {
        const a = s.slice(-4).reduce((x, y) => x + y, 0) / 4, p = s.slice(-8, -4).reduce((x, y) => x + y, 0) / 4;
        return { mot, niveau: Math.round(a * 10) / 10, evolution_pct: p ? Math.round((100 * (a - p)) / p) : null };
      }).sort((x, y) => y.niveau - x.niveau);
    },
  },
  recherches_montantes: {
    description: "Recherches Google associées en forte hausse (ex. nouvelles marques ou produits qui montent).",
    parametres: {},
    run: async (v) => {
      const { data: veille } = await db().from("sl_veilles").select("plan, pays").eq("id", v).maybeSingle();
      const seed = (veille?.plan as Ligne | null)?.categorie;
      if (!seed) return [];
      const { data } = await db().from("sl_rising_queries").select("query, growth").eq("seed", seed).eq("kind", "rising").limit(15);
      return (data ?? []).map((r) => ({ recherche: r.query, hausse: r.growth }));
    },
  },
  videos_phares: {
    description: "Vidéos/posts les plus vus de la veille (plateforme, marques, vues, engagement, extrait de légende, lien, miniature).",
    parametres: { marque: { type: "string", description: "facultatif" }, limite: { type: "integer", description: "défaut 6" } },
    run: async (v, a) => {
      let rows = await lire("sl_v_videos", v, { order: ["views", false], limit: 60 });
      rows = rows.filter((r) => r.focus);
      if (a.marque) rows = rows.filter((r) => ((r.marques as string[] | null) ?? []).some((m) => m.toLowerCase().includes(String(a.marque).toLowerCase())));
      return rows.slice(0, nombre(a.limite) || 6).map((r) => ({ plateforme: r.platform, marques: r.marques, vues: r.views, engagement: r.engagement_rate,
        legende: String(r.caption ?? "").slice(0, 160), url: r.url, image: r.image_url }));
    },
  },
};

const CREER_GRAPHIQUE = {
  type: "function",
  function: {
    name: "creer_graphique",
    description: "Demande un graphique construit À PARTIR d'un résultat d'outil déjà obtenu (référence r1, r2…). Tu ne fournis pas les chiffres.",
    parameters: {
      type: "object",
      properties: {
        resultat: { type: "string", description: "référence du résultat, ex. r2" },
        type: { type: "string", enum: ["barres", "barres_empilees", "lignes", "donut"], description: "lignes = uniquement pour une évolution dans le temps ; donut = parts d'un total (ex. part_de_voix_pct)" },
        titre: { type: "string" },
        axe_x: { type: "string", description: "nom du champ pour les libellés (ex. marque, hashtag, aspect)" },
        valeurs: { type: "array", items: { type: "string" }, description: "champs numériques à tracer, de MÊME unité (ex. ['vues'] ; ['positif','negatif'] avec barres_empilees)" },
        lecture: { type: "string", description: "une phrase factuelle qui lit le graphique" },
      },
      required: ["resultat", "type", "titre", "axe_x", "valeurs"],
    },
  },
};

function toolsSpec() {
  return [
    ...Object.entries(OUTILS).map(([name, o]) => ({
      type: "function",
      function: { name, description: o.description, parameters: { type: "object", properties: o.parametres } },
    })),
    CREER_GRAPHIQUE,
  ];
}

/* ---------------- Boucle de l'agent ---------------- */

interface Msg { role: string; content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[]; tool_call_id?: string; name?: string }

async function appelLLM(modele: string, messages: Msg[], conclure = false) {
  const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.hf.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: modele, messages, tools: toolsSpec(), tool_choice: conclure ? "none" : "auto", max_tokens: 4000, temperature: 0.2 }),
    signal: AbortSignal.timeout(50_000),
  });
  if (!res.ok) throw new Error(`HF ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const json = (await res.json()) as { choices?: { message?: Msg }[] };
  const m = json.choices?.[0]?.message;
  if (!m) throw new Error("réponse vide");
  return m;
}

const SYSTEM = `Tu es Prisme, l'agent analyste social listening de Lookout pour l'équipe marketing de L'Oréal.
Tu réponds à la question de l'utilisateur à partir des données d'une veille déjà collectée (TikTok, Instagram, YouTube, Google),
en appelant tes outils (lecture seule). Méthode :
1. Commence par scores_marques, puis choisis les autres outils utiles à la question (3 à 6 appels au total).
2. Demande 3 à 5 graphiques avec creer_graphique, chacun à partir d'un résultat d'outil (r1, r2…). Mets en avant les marques L'Oréal face aux concurrents.
3. Termine par un message final en JSON UNIQUEMENT : {"reponse": "6 à 10 phrases claires pour une cheffe de produit, avec les chiffres des outils",
"recommandations": ["3 actions concrètes"]}.
Règles : tu travailles pour L'Oréal, les recommandations s'adressent toujours à L'Oréal (jamais à un concurrent) ; n'utilise que des chiffres renvoyés par les outils ; signale quand le volume est faible (confiance « faible ») ; pas de jargon.`;

export async function prisme(veilleId: string, question: string): Promise<ReponsePrisme> {
  if (!config.hf.token) throw new HttpError(503, "Prisme indisponible : HF_TOKEN non configuré");
  const { data: v } = await db().from("sl_veilles").select("id, sujet, pays").eq("id", veilleId).maybeSingle();
  if (!v) throw new HttpError(404, "Veille introuvable");

  const resultats: Resultat[] = [];
  const etapes: EtapeAgent[] = [];
  const graphiques: Graphique[] = [];
  let messages: Msg[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: `Veille : « ${v.sujet} » (${v.pays}). Question : ${question}` },
  ];

  for (const modele of MODELES) {
    try {
      for (let tour = 0; tour < MAX_TOURS; tour++) {
        const conclure = tour >= MAX_TOURS - 1; // dernier tour : on force la réponse finale
        if (conclure) messages.push({ role: "user", content: "Tu as assez de données : réponds maintenant avec le JSON final, sans appeler d'outil." });
        const m = await appelLLM(modele, messages, conclure);
        messages.push({ role: "assistant", content: m.content ?? "", tool_calls: m.tool_calls });
        if (!m.tool_calls?.length) {
          const json = JSON.parse((m.content ?? "").match(/\{[\s\S]*\}/)?.[0] ?? "{}") as { reponse?: string; recommandations?: string[] };
          return { veille: v, reponse: json.reponse || m.content || "", recommandations: json.recommandations ?? [], graphiques, etapes, modele, secours: false };
        }
        for (const call of m.tool_calls) {
          const nom = call.function.name;
          let args: Ligne = {};
          try { args = JSON.parse(call.function.arguments || "{}"); } catch { /* arguments vides */ }
          let contenu: string;
          if (nom === "creer_graphique") {
            const r = resultats.find((x) => x.id === args.resultat);
            const champs = (args.valeurs as string[] | undefined) ?? [];
            if (!r || !r.lignes.length) contenu = `Erreur : résultat ${String(args.resultat)} inconnu ou vide.`;
            else {
              // garde-fous : courbes seulement pour des dates ; une seule unité par graphique (sauf barres empilées)
              const xDate = /^\d{4}-\d{2}/.test(String(r.lignes[0]?.[String(args.axe_x)] ?? ""));
              if (args.type === "lignes" && !xDate) args.type = "barres";
              if (args.type !== "barres_empilees" && champs.length > 1) champs.splice(1);
              graphiques.push({
                id: `g${graphiques.length + 1}`, type: (args.type as Graphique["type"]) ?? "barres", titre: String(args.titre ?? ""), axe_x: String(args.axe_x ?? ""),
                series: champs.map((c) => ({ cle: c, nom: c.replace(/_/g, " ") })),
                donnees: r.lignes.slice(0, 15).map((l) => {
                  const out: Graphique["donnees"][number] = { [String(args.axe_x)]: String(l[String(args.axe_x)] ?? ""), loreal: l.est_loreal === true };
                  for (const c of champs) out[c] = nombre(l[c]);
                  return out;
                }),
                lecture: args.lecture ? String(args.lecture) : undefined,
              });
              contenu = `Graphique créé (g${graphiques.length}).`;
            }
            etapes.push({ outil: nom, args, lignes: r?.lignes.length ?? 0, resultat: contenu });
          } else if (OUTILS[nom]) {
            const lignes = await OUTILS[nom].run(v.id, args);
            const id = `r${resultats.length + 1}`;
            resultats.push({ id, outil: nom, args, lignes });
            contenu = JSON.stringify({ resultat: id, lignes }).slice(0, 6000);
            etapes.push({ outil: nom, args, lignes: lignes.length, resultat: id });
          } else contenu = `Outil inconnu : ${nom}`;
          messages.push({ role: "tool", tool_call_id: call.id, name: nom, content: contenu });
        }
      }
      throw new Error("trop de tours");
    } catch (e) {
      console.error("Prisme", modele, e);
      messages = messages.slice(0, 2); // on repart proprement avec le modèle de secours
      resultats.length = 0; etapes.length = 0; graphiques.length = 0;
    }
  }
  // Secours : l'analyse déjà calculée à la fin de la veille (si elle existe).
  const { data: a } = await db().from("sl_analyses").select("contenu").eq("veille_id", v.id).maybeSingle();
  const c = (a?.contenu ?? {}) as { resume?: string; recommandations?: string[]; graphiques?: Graphique[] };
  if (!c.resume) throw new HttpError(502, "Prisme n'a pas pu répondre (modèles indisponibles) et aucune analyse n'est enregistrée");
  return { veille: v, reponse: c.resume, recommandations: c.recommandations ?? [], graphiques: c.graphiques ?? [], etapes: [], modele: "analyse enregistrée", secours: true };
}
