# Base de données

## Technologie

MOMENTUM utilise Supabase. Les modifications de schéma sont versionnées dans `supabase/migrations/`.

## Règles

- Ajouter une nouvelle migration pour chaque évolution.
- Ne pas modifier une migration déjà appliquée.
- Prévoir la compatibilité avec les données existantes et une stratégie de retour arrière.
- Vérifier les politiques de sécurité au niveau des lignes avant livraison.
- Ne jamais documenter de secrets ou de données personnelles réelles.
