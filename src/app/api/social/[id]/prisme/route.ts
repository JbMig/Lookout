import { z } from "zod";
import { body, handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { prisme } from "@/lib/prisme";

/** L'agent enchaîne plusieurs appels LLM + lectures Supabase : on lui laisse du temps. */
export const maxDuration = 300;

const Body = z.object({
  question: z.string().trim().min(3).max(500).default("Que devrait lancer L'Oréal sur ce sujet ? Qu'est-ce qui marche, et que disent les gens des marques ?"),
});

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/social/[id]/prisme">) => {
  await requireUser();
  const { id } = await ctx.params;
  const { question } = Body.parse(await body(req));
  return prisme(id, question);
});
