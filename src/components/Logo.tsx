/* eslint-disable @next/next/no-img-element */
/**
 * Logo Lookout : monogramme L/b avec l'œil et l'arc terracotta, nom en Cormorant.
 * « clair » = version beige pour les fonds sombres (menu, page de connexion).
 */
export function Logo({ className, clair = false }: { className?: string; clair?: boolean }) {
  return <img src={clair ? "/logo-lookout-clair.png" : "/logo-lookout.png"} alt="Lookout" className={className} width={720} height={471} />;
}
