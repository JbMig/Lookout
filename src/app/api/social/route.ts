import { z } from "zod";
import { body, handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { lancerVeille, listVeilles } from "@/lib/social";

export const GET = handle(async () => {
  await requireUser();
  return { veilles: await listVeilles() };
});

const Body = z.object({
  sujet: z.string().trim().min(2, "Indiquez un sujet (ex. « blush de luxe »)").max(80),
  pays: z.enum(["FR", "US", "GB", "DE"]).default("FR"),
  mode: z.enum(["complet", "economique", "secours"]).default("economique"),
});

/** Lance une veille en arrière-plan (n8n → job Hugging Face → Supabase). */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const input = Body.parse(await body(req));
  return lancerVeille({ ...input, demandePar: user.fullName || user.email || "saas" });
});
