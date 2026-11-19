// LOOKOUT — Agent 3 : Edge Function « save-analysis »
// Les agents Holo n'ouvrent que des adresses web (GET) : cette fonction enregistre pour eux une analyse
// et ses opportunités, comme save-product et save-report le font pour les agents 2 et 4.
//
//   GET ?p=<JSON encodé>
//     { "analyse": { "params": {...}, "result": { "synthese": "...", "top_3": [...], "nb_opportunites": N },
//                    "type"?: "growth_analysis", "status"?: "completed", "error_message"?: null },
//       "opportunites": [ { "kind": "prix|format|teinte|ingredient", "title": "...", "description": "...",
//                           "score": 0-100 (ramené à 0..1), "estimated_impact": {...}, "refs": {...} } ] }
//     -> crée l'analyse puis ses opportunités ; renvoie analysis_id.
//
//   GET ?p=<JSON encodé> avec "analysis_id": "<uuid>" et "opportunites": [...]
//     -> ajoute d'autres opportunités à une analyse déjà créée (envoi en plusieurs fois si l'adresse est trop longue).
//
// Réponse JSON : succès = "ok": true et "status": 200. Les opportunités invalides sont listées dans "rejetees".
const ENTETES = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json; charset=utf-8" };
const URL_SB = Deno.env.get("SUPABASE_URL")!;
const CLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;      // reste côté serveur, jamais renvoyée

const TYPES = ["growth_analysis", "catalog_audit", "market_comparison", "growth_potential", "full"];
const KINDS: Record<string, string> = {
  prix: "prix", price: "prix", price_gap: "prix",
  format: "format", format_gap: "format",
  teinte: "teinte", teintes: "teinte", shade: "teinte", shade_gap: "teinte",
  ingredient: "ingredient", ingredients: "ingredient", ingredient_gap: "ingredient", "ingrédient": "ingredient",
  segment_gap: "segment_gap", winner_to_benchmark: "winner_to_benchmark",
};

const repondre = (corps: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify({ status, ...corps }, null, 1), { status, headers: ENTETES });

async function sb(chemin: string, init: RequestInit = {}) {
  const h: Record<string, string> = { apikey: CLE, "Content-Type": "application/json", Prefer: "return=representation" };
  if (CLE.startsWith("eyJ")) h.Authorization = `Bearer ${CLE}`;
  const res = await fetch(`${URL_SB}${chemin}`, { ...init, headers: { ...h, ...(init.headers ?? {}) } });
  const texte = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${texte.slice(0, 300)}`);
  return texte ? JSON.parse(texte) : null;
}

const objet = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});
const texte = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function opportunite(o: Record<string, unknown>, analysisId: string): { ligne?: Record<string, unknown>; raison?: string } {
  const kind = KINDS[texte(o.kind).toLowerCase()];
  if (!kind) return { raison: `kind invalide « ${texte(o.kind)} » (prix, format, teinte ou ingredient)` };
  const title = texte(o.title);
  if (!title) return { raison: "title manquant" };
  let score = typeof o.score === "number" ? o.score : Number(texte(o.score).replace(",", "."));
  if (!Number.isFinite(score)) score = NaN;
  return { ligne: {
    analysis_id: analysisId, kind, title: title.slice(0, 500), description: texte(o.description) || null,
    // La colonne score est sur 0..1 (le site l'affiche sur 10) : un score sur 100 ou sur 10 est ramené à 0..1.
    score: Number.isFinite(score) ? Math.round(Math.max(0, Math.min(1, score > 10 ? score / 100 : score > 1 ? score / 10 : score)) * 1000) / 1000 : null,
    estimated_impact: objet(o.estimated_impact), refs: objet(o.refs),
  } };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function existants(table: string, ids: string[]): Promise<Set<string>> {
  const valides = ids.filter((i) => UUID.test(i));
  if (!valides.length) return new Set();
  const lignes = await sb(`/rest/v1/${table}?select=id&id=in.(${valides.join(",")})`) as { id: string }[];
  return new Set(lignes.map((l) => l.id));
}

/** Retire de refs.produit_client_ids / produit_concurrent_ids les identifiants absents de la base ; renvoie ceux retirés. */
async function nettoyerRefs(lignes: Record<string, unknown>[]): Promise<string[]> {
  const liste = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x).trim()) : []);
  const client = new Set<string>(), concurrent = new Set<string>();
  for (const l of lignes) {
    const r = l.refs as Record<string, unknown>;
    liste(r.produit_client_ids).forEach((i) => client.add(i));
    liste(r.produit_concurrent_ids).forEach((i) => concurrent.add(i));
  }
  const [okClient, okConcurrent] = await Promise.all([existants("catalog_products", [...client]), existants("market_products", [...concurrent])]);
  const ignores = new Set<string>();
  for (const l of lignes) {
    const r = l.refs as Record<string, unknown>;
    if ("produit_client_ids" in r) r.produit_client_ids = liste(r.produit_client_ids).filter((i) => okClient.has(i) || (ignores.add(i), false));
    if ("produit_concurrent_ids" in r) r.produit_concurrent_ids = liste(r.produit_concurrent_ids).filter((i) => okConcurrent.has(i) || (ignores.add(i), false));
  }
  return [...ignores];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: ENTETES });
  let p: Record<string, unknown>;
  try {
    const url = new URL(req.url);
    const brut = req.method === "POST" ? await req.text() : url.searchParams.get("p");
    if (!brut) {
      return repondre({ ok: true, aide: "GET ?p=<JSON encodé> avec { analyse: { params, result }, opportunites: [...] } ; puis, pour compléter, { analysis_id, opportunites: [...] }." });
    }
    p = objet(JSON.parse(brut));
  } catch {
    return repondre({ ok: false, erreur: "JSON invalide dans ?p (vérifie les guillemets droits et remplace # par %23)." }, 400);
  }
  let creee: string | null = null;   // analyse créée par cet appel : supprimée si la suite échoue
  try {
    let analysisId = texte(p.analysis_id);
    if (!analysisId) {
      const a = objet(p.analyse ?? p.analysis);
      const result = objet(a.result);
      if (!Object.keys(result).length) return repondre({ ok: false, erreur: "analyse.result est obligatoire (synthese, top_3, nb_opportunites)." }, 422);
      const type = TYPES.includes(texte(a.type)) ? texte(a.type) : "growth_analysis";
      const status = texte(a.status) === "failed" ? "failed" : "completed";
      const maintenant = new Date().toISOString();
      const [ligne] = await sb(`/rest/v1/analyses`, { method: "POST", body: JSON.stringify({
        type, status, params: { ...objet(a.params), source: "agent-analyse-concurrentielle" }, result,
        error_message: texte(a.error_message) || null,
        started_at: texte(a.started_at) || maintenant, completed_at: texte(a.completed_at) || maintenant,
      }) }) as { id: string }[];
      analysisId = ligne.id;
      creee = ligne.id;
    } else {
      const trouvee = await sb(`/rest/v1/analyses?select=id&id=eq.${encodeURIComponent(analysisId)}`) as unknown[];
      if (!trouvee.length) return repondre({ ok: false, erreur: `analysis_id inconnu : ${analysisId}` }, 404);
    }
    const liste = Array.isArray(p.opportunites ?? p.opportunities) ? (p.opportunites ?? p.opportunities) as unknown[] : [];
    const rejetees: { index: number; raison: string }[] = [];
    const lignes: Record<string, unknown>[] = [];
    liste.forEach((o, index) => {
      const r = opportunite(objet(o), analysisId);
      if (r.ligne) lignes.push(r.ligne); else rejetees.push({ index, raison: r.raison! });
    });
    // Les identifiants cités dans refs doivent exister : l'agent en recopie parfois de travers (caractère manquant).
    const ignores = await nettoyerRefs(lignes);
    if (lignes.length) await sb(`/rest/v1/growth_opportunities`, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(lignes) });
    return repondre({ ok: true, analysis_id: analysisId, opportunites_ajoutees: lignes.length, rejetees,
      ...(ignores.length ? { ids_ignores: ignores, note_ids: "Ces identifiants n'existent pas dans catalog_products / market_products : ils ont été retirés de refs." } : {}),
      suite: "Pour envoyer d'autres opportunités, rappelle la fonction avec { analysis_id, opportunites: [...] }." });
  } catch (erreur) {
    if (creee) await sb(`/rest/v1/analyses?id=eq.${creee}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => null);
    return repondre({ ok: false, erreur: String((erreur as Error).message ?? erreur).slice(0, 1000),
      note: creee ? "Rien n'a été enregistré : corrige puis renvoie l'appel complet." : undefined }, 500);
  }
});
