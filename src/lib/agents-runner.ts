import "server-only";
import { randomUUID } from "node:crypto";
import { config, isDemo } from "./config";
import { repo } from "./repo";
import { getAgentConfig, getSetting, setSetting, type AgentConfig } from "./settings";
import { loadUniverse } from "./universe";
import { sitesFor } from "./sites";
import { computeGrowth } from "./growth";
import { newShareToken } from "./reports";
import { agentInfo, type AgentId, type AgentRun } from "./agent-runs";
import { HttpError } from "./auth";
import { NEEDS_SETTINGS, missingSettings } from "./settings-check";

/**
 * Déclenchement des agents depuis les boutons du site.
 *   Agent 1 : agent Holo « agent-import-circana » (sans HAI_API_KEY, appel direct de l'Edge Function import-circana).
 *   Agents 3 et 4 : agents Holo (H Company) « agent-analyse-concurrentielle » et « bench-dashboard-creation »
 *   dès que HAI_API_KEY est défini ; sans clé, moteur intégré (analyses / growth_opportunities / reports).
 *   Agents 0, 2, 2.5 : transmis à AGENT_WEBHOOK_URL si défini, sinon à leur agent Holo ;
 *   sans l'un ni l'autre, la demande est notée pour l'équipe.
 */

/**
 * Agent Holo de chaque étape (nom de l'agent créé chez H Company). Modifiable par variable d'environnement.
 */
const HOLO: Partial<Record<AgentId, string>> = {
  "1": process.env.HAI_AGENT_1 || "agent-import-circana",
  "0": process.env.HAI_AGENT_0 || "bench-catalog-audit",
  "2": process.env.HAI_AGENT_2 || "agent-enrichissement-csv",
  "2.5": process.env.HAI_AGENT_2_5 || "agent-recherche-generique",
  "3": process.env.HAI_AGENT_3 || "agent-analyse-concurrentielle",
  "4": process.env.HAI_AGENT_4 || "bench-dashboard-creation",
};

const zoneName = (z: string) => (z === "EU" ? "Europe" : z === "FR" ? "France" : "États-Unis");

/** Paramètres transmis à un agent Holo dédié (ses consignes sont déjà enregistrées chez H Company). */
function holoParams(cfg: AgentConfig, extra: string[] = []): string {
  return [
    `Paramètres : catégorie = ${cfg.category}, zone = ${zoneName(cfg.zone)}${cfg.brand ? `, marque cliente = ${cfg.brand}` : ""}.`,
    ...extra,
    "Ne demande rien à l'utilisateur.",
  ].join("\n");
}

const country = (z: string) => (z === "US" ? "États-Unis" : "France");

/** Consigne de démarrage de chaque agent Holo dédié (complète ses instructions enregistrées chez H Company). */
const SESSION: Partial<Record<AgentId, (cfg: AgentConfig) => string>> = {
  "0": (cfg) => [
    `Marque : ${cfg.brand}. Pays : ${country(cfg.zone)}. Catégorie : ${cfg.category}.`,
    `Formats connus dans les ventes : ${cfg.formats.length ? cfg.formats.join(", ") : "non précisés"}.`,
    `Adresse de départ : ${cfg.startUrl || "non fournie (cherche le site officiel de la marque pour ce pays)"}.`,
    `Ne relève que des produits de la catégorie ${cfg.category} (pas de bronzer, highlighter, coffret ni produit lèvres seul) et un seul relevé par produit : fusionne les variantes d'un même produit.`,
    "Pour chaque teinte, obtiens le code hex via ton sous-agent hex (shade-color-expert) avant de sauvegarder ; relève le prix affiché, et explique dans notes s'il est absent.",
    "Relève le catalogue de la marque puis sauvegarde-le avec update-catalog.",
  ].join("\n"),
  "2": () => "Tu es l'Agent 2 : enrichissement web des produits concurrents. Récupère les produits via get_top_competitors(), traite-les un par un jusqu'à ce qu'il n'en reste plus, délègue les couleurs au sous-agent Shade Color Expert, sauvegarde via l'Edge Function save-product et vérifie à la fin (0 ligne restante, aucune teinte sans hex ni image).",
  "2.5": (cfg) => `Recherche : « ${[cfg.category, ...cfg.formats].join(" ")} ». Zone : ${cfg.zone === "US" ? "US" : "EU"}.`,
  "3": () => `Tu es l'Agent 3 : analyse concurrentielle. Lis catalog_products (teintes dans catalog_variants), market_products, market_shades et market_ingredients, compare prix, formats, teintes et ingrédients. Pour les ventes, lis la vue circana_sku (dernier import, niveau SKU : country US ou FR, annee, format, revenue en unité monétaire réelle) plutôt que circana_sales, qui contient d'anciens imports. Enregistre l'analyse et ses opportunités en ouvrant ${fn("save-analysis")}?p=<JSON encodé> avec { "analyse": { "params": {...}, "result": { "synthese", "top_3", "nb_opportunites" } }, "opportunites": [ { "kind": "prix|format|teinte|ingredient", "title", "description", "score": 0-100, "estimated_impact", "refs" } ] } ; si l'adresse dépasse 6000 caractères, envoie d'abord l'analyse avec quelques opportunités puis les suivantes avec { "analysis_id", "opportunites" }. Succès seulement si la réponse contient "ok": true. Termine par les 3 opportunités les plus intéressantes avec les chiffres.`,
};

/** Agent 2.5 : sites de la page « Sites suivis » pour la zone, sans l'empêcher d'en explorer d'autres. */
async function suivis(cfg: AgentConfig): Promise<string> {
  const domains = (await sitesFor(cfg.zone === "US" ? "US" : "EU", [])).filter((x) => x.type !== "marque").map((x) => x.domain);
  return domains.length
    ? `Sites suivis à couvrir en priorité (paramètre sites) : ${domains.join(",")}. Tu peux aussi chercher sur d'autres sites de beauté pertinents de la zone si tu en trouves.`
    : "Aucun site suivi pour cette zone : choisis toi-même les sites de beauté pertinents.";
}

/** Agent 1 Holo : il inventorie le bucket circana-uploads, importe via import-circana et vérifie la cohérence. */
async function importHolo(cfg: AgentConfig, p: Record<string, unknown>) {
  const file = typeof p.file === "string" && p.file ? p.file : null;
  const category = typeof p.category === "string" && p.category ? p.category : cfg.category;
  const s = await holoSession(HOLO["1"]!, [
    file ? `Importe uniquement le fichier « ${file} » du bucket circana-uploads.` : "Importe tous les nouveaux fichiers du bucket circana-uploads.",
    `Catégorie : ${category}.`,
    p.force ? "Remplace l'import existant (ajoute &force=1)." : "",
    "Fais ensuite la vérification obligatoire. Ne demande rien à l'utilisateur.",
  ].filter(Boolean).join("\n"));
  return { status: "started" as const, via: "h-company" as const, message: `Agent Holo ${s.via} lancé (session ${s.id}). Les ventes apparaîtront dès la fin de l'import.`, link: s.agent_view_url ?? "/import" };
}

/**
 * Orchestrateur Holo : chaque demande passe par lui, il la confie au bon sous-agent (h/swarm) et renvoie sa réponse.
 * HAI_DIRECT=1 permet de revenir à un appel direct de l'agent en cas de panne de l'orchestrateur.
 */
const ORCHESTRATOR = process.env.HAI_ORCHESTRATOR || "ochestrateur-pipeline";

function routage(cible: string, brief: string, formats: string[] = []): string {
  return [
    `MODE ROUTAGE (prioritaire sur le déroulé complet du pipeline) : n'exécute qu'UNE seule étape.`,
    formats.length
      ? `Audit découpé : délègue via h/swarm au sous-agent « ${cible} » une fois par format, l'un après l'autre (${formats.join(", ")}), avec le brief ci-dessous suivi de la ligne « Format : <format> ». Un dépassement de 20 minutes n'est pas un échec : passe au format suivant sans relancer.`
      : `Délègue via h/swarm au sous-agent « ${cible} » le brief ci-dessous, sans le modifier ni le résumer.`,
    `N'appelle aucun autre sous-agent et ne fais aucun travail toi-même. Attends son statut terminal,`,
    `puis retourne sa réponse finale telle quelle. S'il échoue, retourne son erreur exacte.`,
    "",
    `--- BRIEF POUR ${cible} ---`,
    brief,
  ].join("\n");
}

async function holoSession(name: string, message: string, formats: string[] = []) {
  const direct = process.env.HAI_DIRECT === "1";
  const agent = direct ? name : ORCHESTRATOR;
  const res = await fetch(`${config.hcompany.baseUrl}/sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.hcompany.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ agent, messages: direct ? message : routage(name, message, formats), max_time_s: Math.max(config.hcompany.maxTimeS, formats.length ? 1500 * formats.length : 2400) }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`H Company (${agent}) ${res.status} : ${(await res.text().catch(() => "")).slice(0, 160)}`);
  const s = (await res.json()) as { id: string; agent_view_url?: string };
  return { ...s, via: direct ? name : `${ORCHESTRATOR} → ${name}` };
}

const RUNS_KEY = "agent_runs";
const MAX_RUNS = 120;

export async function listRuns(): Promise<AgentRun[]> {
  return getSetting<AgentRun[]>(RUNS_KEY, []);
}

const SESSION_ID = /session ([0-9a-f-]{36})/i;

type SessionH = { id?: string; status?: { status?: string; error?: string | null } | string; latest_answer?: unknown };
const etat = (s: SessionH) => (typeof s.status === "string" ? s.status : s.status?.status);

async function lireSession(id: string): Promise<SessionH | null> {
  const res = await fetch(`${config.hcompany.baseUrl}/sessions/${id}`, { headers: { Authorization: `Bearer ${config.hcompany.apiKey}` }, signal: AbortSignal.timeout(8_000) });
  return res.ok ? ((await res.json()) as SessionH) : null;
}

/** Dernière session lancée par l'orchestrateur (son sous-agent). */
async function sousSession(parent: string): Promise<SessionH | null> {
  const res = await fetch(`${config.hcompany.baseUrl}/sessions?parent_session_id=${parent}&size=5`, { headers: { Authorization: `Bearer ${config.hcompany.apiKey}` }, signal: AbortSignal.timeout(8_000) });
  if (!res.ok) return null;
  const items = ((await res.json()) as { items?: SessionH[] }).items ?? [];
  const enfant = items[0];
  return enfant?.id ? lireSession(enfant.id) : null;
}

/** Réponse de l'orchestrateur : { steps: [{ status, error }], pipeline_status } ; renvoie l'erreur d'une étape ratée. */
function etapeEnEchec(answer: unknown): string | null {
  let a = answer;
  if (typeof a === "string") { try { a = JSON.parse(a); } catch { return null; } }
  const o = (a && typeof a === "object" ? a : {}) as { steps?: { status?: string; error?: string | null; summary?: string }[]; pipeline_status?: string };
  const rate = (o.steps ?? []).find((x) => x.error || (x.status && !["completed", "skipped", "idle"].includes(x.status)));
  if (rate) return String(rate.error || rate.summary || rate.status);
  if (o.pipeline_status && ["failed", "partial"].includes(o.pipeline_status)) return `pipeline ${o.pipeline_status}`;
  return null;
}
const DONE = ["completed", "idle"];
const STOPPED = ["failed", "timed_out", "interrupted"];

/**
 * Met à jour les lancements H Company encore « started » en lisant l'état de leur session
 * (terminée, en échec, expirée). Sans cela, le journal ne saurait jamais qu'un agent Holo a fini.
 */
export async function syncRuns(): Promise<AgentRun[]> {
  const runs = await listRuns();
  if (isDemo.hcompany) return runs;
  const since = Date.now() - 24 * 3600_000;
  const open = runs.filter((r) => r.via === "h-company" && r.status === "started" && Date.parse(r.at) > since && SESSION_ID.test(r.message)).slice(0, 8);
  if (!open.length) return runs;
  const updates = await Promise.all(open.map(async (r): Promise<AgentRun | null> => {
    const id = r.message.match(SESSION_ID)![1];
    try {
      let s = await lireSession(id);
      if (!s) return null;
      let status = etat(s);
      let error = typeof s.status === "object" ? s.status?.error : null;
      // L'orchestrateur abandonne l'attente au bout de 20 min (« Client timeout ») alors que son sous-agent continue :
      // on suit alors la session du sous-agent.
      if (status && STOPPED.includes(status) && /timeout/i.test(error ?? "")) {
        const enfant = await sousSession(id);
        if (enfant) {
          s = enfant;
          status = etat(enfant);
          error = typeof enfant.status === "object" ? enfant.status?.error : null;
        }
      }
      if (!status || (!DONE.includes(status) && !STOPPED.includes(status))) return null;
      const answer = typeof s.latest_answer === "string" ? s.latest_answer : s.latest_answer ? JSON.stringify(s.latest_answer) : "";
      // L'orchestrateur termine « completed » même quand son sous-agent a échoué : on lit ses étapes.
      const echec = etapeEnEchec(s.latest_answer);
      const ok = DONE.includes(status) && !echec;
      const message = ok
        ? `${agentInfo(r.agent).name} terminé (session ${id}).${answer ? ` ${answer.replace(/\s+/g, " ").slice(0, 400)}` : ""}`
        : `${agentInfo(r.agent).name} : session ${id} ${echec ? "terminée en échec" : status}${error || echec ? ` (${(error || echec)!.slice(0, 400)})` : ""}.`;
      // Agent 4 en échec : la page du dashboard cesse d'attendre.
      const report = r.agent === "4" && r.link?.startsWith("/dashboard/") ? r.link.slice("/dashboard/".length) : null;
      if (!ok && report) await repo().update("reports", report, { status: "failed", error_message: message.slice(0, 500) }).catch(() => undefined);
      return { ...r, status: ok ? "completed" : "failed", finishedAt: new Date().toISOString(), message };
    } catch {
      return null;
    }
  }));
  let out = runs;
  for (const u of updates) if (u) out = out.map((r) => (r.id === u.id ? u : r));
  if (updates.some(Boolean)) await setSetting(RUNS_KEY, out);
  return out;
}

async function saveRun(run: AgentRun) {
  const runs = (await listRuns()).filter((r) => r.id !== run.id);
  await setSetting(RUNS_KEY, [run, ...runs].slice(0, MAX_RUNS));
  return run;
}

const fn = (name: string) => `${config.supabase.url}/functions/v1/${name}`;

function brief(agent: AgentId, cfg: AgentConfig): string {
  const zone = cfg.zone === "EU" ? "Europe" : cfg.zone === "FR" ? "France" : "États-Unis";
  const formats = cfg.formats.length ? cfg.formats.join(", ") : "tous";
  switch (agent) {
    case "0":
      return [
        `Agent 0 (audit du catalogue). Marque : ${cfg.brand}. Zone : ${zone}. Catégorie : ${cfg.category}. Formats connus : ${formats}.`,
        `Ouvre ${cfg.startUrl || `le site officiel de ${cfg.brand}`} et parcours la catégorie ${cfg.category}.`,
        `Pour chaque produit : nom, gamme, format, texture, prix et devise, contenance, nouveauté, photo (URL absolue), URL de la page,`,
        `toutes les teintes (nom, code hex #RRGGBB, famille, disponibilité), ingrédients clés et composition INCI complète.`,
        `Enregistre chaque fiche avec ${fn("update-catalog")}?p=<JSON encodé> (upsert par marque + nom + devise).`,
      ].join(" ");
    case "2":
      return [
        `Agent 2 (enrichissement du marché), catégorie ${cfg.category}, zone ${zone}.`,
        `Récupère les concurrents à enrichir avec ${config.supabase.url}/rest/v1/rpc/get_top_competitors.`,
        `Pour chacun, trouve la fiche produit officielle, lis les teintes avec ${fn("extract-shades")}?url=<URL>,`,
        `puis enregistre prix, devise, texture, packshot, teintes (hex #RRGGBB) et INCI avec ${fn("save-product")}?p=<JSON encodé>.`,
      ].join(" ");
    case "2.5":
      return [
        `Agent 2.5 (enrichissement sur sites web), catégorie ${cfg.category}, zone ${zone}.`,
        `Récupère les sites et la file avec ${fn("recherche-web")}?action=sites puis ?action=demarrer ;`,
        `enregistre les fiches trouvées avec ?action=enregistrer, signale les sites bloqués avec ?action=signaler, termine avec ?action=terminer.`,
      ].join(" ");
    default:
      return "";
  }
}

async function external(agent: AgentId, cfg: AgentConfig, params: Record<string, unknown>): Promise<Pick<AgentRun, "status" | "via" | "message" | "link">> {
  const task = brief(agent, cfg);
  const hook = process.env.AGENT_WEBHOOK_URL;
  if (hook) {
    const res = await fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(process.env.AGENT_WEBHOOK_SECRET ? { Authorization: `Bearer ${process.env.AGENT_WEBHOOK_SECRET}` } : {}) },
      body: JSON.stringify({ agent, config: cfg, params, task }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Webhook des agents : ${res.status} ${(await res.text().catch(() => "")).slice(0, 160)}`);
    return { status: "started", via: "webhook", message: "Transmis à l'agent. Les résultats apparaîtront ici dès qu'il les enregistre.", link: null };
  }
  if (!isDemo.hcompany) {
    const name = HOLO[agent];
    const extra = SESSION[agent] ? [SESSION[agent]!(cfg)] : [];
    if (agent === "2.5") extra.push(await suivis(cfg));
    // Agent 0 : un passage par format, pour que chaque passage tienne dans les 20 min d'attente de l'orchestrateur.
    const formats = agent === "0" ? (cfg.formats.length ? cfg.formats : ["liquide", "compact", "creme", "stick"]) : [];
    const s = name ? await holoSession(name, holoParams(cfg, extra), formats) : await holoSession(config.hcompany.agent, task);
    return { status: "started", via: "h-company", message: `Agent Holo ${s.via} lancé (session ${s.id}).`, link: s.agent_view_url ?? null };
  }
  return {
    status: "requested",
    via: "file",
    message: "Demande enregistrée pour l'équipe : aucun agent n'est relié au site (AGENT_WEBHOOK_URL ou HAI_API_KEY).",
    link: null,
  };
}

async function importCircana(params: Record<string, unknown>) {
  if (isDemo.db) return { status: "completed" as const, via: "edge-function" as const, message: "Mode démo : import simulé.", link: "/import" };
  const file = typeof params.file === "string" && params.file ? params.file : null;
  const qs = new URLSearchParams(file ? { fichier: file } : { action: "importer_tout" });
  if (params.force) qs.set("force", "1");
  if (typeof params.category === "string" && params.category) qs.set("categorie", params.category);
  const res = await fetch(`${fn("import-circana")}?${qs}`, { headers: { apikey: config.supabase.anonKey }, signal: AbortSignal.timeout(55_000) });
  const out = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || out.ok === false) throw new Error(String(out.erreur ?? out.message ?? `import-circana ${res.status}`).slice(0, 400));
  const lines = Number(out.lignes_envoyees ?? out.nb_reussis ?? 0);
  const alerts = Array.isArray(out.alertes) ? out.alertes.length : 0;
  return {
    status: "completed" as const,
    via: "edge-function" as const,
    message: file
      ? `${lines} lignes de ventes importées${alerts ? `, ${alerts} alerte${alerts > 1 ? "s" : ""} qualité` : ""}.`
      : String(out.message ?? `${out.nb_reussis ?? 0} fichier(s) importé(s).`),
    link: "/import",
  };
}

async function analyse(cfg: AgentConfig) {
  const started = new Date().toISOString();
  const params = { category: cfg.category, zone: cfg.zone, brand: cfg.brand, source: "site" };
  const [row] = await repo().insert<{ id: string }>("analyses", [{ type: "growth_analysis", status: "running", params, started_at: started } as never]);
  try {
    const u = await loadUniverse();
    const { analysis, opportunities } = computeGrowth(u, null);
    await repo().insert("growth_opportunities", opportunities.map((o) => ({ ...o, analysis_id: row.id })) as never[]);
    await repo().update("analyses", row.id, { status: "completed", result: { ...analysis, params: { ...params, period: u.years } }, completed_at: new Date().toISOString() });
    return { status: "completed" as const, via: "integre" as const, message: `${opportunities.length} opportunités identifiées.`, link: "/opportunities" };
  } catch (e) {
    await repo().update("analyses", row.id, { status: "failed", error_message: (e as Error).message, completed_at: new Date().toISOString() });
    throw e;
  }
}

async function dashboard(cfg: AgentConfig, userId: string | null, params: Record<string, unknown>) {
  const [latest] = await repo().select<{ id: string }>("analyses", { eq: { type: "growth_analysis", status: "completed" }, order: ["created_at", "desc"], limit: 1 });
  const title = typeof params.title === "string" && params.title.trim()
    ? params.title.trim()
    : `${cfg.brand || "Marché"} · ${cfg.category} · ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`;
  const [report] = await repo().insert<{ id: string }>("reports", [{
    title,
    type: "dashboard",
    status: "ready",
    config: { kind: "agents", agent: "4", brand: cfg.brand, category: cfg.category, zone: cfg.zone, filters: params.filters ?? {} },
    data: { generatedAt: new Date().toISOString() },
    analysis_ids: latest ? [latest.id] : [],
    share_slug: params.share ? newShareToken() : null,
    created_by: userId,
  } as never]);
  return { status: "completed" as const, via: "integre" as const, message: "Dashboard généré.", link: `/dashboard/${report.id}` };
}

/** Agent 3 Holo : il écrit lui-même analyses et growth_opportunities ; la page Analyse les affiche dès qu'ils arrivent. */
async function analyseHolo(cfg: AgentConfig) {
  const s = await holoSession(HOLO["3"]!, holoParams(cfg, [SESSION["3"]!(cfg)]));
  return { status: "started" as const, via: "h-company" as const, message: `Agent Holo ${s.via} lancé (session ${s.id}). Les résultats apparaîtront dans Analyse et Opportunités.`, link: s.agent_view_url ?? null };
}

/**
 * Agent 4 Holo : le site prépare la ligne reports (share_slug imposé) ; l'agent la complète avec save-report,
 * qui fait un upsert sur share_slug. La page du dashboard attend le JSON puis l'affiche.
 */
async function dashboardHolo(cfg: AgentConfig, userId: string | null) {
  const day = new Date().toISOString().slice(0, 10);
  const cat = (cfg.category || "categorie").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const slug = `${cat}-benchmark-${day}-${randomUUID().slice(0, 6)}`;
  const [report] = await repo().insert<{ id: string }>("reports", [{
    title: `${cfg.category} — Benchmark${cfg.brand ? ` · ${cfg.brand}` : ""}`,
    type: "dashboard",
    status: "generating",
    config: { kind: "holo", agent: "4", category: cfg.category, zone: cfg.zone, brand: cfg.brand },
    data: {},
    share_slug: slug,
    created_by: userId,
  } as never]);
  try {
    const country = cfg.zone === "US" ? "US" : cfg.zone === "FR" ? "FR" : "global";
    const s = await holoSession(HOLO["4"]!, holoParams(cfg, [
      `Tu es l'Agent 4 : génération du rapport JSON. category = ${cfg.category}, country = ${country}, period = FY 2025 vs FY 2024${cfg.brand ? `, brand = ${cfg.brand}` : ""}.`,
      "Ventes : lis la vue circana_sku (dernier import, niveau SKU) au lieu de circana_sales : filtre par country=eq.US ou country=eq.FR (pas region), annee=eq.2025 ou 2024, et regroupe par format (liquide, compact, creme, stick). revenue est en unité monétaire réelle.",
      "Écris les montants de chiffre d'affaires en unités réelles (pas en millions) et ajoute \"unit\": \"EUR/USD\" dans meta ; si tu préfères les millions, mets \"unit\": \"M\".",
      `Sauvegarde dans reports via l'Edge Function save-report (GET avec ?p=) en utilisant OBLIGATOIREMENT share_slug = "${slug}" pour chaque appel.`,
      "Retourne l'id du rapport, le share_slug et le JSON complet.",
    ]));
    return { status: "started" as const, via: "h-company" as const, message: `Agent Holo ${s.via} lancé (session ${s.id}). Le dashboard s'affichera dès que l'agent l'aura enregistré.`, link: `/dashboard/${report.id}` };
  } catch (e) {
    await repo().remove("reports", report.id).catch(() => undefined);
    throw e;
  }
}

export async function runAgent(agent: AgentId, params: Record<string, unknown>, user: { userId: string; email: string } | null): Promise<AgentRun> {
  const cfg = await getAgentConfig();
  const missing = NEEDS_SETTINGS.includes(agent) ? missingSettings(cfg) : [];
  if (missing.length) throw new HttpError(400, `Complétez les réglages avant de lancer cet agent : ${missing.join(", ")}.`);
  // H Company limite le compte à 3 sessions simultanées ; une demande en occupe 2 (orchestrateur + sous-agent), parfois 3.
  // Un seul agent Holo à la fois, sinon le sous-agent ne peut pas démarrer.
  if (!isDemo.hcompany) {
    const enCours = (await syncRuns()).find((r) => r.via === "h-company" && r.status === "started" && Date.now() - Date.parse(r.at) < 2 * 3600_000);
    if (enCours) throw new HttpError(409, `${agentInfo(enCours.agent).name} est déjà en cours (lancé à ${new Date(enCours.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })}). H Company n'accepte qu'un agent à la fois sur ce compte : relancez quand il aura fini.`);
  }
  const base: AgentRun = {
    id: randomUUID(),
    agent,
    status: "started",
    at: new Date().toISOString(),
    finishedAt: null,
    by: user?.email ?? null,
    via: "integre",
    message: "",
    link: null,
    pipelineId: typeof params.pipelineId === "string" ? params.pipelineId : null,
  };
  try {
    const out =
      agent === "1" ? (isDemo.hcompany ? await importCircana(params) : await importHolo(cfg, params))
      : agent === "3" ? (isDemo.hcompany ? await analyse(cfg) : await analyseHolo(cfg))
      : agent === "4" ? (isDemo.hcompany ? await dashboard(cfg, user?.userId ?? null, params) : await dashboardHolo(cfg, user?.userId ?? null))
      : await external(agent, cfg, params);
    return saveRun({ ...base, ...out, finishedAt: out.status === "completed" ? new Date().toISOString() : null });
  } catch (e) {
    const run = await saveRun({ ...base, status: "failed", finishedAt: new Date().toISOString(), message: `${agentInfo(agent).name} : ${(e as Error).message}` });
    if (e instanceof HttpError) throw e;
    return run;
  }
}
