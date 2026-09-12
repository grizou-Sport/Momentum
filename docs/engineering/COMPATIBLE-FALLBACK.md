# Repli compatible après la protection des anciens écrivains

Cette branche part exactement de `f0691179ce1c267ae6c220fa6a7faaffd502d015`. Les seuls fichiers applicatifs adaptés sont `js/supabase.js` et `scripts/build-environment.mjs` : le client source et les configurations générées transmettent le contrat public `cdc-2026-09-08`. Les protections de la base et des fichiers restent en place. Aucune migration inverse ni suppression de données n’est exécutée.

Installation propre, 198 tests réussis et 204 fichiers construits. Le navigateur sert cette version avec les vrais services locaux et les **17** migrations CDC déjà appliquées, y compris la nouvelle protection. Il relit les deux Moments créés précédemment, dont le GPX importé. Une nouvelle marche de 80 minutes avec souvenir et sans effort est enregistrée depuis le formulaire.

La relecture en base confirme la nouvelle ligne et le RPE nul ; les empreintes des deux activités précédentes et de leurs souvenirs sont strictement inchangées. Le téléchargement authentifié du GPX conserve son empreinte originale. Dans TOGETHER, la réponse « Oui » d’Alex fictif reste confirmée et son lien révoqué. Voir [le relevé](../../specs/cdc/2026-09-12.compatible-fallback-results.json).

La recette est locale et utilise exclusivement des comptes fictifs. Cette branche conserve les comportements antérieurs à la dernière passe d’accessibilité et de récupération d’accès ; elle sert de candidat de repli, pas de version finale du CDC. Les migrations et fonctions serveur doivent rester celles validées pour les nouvelles données. Ne pas promouvoir un artefact de prévisualisation configuré sans comptes ou sur une base de test vers la production. La préparation et l’autorisation de publication restent nécessaires.
