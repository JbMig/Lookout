/**
 * Informations légales de l'éditeur (LCEN, art. 1-1). À compléter avant la mise en production :
 * tant qu'un champ vaut null, la page l'affiche comme manquant.
 */
export const EDITOR = {
  company: null as string | null, // raison sociale et forme juridique, ex. « Lookout SAS »
  capital: null as string | null, // ex. « 1 000 € »
  address: null as string | null, // adresse du siège
  registration: null as string | null, // RCS + numéro SIREN
  vat: null as string | null, // numéro de TVA intracommunautaire
  email: null as string | null,
  phone: null as string | null,
  publicationDirector: null as string | null, // directeur ou directrice de la publication
};

/** Hébergeurs (art. 1-1, I, 4° LCEN : nom, adresse, téléphone). */
export const HOSTS = [
  { role: "Hébergement du site", name: "Vercel Inc.", address: "440 N Barranca Ave #4133, Covina, CA 91723, États-Unis", contact: "https://vercel.com/contact" },
  { role: "Hébergement des données", name: "Supabase Inc.", address: null as string | null, contact: "https://supabase.com/contact" },
];
