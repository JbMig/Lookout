import { handle } from "@/lib/http";
import { requireStaff } from "@/lib/auth";
import { repo } from "@/lib/repo";
import { analysesThisMonth } from "@/lib/quota";
import type { MembershipRow, OrganizationRow } from "@/lib/types";

export const GET = handle(async () => {
  await requireStaff();
  const db = repo();
  const orgs = await db.select<OrganizationRow>("organizations", { order: ["created_at", "desc"] });
  const memberships = await db.select<MembershipRow>("memberships");
  return {
    orgs: await Promise.all(
      orgs.map(async (o) => ({
        ...o,
        members: memberships.filter((m) => m.org_id === o.id).length,
        analysesThisMonth: await analysesThisMonth(o.id),
      })),
    ),
  };
});
