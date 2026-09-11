# Incident de transfert du CDC du 8 septembre 2026

## Constat vérifié

Référence applicative : `dd8b37eb72c4ddc1a255c8f4e3a3f42f9f9fcfa0` sur `main`.
Branche interrompue : `feat/cdc-consolidation-2026-09-08`, dernier commit observé `3526bdc79196e5e7466fef50689b2951e21fc11a`.

La comparaison contient six commits, quatre workflows, une archive et sept fragments base64. Aucune modification applicative n'a été installée à son chemin normal. Les 103 tests de `main` passent sur une copie récupérée directement par Git.

L'archive `momentum-finalize.tar.xz` fait 15 055 octets et échoue à la décompression. Les fragments présents dans la branche donnent un flux XZ tronqué de 36 750 octets contenant un JSON de modifications. Les sept objets Git récupérés séparément donnent un autre flux de 42 000 octets, lui aussi corrompu. Une archive partiellement lisible n'est pas une source intègre.

## Récupération

Le JSON tronqué contient 22 entrées complètes. Pour chacune, l'empreinte SHA-256 du fichier original a été comparée au commit de référence, les modifications ont été appliquées en mémoire, puis l'empreinte du résultat a été comparée à l'empreinte annoncée. **Les 22 vérifications réussissent.** L'inventaire est enregistré dans `docs/incidents/cdc-recovered-files.json`.

Ces empreintes prouvent la fidélité de la récupération aux modifications sauvegardées ; elles ne prouvent ni leur conformité fonctionnelle, ni leur sécurité, ni la présence de toutes leurs dépendances.

Le préfixe d'une archive permet aussi de lire certaines pages et deux modules supplémentaires. En l'absence d'empreinte indépendante et avec un flux corrompu, ces résultats restent des indices à relire, pas des fichiers certifiés.

Les migrations du CDC, les tests de consolidation, plusieurs modules partagés et les évolutions de YOU/TOGETHER ne sont pas présents dans les fichiers récupérés avec une empreinte vérifiée. Les anciens comptes rendus de tests ne peuvent donc pas être reproduits sur un commit contenant ces évolutions.

## Cause et correction de la méthode

Le code avait été emballé dans des archives et fragments avant d'être enregistré comme sources Git. Le workflow de finalisation tentait ensuite de décompresser, de tester, de créer un commit et de le pousser. Ce processus a échoué avant les tests. Le workflow général pouvait pourtant réussir en sautant les tests absents.

Les paquets et les workflows de reconstruction sont retirés de la branche de réparation ; l'historique Git conserve les originaux pour investigation. La méthode de remplacement enregistre directement les fichiers dans un arbre Git et un commit atomique. La vérification s'exécute depuis ce commit, sans générer ni pousser du code applicatif pendant les tests.

## Ce que cette réparation ne certifie pas

- La réalisation complète du CDC et la recette navigateur restent à effectuer après reconstruction des fichiers manquants.
- Aucune des migrations annoncées par l'ancien compte rendu n'est considérée comme appliquée ou validée sur la seule base de ce compte rendu.
- Le manifeste du CDC reste `recovery-incomplete` ; `npm run check:cdc` doit échouer dans cet état.
- La configuration de protection de `main` doit être activée dans les paramètres GitHub. Le fichier proposé ne vaut pas activation.

## Prévention

Sources directes, contrats de présence, tests obligatoires, contrôle des références locales et des migrations historiques, PR traçables et artefact associé au commit testé. Voir `docs/engineering/DELIVERY.md`.
