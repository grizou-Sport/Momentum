# Contribuer à MOMENTUM

Lire `CONSTITUTION.md`, puis `docs/engineering/DELIVERY.md`.

## Source de vérité

- Le dépôt Git contient les vrais fichiers source. Ne jamais transférer le code applicatif dans une archive, du base64, des fragments ou un workflow qui reconstruit puis pousse du code.
- Travailler sur une branche depuis le dernier état de `main` et préserver les changements existants.
- Une copie locale sans `.git` n'est pas un dépôt. Les conversations et leurs résumés ne constituent pas une sauvegarde du code.
- Conserver les photographies, les chemins publics et les acquis fonctionnels. Le passage à un nouveau framework n'est pas autorisé par un simple travail de fiabilisation.

## Vérification

- Exécuter `npm ci --ignore-scripts` et `npm run build` avant de proposer la fusion.
- Les tests ne doivent jamais être optionnels. Ajouter les nouveaux tests au contrat `quality/source-contract.json` lorsqu'ils constituent une obligation de livraison.
- Une migration historique est immuable. Ajouter une nouvelle migration et la tester sur une base isolée.
- Tester les erreurs et les données manquantes ; ne pas remplacer les contrôles par des assertions qui répètent le code.
- Pour le CDC du 8 septembre, tenir à jour `specs/cdc/2026-09-08.delivery.json` et exécuter `npm run check:release` avant fusion, puis `npm run check:cdc` pour la clôture après publication.

## Livraison

- Une PR en brouillon peut sauvegarder du travail incomplet ; elle ne doit pas être présentée comme une livraison.
- Vérifier les contrôles du dernier commit avant fusion. Publier depuis le même état testé et vérifier le commit servi.
- Distinguer explicitement : source récupérée, code implémenté, tests réussis, migration appliquée, production vérifiée.
- Les autorisations et préférences explicites de la session prévalent ; ne pas redemander une autorisation déjà donnée.
