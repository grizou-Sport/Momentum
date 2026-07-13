# Règles de contribution pour les IA

Ces règles s’appliquent à tout le dépôt MOMENTUM.

## Priorités

1. Préserver les données, le comportement existant et la compatibilité GitHub Pages.
2. Effectuer des changements petits, explicites et faciles à annuler.
3. Vérifier les impacts avant de déplacer, renommer ou supprimer un fichier.

## Structure

- Ne pas déplacer les fichiers HTML, CSS ou JavaScript de la racine vers `src/` sans plan de migration validé et vérification de tous les chemins relatifs.
- Utiliser `docs/` pour la documentation transversale, `specs/` pour les comportements attendus et `backlog/` pour le travail non livré.
- Conserver les noms de fichiers existants et leur casse, sauf demande explicite.
- Mettre à jour les liens, imports et références dans le même changement qu’un renommage.

## Sécurité et données

- Ne jamais ajouter de secret, clé privée, jeton ou mot de passe au dépôt.
- Ne jamais réécrire une migration Supabase déjà appliquée ; créer une nouvelle migration.
- Ne pas supprimer ou transformer des données sans stratégie de retour arrière.
- Respecter les politiques d’accès et la confidentialité des données utilisateur.

## Qualité

- Examiner l’état Git avant et après chaque changement et préserver les modifications de l’utilisateur.
- Exécuter les vérifications pertinentes et tester les parcours touchés.
- Documenter toute décision structurante dans `docs/Décisions.md` et toute évolution visible dans `docs/Changelog.md`.
- Signaler clairement ce qui n’a pas pu être vérifié.
