---
version: 1
slug: "src-app"
primary_target: "src/app"
related_targets: []
---

# Surface : application Lookout (toutes les pages connectées, connexion et partage public)

Mode : Operate. Utilisateurs : marketing et chefs de produit de groupes cosmétiques ; équipe Lookout pour l'administration.
Tâches : lancer une analyse, suivre la collecte, lire et partager le rapport, gérer catalogues et file de l'équipe.
Contraintes : logo et couleurs du logo conservés (bleu nuit #13233F, ambre #F2A33A) ; interface en français ; export PDF.

## Direction contract

THESIS: La couleur réelle des produits est la donnée. Lookout se lit comme un nuancier : chaque produit porte sa bande de teintes relevée sur la fiche. Refus du tableau de bord générique gris à cartes de chiffres clés.

OWN-WORLD: Rail latéral bleu nuit plein (#13233F) portant le logo sur une pastille blanche ; fond de travail gris froid très clair, cartes blanches à bord fin et rayon 14 px ; encre bleu nuit ; ambre réservé à l'action « votre marque » et aux états en attente ; les seules couleurs saturées sont les teintes des produits. Une seule famille de caractères (Hanken Grotesk), chiffres tabulaires.

STORY: L'utilisateur voit en une seconde où en est la collecte, puis compare gammes, prix et ventes, repère sa marque, et partage.

FIRST VIEWPORT: Rail à gauche (navigation, analyses récentes, utilisateur). En tête : titre du rapport, date, pastille d'état de collecte, actions Relancer / PDF / Partager. Onglets. Colonne principale : tableau des gammes (produit, zone, ventes, évolution, prix, bande de teintes). Colonne droite : synthèse, familles de teintes en cartes nuancier, tendances.

FORM: Nuancier de teintes (direction « pick », rang 1 de la liste). seed:c7d75ad5cadb73e0. Geste signature : la bande de teintes, dont une teinte s'élargit au survol ; repris partout où un produit apparaît (fiches, catalogue, file de l'équipe). Mouvement : transitions 150-250 ms ease-out, pression des boutons à 0.97, cartes liées qui montent de 2 px.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
