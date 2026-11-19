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
 *   Agents 3 et 4 : moteur intégré (calcul depuis Supabase, écrit analyses / growth_opportunities / reports).
 *   Agents 0, 2, 2.5 : agents navigateur. Transmis à AGENT_WEBHOOK_URL si défini, sinon à H Company
 *   (HAI_API_KEY) avec les consignes de l'agent ; sans l'un ni l'autre, la demande est notée pour l'équipe.
 */

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
    const res = await fetch(`${config.hcompany.baseUrl}/sessions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.hcompany.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ agent: config.hcompany.agent, messages: task, max_time_s: Math.max(config.hcompany.maxTimeS, 1800) }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`H Company ${res.status} : ${(await res.text().catch(() => "")).slice(0, 160)}`);
    const s = (await res.json()) as { id: string; agent_view_url?: string };
    return { status: "started", via: "h-company", message: `Session H Company ${s.id} lancée.`, link: s.agent_view_url ?? null };
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
      : agent === "3" ? await analyse(cfg)
      : agent === "4" ? await dashboard(cfg, user?.userId ?? null, params)
      : await external(agent, cfg, params);
    return saveRun({ ...base, ...out, finishedAt: out.status === "completed" ? new Date().toISOString() : null });
  } catch (e) {
    const run = await saveRun({ ...base, status: "failed", finishedAt: new Date().toISOString(), message: `${agentInfo(agent).name} : ${(e as Error).message}` });
    if (e instanceof HttpError) throw e;
    return run;
  }
}
