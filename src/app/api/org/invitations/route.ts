import { z } from "zod";
import { body, handle } from "@/lib/http";
import { requireUser, HttpError } from "@/lib/auth";
import { repo } from "@/lib/repo";
import type { InvitationRow } from "@/lib/types";

const Body = z.object({
  email: z.string().email("E-mail invalide").transform((e) => e.toLowerCase()),
  role: z.enum(["admin", "analyst", "viewer"]).default("analyst"),
});

/** Invite un collègue : il rejoindra l'organisation en créant son compte avec cet e-mail. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser("admin");
  const { email, role } = Body.parse(await body(req));
  const existing = await repo().select<InvitationRow>("invitations", { eq: { org_id: user.orgId, email, accepted_at: null } });
  if (existing.length) throw new HttpError(409, "Une invitation est déjà en attente pour cet e-mail");
  const [inv] = await repo().insert<InvitationRow>("invitations", [{ org_id: user.orgId, email, role }]);
  return { invitation: inv };
});

export const DELETE = handle(async (req: Request) => {
  const user = await requireUser("admin");
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const inv = await repo().get<InvitationRow>("invitations", id);
  if (!inv || inv.org_id !== user.orgId) throw new HttpError(404, "Invitation introuvable");
  await repo().remove("invitations", id);
  return { ok: true };
});
