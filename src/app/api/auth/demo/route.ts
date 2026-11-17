import { handle } from "@/lib/http";
import { demoLogin, demoLoginEnabled, DEMO_ACCOUNT, HttpError, supabaseDemoLogin } from "@/lib/auth";
import { isDemo } from "@/lib/config";
import { repo } from "@/lib/repo";
import type { MembershipRow, ProfileRow } from "@/lib/types";

/** Connexion en un clic au compte de démonstration. */
export const POST = handle(async () => {
  if (!demoLoginEnabled()) throw new HttpError(403, "La connexion de démonstration n'est pas activée.");

  let userId: string | undefined;
  if (isDemo.db) {
    await demoLogin(DEMO_ACCOUNT.email, DEMO_ACCOUNT.fullName, DEMO_ACCOUNT.orgName);
    userId = (await repo().select<ProfileRow>("profiles", { eq: { email: DEMO_ACCOUNT.email } }))[0]?.id;
  } else {
    userId = await supabaseDemoLogin();
  }

  // Offre Entreprise pour la démo : pas de limite d'analyses pendant une présentation.
  const [membership] = userId ? await repo().select<MembershipRow>("memberships", { eq: { user_id: userId } }) : [];
  if (membership) await repo().update("organizations", membership.org_id, { plan: "enterprise" });
  return { ok: true };
});
