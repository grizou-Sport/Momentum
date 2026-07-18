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

## Conventions produit structurantes

### Expérience d’un Moment et FLOW

- FLOW est un modèle d’analyse, jamais un formulaire autonome.
- Un Moment réalisé et son expérience (effort physique, défi, maîtrise et souvenir facultatif) sont saisis depuis le formulaire du Moment et validés par une action unique.
- `activities.rpe` est l’unique source de vérité de l’effort physique et de tous les calculs de charge. La table `activity_flow_assessments` ne conserve que les dimensions propres à FLOW (défi et maîtrise), le souvenir facultatif et le contexte d’analyse.
- Aucune synchronisation bidirectionnelle ou copie secondaire du RPE n’est autorisée.

### Durées

- Toute durée saisie utilise le composant partagé `<duration-picker>` défini dans `js/momentum-duration-picker.js`.
- La valeur applicative et persistée est un total de minutes. Le composant est seul responsable de l’affichage `HH:MM` et de la conversion des saisies `1:20` ou `80`.
- Un formulaire ne doit jamais recréer des champs séparés « heures » et « minutes ».

## Document historique

La version détaillée antérieure est conservée dans [`Architecture Momentum v1.0.docx`](<Architecture Momentum v1.0.docx>).
