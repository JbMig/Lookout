import { handle } from "@/lib/http";
import { requireStaff } from "@/lib/auth";
import { repo } from "@/lib/repo";
import type { ProfileRow } from "@/lib/types";

/** Utilisateurs inscrits (table profiles). */
export const GET = handle(async () => {
  await requireStaff();
  const users = await repo().select<ProfileRow>("profiles", { order: ["created_at", "desc"], limit: 500 });
  return { users: users.map((u) => ({ id: u.id, email: u.email, fullName: u.full_name, created_at: u.created_at })) };
});
