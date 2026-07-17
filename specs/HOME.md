# Spécification — HOME

## Objectif

Donner une vue immédiate de la journée vécue et des prochaines actions utiles.

HOME réunit le HERO, les informations du jour, la fenêtre vivante, le calendrier et le Journal. Les analyses longitudinales appartiennent désormais à la page `progression.html`.

Une section `Flow` vide est réservée sous le Journal. Elle ne contient encore ni score, ni indicateur, ni interprétation.

## À documenter

- États et parcours principaux.
- Données affichées et sources.
- Cas vides, chargement et erreurs.
- Critères d’acceptation et accessibilité.

## Calendriers et Moments partagés

- La fenêtre vivante, le calendrier mensuel, le résumé du jour et le détail d’une journée réunissent les activités personnelles et les Moments accessibles depuis TOGETHER.
- Un Moment TOGETHER apparaît uniquement s’il appartient à la catégorie « Aujourd’hui », « À venir » ou « Passés » et possède une date confirmée. Les brouillons et Moments « À finaliser » restent dans TOGETHER.
- Le classement est identique dans les deux pages : les statuts `COMPLETED` et `CANCELLED` sont passés ; sinon la date locale détermine aujourd’hui, à venir ou passé.
- Les droits de lecture restent ceux de la politique RLS de `moments`. HOME ne filtre pas les Moments par créateur, afin d’inclure aussi les Moments de Club et ceux auxquels la personne participe.
- Un Moment partagé se distingue par son icône de groupe et s’ouvre dans son détail TOGETHER. Il ne propose jamais les actions Modifier/Supprimer réservées aux activités HOME.
