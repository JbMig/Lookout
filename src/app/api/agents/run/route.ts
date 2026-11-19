import { z } from "zod";
import { body, handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { runAgent } from "@/lib/agents-runner";

export const maxDuration = 60;

const schema = z.object({
  agent: z.enum(["0", "1", "2", "2.5", "3", "4"]),
  params: z.record(z.string(), z.unknown()).default({}),
});

/** Bouton « Lancer » d'une page : déclenche l'agent correspondant. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const { agent, params } = schema.parse(await body(req));
  return { run: await runAgent(agent, params, user) };
});
