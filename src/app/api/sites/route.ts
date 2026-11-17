import { handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { SITES } from "@/lib/sites";

/** Catalogue des sites (défini dans src/lib/sites.ts). */
export const GET = handle(async () => {
  const user = await requireUser();
  return { sites: SITES.map((s) => (user.isStaff ? s : { ...s, cuInstructions: undefined })) };
});
