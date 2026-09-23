# Préparer l’envoi TestFlight

La configuration d’export est dans `ios/ExportOptions-TestFlight.plist` et les consignes françaises dans `mobile/testflight.fr.txt`. Elles préparent le workflow du plugin `codex-testflight-release:codex-ios-api-build` ; leur présence ne signifie pas qu’un build a été envoyé.

Le 20 septembre 2026, Christophe a indiqué que son compte Developer devrait être activé sous 48 heures. Attendre la confirmation effective avant la signature et l’envoi. Aucune reprise automatique ni invitation à des testeurs n’est configurée.

## Prérequis au premier envoi

- Équipe Apple Developer Program active, reconnue par Xcode, et signature disponible.
- Identifiant `com.chrisgyger.momentum` disponible et fiche MOMENTUM créée dans App Store Connect.
- Pour le workflow API du plugin : accès à l’API et clé d’équipe compatible avec les champs `ASC_KEY_ID`, `ASC_ISSUER_ID` et `ASC_KEY_PATH`, stockés dans le fichier privé local prévu par le plugin. Le `.p8` et ce fichier restent hors du dépôt et des dossiers synchronisés. Ne pas recopier leurs valeurs dans les journaux, la documentation ou une PR.
- Identifiant d’équipe fourni par une configuration locale de signature, sans ajouter les données opérationnelles privées à ce modèle d’export.

La connexion du compte dans Xcode et la clé API sont deux prérequis distincts. L’API ne remplace pas l’adhésion Developer. [Documentation Apple : API App Store Connect](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-api).

## Paramètres MOMENTUM

| Paramètre | Valeur |
| --- | --- |
| Projet | `ios/App/App.xcodeproj` |
| Scheme | `App` |
| Configuration | `Release` |
| Destination d’archive | `generic/platform=iOS` |
| Options d’export | `ios/ExportOptions-TestFlight.plist` |
| Identifiant | `com.chrisgyger.momentum` |
| Langue des consignes | `fr-FR` |
| Consignes | `mobile/testflight.fr.txt` |

L’export est configuré pour l’envoi à App Store Connect, avec signature automatique, symboles de diagnostic et numéro de build conservé. Il laisse possible une future distribution externe, mais n’ajoute aucun testeur et ne soumet rien à Beta App Review. Au premier envoi personnel, ne pas configurer `ASC_BETA_GROUP` ni `ASC_SUBMIT_BETA_REVIEW`.

## Ordre de publication

1. Lire le dernier numéro présent dans App Store Connect et choisir un numéro non utilisé. Ne pas déduire ce numéro de la seule compilation du simulateur.
2. Enregistrer le numéro de build dans les sources, puis construire depuis le commit propre : `npm ci --ignore-scripts` et `npm run ios:beta`. Vérifier les contrôles GitHub de ce commit.
3. Archiver ce même état pour iOS avec les paramètres ci-dessus. Si Xcode doit créer ou actualiser la signature, fournir `-allowProvisioningUpdates` et l’authentification API dès l’archivage, pas uniquement à l’export. Conserver la configuration locale et les journaux sous `build/`, ignoré par Git, ou dans un répertoire privé.
4. Avant tout envoi, vérifier dans l’archive l’identifiant, la version, le numéro de build, le commit et les empreintes de `public/version.json`. `ITSAppUsesNonExemptEncryption` doit être `false` : la valeur est déjà définie dans `ios/App/App/Info.plist`.
5. Exporter l’archive vérifiée avec `xcodebuild -exportArchive`, les options préparées et l’authentification API du plugin. Exiger les confirmations réelles d’archivage et d’envoi dans les journaux ; un simulateur fonctionnel n’est pas une preuve d’envoi.
6. Vérifier que le build exact apparaît dans App Store Connect, avec l’état `PROCESSING` ou `VALID`. Ajouter alors les consignes françaises avec le helper `set_testflight_whats_new.js` du plugin et le contenu exact de `mobile/testflight.fr.txt`.
7. Confirmer dans TestFlight que le build est prêt pour le testeur prévu. La distribution à d’autres personnes et une éventuelle revue externe sont des étapes séparées.

## Particularité du helper 0.1.1

Le helper `build_testflight_api.sh` fourni par le plugin modifie `CURRENT_PROJECT_VERSION` juste avant d’archiver puis envoie immédiatement l’archive. Il échoue aussi si le numéro demandé est déjà celui du projet, même si ce numéro est valide. Enfin, ses paramètres d’authentification API et `-allowProvisioningUpdates` ne sont fournis qu’à l’export.

Ne pas le lancer directement sur une version déjà numérotée et vérifiée. Pour MOMENTUM, conserver les étapes distinctes ci-dessus, ou adapter le helper pour accepter le numéro déjà enregistré, fournir la signature à l’archivage et permettre la vérification avant l’envoi. Le plugin installé n’a pas été modifié. Son helper de consignes et sa procédure de vérification restent réutilisables.

Les paramètres du modèle d’export ont été comparés à l’aide de Xcode 26.6 (`xcodebuild -help`). La validation réelle de la signature et de l’API attend l’activation du compte et sa configuration privée.
