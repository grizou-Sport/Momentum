# Organisation et livraison de MOMENTUM

## Organisation

| Emplacement | Rôle |
| --- | --- |
| `*.html`, `js/`, `css/`, `Assets/` | Application statique et chemins publics existants |
| `api/` | Fonctions serveur |
| `supabase/migrations/` | Historique SQL, immuable après application |
| `tests/` | Tests exécutés récursivement, sans condition de présence |
| `scripts/`, `quality/` | Vérifications et contrats de fichiers obligatoires |
| `specs/cdc/` | État de couverture du CDC et preuves de recette |
| `docs/incidents/` | Causes, récupération et limites constatées |
| `.github/` | Contrôles automatiques et modèle de PR |
| `dist/` | Sortie de construction reproductible, non versionnée |

Le rangement des sources de l'application reste compatible avec ses liens existants. `src/` est une ancienne réserve ; ne pas y créer une seconde copie concurrente de l'application.

## Parcours normal

1. Récupérer `main`, créer une branche courte et modifier les fichiers source.
2. Enregistrer les changements avec Git. Si le client Git n'est pas authentifié, l'API GitHub peut créer un arbre et un commit avec le contenu exact des fichiers ; ne pas encoder une archive dans les échanges.
3. Sur un checkout propre du commit, lancer `npm ci --ignore-scripts` puis `npm run build`.
4. Ouvrir une PR. Examiner les résultats **Source and tests** du dernier commit, la prévisualisation et les parcours concernés.
5. Fusionner lorsque la version est complète pour son périmètre. Appliquer les migrations validées selon leur ordre de dépendance, puis vérifier le déploiement et son commit.

`npm run build` vérifie les fichiers obligatoires, toutes les références locales HTML/CSS, la syntaxe des scripts externes et intégrés, les empreintes des migrations historiques, puis lance tous les tests. Il produit les seuls fichiers statiques utiles dans `dist/`, avec un `version.json` qui associe le commit et les empreintes des fichiers. Les fonctions de `api/` restent gérées séparément par l'hébergeur.

Le workflow publie une preuve de construction uniquement après succès. Il n'écrit jamais dans les branches. `vercel.json` impose la même installation, la même vérification et la publication de `dist/` sur Vercel. Les fonctions de `api/` restent à la racine conformément au fonctionnement du runtime Vercel. La configuration GitHub Pages n'est pas modifiée par ce fichier.

## Règles de la branche principale

Configuration activée le 12 septembre 2026 dans GitHub : PR obligatoire, contrôle **Source and tests** émis par GitHub Actions obligatoire, branche à jour, conversations résolues, interdiction de supprimer `main` et de forcer son historique. Aucune exception de contournement. Ne pas imposer une seconde personne lorsqu'une seule personne maintient le dépôt.

Le fichier `quality/main-ruleset.json` décrit cette configuration. **Un fichier dans le dépôt n'active pas une règle GitHub.** Vérifier son activation dans les paramètres et consigner le résultat. L'intégration GitHub disponible peut écrire le code mais n'expose pas la modification des règles d'administration ; une session de navigateur authentifiée est nécessaire si aucun autre accès administrateur n'est disponible.

La règle [main - verified changes](https://github.com/grizou-Sport/Momentum/rules/23020308) a été créée dans l'interface authentifiée, puis relue par l'API GitHub : état `active`, cible exacte `refs/heads/main`, liste de contournement vide et contrôle rattaché à GitHub Actions (`integration_id: 15368`). L'instantané de cette vérification est conservé dans `docs/engineering/main-ruleset-2026-09-12.json`. Il décrit l'état constaté à cette date et ne remplace pas une lecture des paramètres actuels. La PR CDC nº 4 reste en brouillon, sans fusion ni déploiement.

## CDC du 8 septembre

Le CDC complet reste distinct de la réparation de sa chaîne de livraison. Le contrôle `npm run check:cdc` échoue tant que ses sources, ses tests et ses preuves ne sont pas réunis. Les branches dont le nom contient `cdc-consolidation` ou `cdc-recovery` le lancent automatiquement. Les contrôles métier et d'intégrité de base s'exécutent sur **toutes** les branches et PR.

Le contrôle général détecte aussi la présence des nouveaux fichiers du CDC ou un changement de son état de livraison : il impose alors `check:cdc`, même si la branche a un autre nom. Un dossier de tests vide ne suffit pas à passer ce contrôle.

Ne pas renommer une branche pour contourner une recette. Une PR qui annonce le CDC comme livré doit présenter le résultat de `check:cdc`, quel que soit son nom. Passer un chapitre à `verified` nécessite des preuves versionnées et adaptées : tests fonctionnels, recette navigateur ou compte rendu de validation. Les validations humaines prévues au CDC ne peuvent pas être remplacées par une assertion automatique.

## Retour arrière et données

Revenir sur un changement de code par un commit de revert, sans réécrire l'historique partagé. Ne pas inverser automatiquement une migration ni supprimer des données pour restaurer une version applicative. Documenter la compatibilité entre ancienne et nouvelle application avant une migration.
