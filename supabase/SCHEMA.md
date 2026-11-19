# Schéma Supabase utilisé par Lookout

L'application s'adapte au schéma déjà en place dans le projet Supabase. Seul ajout : la table `sites`
(`migrations/20261118_sites.sql`, déjà appliquée sur le projet). Le code n'écrit que des lignes de données, via la clé `service_role` côté serveur.

| Table | Usage dans l'application |
|---|---|
| `profiles` | Utilisateurs (créés par le trigger `handle_new_user`, complétés par l'application si besoin) |
| `reports` (`type = 'dashboard'`) | Une analyse. `config` : catégorie, périmètre, import Circana, produits du catalogue. `data` : lignes à enrichir (`items`), statistiques, tendances, audit, analyse rédigée. `status` : `generating` → `ready` / `failed`. `share_slug` : lien de partage. `analysis_ids` : analyses liées |
| `circana_imports`, `circana_sales` | Historique de chaque fichier Circana importé (une ligne par produit, zone et période ; `region` = zone, libellé de période dans `raw`) |
| `catalog_products` | Catalogue du client, mis à jour à chaque import (rapprochement par SKU, sinon marque + nom) et réutilisable |
| `market_products` | Une fiche par page produit (`source_site` + `product_url`), partagée entre analyses. Fiche complète dans `raw_data.sheet`, méthode de collecte dans `raw_data.method`. `embedding` (768 dimensions) si Hugging Face est configuré |
| `market_shades`, `market_ingredients` | Teintes (avec famille) et liste INCI de chaque fiche |
| `enrichment_jobs` | File de l'équipe. `source` : `team`, `hcompany:<session>`, `manual`, `dismissed` |
| `analyses` | `market_comparison` (statistiques, tendances, analyse) et `catalog_audit` (audit du catalogue) |
| `growth_opportunities` | Écarts de prix et de gammes de teintes issus de l'audit du catalogue |
| `sites` | Sites surveillés (migration `migrations/20261118_sites.sql`). Méthode de collecte, parcours de computer use, dernier succès. Un site rencontré pendant une analyse est ajouté automatiquement (`source = 'discovered'`) |
| `trend_posts` | Source prioritaire des tendances TikTok / Instagram si elle contient des publications |

Non utilisées pour l'instant : `catalog_variants`, `trend_signals`, buckets `packshots`, `catalog-images`, `reports`,
fonctions `match_market_products` / `match_catalog_products` (prêtes pour une recherche par similarité).

Absent du schéma, donc géré autrement : les journaux d'appels
(logs Vercel), les organisations, invitations et quotas (espace unique, équipe définie par `STAFF_EMAILS`).

En mode démo (sans variables Supabase), `.data/db.json` reproduit ces mêmes tables.

## app_settings (ajoutée le 2026-11-19)

Réglages de l'application, une ligne par clé :
- `agent_config` : marque, zone (US/FR/EU), catégorie, formats connus, URL de départ (page /settings) ;
- `agent_runs` : journal des 120 derniers déclenchements d'agents depuis le site (boutons et pipeline).

## prisme_analyses (ajoutée le 2026-11-19)

Historique des recherches Prisme, listé dans « Social listening ». Une ligne par recherche : sujet, question, pays,
veille utilisée, titre et accroche, et le dashboard complet (`resultat`, format `DashboardPrisme`) pour le rouvrir à l'identique.
