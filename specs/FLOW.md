# Spécification — FLOW V1

## Rôle produit

FLOW raconte comment une expérience est vécue. Il ne mesure pas la performance et ne produit aucun score.

La position d’une activité sur la carte dépend exclusivement de deux réponses utilisateur : le défi ressenti et la maîtrise ressentie. Les données FIT, la charge, la météo et le contexte constituent une couche interne séparée qui ne déplace jamais le point en V1.

## Parcours depuis l’implémentation 1.09

1. Le formulaire du Moment contient directement les trois questions d’expérience : effort physique, défi et maîtrise.
2. « Enregistrer le Moment » sauvegarde le Moment et son expérience dans le même parcours, sans popup FLOW.
3. `activities.rpe` reçoit l’effort physique et constitue l’unique RPE officiel.
4. `activity_flow_assessments` reçoit le défi, la maîtrise, le souvenir facultatif et le contexte d’analyse.
5. FLOW utilise ces données pour la carte et les analyses, sans jamais devenir un formulaire visible pour l’utilisateur.
6. Pour modifier une expérience, l’utilisateur modifie le Moment correspondant.

## Périodes

- 4 semaines
- 8 semaines par défaut
- 6 mois
- 1 an
- Historique complet

## Frontières de la V1

La V1 ne contient ni Flow Score, ni Momentum Score, ni prédiction, ni recommandation, ni comparaison entre utilisateurs. Les données automatiques sont conservées uniquement pour préparer de futures analyses.
