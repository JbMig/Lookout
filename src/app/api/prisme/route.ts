import { z } from "zod";
import { body, handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { dashboardPrisme, sujetsDisponibles } from "@/lib/prisme-dashboard";
import { enregistrerAnalyse } from "@/lib/prisme-historique";

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
  const user = await requireUser();
  const { sujet, question, pays } = Body.parse(await body(req));
  const d = await dashboardPrisme(sujet, question, pays);
  // Chaque recherche est gardée dans « Social listening » ; un échec d'enregistrement n'empêche pas d'afficher le résultat.
  const analyse_id = await enregistrerAnalyse(d, { question, pays, userId: user.userId, email: user.email }).catch((e) => {
    console.error("Prisme : enregistrement impossible", e);
    return null;
  });
  return { ...d, analyse_id };
});
