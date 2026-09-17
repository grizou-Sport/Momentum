# Compatibilité des pages déjà ouvertes

La migration `20260912141552_cdc_client_write_contract.sql` exige le contrat `cdc-2026-09-08` pour les écritures d’un utilisateur connecté sur les tables applicatives déjà protégées contre les écritures pendant une suppression de compte. Le contrôle se fait avant chaque instruction, même si elle ne touche aucune ligne. Les lectures restent possibles. Les traitements serveur sans identité utilisateur et les parcours invités conservent leurs contrôles existants.

Le client Supabase transmet ce contrat dans `x-momentum-client`. Cette valeur publique ne remplace ni la session, ni les politiques d’accès, ni la validation serveur. Changer cet en-tête ne permet pas à un autre compte d’accéder aux données. Les accès directs aux fichiers restent interdits : leur validation continue dans `file-ingest`.

Une version obsolète reçoit le code `MM001` avant de créer une activité ou son reçu d’opération. L’interface actuelle demande de conserver le texte puis de recharger. Elle ne recharge pas automatiquement un formulaire non enregistré. Le code pré-CDC masque déjà les détails d’erreur : son message reste générique, mais le formulaire et le texte restent ouverts et aucun succès n’est annoncé.

## Ordre d’activation à préparer

1. Vérifier la sauvegarde utilisable, la configuration hébergée et les preuves préalables ; obtenir l’autorisation de publication.
2. Appliquer uniquement les nouvelles migrations CDC validées, dans l’ordre, et préparer les fonctions serveur et leur configuration. Ne pas rejouer les migrations historiques à cause d’un simple écart de timestamp entre Git et le registre hébergé.
3. Publier le client vérifié avec le contrat. Pendant l’intervalle, les anciens écrivains sont refusés ; prévoir et annoncer cette courte interruption des écritures.
4. Vérifier les lectures, une écriture, les fichiers et le commit réellement servi sur la cible.

Cette procédure n’a pas été exécutée en production. Le refus côté base est testé localement avec l’interface exacte `dd8b37eb72c4ddc1a255c8f4e3a3f42f9f9fcfa0`, puis avec la version actuelle après rechargement.

## Repli

Ne pas utiliser le client pré-CDC comme version de repli : il ne comprend pas les nouveaux profils minimaux et utilise les anciens envois de fichiers. Le repli doit conserver la validation des fichiers, la lecture des axes nuls et ce contrat d’écriture. La version `f0691179ce1c267ae6c220fa6a7faaffd502d015`, précédemment vérifiée en lecture, doit recevoir cette adaptation avant d’être considérée comme un repli capable d’écrire. Ne pas retirer les protections de la base pour la faire fonctionner.

La restauration locale précédemment testée reste une preuve sur son schéma représentatif ; elle ne certifie pas une sauvegarde hébergée récente. Voir [la recette](../../specs/cdc/2026-09-12.client-access.md).
