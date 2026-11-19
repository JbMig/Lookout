import { handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { listRuns } from "@/lib/agents-runner";
import { isDemo } from "@/lib/config";

/** Journal des déclenchements et mode de liaison des agents navigateur. */
export const GET = handle(async () => {
  await requireUser();
  const link = process.env.AGENT_WEBHOOK_URL ? "webhook" : !isDemo.hcompany ? "h-company" : "aucun";
  return { runs: await listRuns(), link };
});
