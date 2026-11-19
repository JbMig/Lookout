import { z } from "zod";
import { body, handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { getAgentConfig, setSetting } from "@/lib/settings";

const schema = z.object({
  brand: z.string().trim().min(1, "Indiquez la marque").max(120),
  zone: z.enum(["US", "FR", "EU"]),
  category: z.string().trim().min(1, "Choisissez une catégorie").max(60),
  formats: z.array(z.enum(["liquide", "compact", "creme", "stick"])).min(1, "Cochez au moins un format connu").max(4),
  startUrl: z.string().trim().min(1, "Indiquez l'URL de départ").url("L'URL de départ doit commencer par https://").max(500),
});

/** Configuration des agents (marque, zone, catégorie, formats, URL de départ). */
export const GET = handle(async () => {
  await requireUser();
  return { config: await getAgentConfig() };
});

export const PUT = handle(async (req: Request) => {
  await requireUser();
  const config = schema.parse(await body(req));
  await setSetting("agent_config", config);
  return { config };
});
