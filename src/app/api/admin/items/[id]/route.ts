import { z } from "zod";
import { body, handle } from "@/lib/http";
import { requireStaff, HttpError } from "@/lib/auth";
import { repo } from "@/lib/repo";
import { startNavigator } from "@/lib/agents/navigator";
import { checkNavigator, finalize } from "@/lib/pipeline";
import { missingFields, mergeSheets } from "@/lib/product";
import { toEur } from "@/lib/currency";
import { withFamilies } from "@/lib/shades";
import { logRun } from "@/lib/runs";
import type { ProductSheet, ReportItemRow, ReportRow, SiteRow } from "@/lib/types";

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
  z.object({
    action: z.literal("start_cu"),
    url: z.string().url().nullable().optional(),
    instructions: z.string().max(4000).nullable().optional(),
    saveToSite: z.boolean().default(false),
  }),
  z.object({ action: z.literal("poll") }),
  z.object({ action: z.literal("manual"), product: Manual }),
  z.object({ action: z.literal("retry") }),
  z.object({ action: z.literal("dismiss") }),
]);

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/admin/items/[id]">) => {
  await requireStaff();
  const { id } = await ctx.params;
  const db = repo();
  const item = await db.get<ReportItemRow>("report_items", id);
  if (!item) throw new HttpError(404, "Produit introuvable");
  const report = await db.get<ReportRow>("reports", item.report_id);
  if (!report) throw new HttpError(404, "Rapport introuvable");
  const input = Action.parse(await body(req));
  const now = new Date().toISOString();
  const [site] = item.site_domain ? await db.select<SiteRow>("sites", { eq: { domain: item.site_domain } }) : [];

  switch (input.action) {
    case "start_cu": {
      const instructions = input.instructions?.trim() || site?.cu_instructions || null;
      const sessionId = await startNavigator({
        row: item.circana,
        url: input.url ?? item.product?.sourceUrl ?? null,
        domain: item.site_domain,
        instructions,
        missing: missingFields(item.product),
      });
      await logRun("hcompany", "session", true, { orgId: report.org_id, reportId: report.id });
      await db.update("report_items", id, { status: "navigating", method: "hcompany", session_id: sessionId, updated_at: now });
      if (input.saveToSite && site && instructions) await db.update("sites", site.id, { cu_instructions: instructions, status: "computer_use" });
      return { ok: true, sessionId };
    }
    case "poll": {
      if (item.status !== "navigating" || !item.session_id) return { ok: true, done: true };
      const changed = await checkNavigator(item, report.id, report.org_id);
      if (changed && report.status === "done") await finalize(report.id);
      return { ok: true, done: changed };
    }
    case "manual": {
      const p = input.product;
      const sheet: ProductSheet = {
        ...p,
        formats: p.formats.map((f) => ({ ...f, currency: p.currency ?? undefined })),
        shades: withFamilies(p.shades),
        priceEur: await toEur(p.price, p.currency),
      };
      const merged = mergeSheets(sheet, item.product)!;
      await db.update("report_items", id, {
        status: missingFields(merged).length ? "partial" : "done",
        method: "manual", product: merged, error: null, updated_at: now,
      });
      if (report.status === "done") await finalize(report.id);
      return { ok: true };
    }
    case "retry": {
      await db.update("report_items", id, { status: "pending", session_id: null, error: null, updated_at: now });
      if (report.status === "done" || report.status === "failed") await db.update("reports", report.id, { status: "collecting" });
      return { ok: true };
    }
    case "dismiss": {
      await db.update("report_items", id, { status: "failed", error: "Écarté par l'équipe", updated_at: now });
      if (report.status === "done") await finalize(report.id);
      return { ok: true };
    }
  }
});
