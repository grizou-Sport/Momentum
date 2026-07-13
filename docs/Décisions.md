# Journal des décisions

Les décisions structurantes sont ajoutées ici avec leur contexte, leurs conséquences et leur statut.

## 2026-07-13 — Organisation documentaire

- **Statut :** accepté.
- **Décision :** centraliser la documentation dans `docs/`, les spécifications dans `specs/` et la priorisation dans `backlog/`.
- **Conséquence :** le code applicatif reste temporairement à la racine ; `src/` est réservé à une migration future planifiée.
- **Motif :** éviter de casser les chemins relatifs et le déploiement GitHub Pages.
