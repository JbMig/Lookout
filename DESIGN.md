---
name: Lookout
description: La veille qui ne dort jamais. Un nuancier de marché pour les équipes marketing beauté.
colors:
  night: "#13233f"
  night-2: "#1c3256"
  night-3: "#24406b"
  night-line: "#2a3f63"
  night-text: "#c6d1e1"
  night-muted: "#8597b2"
  ink: "#13233f"
  ink-soft: "#4f5d73"
  ink-faint: "#6f7b8e"
  ground: "#f4f5f7"
  paper: "#ffffff"
  line: "#e4e6eb"
  line-soft: "#eef0f3"
  amber: "#f2a33a"
  amber-dark: "#8a560b"
  amber-wash: "#fdf3e3"
  ok: "#17784f"
  bad: "#b33939"
  family-rose: "#e58fa0"
  family-peche-corail: "#ee9474"
  family-rouge: "#c8243b"
  family-baie-prune: "#8e3557"
  family-mauve: "#a884b5"
  family-nude-brun: "#b98667"
typography:
  page-title:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  card-title:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  meta:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 600
    lineHeight: 1.4
  display-login:
    fontFamily: "Hanken Grotesk Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "52px"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.03em"
rounded:
  strip: "6px"
  control: "10px"
  panel: "12px"
  card: "14px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "20px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.night}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.night-2}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  button-accent:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.night}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.card}"
    padding: "20px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  rail:
    backgroundColor: "{colors.night}"
    textColor: "{colors.night-text}"
    width: "248px"
  rail-link-active:
    backgroundColor: "{colors.night-3}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
  pill:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
---

# Design System: Lookout

## Overview

Lookout se lit comme un nuancier. La couleur réelle des produits est la donnée : chaque produit porte la bande des teintes relevées sur sa fiche, partout où il apparaît (tableau des gammes, fiches produits, file de l'équipe). Autour, l'interface reste calme et précise, comme un outil de travail quotidien pour des équipes marketing : un rail bleu nuit, un fond gris froid, des cartes blanches.

Le monde a été choisi parmi quatre propositions (Paillasse, Nuancier, Atlas, Standard SaaS) ; le logo et ses deux couleurs, bleu nuit et ambre, sont conservés tels quels.

## Colors

### Primary
- **Bleu nuit** (`night`, #13233f) : rail de navigation, boutons principaux, encre, barres « États-Unis » des graphiques. Ses variantes `night-2` et `night-3` portent le survol et l'élément actif du rail.

### Secondary
- **Ambre** (`amber`, #f2a33a) : réservé à « votre marque », aux fiches en attente de l'équipe, à l'action « Nouvelle analyse » et à l'anneau de focus. `amber-wash` teinte les lignes de votre marque, `amber-dark` en porte le texte.

### Tertiary
- **Teintes des produits** : les seules couleurs saturées de l'écran, lues sur les fiches. Les familles (`family-*`) en donnent la référence quand il faut les regrouper.

### Neutral
- `ground` (#f4f5f7) fond de travail, `paper` cartes, `line` et `line-soft` bords et séparateurs, `ink-soft` et `ink-faint` texte secondaire.

### Named Rules
- **La couleur appartient au produit.** Aucune décoration saturée : si une couleur vive apparaît, c'est une teinte relevée ou un état.
- **L'ambre désigne le client.** Il ne sert ni de décoration ni de second accent.

## Typography

Une seule famille, Hanken Grotesk (variable, auto-hébergée), chiffres tabulaires partout.

### Hierarchy
- Titre de page 28 px / 600, titre de carte 16 px / 600, corps 14 px, métadonnées 13 px, en-têtes de tableau 12,5 px / 600.
- Le grand titre 52 px n'existe que sur la page de connexion, pour le slogan.

## Layout

- Rail fixe de 248 px à partir de 1024 px ; en dessous, barre du haut bleu nuit et menu latéral.
- Contenu limité à 1320 px, marges 20 / 32 / 40 px.
- Rapport : colonne principale (tableau des gammes, audit du catalogue) et colonne de 340 px (synthèse, familles de teintes) à partir de 1280 px ; sous 768 px, les tableaux deviennent des lignes empilées où la bande de teintes passe en pleine largeur.
- Onglets du rapport collés en haut, avec suivi de la section visible.

## Elevation & Depth

Plat par défaut : bords de 1 px, pas d'ombre au repos. Une ombre douce et décalée apparaît au survol des éléments liés (montée de 2 px) et sous la barre d'action collante de « Nouvelle analyse ».

## Shapes

Rayons : 6 px pour les bandes de teintes, 10 px pour les boutons et champs, 12 px pour les panneaux internes, 14 px pour les cartes, pilule pour les états.

## Components

### Buttons
Principal bleu nuit, secondaire blanc bordé, accent ambre (une seule action par écran), danger bordé au texte rouge. Tous se compriment à 0,97 à l'appui.

### Chips
Pastille d'état blanche à point coloré (gris, ambre, vert, rouge, bleu nuit) ; badge « Votre marque » ambre.

### Cards / Containers
Carte blanche, bord `line`, rayon 14 px, 20 px de marge interne ; variante sans marge pour les tableaux.

### Inputs / Fields
Champ blanc rayon 10 px, bord bleu nuit et halo léger au focus ; zone de dépôt de fichier en pointillé.

### Navigation
Rail bleu nuit : logo sur pastille blanche, liens avec icônes, analyses récentes, compte et déconnexion en pied.

### Bande de teintes (composant signature)
`ShadeStrip` : une case par teinte relevée, nom en infobulle ; au survol, la case s'élargit (220 ms, ease-out). Sans teinte, motif hachuré avec l'état (« collecte en cours », « chez l'équipe »).

## Do's and Don'ts

### Do:
- Montrer la bande de teintes chaque fois qu'un produit apparaît.
- Dire l'état réel d'une fiche (complète, chez l'équipe, incomplète) plutôt que le masquer.
- Formater les nombres en français (28,26 €, 4,2 teintes).

### Don't:
- Ajouter des cartes de chiffres clés en tête de page : les chiffres vivent dans la synthèse et les tableaux.
- Utiliser l'ambre pour autre chose que le client, l'attente ou l'action principale.
- Ajouter une seconde famille de caractères ou une couleur vive décorative.
