import { z } from "zod";
import { body, handle } from "@/lib/http";
import { requireUser, HttpError } from "@/lib/auth";
import { repo } from "@/lib/repo";
import type { MembershipRow } from "@/lib/types";

async function load(orgId: string, id: string) {
  const m = await repo().get<MembershipRow>("memberships", id);
  if (!m || m.org_id !== orgId) throw new HttpError(404, "Membre introuvable");
  return m;
}

async function ensureAnotherOwner(orgId: string, excludingId: string) {
  const owners = await repo().select<MembershipRow>("memberships", { eq: { org_id: orgId, role: "owner" } });
  if (!owners.some((o) => o.id !== excludingId)) throw new HttpError(400, "L'organisation doit garder au moins un propriétaire");
}

export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/org/members/[id]">) => {
  const user = await requireUser("admin");
  const { id } = await ctx.params;
  const { role } = z.object({ role: z.enum(["owner", "admin", "analyst", "viewer"]) }).parse(await body(req));
  const m = await load(user.orgId, id);
  if (role === "owner" && user.role !== "owner") throw new HttpError(403, "Seul un propriétaire peut nommer un propriétaire");
  if (m.role === "owner" && role !== "owner") await ensureAnotherOwner(user.orgId, m.id);
  await repo().update("memberships", id, { role });
  return { ok: true };
});

export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/org/members/[id]">) => {
  const user = await requireUser("admin");
  const { id } = await ctx.params;
  const m = await load(user.orgId, id);
  if (m.role === "owner") await ensureAnotherOwner(user.orgId, m.id);
  await repo().remove("memberships", id);
  return { ok: true };
});
