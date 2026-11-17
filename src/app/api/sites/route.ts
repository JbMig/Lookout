import { body, handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { repo } from "@/lib/repo";
import { ensureSeed } from "@/lib/seed";
import type { SiteRow } from "@/lib/types";
import { SiteInput } from "@/lib/schemas";

export const GET = handle(async () => {
  const user = await requireUser();
  await ensureSeed();
  const sites = await repo().select<SiteRow>("sites", { order: ["name", "asc"] });
  // Les clients voient le catalogue actif et leurs propres demandes ; l'équipe voit tout.
  return {
    sites: user.isStaff
      ? sites
      : sites
          .filter((s) => s.status !== "requested" || s.requested_by_org === user.orgId)
          .map((s) => ({ ...s, cu_instructions: null, notes: null })),
  };
});

/** L'équipe ajoute un site ; un client envoie une demande d'ajout. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser("analyst");
  const input = SiteInput.parse(await body(req));
  const existing = await repo().select<SiteRow>("sites", { eq: { domain: input.domain } });
  if (existing.length) return { site: existing[0], alreadyExists: true };
  const [site] = await repo().insert<SiteRow>("sites", [
    { ...input, status: user.isStaff ? "untested" : "requested", requested_by_org: user.isStaff ? null : user.orgId },
  ]);
  return { site };
});
