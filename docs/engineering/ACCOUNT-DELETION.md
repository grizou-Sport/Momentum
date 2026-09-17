# Suppression du compte

Le compte prépare un récapitulatif. L’utilisateur confirme l’action en écrivant SUPPRIMER et en donnant son mot de passe actuel. La fonction serveur vérifie l’identité auprès d’Auth puis vérifie ce mot de passe ; elle ignore tout identifiant d’utilisateur fourni par le client. Une session assortie d’un facteur MFA vérifié doit suivre une réauthentification adaptée et reste refusée par ce parcours de mot de passe. Aucune suppression n’est engagée si le nettoyage planifié n’a pas récemment fonctionné.

Une demande possède un identifiant stable et un reçu privé aléatoire de 32 octets. Seule son empreinte est stockée. Le reçu permet de suivre le traitement après la suppression de l’identité ; il reste uniquement en mémoire dans le navigateur, sauf téléchargement choisi par l’utilisateur. Son URL utilise un fragment, retiré immédiatement à l’ouverture de la page dédiée. Cette page ne charge ni analyse de trafic, ni contenu tiers, ni compte utilisateur. Le reçu est supprimé du serveur après sept jours suivant la fin du traitement. Les mots de passe et les réponses d’Auth ne sont ni journalisés, ni renvoyés au navigateur.

## Ordre des opérations

1. Enregistrer une demande durable et révoquer les liens invités de ce compte. Les déclencheurs métier et les règles Storage empêchent les nouvelles écritures d’un compte en suppression, y compris avec un JWT encore valable.
2. Le traitement serveur interdit les nouvelles connexions, retire les données privées et inscrit les fichiers dans le nettoyage. Ces opérations SQL sont transactionnelles et rejouables.
3. Nettoyer les objets par l’API Storage, y compris les téléversements abandonnés et les anciens fichiers personnels sans métadonnée de propriétaire mais placés sous le dossier du compte. Un bucket non répertorié ou un fichier encore référencé empêche de conclure la suppression.
4. Vérifier l’absence de fichiers et de demandes en attente avant d’appeler l’API d’administration Auth. Le résultat final est confirmé par l’absence effective de l’identité dans la base. Une réponse perdue ou une panne laisse un reçu à reprendre.

## Données collectives

Les titres et dates déjà partagés des Moments sont conservés. Le compte est dissocié des enregistrements, ses récits et localisations copiées sont retirés ; un Moment terminé le reste, les autres sont annulés. Les Clubs sont archivés, sans nomination automatique d’un propriétaire. Les membres conservent leurs enregistrements et leurs droits existants. Les autres participants gardent leurs activités, médias et ressentis privés. Les fichiers du compte supprimé sont retirés même lorsqu’ils servaient de logo à un Club.

Une ancienne composition nutritionnelle déjà utilisée dans l’historique d’un autre compte est conservée sous forme d’instantané. Son ancien produit privé est retiré du catalogue actif et dissocié de son créateur ; il ne devient pas un produit public. Les autres données personnelles sont supprimées, et les contraintes de suppression réelle de la base sont couvertes par la recette.

## Activation et limites

Déployer `account-deletion` et `storage-cleanup` après les migrations validées sur une base Supabase isolée. Définir les origines autorisées du frontend via `MOMENTUM_ALLOWED_ORIGINS`, sans joker. Configurer le nettoyage selon [STORAGE-CLEANUP.md](STORAGE-CLEANUP.md), puis effectuer une recette réelle avec des comptes et fichiers fictifs avant production.

La recette PostgreSQL unitaire applique les 72 clés étrangères capturées et vérifie les reprises et la conservation d’un second participant. La [recette Docker du 12 septembre](../../specs/cdc/2026-09-12.supabase-docker.md) complète ces simulations avec de vrais services Auth/Storage : mot de passe vérifié, ancien JWT bloqué, fichiers supprimés, identité retirée, reçu final exact et photo d’un autre participant préservée. Les tests sont reproductibles via `npm run test:supabase` et exécutés dans GitHub. Le parcours complet de suppression dans le navigateur et la parité avec la configuration hébergée restent à vérifier.

Les durées et mécanismes réels de conservation des sauvegardes restent à vérifier et à faire valider avant communication publique. La confirmation de cette implémentation porte sur les services actifs, pas sur l’effacement immédiat de toutes les sauvegardes du fournisseur.

Références : [gestion et suppression des utilisateurs](https://supabase.com/docs/guides/auth/managing-user-data), [suppression des objets Storage](https://supabase.com/docs/guides/storage/management/delete-objects), [API d’administration Auth](https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/GoTrueAdminApi.ts).
