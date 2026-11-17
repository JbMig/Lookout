import { handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { PLANS } from "@/lib/plans";
import { analysesThisMonth } from "@/lib/quota";

export const GET = handle(async () => {
  const user = await requireUser();
  const used = await analysesThisMonth(user.orgId);
  return { user, plan: PLANS[user.plan], usage: { analysesThisMonth: used } };
});
