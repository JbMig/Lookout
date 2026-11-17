import { handle } from "@/lib/http";
import { requireStaff } from "@/lib/auth";
import { repo } from "@/lib/repo";
import type { OrganizationRow, ReportItemRow, ReportRow, SiteRow } from "@/lib/types";

/** File de l'équipe : produits que le scraping n'a pas pu traiter. */
export const GET = handle(async () => {
  await requireStaff();
  const db = repo();
  const items = await db.select<ReportItemRow>("report_items", { in: ["status", ["awaiting_team", "navigating", "partial"]], order: ["updated_at", "asc"], limit: 300 });
  const reportIds = [...new Set(items.map((i) => i.report_id))];
  const reports = reportIds.length ? await db.select<ReportRow>("reports", { in: ["id", reportIds] }) : [];
  const orgIds = [...new Set(reports.map((r) => r.org_id))];
  const orgs = orgIds.length ? await db.select<OrganizationRow>("organizations", { in: ["id", orgIds] }) : [];
  const sites = await db.select<SiteRow>("sites");
  return {
    items: items.map((i) => {
      const r = reports.find((x) => x.id === i.report_id);
      return {
        ...i,
        reportName: r?.name ?? "?",
        orgName: orgs.find((o) => o.id === r?.org_id)?.name ?? "?",
        site: sites.find((s) => s.domain === i.site_domain) ?? null,
      };
    }),
  };
});
