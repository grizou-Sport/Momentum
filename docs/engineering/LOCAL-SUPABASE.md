# Recette Supabase locale

Docker Desktop permet d’exécuter Auth, PostgREST, Storage, les Edge Functions, Vault, `pg_cron` et `pg_net` sans créer de projet Supabase hébergé. La recette utilise exclusivement des comptes et des fichiers fictifs. Les courriels de confirmation sont capturés dans Mailpit ; ils ne sont pas envoyés à des destinataires externes.

Prérequis : Docker démarré, Node conforme à `.nvmrc`, Python 3, Supabase CLI **2.117.0**, dépendances installées avec `npm ci --ignore-scripts`.

```sh
npm run test:supabase
```

La commande crée `.supabase-local/`, démarre les services, applique le schéma de référence puis les migrations, et exécute les tests HTTP réels. Ce dossier est ignoré par Git et ses fichiers de configuration sont privés. `SUPABASE_BIN`, `DOCKER_BIN`, `PYTHON_BIN` et `MOMENTUM_LOCAL_WORKDIR` permettent de préciser les outils et le dossier. Aucun identifiant Supabase de production n’est nécessaire.

Les ports 54321–54324 sont réservés à cette recette et limités à `127.0.0.1`. Le script vérifie cette restriction et corrige les conteneurs si Docker ignore l’option du réseau. Le projet Docker porte le nom fixe `momentum-cdc-validation` : ne pas l’utiliser pour des données à conserver. La commande refuse un dossier portant un autre identifiant.

En intégration continue :

```sh
npm run test:supabase -- --ci
```

Cette variante détruit les volumes fictifs en fin d’exécution. Elle est intégrée au contrôle GitHub obligatoire « Source and tests », avant la construction du site. Les échecs d’Auth, de Storage, des migrations ou des fonctions empêchent donc ce contrôle de réussir. Les sauvegardes, sessions et clés locales ne sont jamais publiées comme artefacts CI.

Pour afficher l’application après une exécution locale sans `--ci` :

```sh
MOMENTUM_LOCAL_STATUS=.supabase-local/status.json node validation/supabase-local-server.mjs
```

Ouvrir `http://127.0.0.1:3000/login.html`. Le serveur charge les sources de l’application avec l’adresse et la clé anonyme locales ; il ne simule aucune API. Créer un compte fictif et consulter sa confirmation sur `http://127.0.0.1:54324`. Pour arrêter les services en conservant les volumes : `supabase stop --workdir .supabase-local`.

## Portée des preuves

Le schéma applicatif initial reste **représentatif** : colonnes de référence déjà versionnées, contraintes capturées et migrations historiques. Auth, Storage et leurs règles internes sont fournis par Supabase réel, sans les adaptateurs des tests PGlite. Les anciennes règles des buckets `activities` et `avatars` et la lecture du catalogue `collections` sont explicitement définies pour la recette ; leur parité avec la production n’est pas certifiée. Le helper d’activation automatique de RLS propre à l’hébergement est absent localement. Les quinze migrations CDC sont exécutées sans modification.

Les Edge Functions n’acceptent HTTP qu’avec `MOMENTUM_LOCAL_DEVELOPMENT=true`, défini côté serveur, et pour une liste fermée d’adresses locales. Ne pas activer ce réglage dans les fonctions hébergées. CORS, JWT utilisateur, réauthentification et secret de nettoyage restent contrôlés.

Le configurateur du planificateur conserve son contrôle des URL Supabase hébergées. Dans cette base jetable uniquement, la valeur Vault est ensuite remplacée, dans la même transaction, par `http://kong:8000`. Les vrais `pg_cron` et `pg_net` déclenchent le véritable worker. Cette adaptation de transport ne prouve pas la configuration d’un projet hébergé.

Cette recette ne vaut ni livraison complète du CDC, ni validation de tous les contenus de fichiers, ni restauration d’un projet hébergé, ni essais humains. Les contrôles de livraison restent actifs.

## Restauration complète et repli

Le scénario `validation/supabase-local-restore.mjs` sauvegarde hors ligne les deux volumes, la configuration et la clé racine Vault locale, puis restaure dans de nouveaux volumes. Il exige le projet fictif nommé `momentum-cdc-validation`, une origine de boucle locale et des comptes `example.invalid`. Les originaux restent conservés. Voir les preuves et limites dans [la recette navigateur et restauration](../../specs/cdc/2026-09-12.browser-recovery.md). Les archives, clés et identifiants doivent rester hors du dépôt. Les essais avec de vraies personnes suivent [le protocole de recette humaine](HUMAN-ACCEPTANCE.md).
