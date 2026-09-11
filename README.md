# MOMENTUM

MOMENTUM est un journal de mission sportive qui transforme les données d’activité en récit personnel : progression, bien-être, aventures et expériences partagées.

## État du projet

Le produit est en développement actif. L’application web statique reste actuellement à la racine du dépôt afin de préserver son fonctionnement sur GitHub Pages et ses chemins relatifs.

## Repères

- [`docs/`](docs/) : vision, décisions, architecture et documentation du projet.
- [`specs/`](specs/) : spécifications fonctionnelles par écran ou parcours.
- [`backlog/`](backlog/) : idées, sprint en cours et sujets différés.
- [`src/`](src/) : emplacement réservé au futur regroupement du code source.
- [`supabase/migrations/`](supabase/migrations/) : migrations de la base de données.
- [`docs/Notes version 0.07.md`](<docs/Notes version 0.07.md>) : notes historiques auparavant conservées dans `README.md/README.txt`.

## Lancer le projet

Servir le dépôt avec un serveur web local, puis ouvrir `index.html`. Une connexion internet est nécessaire pour les services externes tels que la météo, la cartographie et Supabase.

## Contribution

Lire [`AGENTS.md`](AGENTS.md) avant toute modification automatisée ou assistée par IA.

## Vérifier et livrer

Avec Node.js 22 : `npm ci --ignore-scripts`, puis `npm run build`.
Cette commande vérifie les sources, exécute tous les tests et produit `dist/` avec l'identité du commit et les empreintes des fichiers.

- [Organisation et procédure de livraison](docs/engineering/DELIVERY.md)
- [Incident et récupération du CDC du 8 septembre](docs/incidents/2026-09-08-cdc-transfer.md)
- [Couverture du CDC](specs/cdc/2026-09-08.delivery.json)

Le contrôle du CDC complet s'exécute avec `npm run check:cdc`. Il échoue tant que les sources et preuves nécessaires restent manquantes ; un contrôle général vert ne signifie pas que ce CDC est livré.
