# Spécification — TOGETHER

## Objectif

Permettre de vivre et conserver des moments sportifs partagés au sein de groupes et de clubs.

## À documenter

- Rôles, permissions et visibilité.
- Clubs, moments et souvenirs.
- Cas vides, chargement et erreurs.
- Critères d’acceptation et modération.

## Navigation UX v1

- Le panneau contextuel TOGETHER expose Mes Moments, Cercle, Clubs et Invitations.
- Le Fil d’actualité est visible comme extension future, mais ne mène pas vers un écran vide.
- Sur Mobile, les mêmes destinations sont réunies dans le menu hamburger.

## Cycle de vie d’un Moment

Un organisateur peut :

- créer un Moment privé, partagé avec le Cercle ou rattaché à un Club ;
- choisir des participants dans son Cercle ;
- consulter le détail et le statut de chaque invitation ;
- modifier, dupliquer ou supprimer son Moment ;
- confirmer un créneau et terminer un Moment.

Un participant invité peut consulter le Moment grâce aux politiques RLS de `moment_participants`, puis accepter ou refuser l’invitation.

## Critères d’acceptation UX v1

- La création suit l’ordre informations, visibilité, participants, invitations.
- Une personne sélectionnée reçoit une ligne `moment_participants` au statut `PENDING`.
- Une réponse met à jour le statut sans créer de doublon.
- Seul l’organisateur voit les actions Modifier, Dupliquer et Supprimer.
- La suppression demande une confirmation explicite et nettoie les médias de stockage après la suppression des données.
