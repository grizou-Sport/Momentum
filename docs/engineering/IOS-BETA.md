# Bêta iPhone MOMENTUM

La première version iPhone conserve l’application HTML/CSS/JavaScript existante et l’embarque avec Capacitor 8. Elle utilise les mêmes comptes et données que le site lorsque la construction de production est explicitement demandée. Le site reste hébergé sur Vercel et les données sur Supabase ; cette étape ne nécessite aucun achat Infomaniak.

## Construire

Prérequis : Node 22–24, npm, Xcode avec un runtime iOS installé.

```sh
npm ci --ignore-scripts
npm run ios:prepare
```

Cette commande exécute les contrôles et tous les tests du site, prépare `dist-native/`, puis synchronise les ressources dans le projet Xcode. Par défaut, les comptes de production sont désactivés dans l’artefact. Pour une bêta destinée à utiliser les vrais comptes :

```sh
npm run ios:beta
npm run ios:open
```

La construction de production conserve le contrôle `check:release` du site. Construire depuis un commit enregistré, puis vérifier le commit et les empreintes de `ios/App/App/public/version.json`. Les bibliothèques Supabase, Leaflet et Chart.js sont embarquées aux versions verrouillées dans `package-lock.json`.

Compilation sans signature pour simulateur :

```sh
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath build/DerivedData CODE_SIGNING_ALLOWED=NO build
```

## Authentification et liens

Décision de Christophe du 20 septembre 2026 : conserver les redirections Supabase existantes. Aucune URL d’authentification native n’est enregistrée et l’app ne traite aucun jeton reçu par un lien.

- La connexion dans l’app se fait par e-mail et mot de passe.
- La confirmation d’adresse ouvre `https://momentum-alpha-rho.vercel.app/welcome.html` dans le navigateur. Revenir ensuite dans l’app et se connecter.
- La récupération ouvre `https://momentum-alpha-rho.vercel.app/login.html?recovery=1` dans le navigateur. Après changement du mot de passe, revenir se connecter dans l’app.
- Les invitations et reçus partagés restent des liens HTTPS vers le site.

La session est conservée par le client Supabase dans le stockage du WebView, avec renouvellement lors du retour au premier plan. Les fichiers de l’interface sont embarqués ; les comptes, cartes, photos distantes et enregistrements nécessitent du réseau. Il n’y a pas de file de modifications hors connexion.

## Backend requis avant une bêta complète

Les fonctions `file-ingest` et `account-deletion` vérifient strictement l’origine des requêtes. Le code de cette branche ajoute l’origine exacte `capacitor://localhost` ; il conserve les sessions, la réauthentification et toutes les autorisations existantes. Cela concerne les requêtes de l’app, pas les redirections d’e-mail.

Cette modification n’est pas appliquée à la production par la génération iOS. Son déploiement doit être traité séparément, après validation de ce changement de sécurité. Tant qu’il n’a pas été appliqué, les envois de fichiers et la suppression de compte depuis l’app sont bloqués par le serveur. Les parcours web existants restent disponibles.

État au 20 septembre 2026 : adaptation explicitement autorisée par Christophe et déployée en version 4 des deux fonctions. Précontrôles de l’app et du site vérifiés en 204, origines étrangères refusées en 403 et requêtes sans session refusées en 401. Les redirections d’e-mail restent inchangées. Aucun fichier ni compte réel n’a été modifié par ces contrôles.

## Signature et TestFlight

Projet : `ios/App/App.xcodeproj`, scheme `App`, identifiant `com.chrisgyger.momentum`, version initiale `0.1.0` / build `1`, iPhone avec iOS 15 ou ultérieur.

1. Connecter le compte de l’adhésion Apple Developer dans **Xcode → Settings → Apple Accounts**.
2. Choisir l’équipe correspondante dans **App → Signing & Capabilities**, avec signature automatique.
3. Créer ou sélectionner la fiche MOMENTUM avec cet identifiant dans App Store Connect. Vérifier la disponibilité de l’identifiant avant de l’enregistrer.
4. Après validation des parcours sur appareil, archiver pour **Any iOS Device**, puis distribuer dans **App Store Connect → TestFlight**. Incrémenter le numéro de build pour chaque nouvel envoi.
5. Vérifier le traitement du build dans App Store Connect avant de le proposer au testeur. Ne pas confondre compilation locale et disponibilité TestFlight.

Une clé API App Store Connect peut aussi automatiser l’envoi, si elle existe déjà et est stockée hors du dépôt. Ne jamais versionner de clé, certificat privé, archive, IPA ou journal de distribution.

La configuration d’export, les consignes en français et la procédure de reprise avec le plugin sont décrites dans [TESTFLIGHT.md](TESTFLIGHT.md). Christophe a annoncé une activation de son compte sous 48 heures ; aucun build n’est encore envoyé.

## Recette iPhone

Vérifier la connexion et son maintien après fermeture, la navigation YOU/FLOW, les marges autour de l’encoche et de l’indicateur d’accueil, la saisie avec clavier, la création d’un Moment, les lieux, l’envoi d’une photo et le retour depuis l’arrière-plan. Vérifier les messages sans réseau et les deux e-mails d’authentification dans le navigateur. Utiliser une base isolée pour les essais destructifs ; ne pas supprimer un vrai compte pour valider la bêta.

Les vérifications de la branche couvrent les redirections HTTPS, les retours internes, les erreurs et annulations de recherche de lieux, ainsi que le maintien des protections d’origine et de session des fonctions serveur. Une compilation et ces tests ne remplacent pas la recette authentifiée sur iPhone.
