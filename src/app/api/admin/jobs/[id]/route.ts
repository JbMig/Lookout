import { z } from "zod";
import { body, handle } from "@/lib/http";
import { requireStaff, HttpError } from "@/lib/auth";
import { repo } from "@/lib/repo";
import { startNavigator } from "@/lib/agents/navigator";
import { pollJob, refreshReportsFor } from "@/lib/pipeline";
import { loadSheets, saveMarketProduct } from "@/lib/market";
import { missingFields, mergeSheets } from "@/lib/product";
import { toEur } from "@/lib/currency";
import { withFamilies } from "@/lib/shades";
import { siteByDomain } from "@/lib/sites";
import { logRun } from "@/lib/runs";
import type { EnrichmentJobRow, ProductSheet, Zone } from "@/lib/types";

const Manual = z.object({
  name: z.string().min(1),
  brand: z.string().min(1),
  price: z.number().nullable(),
  currency: z.string().length(3).nullable(),
  ingredients: z.string().nullable(),
  formats: z.array(z.object({ size: z.string().min(1), price: z.number().optional() })),
  shades: z.array(z.object({ name: z.string().min(1), hex: z.string().optional() })),
  packaging: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  sourceUrl: z.string().url().nullable(),
});

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start_cu"), url: z.string().url().nullable().optional(), instructions: z.string().max(4000).nullable().optional() }),
  z.object({ action: z.literal("poll") }),
  z.object({ action: z.literal("manual"), product: Manual }),
  z.object({ action: z.literal("dismiss") }),
]);

/** Actions de l'équipe sur une tâche de la file (table enrichment_jobs). */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/admin/jobs/[id]">) => {
  await requireStaff();
  const { id } = await ctx.params;
  const db = repo();
  const job = await db.get<EnrichmentJobRow>("enrichment_jobs", id);
  if (!job || job.target_type !== "market_product") throw new HttpError(404, "Tâche introuvable");
  const p = (await loadSheets([job.target_id])).get(job.target_id);
  if (!p) throw new HttpError(404, "Fiche produit introuvable");
  const zone: Zone = p.row.raw_data?.zone ?? "EU";
  const row = { brand: p.row.brand ?? "", product: p.row.name, zone };
  const input = Action.parse(await body(req));
  const now = new Date().toISOString();

  switch (input.action) {
    case "start_cu": {
      const site = siteByDomain(p.row.source_site);
      const sessionId = await startNavigator({
        row,
        url: input.url ?? p.sheet?.sourceUrl ?? p.row.product_url,
        domain: p.row.source_site,
        instructions: input.instructions?.trim() || site?.cuInstructions || null,
        missing: missingFields(p.sheet),
      });
      logRun("hcompany", "session", true);
      await db.update("enrichment_jobs", id, {
        status: "running", source: `hcompany:${sessionId}`, attempts: job.attempts + 1, started_at: now, finished_at: null,
      });
      await refreshReportsFor(job.target_id);
      return { ok: true, sessionId };
    }
    case "poll": {
      const done = await pollJob(job);
      if (done) await refreshReportsFor(job.target_id);
      return { ok: true, done };
    }
    case "manual": {
      const m = input.product;
      const sheet: ProductSheet = {
        ...m,
        formats: m.formats.map((f) => ({ ...f, currency: m.currency ?? undefined })),
        shades: withFamilies(m.shades),
        priceEur: await toEur(m.price, m.currency),
      };
      const merged = mergeSheets(sheet, p.sheet)!;
      await saveMarketProduct({
        sheet: merged, row, domain: p.row.source_site, url: p.row.product_url, method: "manual",
        category: p.row.category ?? "", existingId: job.target_id,
      });
      const missing = missingFields(merged);
      await db.update("enrichment_jobs", id, {
        status: "completed", source: "manual", finished_at: now,
        error_message: missing.length ? `Champs manquants : ${missing.join(", ")}` : null,
      });
      await refreshReportsFor(job.target_id);
      return { ok: true };
    }
    case "dismiss": {
      await db.update("enrichment_jobs", id, { status: "failed", source: "dismissed", finished_at: now, error_message: "Écarté par l'équipe" });
      await db.update("market_products", job.target_id, { status: "failed" });
      await refreshReportsFor(job.target_id);
      return { ok: true };
    }
  }
});
