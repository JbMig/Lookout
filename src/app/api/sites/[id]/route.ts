import { z } from "zod";
import { body, handle } from "@/lib/http";
import { requireStaff } from "@/lib/auth";
import { repo } from "@/lib/repo";

const Patch = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  zone: z.enum(["US", "EU"]).optional(),
  country: z.string().trim().max(40).optional(),
  type: z.enum(["revendeur", "marque", "marketplace"]).optional(),
  categories: z.array(z.string()).optional(),
  status: z.enum(["untested", "scraping", "linkup", "computer_use", "needs_review", "blocked", "requested"]).optional(),
  cu_instructions: z.string().max(4000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/sites/[id]">) => {
  await requireStaff();
  const { id } = await ctx.params;
  await repo().update("sites", id, Patch.parse(await body(req)));
  return { ok: true };
});

export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/sites/[id]">) => {
  await requireStaff();
  const { id } = await ctx.params;
  await repo().remove("sites", id);
  return { ok: true };
});
