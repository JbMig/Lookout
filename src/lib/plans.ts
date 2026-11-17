import type { PlanId } from "./types";

/**
 * Offres. Le paiement en ligne (Stripe) n'est pas encore branché :
 * l'offre d'une organisation est modifiée par l'équipe depuis l'administration.
 */
export const PLANS: Record<
  PlanId,
  { label: string; price: string; analysesPerMonth: number | null; productsPerAnalysis: number; features: string[] }
> = {
  trial: {
    label: "Essai",
    price: "Gratuit 14 jours",
    analysesPerMonth: 3,
    productsPerAnalysis: 30,
    features: ["3 analyses par mois", "30 produits par analyse", "Zones US et Europe", "Historique des rapports"],
  },
  pro: {
    label: "Pro",
    price: "Sur devis",
    analysesPerMonth: 30,
    productsPerAnalysis: 200,
    features: ["30 analyses par mois", "200 produits par analyse", "Croisement avec votre catalogue", "Tendances sociales", "Partage des rapports"],
  },
  enterprise: {
    label: "Entreprise",
    price: "Sur devis",
    analysesPerMonth: null,
    productsPerAnalysis: 1000,
    features: ["Analyses illimitées", "1 000 produits par analyse", "Sites sur mesure ajoutés au catalogue", "Accompagnement dédié"],
  },
};

export function isPlan(v: unknown): v is PlanId {
  return v === "trial" || v === "pro" || v === "enterprise";
}
