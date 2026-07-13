# Journal des décisions

Les décisions structurantes sont ajoutées ici avec leur contexte, leurs conséquences et leur statut.

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
