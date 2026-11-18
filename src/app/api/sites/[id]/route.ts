import { z } from "zod";
import { body, handle } from "@/lib/http";
import { HttpError, requireStaff } from "@/lib/auth";
import { updateSite } from "@/lib/sites";

const Patch = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  zone: z.enum(["US", "EU"]).optional(),
  country: z.string().trim().max(60).nullable().optional(),
  type: z.enum(["revendeur", "marque", "marketplace"]).optional(),
  categories: z.array(z.string().trim().min(1)).optional(),
  method: z.enum(["untested", "scraping", "linkup", "computer_use", "blocked"]).optional(),
  cuInstructions: z.string().trim().max(4000).nullable().optional(),
});

/** Modification d'un site par l'équipe (méthode, parcours de computer use…). */
export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/sites/[id]">) => {
  await requireStaff();
  const { id } = await ctx.params;
  const { cuInstructions, ...rest } = Patch.parse(await body(req));
  if (rest.method === "computer_use" && cuInstructions !== undefined && !cuInstructions) {
    throw new HttpError(400, "Un parcours est nécessaire pour passer le site en computer use automatique");
  }
  await updateSite(id, { ...rest, ...(cuInstructions !== undefined ? { cu_instructions: cuInstructions || null } : {}) });
  return { ok: true };
});
