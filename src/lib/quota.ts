import "server-only";
import { repo } from "./repo";
import { PLANS } from "./plans";
import { HttpError } from "./auth";
import type { ReportRow, SessionUser } from "./types";

function monthStart() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

export async function analysesThisMonth(orgId: string) {
  return (await repo().select<ReportRow>("reports", { eq: { org_id: orgId }, gte: ["created_at", monthStart()] })).length;
}

/** Vérifie le quota de l'offre avant de lancer une analyse. Renvoie le nombre max de produits. */
export async function checkQuota(user: SessionUser) {
  const plan = PLANS[user.plan];
  if (plan.analysesPerMonth !== null && (await analysesThisMonth(user.orgId)) >= plan.analysesPerMonth) {
    throw new HttpError(402, `Quota atteint : ${plan.analysesPerMonth} analyses par mois avec l'offre ${plan.label}.`);
  }
  return plan.productsPerAnalysis;
}
