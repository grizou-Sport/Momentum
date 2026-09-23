# Procédures à valider avant ouverture

Ce document organise la réalisation ; il n’atteste pas d’une validation de l’exploitant ou d’un juriste.

## Demandes de droits et plaintes

1. Titulaire et contact confirmés : Christophe Gyger, grizou@gmx.ch. Définir la continuité en cas d’indisponibilité sans inventer de suppléant, ainsi que le régime et les délais applicables dans le registre interne non public.
2. Enregistrer identifiant de demande, date, canal et objet, sans recopier de données de santé ni de secret d’invitation dans un ticket.
3. Vérifier l’identité de façon proportionnée. Pour un invité, utiliser le lien encore valide ou faire intervenir l’organisateur ; ne pas réclamer automatiquement une pièce d’identité.
4. Qualifier accès, rectification, export, opposition, retrait, effacement, photo d’un tiers ou contenu illicite. Le refus des CGU n’empêche pas ces démarches.
5. Exporter via le snapshot paginé ; vérifier le manifeste et l’isolation. Ne pas transmettre les données privées d’autres membres. Les liens expirent après une heure.
6. Supprimer via account-deletion : réauthentification, reçu, retrait des fichiers, identité, résultat confirmé. Une panne reste en attente et doit être reprise, jamais annoncée comme succès.
7. Traiter séparément les copies collectives, les demandes sur photos et les sauvegardes selon la décision validée. Conserver seulement la trace autorisée puis purger.

## Incident

Détecter → contenir l’accès concerné sans détruire les preuves → identifier personnes et catégories affectées → apprécier risque avec responsable et conseil → contacter les prestataires → décider les notifications selon seuils et délais applicables → corriger/tester → clôturer avec cause et actions. Aucun délai universel inventé. Aucun secret, trajet ou mesure de santé dans les logs ordinaires. Documenter la réintégration des demandes de suppression lors d’une restauration de sauvegarde.

## Rétention et exploitation

Les délais des comptes incomplets/inactifs, invitations et événements juridiques restent des décisions bloquantes. Ne pas lancer une purge irréversible en les inventant. Inventorier les tâches existantes dans inventory.md ; configurer les tâches approuvées, tester leur reprise et alerter sur les échecs. L’expiration d’un accès n’est pas une suppression physique.

## Évaluation d’impact

Réaliser avant bêta élargie un examen documenté de la sensibilité santé + trajets + partage social : volume/population, finalités, nécessité, alternatives moins intrusives, destinataires, menaces, gravité/probabilité, garanties et risque résiduel. Déterminer avec le juriste si une AIPD/DPIA s’impose. Réexaminer mineurs, nouveaux territoires, suivi publicitaire, scoring, IA externe et échelle. Aucun avis « non requis » n’est présumé.

## Fournisseurs et contenus

Pour chaque fournisseur : rôle exact, DPA, pays de stockage/accès/support, sous-traitants, mécanismes de transfert, rétention, suppression et contact incident. Contrôler Vercel, Supabase/SMTP, jsDelivr, Open-Meteo, OpenStreetMap et Geoapify. Répertorier les licences photographies, icônes, cartes, polices et bibliothèques ; organiser retrait de contenu et contestation. Toute fonction future reste désactivée jusqu’à mise à jour du registre, des notices et des contrôles.
