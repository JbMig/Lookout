import "server-only";
import { randomUUID } from "node:crypto";
import { config, isDemo } from "./config";
import { repo } from "./repo";
import { getAgentConfig, getSetting, setSetting, type AgentConfig } from "./settings";
import { loadUniverse } from "./universe";
import { computeGrowth } from "./growth";
import { newShareToken } from "./reports";
import { agentInfo, type AgentId, type AgentRun } from "./agent-runs";
import { HttpError } from "./auth";
import { NEEDS_SETTINGS, missingSettings } from "./settings-check";

/**
 * Déclenchement des agents depuis les boutons du site.
 *   Agent 1 : Edge Function Supabase « import-circana » (lit le bucket circana-uploads).
 *   Agents 3 et 4 : agents Holo (H Company) « agent-analyse-concurrentielle » et « bench-dashboard-creation »
 *   dès que HAI_API_KEY est défini ; sans clé, moteur intégré (analyses / growth_opportunities / reports).
 *   Agents 0, 2, 2.5 : transmis à AGENT_WEBHOOK_URL si défini, sinon à leur agent Holo ;
 *   sans l'un ni l'autre, la demande est notée pour l'équipe.
 */

/**
 * Agent Holo de chaque étape (nom de l'agent créé chez H Company). Modifiable par variable d'environnement.
 */
const HOLO: Partial<Record<AgentId, string>> = {
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
    "Relève le catalogue de la marque puis sauvegarde-le avec update-catalog.",
  ].join("\n"),
  "2": () => "Tu es l'Agent 2 : enrichissement web des produits concurrents. Récupère les produits via get_top_competitors(), traite-les un par un jusqu'à ce qu'il n'en reste plus, délègue les couleurs au sous-agent Shade Color Expert, sauvegarde via l'Edge Function save-product et vérifie à la fin (0 ligne restante, aucune teinte sans hex ni image).",
  "2.5": (cfg) => `Recherche : « ${[cfg.category, ...cfg.formats].join(" ")} ». Zone : ${cfg.zone === "US" ? "US" : "EU"}.`,
  "3": () => "Tu es l'Agent 3 : analyse concurrentielle. Lis catalog_products, market_products, market_shades, market_ingredients et circana_sales, compare prix, formats, teintes et ingrédients. Écris d'abord une ligne dans analyses, puis une ligne par opportunité dans growth_opportunities avec analysis_id renseigné. Termine par les 3 opportunités les plus intéressantes avec les chiffres.",
};

async function holoSession(name: string, message: string) {
  const res = await fetch(`${config.hcompany.baseUrl}/sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.hcompany.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ agent: name, messages: message, max_time_s: Math.max(config.hcompany.maxTimeS, 1800) }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`H Company (${name}) ${res.status} : ${(await res.text().catch(() => "")).slice(0, 160)}`);
  return (await res.json()) as { id: string; agent_view_url?: string };
}

const RUNS_KEY = "agent_runs";
const MAX_RUNS = 120;

export async function listRuns(): Promise<AgentRun[]> {
  return getSetting<AgentRun[]>(RUNS_KEY, []);
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
    const s = name ? await holoSession(name, holoParams(cfg, SESSION[agent] ? [SESSION[agent]!(cfg)] : [])) : await holoSession(config.hcompany.agent, task);
    return { status: "started", via: "h-company", message: `Agent Holo ${name || config.hcompany.agent} lancé (session ${s.id}).`, link: s.agent_view_url ?? null };
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
  return { status: "started" as const, via: "h-company" as const, message: `Agent Holo ${HOLO["3"]} lancé (session ${s.id}). Les résultats apparaîtront dans Analyse et Opportunités.`, link: s.agent_view_url ?? null };
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
      `Sauvegarde dans reports via l'Edge Function save-report (GET avec ?p=) en utilisant OBLIGATOIREMENT share_slug = "${slug}" pour chaque appel.`,
      "Retourne l'id du rapport, le share_slug et le JSON complet.",
    ]));
    return { status: "started" as const, via: "h-company" as const, message: `Agent Holo ${HOLO["4"]} lancé (session ${s.id}). Le dashboard s'affichera dès que l'agent l'aura enregistré.`, link: `/dashboard/${report.id}` };
  } catch (e) {
    await repo().remove("reports", report.id).catch(() => undefined);
    throw e;
  }
}

export async function runAgent(agent: AgentId, params: Record<string, unknown>, user: { userId: string; email: string } | null): Promise<AgentRun> {
  const cfg = await getAgentConfig();
  const missing = NEEDS_SETTINGS.includes(agent) ? missingSettings(cfg) : [];
  if (missing.length) throw new HttpError(400, `Complétez les réglages avant de lancer cet agent : ${missing.join(", ")}.`);
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
      agent === "1" ? await importCircana(params)
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
