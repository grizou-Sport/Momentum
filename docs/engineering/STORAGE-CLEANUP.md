# Suppressions de fichiers

La suppression d’une activité et le retrait de ses références produisent des demandes privées de nettoyage dans la même transaction. Les fichiers encore référencés sont conservés. La fonction serveur traite un lot avec un bail ; une panne, un délai dépassé ou une réponse perdue laisse une reprise possible. Seule l’API Storage supprime les objets physiques. Les chemins retirés ne peuvent plus recevoir d’association, d’écrasement ou de nouveau lien signé. Les liens signés déjà délivrés peuvent rester valables jusqu’au retrait physique ou leur expiration.

Un fichier téléversé puis abandonné sans référence est collecté après 24 heures. Cette durée laisse terminer un formulaire resté ouvert ; un fichier déjà collecté doit être téléversé de nouveau. Les exports temporaires expirés sont également purgés par le traitement.

## Activation après validation isolée

1. Tester les migrations, les droits Storage et les opérations réelles avec deux comptes fictifs dans un projet Supabase isolé. Vérifier la sauvegarde et la restauration avant toute migration en production.
2. Appliquer les migrations dans l’ordre. La migration `cdc_cleanup_schedule` installe `pg_cron` et `pg_net`, mais ne crée pas de tâche sans configuration explicite.
3. Générer un secret aléatoire de 32 octets, représenté par 64 caractères hexadécimaux. Le placer dans les secrets Edge Functions sous `MOMENTUM_CLEANUP_SECRET`, puis déployer `storage-cleanup` avec la configuration du dépôt. Ne pas imprimer ni versionner ce secret. Les variables Supabase serveur sont fournies par la plateforme.
4. Depuis l’environnement de déploiement, appeler `configure_storage_cleanup` avec l’URL du projet et le même secret. Cette fonction est réservée au rôle serveur. Elle stocke la valeur dans Vault et crée ou met à jour une seule tâche exécutée chaque minute. Le texte de la tâche ne contient pas le secret. Une rotation remplace les deux valeurs avant vérification.
5. Tester une suppression réelle d’un fichier fictif, puis une panne Storage et sa reprise. Vérifier le reçu `complete`, l’absence de l’objet et `private.cleanup_runtime.last_success_at`. Contrôler aussi les tâches en retard et les demandes `still_referenced`.

Ces opérations ne sont pas activées par un déploiement statique Vercel. La fonction ne reçoit aucune autorisation CORS pour les navigateurs et vérifie sa propre clé de traitement avant tout appel serveur.

## Preuves et limites actuelles

Les tests PostgreSQL locaux couvrent les transactions, refus d’accès, baux, reprises, références encore utilisées et orphelins. Les tests du gestionnaire HTTP simulent une panne de stockage et une réponse perdue. Les adaptateurs locaux du planificateur vérifient les droits, l’unicité et la rotation ; ils ne prouvent ni le chiffrement de Vault, ni l’exécution de `pg_cron`, ni la suppression de vrais objets. La recette Supabase isolée reste obligatoire avant activation.

Références de mise en œuvre : [planification des fonctions](https://supabase.com/docs/guides/functions/schedule-functions), [Vault](https://supabase.com/docs/guides/database/vault), [configuration des fonctions](https://supabase.com/docs/guides/functions/function-configuration).
