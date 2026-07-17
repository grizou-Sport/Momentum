# Spécification — FLOW V1

## Rôle produit

FLOW raconte comment une expérience est vécue. Il ne mesure pas la performance et ne produit aucun score.

La position d’une activité sur la carte dépend exclusivement de deux réponses utilisateur : le défi ressenti et la maîtrise ressentie. Les données FIT, la charge, la météo et le contexte constituent une couche interne séparée qui ne déplace jamais le point en V1.

## Parcours

1. Une activité réalisée est enregistrée normalement.
2. MOMENTUM propose trois curseurs rapides : effort physique, défi et maîtrise.
3. L’utilisateur peut répondre ou choisir « Plus tard ».
4. Une réponse crée ou actualise `activity_flow_assessments` et place l’activité sur la carte.
5. La sélection d’un point affiche le contexte, les mesures disponibles, les notes et les photos éventuellement liées à un Moment.

## Périodes

- 4 semaines
- 8 semaines par défaut
- 6 mois
- 1 an
- Historique complet

## Frontières de la V1

La V1 ne contient ni Flow Score, ni Momentum Score, ni prédiction, ni recommandation, ni comparaison entre utilisateurs. Les données automatiques sont conservées uniquement pour préparer de futures analyses.
