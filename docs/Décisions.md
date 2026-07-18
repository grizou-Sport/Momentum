# Journal des décisions

Les décisions structurantes sont ajoutées ici avec leur contexte, leurs conséquences et leur statut.

## 2026-07-18 — Navigation contextuelle et socle de consolidation bêta

- **Statut :** accepté.
- **Décision :** utiliser le triangle comme symbole unique, laisser chaque section déclarer un thème clair ou sombre et limiter l’analyse de luminance aux photographies variables, au chargement et aux redimensionnements significatifs.
- **Conséquence :** le rail conserve un voile flouté garantissant sa lisibilité ; les messages d’erreur, dialogues et alternatives de graphiques reposent sur des conventions partagées, sans nouvelle fonctionnalité produit.
- **Motif :** garantir une interface stable, accessible et compréhensible avant la bêta sans introduire une analyse continue des pixels ni une refonte structurelle.

## 2026-07-13 — Organisation documentaire

- **Statut :** accepté.
- **Décision :** centraliser la documentation dans `docs/`, les spécifications dans `specs/` et la priorisation dans `backlog/`.
- **Conséquence :** le code applicatif reste temporairement à la racine ; `src/` est réservé à une migration future planifiée.
- **Motif :** éviter de casser les chemins relatifs et le déploiement GitHub Pages.

## 2026-07-13 — Périodes et qualité de sommeil sur HOME

- **Statut :** accepté.
- **Décision :** centraliser la période des graphiques dans un modèle de préréglages extensible et enregistrer les saisies manuelles de qualité du sommeil sur cinq niveaux, avec l’unité `qualitative-v1` dans les colonnes existantes.
- **Conséquence :** aucun schéma ni contrat API n’est modifié ; les sources numériques existantes sont converties en libellés qualitatifs uniquement pour l’affichage.
- **Motif :** garantir une expérience cohérente aujourd’hui tout en laissant une extension future vers le mode Horizon et les montres connectées.

## 2026-07-13 — Séparation des univers TOGETHER

- **Statut :** accepté.
- **Décision :** réserver MOMENTS aux aventures organisées par période et CERCLE aux proches, invitations et Clubs, avec une action principale propre à chaque vue.
- **Conséquence :** la séparation reste entièrement côté interface ; les modèles de données, les API et les traitements Supabase ne changent pas.
- **Motif :** rendre la navigation mobile plus claire et préserver une expérience calme, organisée et intentionnelle.

## 2026-07-13 — Identité sportive dérivée dans YOU

- **Statut :** accepté.
- **Décision :** construire « Je vis pour » à l’affichage en fusionnant les sports déclarés pendant l’inscription avec les activités réalisées sur les douze derniers mois.
- **Conséquence :** les pratiques sont qualifiées comme déclarées, occasionnelles, saisonnières ou régulières par un module autonome ; aucune table ni donnée sportive existante n’est modifiée.
- **Motif :** laisser l’identité sportive évoluer avec la vie réelle de l’utilisateur tout en conservant le questionnaire comme point de départ.

## 2026-07-15 — Navigation UX v1 par rail contextuel

- **Statut :** accepté après validation des maquettes.
- **Décision :** remplacer la TopBar de HOME, YOU et TOGETHER par un rail fixe compact sur Desktop, accompagné d’un panneau présentant les sous-sections du module actif. Sur Mobile, cette navigation devient un menu latéral ouvert par un bouton hamburger.
- **Conséquence :** HOME, YOU et TOGETHER utilisent le même composant de navigation. Les sous-sections existantes conservent leurs écrans et leurs données ; le Fil d’actualité et Paramètres restent identifiés comme extensions futures sans faux parcours actif.
- **Motif :** préserver l’espace éditorial de MOMENTUM tout en rendant les destinations immédiatement compréhensibles et évolutives.

## 2026-07-15 — Maîtrise du cycle de vie des Moments

- **Statut :** accepté.
- **Décision :** permettre à l’organisateur de modifier, dupliquer et supprimer un Moment, de sélectionner des participants de son Cercle et de consulter leurs réponses. Chaque participant peut accepter ou refuser son invitation depuis le détail du Moment.
- **Conséquence :** l’interface s’appuie sur `moments` et `moment_participants` ainsi que sur leurs politiques RLS existantes ; aucune migration supplémentaire n’est nécessaire pour cette étape.
- **Motif :** garantir que la création, l’invitation, l’affichage partagé et la réponse forment un seul parcours cohérent.
