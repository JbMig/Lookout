# Lookout

### Le Problème

Dans l'industrie cosmétique, les données de marché existent déjà : les chiffres de vente viennent de **Circana** (ex-NPD), la référence du secteur. Mais Circana ne donne que les volumes et les prix pas les compositions, pas les teintes, pas le packaging. Pour avoir une vision complète, il faut ensuite aller chercher ces informations à la main sur des dizaines de sites (Sephora, Ulta, sites des marques…), dans plusieurs langues et devises, puis tout croiser. **Ce travail ingrat est systématiquement confié aux stagiaires** : plus de 130 heures par mois à compiler des tableurs, le tout pour un rendu souvent incomplet et déjà périmé.

### La Solution

L'outil(SAAS) récupère les données de vente Circana (fichier CSV), puis va **chercher automatiquement sur le web** les données produits  : teintes, compositions INCI, formats, packaging. (Il enrichit le tout avec les tendances détectées sur TikTok et Instagram, et croise avec les données du propre catalogue du client). À la fin, il **génère automatiquement un rapport visuel interactif** — un vrai dashboard, pas un tableur (avec les packshot et shaderanges pour  **avoir une vue d’ensemble**).

### Notre Plus-Value

**Du CSV brut au dashboard décisionnel, en un clic.**

Circana + web + tendances sociales + données internes du client : tout est fusionné automatiquement. Le client obtient un **rapport visuel généré automatiquement**, où il peut :

- **Auditer son propre catalogue** : ce qui marche, ce qui décline, ce qu'il a déjà fait.
- **Se comparer au marché** : ses prix, ses teintes et ses formats face aux best-sellers concurrents.
- **Voir les tendances sociales** : les actifs, formats et teintes qui montent sur TikTok et Instagram.
- **Filtrer et explorer** par zone (US, Europe), par format, par gamme de prix.

Sourcé, visuel, partageable en un clic — sans qu'un stagiaire ait passé une semaine à tout mettre en forme.

---

## Documentation technique

Lookout fusionne les ventes Circana, les données produits récupérées sur le web (teintes, composition INCI,
formats, packaging, packshots), les tendances sociales et le catalogue interne du client, puis génère un
rapport visuel sourcé, partageable en un clic.

## Fonctionnalités

| Côté client | Côté équipe Lookout (administration) |
|---|---|
| Comptes, organisations, rôles (propriétaire, admin, analyste, lecteur), invitations | File des produits que le scraping n'a pas pu traiter |
| Offres et quotas (Essai, Pro, Entreprise) — paiement Stripe à venir | Lancement et suivi des sessions H Company (computer use) |
| Import Circana et catalogue client : CSV, Excel, JSON, avec correspondance des colonnes | Enregistrement d'un **parcours par site** : le site passe ensuite en automatique pour tous |
| Périmètre : zones, sites, marques exclues, produits ciblés | Saisie manuelle d'une fiche, relance, mise à l'écart |
| Rapport : synthèse rédigée, audit du catalogue, marché (prix, ventes, gammes de teintes, formats), tendances, fiches filtrables avec lien source | Catalogue de sites (statut, parcours, dernier succès), demandes des clients |
| Historique, relance d'une analyse, lien de partage en lecture seule, export PDF | Offre de chaque client, volume d'appels par service et par client |
| Catalogue de sites et demande d'ajout | |

## Comment une analyse se déroule

```
Import Circana (+ catalogue) ─► une ligne par produit et par zone (les périodes sont regroupées)
                                         │
   pour chaque produit :  1. Découverte Linkup : URL de la page produit, limitée aux sites choisis
                          2. Scraping direct  : données schema.org (JSON-LD) + HTML
                          3. Extraction Linkup : si des champs manquent
                          4. Site avec parcours enregistré ─► session H Company automatique
                             Sinon ─► file de l'équipe ─► computer use ou saisie, puis parcours enregistré
                                         │
   Conversion en euros (BCE) · familles de teintes · rapprochement avec le catalogue client (embeddings HF)
   · tendances (dataset HF) · analyse rédigée par un LLM Hugging Face à partir de chiffres calculés
                                         ▼
                     Rapport (recalculé automatiquement quand l'équipe débloque un produit)
```

Une fiche est « complète » quand elle a : nom, marque, prix, composition, au moins un format.

La page rapport fait avancer l'analyse par petites étapes (`/api/reports/[id]/step`) : chaque appel traite
3 produits puis rend la main. Ça tient dans la durée maximale d'une fonction Vercel, sans file d'attente à installer.

## Mode démo

Sans clés, chaque service renvoie des données fictives (bandeau en haut de page) :
- **Base** : fichier local `.data/db.json` ; connexion avec n'importe quel e-mail ; le premier compte créé a accès à l'administration.
- **Linkup / H Company / Hugging Face** : fiches et sessions simulées ; environ 1 produit sur 4 part dans la file de l'équipe pour montrer ce parcours.

## Démarrage local

```bash
npm install
cp .env.example .env.local
npm run dev          # http://localhost:3000
npm test             # tests unitaires
```

Cliquez sur « Nouvelle analyse », puis « Utiliser le fichier d'exemple » pour Circana et pour le catalogue.
Les fichiers d'exemple (`public/exemple-*.csv`) contiennent des **chiffres fictifs**.

## Mise en production

### 1. Supabase
1. Créez un projet, ouvrez **SQL Editor**, exécutez `supabase/schema.sql` (tables, sécurité RLS, catalogue de départ).
2. **Authentication > Providers** : e-mail activé. Pour tester vite, vous pouvez désactiver la confirmation par e-mail.
3. Renseignez `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY`.
4. Ajoutez vos e-mails d'équipe dans `STAFF_EMAILS`.

### 2. Services
- `LINKUP_API_KEY` (app.linkup.so), `HAI_API_KEY` (hub.hcompany.ai, vérifiez la région), `HF_TOKEN` (Inference Providers).
- Testez d'abord une analyse de **2 ou 3 produits** pour valider les réponses réelles et les coûts.

### 3. Vercel
Importez le dépôt GitHub, ajoutez les variables de `.env.example`, déployez. La CI GitHub (`.github/workflows/ci.yml`)
lance lint, types, tests et build à chaque pull request.

### 4. v0
Connectez le même dépôt dans v0 pour retravailler les écrans (`src/app/**/page.tsx`, `src/components/`).
Gardez la logique (`src/lib/`, `src/app/api/`) hors de v0 et fusionnez ses pull requests rapidement.

## Arborescence

| Dossier | Contenu |
|---|---|
| `src/lib/agents/` | `discovery.ts` (Linkup), `scraper.ts`, `extractor.ts` (Linkup), `navigator.ts` (H Company), `demo.ts` |
| `src/lib/pipeline.ts` | Enchaînement des étapes, file de l'équipe, finalisation |
| `src/lib/analysis.ts` | Statistiques, audit du catalogue, analyse rédigée |
| `src/lib/tabular.ts`, `excel.ts` | Import CSV / Excel / JSON et correspondance des colonnes |
| `src/lib/shades.ts`, `matching.ts`, `trends.ts` | Familles de teintes, rapprochement, tendances |
| `src/lib/auth.ts`, `repo.ts`, `quota.ts`, `plans.ts` | Comptes, accès aux données, quotas et offres |
| `src/app/api/` | Routes API (client, partage, administration) |
| `supabase/schema.sql` | Schéma complet et règles RLS |
| `tests/` | Tests unitaires (Vitest) |

## À savoir avant le lancement commercial

- **Stripe** n'est pas branché : l'offre se change dans Administration > Clients. Le champ `plan` et les quotas sont prêts.
- **Tendances sociales** : renseignez un dataset sous licence (`HF_TRENDS_DATASET`) ou une source partenaire ; vérifiez le RGPD.
- **Juridique** : conditions d'utilisation des sites collectés, CGV du service, RGPD.
- Les formats exacts des réponses Linkup et H Company sont à valider sur vos premiers produits réels ; le code accepte plusieurs variantes.
- `exceljs` dépend d'une version de `uuid` signalée par `npm audit` (sévérité modérée) : sans impact pour la lecture de fichiers, à suivre.
