# Architecture

## État actuel

- Application web statique composée de pages HTML, de feuilles CSS et de modules JavaScript.
- Code applicatif actuellement placé à la racine, dans `css/` et dans `js/`.
- Ressources visuelles dans `Assets/`.
- Persistance et authentification via Supabase.
- Évolutions de schéma dans `supabase/migrations/`.

## Contraintes

- Les chemins relatifs sont utilisés par l’application et GitHub Pages.
- Un déplacement vers `src/` nécessite une migration coordonnée des pages, imports, ressources et réglages de déploiement.

## Document historique

La version détaillée antérieure est conservée dans [`Architecture Momentum v1.0.docx`](<Architecture Momentum v1.0.docx>).
