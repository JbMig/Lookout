# Lookout

## Accéder à la plateforme

**https://lookout-ten.vercel.app**

Compte de démonstration (sans conséquence, données partagées) :

| | |
|---|---|
| E-mail | `jmigone@eugeniaschool.com` |
| Mot de passe | `LookoutApp` |

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

Application Next.js 16 (App Router, Tailwind v4, Recharts) hébergée sur Vercel, avec Supabase pour la base,
l'authentification et le stockage. Production : https://lookout-ten.vercel.app (déployée depuis `main`) ;
chaque branche poussée obtient sa propre preview Vercel.

## Pages de l'application

| Rubrique | Page | Rôle |
|---|---|---|
| Préparer | **Réglages** (`/settings`) | Zones, marques suivies, marques exclues, sites. **Obligatoires** avant de lancer une analyse (bandeau et boutons bloqués tant qu'ils manquent). |
| | **Import Circana** (`/import`) | Dépôt du fichier de ventes Circana (agent 1). |
| | **Votre catalogue** (`/catalog`) | Catalogue client importé, audit (agent 0). |
| | **Marché** (`/market`) | Fiches produits du marché enrichies : teintes, INCI, formats (agents 2 et 2.5). |
| | **Concurrents** (`/competitors`) | Vue par marque concurrente. |
| Analyser | **Analyse** (`/analysis`) | Synthèse lisible de l'analyse de croissance (agent 3), top 3 et limites. |
| | **Opportunités** (`/opportunities`) | Écarts de prix, de format, de teinte et d'ingrédient, avec références produits. |
| | **Dashboards** (`/dashboard`) | Dashboard « Market Radar » généré à partir des données (agent 4), lien de partage. |
| Veiller | **Social listening** (`/social`) | Historique des analyses Prisme ; chaque analyse se rouvre au même format de dashboard. Collecte d'un nouveau sujet. |
| | **Prisme** (`/prisme`) | Agent analyste des tendances sociales : question libre → dashboard (KPI, réseaux, marques, produits, alertes), enregistré automatiquement dans l'historique. |
| | **Sites suivis** (`/sites`) | Sites surveillés et méthode de collecte. |
| Équipe | **Administration** (`/admin`) | Réservée aux e-mails de `STAFF_EMAILS` : utilisateurs, file, statistiques. |
| | **Offres** (`/offres`) | Page tarifaire indicative (Stripe non branché). |

Toutes les pages, y compris les liens de partage, demandent d'être connecté.

## Les agents

Chaque page porte un bouton qui lance son agent ; le suivi s'affiche sur la page (`/api/agents/run`).

| Agent | Produit | Exécution actuelle |
|---|---|---|
| 0 · Audit du catalogue | `catalog_products` | Agent externe (webhook) si configuré, sinon demande en attente |
| 1 · Import Circana | `circana_imports`, `circana_sales` | Edge function Supabase `import-circana` |
| 2 · Enrichissement du marché | `market_products`, `market_shades`, `market_ingredients` | Agent externe ou H Company, sinon demande en attente |
| 2.5 · Enrichissement sur sites web | `market_products` (complément) | Agent externe ou H Company, sinon demande en attente |
| 3 · Analyse de croissance | `analyses`, `growth_opportunities` | Dans l'application |
| 4 · Dashboard | `reports` | Dans l'application |

Les résultats produits par des agents externes (par exemple un Agent 3 au format `synthese` / `top_3` / `limites`,
scores sur 10) sont aussi lus et normalisés.

## Données (Supabase)

- **Ventes Circana** : tables `circana_top50_sku_{us|fr}_{liquid|compact|creme|stick}` (top 50 par format, CA en milliers)
  et `circana_{format}_blush` (totaux de marché), converties par `src/lib/circana.ts`.
- **Marché et catalogue** : `market_*`, `catalog_products`, `brand_aliases`.
- **Analyses** : `analyses`, `growth_opportunities` (types `price_gap`, `format_gap`, `shade_gap`, `ingredient`…), `reports`.
- **Social listening** : tables `sl_*` (collecte n8n → Hugging Face) et `prisme_analyses` (historique Prisme).
- **Réglages** : `app_settings`. **Sites** : `sites`.

Les tables optionnelles (`enrichment_jobs`, `brand_aliases`, tables Circana) peuvent être absentes : la lecture renvoie
une liste vide au lieu de casser la page. Migrations dans `supabase/migrations/`, correspondance dans `supabase/SCHEMA.md`.

## Variables d'environnement (Vercel)

| Variable | Usage |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Base, auth, stockage (la clé service reste côté serveur) |
| `STAFF_EMAILS` | Accès à l'administration |
| `HF_TOKEN`, `HF_MODEL`, `PRISME_MODEL` | Hugging Face : analyse rédigée et Prisme (par défaut Qwen3-235B) |
| `N8N_VEILLE_URL`, `N8N_VEILLE_KEY` | Lancement d'une collecte de social listening |
| `AGENT_WEBHOOK_URL`, `AGENT_WEBHOOK_SECRET` | Agents externes 0, 2 et 2.5 |
| `HAI_API_KEY`, `HAI_BASE_URL`, `HAI_AGENT`, `HAI_MAX_TIME_S` | H Company (computer use) |
| `LINKUP_API_KEY`, `LINKUP_DEPTH` | Découverte et extraction web |
| `DEMO_LOGIN`, `DEMO_EMAIL`, `DEMO_PASSWORD` | Connexion démo |

Ne jamais committer ces valeurs : elles se saisissent dans Vercel (Settings > Environment Variables).

## État actuel

- **Branché** : import Circana, analyse de croissance, opportunités, dashboard Market Radar, Prisme et son historique.
- **Pas encore relié** : aucun `AGENT_WEBHOOK_URL` ni `HAI_API_KEY` en production, donc les agents 0, 2 et 2.5 restent
  « en attente » quand on les lance.
- **Stripe** n'est pas branché : la page Offres est indicative.

## Démarrage local

```bash
npm install
cp .env.example .env.local   # sans clés : mode démo sur un fichier local .data/db.json
npm run dev                  # http://localhost:3000
npm test                     # tests unitaires (Vitest)
```

La CI GitHub (`.github/workflows/ci.yml`) lance lint, types, tests et build à chaque pull request.
Fusionner les PR avec « Create a merge commit ».

## Arborescence

| Dossier | Contenu |
|---|---|
| `src/app/` | Pages et routes API (`src/app/api/`) |
| `src/components/` | Interface : `AppShell`, `agents/` (boutons, bandeau des réglages), `prisme/`, `report/` |
| `src/lib/agent-runs.ts`, `agents-runner.ts` | Liste des agents et leur déclenchement |
| `src/lib/circana.ts`, `market*.ts`, `growth.ts`, `analysis.ts`, `synthesis.ts` | Données de vente, marché, opportunités, synthèse |
| `src/lib/radar.ts`, `radar-template.ts`, `dashboards.ts` | Dashboard Market Radar |
| `src/lib/prisme*.ts`, `alertes.ts`, `reseaux.ts`, `marques.ts`, `social.ts` | Prisme, historique, social listening |
| `src/lib/settings*.ts` | Réglages et vérification avant analyse |
| `src/lib/repo.ts`, `auth.ts` | Accès aux données (Supabase ou fichier local) et comptes |
| `supabase/` | Migrations, edge functions, `SCHEMA.md` |
| `tests/` | Tests unitaires |

## À savoir avant le lancement commercial

- **Sécurité Supabase** : plusieurs tables ont une règle RLS `anon_full` ; l'application passe par le serveur et n'en a pas besoin, à restreindre.
- **Juridique** : conditions d'utilisation des sites collectés, CGV, RGPD (tendances sociales comprises).
- **Accessibilité** : à auditer de nouveau avant ouverture au public.
