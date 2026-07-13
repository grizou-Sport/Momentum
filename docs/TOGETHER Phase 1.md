# TOGETHER — Phase 1 Cercle

## Périmètre livré

- recherche privée par adresse e-mail exacte d’un compte découvrable ;
- invitation de Cercle entre comptes existants ;
- demandes reçues et envoyées, avec acceptation, refus et annulation ;
- relation réciproque créée atomiquement lors de l’acceptation ;
- retrait sans suppression des Moments historiques ;
- blocage bilatéral des nouvelles invitations ;
- limitation de fréquence des recherches et envois ;
- états de chargement, résultats neutres, confirmations et erreurs dans l’interface.

Les invitations externes, liens, QR codes, e-mails applicatifs et partages WhatsApp restent hors périmètre jusqu’à l’instruction explicite « continue ».

## Migration

La migration `20260713192107_phase1_circle_invitations.sql` ajoute les tables `invitations`, `connections` et `blocked_users`, migre les anciennes relations de Cercle et remplace les écritures directes du navigateur par cinq fonctions RPC contrôlées.

Après application dans l’environnement Supabase ciblé, vérifier que les cinq fonctions publiques sont visibles dans le cache de schéma PostgREST. Les nouvelles tables n’accordent aucun accès direct au rôle `authenticated` ; leur lecture et leurs mutations passent exclusivement par les fonctions prévues.

## Recette

1. Avec deux comptes découvrables A et B, A recherche l’e-mail exact de B et envoie une invitation.
2. Vérifier que A la voit dans « Invitations envoyées » et B dans « Invitations reçues ».
3. B accepte : A et B apparaissent une seule fois dans leurs Cercles respectifs.
4. Refaire le parcours avec un refus, puis avec une annulation ; aucune relation ne doit être créée.
5. Retirer un membre et confirmer que les Moments historiques restent accessibles selon leurs droits propres.
6. Bloquer un membre, puis vérifier qu’une recherche ou invitation dans les deux sens retourne un résultat neutre.
7. Essayer un e-mail absent, un profil non découvrable, son propre e-mail et des requêtes répétées au-delà de la limite.
8. Rejouer les actions par double clic : aucune invitation ni connexion en double ne doit apparaître.
9. Avec un troisième JWT, tenter de lire ou modifier les invitations et connexions de A/B : aucun accès direct ne doit être accordé.
10. Vérifier l’onglet CERCLE sur desktop et Safari mobile, ainsi que les fonctions Moments et Clubs existantes.

Le contrôle statique local se lance avec `node --test tests/together-phase1.test.mjs`.

## Retour arrière

Avant tout retour arrière, sauvegarder `invitations`, `connections` et `blocked_users`. Revenir à l’ancienne interface nécessite de rétablir les droits d’écriture sur `circle_relationships`, puis de déployer ensemble l’ancien JavaScript et l’ancien schéma. Ne pas supprimer les nouvelles tables avant d’avoir exporté leur historique : les refus, annulations, retraits et blocages n’existent pas avec la même précision dans l’ancien modèle.
