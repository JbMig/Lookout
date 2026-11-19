import { handle } from "@/lib/http";
import { requireStaff } from "@/lib/auth";
import { config, isDemo } from "@/lib/config";

export const maxDuration = 30;

const AGENTS = [
  process.env.HAI_ORCHESTRATOR || "ochestrateur-pipeline",
  "bench-catalog-audit", "agent-import-circana", "agent-enrichissement-csv", "shade-color-expert",
  "agent-recherche-generique", "agent-analyse-concurrentielle", "bench-dashboard-creation",
];

/** Équipe : configuration actuelle des agents Holo chez H Company (date de mise à jour, sous-agents, consignes). */
export const GET = handle(async () => {
  await requireStaff();
  if (isDemo.hcompany) return { agents: [], note: "HAI_API_KEY absent" };
  const agents = await Promise.all(AGENTS.map(async (name) => {
    const res = await fetch(`${config.hcompany.baseUrl}/agents/${encodeURIComponent(name)}`, {
      headers: { Authorization: `Bearer ${config.hcompany.apiKey}` }, signal: AbortSignal.timeout(10_000),
    }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }) as unknown as Response);
    if (!res.ok) return { name, error: `${res.status} ${(await res.text()).slice(0, 200)}` };
    return { name, agent: await res.json() };
  }));
  return { agents };
});

/** Équipe : met à jour les consignes d'un agent Holo (PATCH chez H Company). Réservé aux agents Lookout listés. */
export const PATCH = handle(async (req: Request) => {
  await requireStaff();
  const { name, instructions, skills } = (await req.json()) as { name?: string; instructions?: string; skills?: string[] };
  if (!name || !AGENTS.includes(name)) throw new Error("Agent inconnu");
  if (instructions !== undefined && instructions.length < 200) throw new Error("Consignes trop courtes");
  if (instructions === undefined && !skills) throw new Error("Rien à modifier");
  const res = await fetch(`${config.hcompany.baseUrl}/agents/${encodeURIComponent(name)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${config.hcompany.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...(instructions !== undefined ? { instructions } : {}), ...(skills ? { skills } : {}) }),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`H Company ${res.status} : ${text.slice(0, 300)}`);
  return { ok: true, name, length: instructions?.length ?? null, skills: skills ?? null };
});
