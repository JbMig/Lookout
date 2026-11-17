import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "crypto";
import { config, isDemo } from "./config";
import { repo } from "./repo";
import type { InvitationRow, MembershipRow, OrganizationRow, ProfileRow, Role, SessionUser } from "./types";

/**
 * Authentification.
 * - Supabase configuré : Supabase Auth (e-mail + mot de passe), session en cookies.
 * - Mode démo : n'importe quel e-mail ouvre une session locale (cookie lk_demo_uid).
 */

const DEMO_COOKIE = "lk_demo_uid";

/** Compte utilisé par le bouton de connexion en un clic (mode démo). */
export const DEMO_ACCOUNT = { email: "demo@lookout.app", fullName: "Compte démo", orgName: "Lookout Démo" };

export async function supabaseAuth() {
  const store = await cookies();
  return createServerClient(config.supabase.url, config.supabase.anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) store.set(name, value, options);
      },
    },
  });
}

/**
 * Membre de l'équipe Lookout : e-mail listé dans STAFF_EMAILS.
 * En mode démo sans STAFF_EMAILS, le premier compte créé fait partie de l'équipe.
 */
async function isStaff(userId: string, email: string) {
  if (config.staffEmails.length) return config.staffEmails.includes(email.toLowerCase());
  if (!isDemo.db) return false;
  if (email.toLowerCase() === DEMO_ACCOUNT.email) return true;
  const [first] = await repo().select<ProfileRow>("profiles", { order: ["created_at", "asc"], limit: 1 });
  return first?.id === userId;
}

/** Crée le profil et l'organisation à la première connexion (ou rattache à une invitation). */
export async function ensureAccount(userId: string, email: string, fullName?: string, orgName?: string) {
  const db = repo();
  const profile = await db.get<ProfileRow>("profiles", userId);
  if (!profile) await db.insert<ProfileRow>("profiles", [{ id: userId, email: email.toLowerCase(), full_name: fullName ?? null }]);

  const memberships = await db.select<MembershipRow>("memberships", { eq: { user_id: userId } });
  if (memberships.length) return;

  const invites = await db.select<InvitationRow>("invitations", { eq: { email: email.toLowerCase(), accepted_at: null } });
  if (invites[0]) {
    await db.insert<MembershipRow>("memberships", [{ org_id: invites[0].org_id, user_id: userId, role: invites[0].role }]);
    await db.update("invitations", invites[0].id, { accepted_at: new Date().toISOString() });
    return;
  }
  const domain = email.split("@")[1]?.split(".")[0] ?? "Mon équipe";
  const [org] = await db.insert<OrganizationRow>("organizations", [
    { name: orgName?.trim() || domain.charAt(0).toUpperCase() + domain.slice(1), plan: "trial" },
  ]);
  await db.insert<MembershipRow>("memberships", [{ org_id: org.id, user_id: userId, role: "owner" }]);
}

export async function getSession(): Promise<SessionUser | null> {
  let userId: string | null = null;
  let email: string | null = null;

  if (isDemo.db) {
    userId = (await cookies()).get(DEMO_COOKIE)?.value ?? null;
    if (userId) email = (await repo().get<ProfileRow>("profiles", userId))?.email ?? null;
  } else {
    const { data } = await (await supabaseAuth()).auth.getUser();
    userId = data.user?.id ?? null;
    email = data.user?.email ?? null;
    if (userId && email) await ensureAccount(userId, email);
  }
  if (!userId || !email) return null;

  const [membership] = await repo().select<MembershipRow>("memberships", { eq: { user_id: userId }, order: ["created_at", "asc"] });
  if (!membership) return null;
  const org = await repo().get<OrganizationRow>("organizations", membership.org_id);
  if (!org) return null;
  return {
    userId,
    email,
    orgId: org.id,
    orgName: org.name,
    plan: org.plan,
    role: membership.role,
    isStaff: await isStaff(userId, email),
  };
}

export async function demoLogin(email: string, fullName?: string, orgName?: string) {
  const db = repo();
  const existing = await db.select<ProfileRow>("profiles", { eq: { email: email.toLowerCase() } });
  const userId = existing[0]?.id ?? randomUUID();
  await ensureAccount(userId, email, fullName, orgName);
  (await cookies()).set(DEMO_COOKIE, userId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function logout() {
  if (isDemo.db) (await cookies()).delete(DEMO_COOKIE);
  else await (await supabaseAuth()).auth.signOut();
}

/* ---------- Contrôles d'accès ---------- */

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const RANK: Record<Role, number> = { viewer: 0, analyst: 1, admin: 2, owner: 3 };

export async function requireUser(minRole: Role = "viewer"): Promise<SessionUser> {
  const s = await getSession();
  if (!s) throw new HttpError(401, "Connexion requise");
  if (RANK[s.role] < RANK[minRole]) throw new HttpError(403, "Droits insuffisants");
  return s;
}

export async function requireStaff(): Promise<SessionUser> {
  const s = await requireUser();
  if (!s.isStaff) throw new HttpError(403, "Réservé à l'équipe Lookout");
  return s;
}
