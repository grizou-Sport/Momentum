# Recette du CDC légal — 23 septembre 2026

## Portée et état

Préparation technique, **pas une livraison juridique ni une publication**. Référence : CDC fourni par l’exploitant le 23 septembre 2026, version 1.0, 14 scénarios. Main de départ : 60e293d. Les contrôles de cette branche ne remplacent pas L01–L10 ni la revue des textes. Les pages de remplacement indiquent une indisponibilité ; ce ne sont pas des politiques validées.

## Preuves techniques

- `npm ci --ignore-scripts`, puis `npm run build` : contrôle source, références, syntaxe, migrations historiques et tests obligatoires. Les tests ajoutés sont inscrits au contrat source.
- `tests/legal-framework.test.mjs` : migration exécutée sur PGlite isolé ; preuve serveur, séparation des titulaires, métadonnées falsifiées rejetées, RPC/déclaration directe bloquées, versions/hash, réessais, export et suppression sans accord, sessions révoquées, service d’upload et invités.
- `tests/legal-client.test.mjs` : documents absents/altérés, réseau, refus, double soumission pendant inscription, reprise sans second compte, contrôle de publication, changement fournisseur/code, précision météo.
- `npm run test:postgres` : 8 tests natifs PostgreSQL 17.6 existants réussis (concurrence du socle ; ce nombre ne prétend pas couvrir à lui seul la migration juridique).
- `npm run test:supabase` : parcours avec vrais services Auth, confirmations e-mail locales, PostgREST/RLS, Storage, Edge Functions, Vault, pg_cron et pg_net. Trois comptes fictifs, preuve juridique, export, partage/invités, nettoyage de fichiers et suppression de l’identité avec maintien des contributions d’autrui. La validation de la version finale comprend des acceptations concurrentes.
- Navigateur Chromium : fixture locale PGlite avec adaptation Auth, identité fictive, CGU fictives clairement étiquetées. Redirection d’un compte sans preuve, case décochée, export téléchargeable avant accord, acceptation puis retour au journal. Affichage 390 × 844 sans débordement horizontal. Cette fixture n’est pas une preuve des services Auth réels ; ceux-ci sont couverts séparément par Supabase local.
- Relevé anonyme de production login/discover avant interaction : détails et limites dans `inventory.md`. Aucune action sur un compte réel.
- `npm run check:legal` doit échouer tant que les décisions/textes/preuves applicables sont incomplets. Le même contrôle est exécuté en CI et dans toute construction de production.

## Matrice de réception

| Scénario | État | Preuve acquise et travail restant |
|---|---|---|
| LEG-01 | Bloqué | Navigation publique créée ; exploitant, localité et e-mail confirmés et accessibles ; adresse complète et cinq textes définitifs à finaliser. |
| LEG-02 | Partiel | Refus empêche signUp, case non cochée, confidentialité séparée ; vérifier les textes approuvés. |
| LEG-03 | Partiel | Idempotence serveur, double clic et reprise réseau, vrais comptes locaux ; durée de purge des inscriptions abandonnées à décider et implémenter. |
| LEG-04 | Partiel | Ancien compte orienté vers finalisation ; export/suppression accessibles sans accord ; contact réel désormais accessible ; finalisation des documents toujours requise. |
| LEG-05 | Partiel | Politique informative distincte des CGU, historique/version exacte conservés ; procédure et contenu des notifications à valider. |
| LEG-06 | Partiel | Relevé vierge login/discover et inventaire source ; audit authentifié réel complet et scénario UE selon L02 à terminer. |
| LEG-07 | Bloqué | Pas de consentement facultatif inventé ; les finalités et qualifications restent à décider dans L06. Aucun statut « non applicable » présumé. |
| LEG-08 | Bloqué | Marketing/connecteurs non ajoutés ; base des fonctions santé à qualifier avant activation publique de ce lot. |
| LEG-09 | Partiel | Tests existants d’isolation, partages et exports réexécutés ; revue globale des publics/champs et anciens buckets publics à clore. |
| LEG-10 | Partiel | Notice versionnée avant réponse, ancien RPC bloqué, retrait idempotent ; exploitant et contact pour lien expiré ajoutés ; durée et document définitif à finaliser. |
| LEG-11 | Partiel | Notice import, suppression des logs d’erreurs brutes, fichiers validés et export/suppression locaux ; contrats/durées et relevé complet des destinations à clore. |
| LEG-12 | Partiel | Suppression asynchrone, statut et reprise testés dans le socle/local ; sauvegardes hébergées et promesses finales non vérifiées. |
| LEG-13 | Réussi technique | Construction de production et CI bloquées si décisions/preuves/textes manquent ; empreinte du code de collecte invalide la revue après nouveau fournisseur/script. Le ciblage d’un pays et les réglages externes restent aussi soumis à la procédure d’exploitation. |
| LEG-14 | Partiel | Liens/cases nommés, zones de statut, focus visible, affichage mobile ; recette humaine clavier complète, zoom 200 % et lecteur d’écran à terminer. |

## Limites et anomalies d’environnement

Aucune migration appliquée au projet hébergé et aucun déploiement de production effectué. Les contrats, SMTP réel, pays d’accès support, sauvegardes, propriété des visuels et durées ne sont pas prouvés par les tests. La prévisualisation Vercel sans base de test reste déconnectée des comptes.

La reprise d’un ancien Docker local a révélé un worker arrêté, des secrets Vault de fixture devenus illisibles et une tâche cron désactivée. Ils ont été rétablis uniquement dans le projet fictif `momentum-cdc-validation`. Le parcours complet a ensuite réussi. La réinitialisation locale a aussi recréé la base dans le réseau Docker par défaut ; son rattachement au réseau local dédié a été corrigé. Aucun contrôle applicatif n’a été affaibli pour masquer ces erreurs.
