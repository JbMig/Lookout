/** Les agents Lookout et leurs déclenchements (partagé serveur / navigateur). */

export type AgentId = "0" | "1" | "2" | "2.5" | "3" | "4";

export interface AgentInfo {
  id: AgentId;
  name: string;
  produces: string;
  page: string;
}

export const AGENTS: AgentInfo[] = [
  { id: "0", name: "Audit du catalogue", produces: "catalog_products", page: "/catalog" },
  { id: "1", name: "Import Circana", produces: "circana_imports, circana_sales", page: "/import" },
  { id: "2", name: "Enrichissement du marché", produces: "market_products, market_shades, market_ingredients", page: "/market" },
  { id: "2.5", name: "Enrichissement sur sites web", produces: "market_products (complément)", page: "/market" },
  { id: "3", name: "Analyse de croissance", produces: "analyses, growth_opportunities", page: "/analysis" },
  { id: "4", name: "Dashboard", produces: "reports", page: "/dashboard" },
];

export const agentInfo = (id: AgentId) => AGENTS.find((a) => a.id === id)!;

/**
 * started : transmis à un agent externe, résultat attendu dans Supabase ;
 * requested : aucun agent externe relié, la demande attend l'équipe ;
 * completed / failed : exécution terminée (agents 1, 3 et 4).
 */
export type RunStatus = "started" | "requested" | "completed" | "failed";

export interface AgentRun {
  id: string;
  agent: AgentId;
  status: RunStatus;
  at: string;
  finishedAt: string | null;
  by: string | null;
  via: "edge-function" | "webhook" | "h-company" | "integre" | "file";
  message: string;
  link: string | null;
  pipelineId: string | null;
}
