import { redirect } from "next/navigation";
import { getAgentConfig } from "@/lib/settings";
import { missingSettings } from "@/lib/settings-check";

export const dynamic = "force-dynamic";

/** L'accueil ouvre les réglages tant qu'ils ne sont pas remplis, sinon l'analyse. */
export default async function Home() {
  const cfg = await getAgentConfig().catch(() => null);
  redirect(missingSettings(cfg).length ? "/settings" : "/analysis");
}
