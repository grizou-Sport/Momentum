# Changelog

Les changements notables du projet sont consignés dans ce fichier.

## Non publié

### Ajouté

- Module FLOW V1 sur HOME : carte Défi × Maîtrise, périodes, sélection et résumé d’activité.
- Collecte rapide de l’effort physique, du défi et de la maîtrise après une activité réalisée, avec possibilité de répondre plus tard.
- Table sécurisée `activity_flow_assessments` et couche de contexte interne extensible.
- Extraction FIT enrichie : fréquence cardiaque, zones, dérive, vitesse, puissance, cadence, température, altitude et métriques de charge disponibles dans le fichier.
- Connexion des Moments TOGETHER « Aujourd’hui », « À venir » et « Passés » aux calendriers HOME.
- Accès direct depuis HOME vers le détail du Moment partagé dans TOGETHER.
- Structure documentaire `docs/`, `specs/` et `backlog/`.
- Règles communes pour les contributions assistées par IA.
- Emplacement `src/` réservé à une future migration contrôlée.
- Sélecteur de période commun aux graphiques HOME : semaine en cours (par défaut), 4 semaines, 12 semaines, 6 mois, 1 année ou période personnalisée.
- Création, modification et suppression des données Bien-être depuis HOME et le calendrier.

### Modifié

- Conversion de `README.md` en fichier de présentation du projet.
- Archivage des anciennes notes du README dans `Notes version 0.07.md`.
- Normalisation de `Docs/` en `docs/`.
- Correction de l’extension du document Word d’architecture historique.
- Simplification de la carte Bien-être autour de la motivation au réveil et d’une qualité de sommeil qualitative.
- Différenciation visuelle des activités prévues dans les graphiques.
- Masquage des légendes sans valeur dans le graphique du volume hebdomadaire.
- Conservation de la position de défilement lors de l’ouverture et de la fermeture des fenêtres HOME.
- Refonte de la hiérarchie de TOGETHER : navigation et Hero plus compacts, rythme vertical resserré et compteurs secondaires.
- Séparation des vues MOMENTS et CERCLE, avec une action principale adaptée à chaque univers.
- Densification des cartes Moment, des états vides et des invitations ; transformation des Clubs en cartes de résumé.
- Redirection vers HOME après connexion et après finalisation du questionnaire d’inscription.
- Réorganisation de la navigation globale dans l’ordre HOME, TOGETHER, YOU.
- Évolution de « Je vis pour » à partir des sports déclarés et des activités réalisées sur douze mois.
