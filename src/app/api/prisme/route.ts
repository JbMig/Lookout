import { z } from "zod";
import { body, handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { dashboardPrisme, sujetsDisponibles } from "@/lib/prisme-dashboard";

/** Prisme enchaîne plusieurs appels LLM et lectures Supabase. */
export const maxDuration = 300;

export const GET = handle(async () => {
  await requireUser();
  return { sujets: await sujetsDisponibles() };
});

const Body = z.object({
  sujet: z.string().trim().min(2, "Écrivez ce que vous cherchez (ex. « blush de luxe »)").max(80),
  question: z.string().trim().max(500).optional(),
  pays: z.enum(["FR", "EU", "US", "GB", "DE"]).default("FR"),
});

export const POST = handle(async (req: Request) => {
  await requireUser();
  const { sujet, question, pays } = Body.parse(await body(req));
  return dashboardPrisme(sujet, question, pays);
});
