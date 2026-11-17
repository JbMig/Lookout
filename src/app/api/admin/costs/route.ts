import { handle } from "@/lib/http";
import { requireStaff } from "@/lib/auth";
import { repo } from "@/lib/repo";
import type { AgentRunRow, OrganizationRow } from "@/lib/types";

/** Volume d'appels par service et par organisation sur 30 jours. */
export const GET = handle(async () => {
  await requireStaff();
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const runs = await repo().select<AgentRunRow>("agent_runs", { gte: ["created_at", since] });
  const orgs = await repo().select<OrganizationRow>("organizations");
  const services = ["scraping", "linkup", "hcompany", "huggingface"] as const;
  const byService = services.map((s) => {
    const list = runs.filter((r) => r.service === s);
    return { service: s, calls: list.length, failures: list.filter((r) => !r.ok).length };
  });
  const byOrg = orgs
    .map((o) => {
      const list = runs.filter((r) => r.org_id === o.id);
      return {
        org: o.name,
        total: list.length,
        ...Object.fromEntries(services.map((s) => [s, list.filter((r) => r.service === s).length])),
      };
    })
    .filter((o) => o.total > 0)
    .sort((a, b) => b.total - a.total);
  return { since, byService, byOrg };
});
