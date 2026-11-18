# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Équipes marketing et chefs de produit (category managers) de groupes cosmétiques. Ils lancent une analyse
à partir d'un export Circana, règlent le périmètre (zones, sites, marques exclues, produits ciblés), puis
lisent et partagent le rapport généré. Une équipe Lookout interne traite la file des fiches que la collecte
automatique n'a pas complétées (computer use H Company, saisie manuelle) et règle les sites.

## Product Purpose

Remplacer la veille concurrentielle faite à la main (plus de 130 heures par mois de stagiaires à compiler des
tableurs) : Lookout croise les ventes Circana avec les fiches produits collectées sur le web (prix, composition
INCI, formats, teintes, packaging, packshot, lien source), les tendances TikTok / Instagram et le catalogue du
client, puis produit un rapport visuel sourcé, partageable en un clic. Réussite : un rapport fiable lu et
partagé sans retraitement manuel.

## Positioning

Une chaîne de collecte en plusieurs étages (découverte Linkup, scraping direct, extraction Linkup, computer use
H Company, puis une équipe humaine en dernier recours) qui garantit des fiches complètes et sourcées, croisées
avec les ventes Circana du client, là où les outils de veille s'arrêtent aux prix ou aux mentions sociales.

## Operating Context

- Entrées : exports Circana (CSV, Excel, JSON), catalogue client (CSV, Excel, JSON).
- Analyses lancées manuellement, jamais planifiées, avec marques exclues et produits ciblés.
- Zones : États-Unis et Europe ; Chine et Corée annoncées, pas encore disponibles.
- Rapports relancés pour suivre l'évolution, partagés par lien en lecture seule, exportés en PDF.
- Langue de l'interface : français.

## Capabilities and Constraints

- Next.js (App Router), Tailwind v4, Recharts, Supabase (Auth, Postgres, Storage), déploiement Vercel.
- Espace de travail unique ; l'équipe Lookout est définie par `STAFF_EMAILS`.
- Pages : accueil (historique des analyses), nouvelle analyse, rapport, partage public, catalogues (sites et
  catalogue client), compte, offres, connexion, administration (file de l'équipe, sites, utilisateurs, collecte).
- Offres affichées à titre indicatif : le paiement Stripe n'est pas branché.
- Mode démo sans clés : données fictives, bandeau signalé.

## Brand Commitments

- Nom : Lookout. Slogan : « La veille qui ne dort jamais ».
- Le logo actuel est conservé tel quel (`src/components/Logo.tsx`) : les deux O de « Look » forment des
  jumelles tenues par le T de « out » ; bleu nuit #13233F et ambre #F2A33A.

## Evidence on Hand

- Fichiers d'exemple aux chiffres fictifs : `public/exemple-circana.csv`, `public/exemple-catalogue.csv`.
- Aucun client, témoignage, chiffre d'affaires ou logo client réel : ne rien inventer de tel.

## Product Principles

1. Chaque chiffre est sourcé : une fiche renvoie toujours à sa page d'origine.
2. Le rapport se lit en deux minutes et se creuse ensuite (synthèse d'abord, fiches ensuite).
3. L'utilisateur garde la main : il choisit le périmètre et voit ce qui est en attente de l'équipe.
4. L'incomplet est montré, jamais masqué : une fiche partielle le dit.
