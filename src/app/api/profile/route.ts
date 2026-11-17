import { z } from "zod";
import { body, handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { repo } from "@/lib/repo";

/** Mise à jour du nom affiché (table profiles). */
export const PATCH = handle(async (req: Request) => {
  const user = await requireUser();
  const { fullName } = z.object({ fullName: z.string().trim().min(1, "Le nom ne peut pas être vide").max(80) }).parse(await body(req));
  await repo().update("profiles", user.userId, { full_name: fullName });
  return { ok: true };
});
