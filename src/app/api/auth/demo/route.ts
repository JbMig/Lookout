import { handle } from "@/lib/http";
import { demoLogin, DEMO_ACCOUNT, HttpError } from "@/lib/auth";
import { isDemo } from "@/lib/config";
import { repo } from "@/lib/repo";
import type { MembershipRow, ProfileRow } from "@/lib/types";

/** Connexion en un clic au compte de démonstration (uniquement sans Supabase). */
export const POST = handle(async () => {
  if (!isDemo.db) throw new HttpError(403, "La connexion de démonstration est désactivée quand Supabase est configuré.");
  await demoLogin(DEMO_ACCOUNT.email, DEMO_ACCOUNT.fullName, DEMO_ACCOUNT.orgName);
  // Offre Entreprise pour la démo : pas de limite d'analyses pendant une présentation.
  const [profile] = await repo().select<ProfileRow>("profiles", { eq: { email: DEMO_ACCOUNT.email } });
  const [membership] = profile ? await repo().select<MembershipRow>("memberships", { eq: { user_id: profile.id } }) : [];
  if (membership) await repo().update("organizations", membership.org_id, { plan: "enterprise" });
  return { ok: true };
});
