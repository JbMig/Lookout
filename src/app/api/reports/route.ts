import { z } from "zod";
import { body, handle } from "@/lib/http";
import { requireUser, HttpError } from "@/lib/auth";
import { repo } from "@/lib/repo";
import { checkQuota } from "@/lib/quota";
import { normalize } from "@/lib/matching";
import { CATALOG_FIELDS, CIRCANA_FIELDS, missingRequired, toCircanaRows, toClientProducts } from "@/lib/tabular";
import type { ClientProductRow, ReportItemRow, ReportRow } from "@/lib/types";

export const GET = handle(async () => {
  const user = await requireUser();
  const reports = await repo().select<ReportRow>("reports", { eq: { org_id: user.orgId }, order: ["created_at", "desc"] });
  return {
    reports: reports.map((r) => ({
      id: r.id, name: r.name, category: r.category, status: r.status, created_at: r.created_at,
      params: r.params, productCount: r.stats?.productCount ?? null, completeCount: r.stats?.completeCount ?? null,
      awaitingTeam: r.stats?.awaitingTeam ?? null,
    })),
  };
});

const Table = z.object({
  rows: z.array(z.record(z.string(), z.string())).max(2000),
  mapping: z.record(z.string(), z.string().nullable()),
});

const Body = z.object({
  name: z.string().trim().min(1, "Donnez un nom à l'analyse").max(120),
  category: z.string().trim().max(60).default(""),
  params: z.object({
    zones: z.array(z.enum(["US", "EU"])).min(1, "Choisissez au moins une zone"),
    siteIds: z.array(z.string()).default([]),
    excludedBrands: z.array(z.string().trim().min(1)).default([]),
    focus: z.string().trim().max(200).default(""),
    focusOnly: z.boolean().default(false),
  }),
  circana: Table,
  catalog: Table.optional(),
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser("analyst");
  const input = Body.parse(await body(req));
  const maxProducts = await checkQuota(user);

  const missing = missingRequired(input.circana.mapping, CIRCANA_FIELDS);
  if (missing.length) throw new HttpError(400, `Colonnes Circana à associer : ${missing.join(", ")}`);

  const excluded = new Set(input.params.excludedBrands.map(normalize));
  const focusTerms = normalize(input.params.focus).split(" ").filter((w) => w.length > 2);
  let rows = toCircanaRows(input.circana.rows, input.circana.mapping)
    .filter((r) => input.params.zones.includes(r.zone))
    .filter((r) => !excluded.has(normalize(r.brand)));
  if (input.params.focusOnly && focusTerms.length) {
    rows = rows.filter((r) => focusTerms.some((t) => normalize(`${r.brand} ${r.product}`).includes(t)));
  }
  if (!rows.length) throw new HttpError(400, "Aucune ligne Circana ne correspond aux critères (zones, exclusions, focus).");
  const truncated = rows.length > maxProducts;
  rows = rows.slice(0, maxProducts);

  let catalogRows: ReturnType<typeof toClientProducts> = [];
  if (input.catalog?.rows.length) {
    const miss = missingRequired(input.catalog.mapping, CATALOG_FIELDS);
    if (miss.length) throw new HttpError(400, `Colonnes du catalogue à associer : ${miss.join(", ")}`);
    catalogRows = toClientProducts(input.catalog.rows, input.catalog.mapping).slice(0, 500);
  }

  const db = repo();
  const [report] = await db.insert<ReportRow>("reports", [
    { org_id: user.orgId, created_by: user.userId, name: input.name, category: input.category, params: input.params, status: "collecting" },
  ]);
  await db.insert<ReportItemRow>(
    "report_items",
    rows.map((circana, position) => ({ report_id: report.id, org_id: user.orgId, position, circana, status: "pending" as const })),
  );
  if (catalogRows.length) {
    await db.insert<ClientProductRow>("client_products", catalogRows.map((data) => ({ report_id: report.id, org_id: user.orgId, data })));
  }
  return { id: report.id, products: rows.length, truncated, maxProducts };
});
