import { randomUUID } from "crypto";
import { z } from "zod";
import { body, handle } from "@/lib/http";
import { requireUser, HttpError } from "@/lib/auth";
import { repo } from "@/lib/repo";
import { normalize } from "@/lib/matching";
import { saveCircanaImport, upsertCatalog } from "@/lib/imports";
import { toView } from "@/lib/reports";
import { CATALOG_FIELDS, CIRCANA_FIELDS, missingRequired, toCircanaRows, toClientProducts } from "@/lib/tabular";
import type { CatalogProductRow, ReportDbRow, StoredItem } from "@/lib/types";

/** Nombre maximum de lignes Circana enrichies par analyse. */
const MAX_PRODUCTS = 300;

export const GET = handle(async () => {
  await requireUser();
  const reports = await repo().select<ReportDbRow>("reports", { eq: { type: "dashboard" }, order: ["created_at", "desc"], limit: 200 });
  return {
    reports: reports.map((r) => {
      const v = toView(r);
      return {
        id: v.id, name: v.name, category: v.category, status: v.status, created_at: v.created_at, params: v.params,
        productCount: v.stats?.productCount ?? r.data?.items?.length ?? null,
        completeCount: v.stats?.completeCount ?? null,
        awaitingTeam: v.stats?.awaitingTeam ?? null,
      };
    }),
  };
});

const Table = z.object({
  rows: z.array(z.record(z.string(), z.string())).max(5000),
  mapping: z.record(z.string(), z.string().nullable()),
  fileName: z.string().max(200).default("import"),
  storagePath: z.string().max(400).nullable().optional(),
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
  /** Sans fichier catalogue : réutiliser le catalogue déjà enregistré. */
  useSavedCatalog: z.boolean().default(false),
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const input = Body.parse(await body(req));

  const missing = missingRequired(input.circana.mapping, CIRCANA_FIELDS);
  if (missing.length) throw new HttpError(400, `Colonnes Circana à associer : ${missing.join(", ")}`);

  const all = toCircanaRows(input.circana.rows, input.circana.mapping);
  const excluded = new Set(input.params.excludedBrands.map(normalize));
  const focusTerms = normalize(input.params.focus).split(" ").filter((w) => w.length > 2);
  let rows = all.filter((r) => input.params.zones.includes(r.zone)).filter((r) => !excluded.has(normalize(r.brand)));
  if (input.params.focusOnly && focusTerms.length) {
    rows = rows.filter((r) => focusTerms.some((t) => normalize(`${r.brand} ${r.product}`).includes(t)));
  }
  if (!rows.length) throw new HttpError(400, "Aucune ligne Circana ne correspond aux critères (zones, exclusions, focus).");
  const truncated = rows.length > MAX_PRODUCTS;
  rows = rows.slice(0, MAX_PRODUCTS);

  let catalogProductIds: string[] = [];
  if (input.catalog?.rows.length) {
    const miss = missingRequired(input.catalog.mapping, CATALOG_FIELDS);
    if (miss.length) throw new HttpError(400, `Colonnes du catalogue à associer : ${miss.join(", ")}`);
    catalogProductIds = await upsertCatalog(toClientProducts(input.catalog.rows, input.catalog.mapping).slice(0, 500), input.category);
  } else if (input.useSavedCatalog) {
    const saved = await repo().select<CatalogProductRow>("catalog_products", { limit: 500 });
    catalogProductIds = saved.filter((c) => c.status !== "discontinued").map((c) => c.id);
  }

  // Tout le fichier Circana est historisé, pas seulement les lignes retenues.
  const circanaImportId = await saveCircanaImport(input.circana.fileName, all, user.userId, input.circana.storagePath ?? null);

  const now = new Date().toISOString();
  const items: StoredItem[] = rows.map((circana, position) => ({
    id: randomUUID(), position, circana, status: "pending", method: null, siteDomain: null,
    marketProductId: null, jobId: null, error: null, updatedAt: now,
  }));
  const [report] = await repo().insert<ReportDbRow>("reports", [
    {
      title: input.name,
      type: "dashboard",
      status: "generating",
      config: { category: input.category, params: input.params, circanaImportId, catalogProductIds },
      data: { phase: "collecting", items },
      created_by: user.userId,
    },
  ]);
  return { id: report.id, products: rows.length, truncated, maxProducts: MAX_PRODUCTS };
});
