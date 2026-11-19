# Workflows n8n · social listening

Orchestration de la veille social listening (TikTok, Instagram, YouTube, Google Trends) qui alimente les tables `sl_*` de Supabase, lues ensuite par Prisme.

| Fichier | Rôle |
|---|---|
| `lookout-veille.json` | Workflow principal « Lookout · Veille social listening (par sujet) » : formulaire (sujet, pays, budget, sources) ou déclenchement chaque lundi à 7 h → lance un job Hugging Face (`python:3.12-slim`, code du dépôt privé `lookout-social`) → vérifie l'état toutes les 2 min → nouvelle tentative ou alerte en cas d'échec. |
| `noeuds-api-saas.json` | Nœuds à ajouter pour lancer une veille depuis le SaaS : webhook protégé par l'en-tête `X-Lookout-Key`, puis lecture de la demande. |

## Importer
Dans n8n : **Workflows → Import from file**, puis recréer les credentials (ils ne sont pas exportés) :
- **Lookout · HF Jobs** (Custom Auth) : en-tête `Authorization: Bearer <jeton Hugging Face>` et les secrets du job (Apify, YouTube, Supabase, Hugging Face) ;
- un credential **Header Auth** séparé pour lire l'état du job (requête GET sans corps) ;
- pour l'API SaaS : Header Auth `X-Lookout-Key`.

Aucune clé n'est stockée dans ces fichiers.
