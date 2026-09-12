# Organisation et livraison de MOMENTUM

## Organisation

| Emplacement | Rôle |
| --- | --- |
| `*.html`, `js/`, `css/`, `Assets/` | Application statique et chemins publics existants |
| `api/` | Fonctions serveur |
| `supabase/migrations/` | Historique SQL, immuable après application |
| `tests/` | Tests exécutés récursivement, sans condition de présence |
| `validation/` | Essais nécessitant PostgreSQL natif ; étape obligatoire distincte dans la CI |
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

La CI distingue trois résultats : **Build and tests** (sources, tests unitaires, PostgreSQL, Supabase Docker, construction), **CDC readiness** (preuves nécessaires avant publication) et **Source and tests** (contrôle de fusion déjà obligatoire, réussi uniquement si les deux précédents réussissent). Un échec ou une annulation de l’un des deux bloque la fusion. Aucun contrôle ne dépend du nom de la branche.

Une construction technique réussie produit un artefact `tested-preview` et un `version.json` avec le commit, l’environnement, l’accès aux comptes et les empreintes des fichiers effectivement servis. Elle ne certifie pas la livraison du CDC.

Sur Vercel, `VERCEL_ENV=production` impose le contrôle de préparation à la publication avant de produire les fichiers. Une valeur d’environnement inconnue ou absente dans Vercel est refusée. La même protection s’applique à un appel direct du constructeur.

Les constructions locales et les prévisualisations n’utilisent jamais implicitement la base de production. Sans `MOMENTUM_TEST_SUPABASE_URL` et `MOMENTUM_TEST_SUPABASE_KEY`, les pages de compte sont remplacées, dans l’artefact uniquement, par un message explicite ; la découverte fictive reste consultable. Avec une configuration de test, la clé doit être publique et le projet distinct de la production. Seules les constructions locales permettent une API HTTP sur localhost. Les sources et les originaux restent inchangés.

Les scénarios complets sont exécutés dans Docker avec les véritables services Supabase. Aucune base de test hébergée payante n’est nécessaire. Une prévisualisation distante sans base reliée ne constitue pas une preuve des parcours authentifiés.

## Règles de la branche principale

Configuration activée le 12 septembre 2026 dans GitHub : PR obligatoire, contrôle **Source and tests** émis par GitHub Actions obligatoire, branche à jour, conversations résolues, interdiction de supprimer `main` et de forcer son historique. Aucune exception de contournement. Ne pas imposer une seconde personne lorsqu'une seule personne maintient le dépôt.

Le fichier `quality/main-ruleset.json` décrit cette configuration. **Un fichier dans le dépôt n'active pas une règle GitHub.** Vérifier son activation dans les paramètres et consigner le résultat. L'intégration GitHub disponible peut écrire le code mais n'expose pas la modification des règles d'administration ; une session de navigateur authentifiée est nécessaire si aucun autre accès administrateur n'est disponible.

La règle [main - verified changes](https://github.com/grizou-Sport/Momentum/rules/23020308) a été créée dans l'interface authentifiée, puis relue par l'API GitHub : état `active`, cible exacte `refs/heads/main`, liste de contournement vide et contrôle rattaché à GitHub Actions (`integration_id: 15368`). L'instantané de cette vérification est conservé dans `docs/engineering/main-ruleset-2026-09-12.json`. Il décrit l'état constaté à cette date et ne remplace pas une lecture des paramètres actuels. La PR CDC nº 4 reste en brouillon, sans fusion ni déploiement.

## CDC du 8 septembre

Le CDC complet reste distinct de la construction technique. `npm run check:release` exige les 33 chapitres, l’inventaire des scénarios de la spécification et les preuves préalables. Pour le chapitre 32, la préparation est consignée dans `preDeployment` ; le scénario LIV-06 est reporté après publication. Christophe a explicitement reporté les cinq essais humains le 12 septembre 2026 : seule la ligne LIV-05 peut porter `deferred` avant publication, avec la décision et ses preuves dans le manifeste. Les autres scénarios doivent être réussis ou non applicables avec justification et preuve. Les statuts partiels et non exécutés bloquent la préparation. Pour le chapitre 27, le report humain ne dispense pas des points techniques 27.1–27.3 : leur preuve `technicalValidation` reste obligatoire, sans prétendre que les points qualitatifs 27.4–27.5 sont validés.

`npm run check:cdc` est la clôture complète : il exige aussi les essais humains LIV-05 effectivement réalisés, le chapitre 32 finalisé, LIV-06 réussi et un relevé `deployment` contenant le commit publié, l’URL et ses preuves. Le statut global peut devenir `ready-for-release` après validation préalable ; il ne devient `verified` qu’après les contrôles publiés. Ces phases évitent de demander une preuve de publication avant de permettre sa préparation.

Les empreintes de la spécification, les scénarios manquants ou dupliqués et les preuves absentes sont contrôlés. Passer un chapitre à `verified` nécessite des preuves adaptées au contenu de ce chapitre. Les validations humaines prévues au CDC ne peuvent pas être remplacées par une assertion automatique. Une prévisualisation ne doit jamais être promue directement en production : sa configuration de test et ses preuves ne constituent pas une autorisation de production.

## Retour arrière et données

Revenir sur un changement de code par un commit de revert, sans réécrire l'historique partagé. Ne pas inverser automatiquement une migration ni supprimer des données pour restaurer une version applicative. Documenter la compatibilité entre ancienne et nouvelle application avant une migration.
