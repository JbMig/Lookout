import { z } from "zod";
import { body, handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { repo } from "@/lib/repo";
import type { InvitationRow, MembershipRow, ProfileRow } from "@/lib/types";

export const GET = handle(async () => {
  const user = await requireUser();
  const db = repo();
  const memberships = await db.select<MembershipRow>("memberships", { eq: { org_id: user.orgId }, order: ["created_at", "asc"] });
  const profiles = memberships.length
    ? await db.select<ProfileRow>("profiles", { in: ["id", memberships.map((m) => m.user_id)] })
    : [];
  const invitations = await db.select<InvitationRow>("invitations", { eq: { org_id: user.orgId, accepted_at: null } });
  return {
    org: { id: user.orgId, name: user.orgName, plan: user.plan },
    members: memberships.map((m) => {
      const p = profiles.find((x) => x.id === m.user_id);
      return { id: m.id, userId: m.user_id, email: p?.email ?? "?", fullName: p?.full_name ?? null, role: m.role };
    }),
    invitations,
  };
});

export const PATCH = handle(async (req: Request) => {
  const user = await requireUser("admin");
  const { name } = z.object({ name: z.string().trim().min(1).max(80) }).parse(await body(req));
  await repo().update("organizations", user.orgId, { name });
  return { ok: true };
});
