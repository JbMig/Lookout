# Consignes des agents Holo (H Company)

Copie des consignes en place chez H Company au 19 novembre 2026, pour garder une trace des versions.
Les modifier ici ne change rien chez H Company : la page d'administration (`GET/PATCH /api/admin/holo`, équipe seulement)
lit et met à jour les agents, ou on les modifie directement dans Holo.

| Fichier | Agent | Rôle |
|---|---|---|
| `ochestrateur-pipeline.md` | ochestrateur-pipeline | Reçoit toutes les demandes du site (« MODE ROUTAGE ») et les confie au bon sous-agent |
| `bench-catalog-audit.md` | bench-catalog-audit | Agent 0 : audit du catalogue, un format par passage |
| `agent-enrichissement-csv.md` | agent-enrichissement-csv | Agent 2 : enrichissement des concurrents |
| `agent-analyse-concurrentielle.md` | agent-analyse-concurrentielle | Agent 3 : analyse, enregistrée via `save-analysis` |
| `bench-dashboard-creation.md` | bench-dashboard-creation | Agent 4 : rapport JSON du dashboard, ventes lues dans `circana_sku` |

Inchangés (non copiés) : `agent-import-circana`, `agent-recherche-generique`, `shade-color-expert`.
