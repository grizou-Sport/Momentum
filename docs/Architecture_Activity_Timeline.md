# Activity Timeline — Lot B.1

## Décision

L'Activity Timeline est un objet métier interne et factuel. Elle décrit le déroulement connu d'une activité sans qualifier la performance et sans segmenter le terrain.

Le fichier FIT reste la source de vérité. La table `activity_timeline` est une projection reconstruisible, ordonnée et destinée aux futurs consommateurs internes.

## Événements de la version 1

- `start` et `finish` : bornes factuelles de la session importée ou horodatée ;
- `pause` et `resume` : transitions du chronomètre FIT ;
- `lap` : tours présents dans le fichier ;
- `gps_lost` et `gps_recovered` : transitions directement observées dans les enregistrements ;
- `fit_event` : autres messages FIT conservés sans interprétation.

Chaque événement porte son horodatage absolu, son temps écoulé depuis le départ, sa position stable dans la chronologie et des métadonnées JSON limitées aux faits sources.

## Frontière du lot

Les montées, descentes, portions roulantes et changements d'effort ne font pas partie de cette version. Ils nécessitent des règles de segmentation et appartiennent à un lot ultérieur. Aucune métrique physiologique, recommandation ou appréciation qualitative n'est produite par la Timeline.

## Accès

Supabase expose la relation `activity_timeline` dans sa Data API. Le client interne `MomentumTimeline.get(activityId)` renvoie les événements par date puis par position. Les politiques RLS limitent la lecture et l'écriture au propriétaire de l'activité.
