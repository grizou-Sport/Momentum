# MOMENTUM — Cahier des charges unique
## Consolidation de la fiabilité, de l’expérience et de l’identité produit

**Version :** 1.0 — 8 septembre 2026  
**Destinataire :** Ingrid  
**Commanditaire :** Christophe Gyger  
**Nature du livrable :** spécification fonctionnelle, éditoriale, graphique et technique, avec recette intégrée.  
**Dépôt de référence :** `grizou-Sport/Momentum`  
**Référence vérifiée lors de la rédaction :** `dd8b37eb72c4ddc1a255c8f4e3a3f42f9f9fcfa0`, branche `main`, commit du 5 septembre 2026.  
**Chemin de rangement proposé :** `specs/CDC_MOMENTUM_Consolidation_Experience_V1_2026-09-08.md`.

> **L’esthétique d’un magazine d’aventure. La rigueur d’un outil d’entraînement.**
>
> Le résultat attendu n’est pas un site qui fait davantage de choses. C’est un produit plus fiable, plus facile à utiliser et plus fidèle à la vie de la personne qui s’en sert.

---

## Sommaire

1. Cadre, sources et portée du document
2. Objectifs produit et positionnement
3. Acquis à préserver et limites du périmètre
4. Pilotage, priorités et dépendances
5. Architecture de l’information et vocabulaire
6. Système de design et accessibilité
7. Photographies, Heroes et animations
8. Accueil public et démonstration
9. Authentification et onboarding progressif
10. Navigation commune
11. HOME, journée et Journal
12. Formulaire unique d’un Moment
13. Imports FIT/GPX, provenance et doublons
14. FLOW et expression du ressenti
15. Moteur commun de charge et qualité des données
16. Progression et lecture croisée des graphiques
17. Bien-être et annotations de contexte
18. YOU, Mon Horizon et Mon Chemin
19. Nutrition pendant l’activité
20. TOGETHER et organisation des Moments
21. Invitations sans compte
22. Services connectés et notifications
23. Confidentialité, partage, export et suppression
24. Contenu, synthèses et interprétations
25. Données, migrations et compatibilité
26. Architecture technique, sécurité et performances
27. Observabilité et mesure de l’utilité
28. Plan de réalisation intégré
29. Données et environnements de recette
30. Scénarios de recette détaillés
31. Matrice de couverture de l’audit
32. Livraison, déploiement et définition de terminé
33. Références et distinction entre existant et décisions nouvelles

---

## 1. Cadre, sources et portée du document

### 1.1. Objet

Ce CDC transforme l’audit global de MOMENTUM en exigences implémentables. Il couvre les parcours publics et authentifiés, l’UX, le design, les contenus, la cohérence des calculs, les données personnelles et les interactions entre modules.

Il s’agit d’un **seul périmètre de référence**, réalisable par lots internes. Ces lots ne constituent pas des CDC séparés. Ingrid suit les dépendances, livre des changements vérifiables et maintient ce document comme référence de couverture.

Le présent livrable n’autorise ni la suppression irréversible de données existantes ni la mise en production immédiate de toutes les évolutions. Les règles de préparation, de validation et de publication du dépôt restent applicables.

### 1.2. Fondements

Le socle est constitué de l’audit présenté dans cette conversation, de la Constitution de MOMENTUM, de l’ADN fondateur fourni au projet et du code de référence consulté. Les sources sont identifiées au chapitre 33.

Les phrases exprimant une expérience personnelle appartiennent à l’utilisateur. La mission fondatrice — raconter ce qu’une expérience a changé pour lui — ne permet jamais de lui attribuer une émotion qu’il n’a pas exprimée.

### 1.3. Ce qui est constaté et ce qui est décidé ici

Les observations de l’audit proviennent principalement du code. Elles ne constituent pas une certification d’ergonomie sur appareil réel, une mesure de performance, un audit juridique ou un audit complet de sécurité de la base en production.

Les comportements cibles, seuils de recette, états applicatifs et conventions de calcul définis ci-dessous sont des **décisions de conception proposées pour cette implémentation**. Ils ne sont pas présentés comme des fonctionnalités déjà livrées ou comme un modèle physiologique scientifiquement validé.

L’audit ne fixait pas tous les détails nécessaires à la programmation. Ce CDC les explicite : comportement d’un RPE absent, initialisation du modèle, sécurité des liens invités, portée des exports, traitement des sauvegardes partielles et des préférences. Ces arbitrages doivent être traçables dans la réalisation.

### 1.4. Vérification initiale obligatoire

Avant toute modification, Ingrid relève le commit courant, les migrations réellement appliquées et les composants disponibles. Un fichier de migration dans GitHub ne prouve pas son application à la base utilisée.

Toute fonctionnalité déjà présente et conforme est conservée, testée et marquée « existant vérifié ». Elle n’est pas reconstruite pour satisfaire artificiellement ce CDC. Une divergence entre le code actuel et la référence ci-dessus doit être consignée avant modification.

**Acceptation :** un état initial associe chaque chapitre à « conforme », « à corriger », « à créer » ou « dépendance externe ». Aucun travail de production n’est fondé uniquement sur un ancien résumé de conversation.

---

## 2. Objectifs produit et positionnement

### 2.1. Proposition de valeur à traduire dans l’expérience

**Promesse :** « Le carnet d’aventure qui relie ce que tu fais, ce que tu ressens et ce que tu choisis de vivre ensuite. »

**Explication :** « Rassemble tes activités, garde les souvenirs qui comptent et prépare tes prochains moments, seul ou avec tes proches. »

Ces formulations sont la direction éditoriale de cette phase. Elles ne constituent pas une promesse de synchronisation universelle, de diagnostic médical ou de coaching automatisé.

### 2.2. Public de conception prioritaire

La conception vise d’abord une personne pratiquant régulièrement une ou plusieurs activités, éventuellement équipée d’une montre, intéressée par sa progression mais ne souhaitant pas résumer sa pratique à un classement.

La navigation, l’ajout d’un Moment et le Journal restent utilisables par un débutant et sans montre. Le produit ne doit pas exiger une compétition, un objectif chiffré, une pratique extérieure ou un profil physiologique complet pour être utile.

### 2.3. Continuité d’usage attendue

Le parcours à rendre naturel est :

**Une envie → un Moment préparé ou vécu → des faits et un ressenti → une trace personnelle → une prochaine envie.**

Cette continuité ne signifie pas qu’un assistant choisit automatiquement l’étape suivante. Un lien, une action de réutilisation ou une question sobre peuvent suffire.

### 2.4. Traduction fonctionnelle

HOME aide à se situer et à agir aujourd’hui. Progression aide à comprendre les activités enregistrées. YOU permet de reconnaître son parcours et ses intentions. TOGETHER aide à organiser des expériences avec des proches. FLOW reste un repère du défi et de la maîtrise déclarés.

Une nouvelle mesure n’est admise que si sa définition, sa provenance et son utilité sont compréhensibles. Une nouvelle action n’est admise que si elle sert un de ces parcours.

### 2.5. Positionnement face aux autres outils

MOMENTUM n’a pas pour objectif, dans cette phase, de remplacer l’enregistrement d’une montre, l’analyse experte exhaustive, le calcul d’itinéraires ou le réseau social sportif généraliste. Il doit s’intégrer à la vie de l’utilisateur sans lui demander d’abandonner ses outils existants.

La différenciation par le parcours personnel est une hypothèse à tester, pas une exclusivité de marché démontrée. L’accueil public ne doit ni dénigrer des concurrents ni annoncer une supériorité technique non mesurée.

### 2.6. Valeur commerciale

Aucun paiement, abonnement, paywall ou comparatif tarifaire n’est à développer. Les tests doivent déterminer si la continuité entre activité, ressenti, souvenir et préparation apporte une valeur récurrente. Le design seul n’est pas considéré comme une preuve de disposition à payer.

**Acceptation :** une personne découvrant le produit peut expliquer son utilité sans citer uniquement « des statistiques sportives » ou « une IA qui résume les sorties ».

---

## 3. Acquis à préserver et limites du périmètre

### 3.1. Acquis non négociables

Conserver les territoires HOME, TOGETHER, Progression, YOU et FLOW. Conserver les grands Heroes de HOME et Progression et leur harmonisation. Ne pas revenir à une petite bannière par défaut.

Conserver le regroupement des graphiques, les périodes de Progression, la période personnalisée, les flèches, les tableaux de données accessibles et les préférences existantes.

Conserver la photo de profil dans la navigation et son ajustement dans le cercle. Les paramètres restent dans YOU.

Conserver le formulaire unique d’un Moment : les questions de ressenti sont intégrées à ce formulaire, avec **une seule validation principale**. Aucun nouveau formulaire FLOW indépendant ne doit être réintroduit après l’enregistrement.

`activities.rpe` reste la seule source officielle de l’« Effort physique ». Défi et maîtrise ne modifient jamais le RPE. Les données FIT peuvent fournir du contexte sans déplacer automatiquement un point FLOW.

Conserver le composant commun de durée et les contrôles de ressenti partagés, les imports FIT/GPX, le préremplissage de l’heure, les médias, le ravitaillement récemment ajouté, la météo, les lieux structurés, les fonctions de Cercle et de Club, et les droits associés.

La structure et le nommage des photographies déjà présents dans le dépôt ne sont pas réorganisés dans cette phase.

### 3.2. Travaux compris

Toutes les corrections et évolutions explicitement décrites dans les chapitres fonctionnels font partie du CDC : accueil public, onboarding allégé, navigation directe, hiérarchie de HOME, formulaire progressif, moteur de charge, qualité des données, YOU, souvenirs, invitations sans Passeport complet, transparence des connexions et export fiable.

La synthèse de période est une vue sobre dans les modules existants. Ce n’est pas un nouveau module « chapitre hebdomadaire », une newsletter ou un moteur de récits automatiques.

### 3.3. Dépendances externes clairement bornées

Les futurs connecteurs sportifs et l’envoi d’e-mails dépendent des accès et services réellement disponibles. Ce CDC impose leur état véridique, leur architecture d’intégration et leur parcours de repli, mais ne prétend pas obtenir l’accord d’un fournisseur.

Le partage d’une invitation par lien doit fonctionner sans imposer l’installation d’un fournisseur d’e-mails supplémentaire. Une dépendance externe non levée reste explicitement marquée comme telle ; elle ne devient jamais une fausse fonction active.

### 3.4. Hors périmètre

Pas de changement général de framework, d’application native, de migration d’hébergement, de nouveau réseau social, de classement, de moteur médical, de plan d’entraînement généré automatiquement, de synchronisation non autorisée ou de contournement des conditions des fournisseurs.

Pas de journal alimentaire quotidien, de nouveau modèle prédictif de récupération, de nouveau score global, de modification du principe des neuf zones FLOW, de notifications culpabilisantes ou d’intégration automatique d’une IA externe.

Le choix futur d’un hébergement et d’un service d’e-mail suisses demeure une orientation du projet. Ne pas afficher « hébergé en Suisse » avant que cela corresponde au déploiement réel.

---

## 4. Pilotage, priorités et dépendances

### 4.1. Priorités

**P0 — confiance et intégrité :** charge, données manquantes, source du RPE, accès au profil, états de connexion véridiques, droits, sécurité des nouveaux partages et exactitude des exports.

**P1 — clarté quotidienne :** navigation, typographie, Heroes utilisables, formulaire, accueil public, onboarding, HOME et Progression.

**P2 — continuité personnelle et collective :** présentation de YOU, traces marquantes, synthèses sobres, invitations sans compte et enrichissements contextuels de nutrition.

P2 ne signifie pas facultatif. Une livraison intermédiaire peut être terminée pour son lot ; le CDC global n’est pas terminé si une exigence obligatoire reste absente.

### 4.2. Dépendances de réalisation

Les règles de données précèdent les nouvelles interprétations. La navigation commune précède la validation complète des pages. Les règles de visibilité et le contrôle serveur précèdent les liens invités. La persistance additive précède l’activation d’une nouvelle interface qui l’utilise.

Une évolution du moteur de charge ne peut être activée dans Progression en laissant FLOW sur un calcul différent. Une évolution du formulaire ne peut être publiée en laissant une autre entrée de saisie rétablir un RPE par défaut.

### 4.3. Traçabilité

Les identifiants des tests du chapitre 30 et la matrice du chapitre 31 doivent apparaître dans les comptes rendus de livraison. Pour une exigence non applicable, la raison doit être explicite. « Non testé » et « fonctionne dans le code » ne sont pas équivalents à « validé ».

---

## 5. Architecture de l’information et vocabulaire

### 5.1. Destinations

| Destination | Question à laquelle elle répond | Contenu principal |
|---|---|---|
| HOME | Où en suis-je aujourd’hui et que puis-je faire ? | Journée, prochains jours, accès au Journal, FLOW. |
| TOGETHER | Quel Moment peut-on vivre ensemble ? | Moments, invitations, Cercle, Clubs. |
| Progression | Que montrent mes activités enregistrées ? | Volume, répartition, charge, bien-être, synthèse de période. |
| YOU | Qu’est-ce qui me ressemble et compte pour moi ? | Aperçu personnel, Mon Horizon, Mon Chemin, pratiques, profil, matériel, compte. |

### 5.2. Objets existants et sens des mots

« Moment » est un terme d’expérience, pas l’obligation de fusionner les tables. Une activité personnelle et un événement organisé à plusieurs restent des objets distincts pouvant être liés.

Une inscription à un Moment collectif ne prouve pas qu’une activité sportive a été réalisée. Le passage du temps ne transforme pas automatiquement un événement en séance comptabilisée.

« Mon Horizon » désigne une intention ou un objectif. « Mon Chemin » désigne la consultation du parcours et des traces conservées. « Mon équilibre » dans YOU concerne le profil et les préférences ; « Bien-être » dans Progression concerne les observations dans le temps.

### 5.3. Convention de langue

Les grands territoires conservent les appellations validées. Les objets, commandes, aides et états sont en français. Ne pas traduire HOME en Accueil ou YOU en Moi dans un seul composant sans décision globale.

### 5.4. Compatibilité des liens

Les URL et ancres existantes restent fonctionnelles, notamment `index.html#today`, `#journal`, `#flow`, les liens de Progression et les paramètres de YOU et TOGETHER.

Un ancien lien vers une section secondaire doit l’ouvrir, même si la page possède un nouvel écran de synthèse. Les actions précédent/suivant du navigateur ne doivent pas renvoyer arbitrairement vers l’onglet par défaut.

---

## 6. Système de design et accessibilité

### 6.1. Direction visuelle

Conserver les fonds clairs, les surfaces sobres, les photographies, les accents déjà en place et le contraste entre titrage éditorial et lecture des données. Éviter le tableau de bord saturé de cartes colorées.

La cohérence provient des comportements, de la typographie, des espacements et des composants partagés. Les quatre pages ne doivent pas devenir quatre copies d’une même grille.

### 6.2. Socle commun

Centraliser les tokens de couleurs, espacements, rayons, ombres, dimensions de contrôle, styles de focus et typographie. Réutiliser le socle existant plutôt que juxtaposer de nouveaux systèmes.

Les boutons principaux, secondaires, liens d’action, filtres, badges de statut, champs, contrôles de durée, sliders, messages, dialogues et états vides ont chacun une définition commune. Les différences propres à une page doivent être justifiées par l’usage.

### 6.3. Échelle de lecture cible

Les cibles suivantes sont des choix de design pour la recette : corps courant autour de 16 px ; contrôles et libellés utiles entre 13 et 14 px au minimum ; métadonnées non essentielles généralement à partir de 12 px. Sur mobile, les champs doivent rester lisibles sans agrandissement imposé au focus.

Ne pas appliquer une petite taille à un contrôle uniquement parce que son libellé est long. Ne pas mettre en capitales des phrases entières d’aide. Les unités et les états doivent rester lisibles indépendamment de la valeur principale.

Avant de réduire les graphiques, diminuer les grands index décoratifs, les libellés redondants et les marges internes qui ne servent pas la lecture.

### 6.4. Grille et rythme

Employer une échelle d’espacement cohérente, par exemple 4/8/12/16/24/32/48/64 px, avec une adaptation responsive. Cette grille n’impose pas la même marge à chaque composant.

La largeur de texte doit éviter les paragraphes très longs sur grand écran. Les actions associées à un titre restent identifiables sans sembler appartenir au bloc voisin.

### 6.5. Cibles d’interaction

Viser une zone interactive d’au moins 44 × 44 px pour les actions tactiles principales, y compris lorsque l’icône dessinée est plus petite. Éviter les icônes sans libellé visible sur les actions déterminantes.

Conserver les libellés courts et explicites. Une suppression est identifiable comme telle, séparée de l’action positive et confirmée lorsqu’elle détruit des données enregistrées.

### 6.6. Contraste et focus

Cibles de recette : contraste de 4,5:1 pour le texte courant, 3:1 pour les grands textes et composants graphiques utiles à l’interaction. Le focus doit être visible sur fonds clairs, sombres et photographiques.

Le thème dynamique de navigation est un confort supplémentaire, pas une garantie de contraste. Prévoir un fond de secours ou un voile stable lorsque l’analyse de la photographie échoue ou ne garantit pas la lisibilité.

Les séries de graphiques ne se distinguent pas uniquement par la couleur : légende, libellé et style de ligne sont disponibles. Une information importante ne doit jamais dépendre du seul survol.

### 6.7. Clavier et assistance

Toutes les commandes sont accessibles au clavier. Les onglets possèdent un comportement cohérent, les dialogues gèrent le focus, la touche Échap et le retour au déclencheur. Un bloc replié n’est pas parcouru par le focus.

Fournir un lien d’évitement vers le contenu principal. Les flèches du calendrier et des périodes portent des noms accessibles complets. Les zones modifiées annoncent l’état sans lire répétitivement toute la page.

Préserver les tableaux de données des graphiques, leurs unités et leur période. Les contrôles de durée et de ressenti gardent une alternative clavier et une valeur lisible.

### 6.8. Reflow et états applicatifs

Tester les largeurs 360, 390, 430, 768, 1024 et 1440 px, le portrait/paysage, le zoom texte à 200 % et le reflow à une largeur équivalente de 320 px. Aucun défilement horizontal global involontaire. Un tableau large ou la fenêtre glissante peut disposer d’un défilement local clairement identifié.

Chaque composant de données distingue chargement, vide réel, absence de mesure, résultat partiel, erreur récupérable et succès. Un zéro ne remplace jamais un message « non renseigné ».

**Acceptation :** les tâches principales restent réalisables sur téléphone, tablette et ordinateur, sans dépendre du survol et sans perte d’information après zoom.

---

## 7. Photographies, Heroes et animations

### 7.1. Grand Hero maintenu

HOME et Progression conservent un Hero immersif partagé. L’objectif est une entrée proche d’un écran lorsqu’elle tient dans l’espace disponible, pas une hauteur fixe de 760 ou 820 px imposée à tous les mobiles.

Le contenu, les réglages de police, les zones de sécurité et la hauteur utile de l’écran priment sur une valeur rigide. Une hauteur supérieure à l’écran est acceptable si elle est nécessaire pour ne pas couper le contenu ; elle ne doit pas être imposée par une constante sans rapport avec l’appareil.

### 7.2. Accès immédiat à l’usage

Dans le Hero HOME, proposer « Voir ma journée » et un accès à « Ajouter un Moment ». Dans Progression, proposer « Voir mes indicateurs ». Ces actions doivent être accessibles sans traverser d’abord toute la page.

Après passage à la section ciblée, placer le focus de façon logique sans piéger l’utilisateur. Le bouton Retour et une visite ultérieure ne déclenchent pas une nouvelle animation obligatoire.

### 7.3. Préférence d’arrivée

Créer dans YOU une préférence par page : « Arrivée immersive » ou « Accès direct au contenu ». Le réglage par défaut conserve l’immersion ; une préférence existante explicite est préservée.

L’accès direct vise la section utile sans supprimer le Hero, qui reste disponible en remontant. Ne pas inférer secrètement une préférence à partir du nombre de visites. Les liens profonds vers une section priment sur cette préférence.

### 7.4. Composition photographique

Définir pour les images de marque un point focal, un recadrage adapté aux formats et un traitement de contraste. Ne pas étirer une image. Prévoir un fond de secours sans texte illisible ni message d’erreur technique.

Diversifier l’éditorial : paysages, chemins proches, départs ordinaires, pauses, pratiques variées, gestes et expériences partagées. Les photographies ne doivent pas suggérer que seules les performances exceptionnelles méritent une place.

Réutiliser les dossiers existants et ne pas inventer des fichiers qui n’y figurent pas. Une recherche ou un achat de droits n’est pas implicitement autorisé par ce CDC.

### 7.5. Médias personnels

Les photos personnelles ne deviennent ni des illustrations publiques ni des Heroes collectifs par défaut. Les transformations d’affichage ne détruisent pas les originaux. Les métadonnées de localisation sont retirées des dérivés destinés au partage, sauf mécanisme explicite et contrôlé.

### 7.6. Mouvement

Conserver des animations calmes. Respecter `prefers-reduced-motion` sur toutes les pages, pas seulement Progression. Dans ce mode, les valeurs et graphiques sont directement visibles.

Ne jamais afficher durablement zéro pendant l’animation d’une valeur chargée. Une panne du module d’animation ne doit pas cacher le contenu. Pas de défilement forcé, de parallaxe obligatoire ou de compte à rebours bloquant.

---

## 8. Accueil public et démonstration

### 8.1. Page de découverte distincte

Créer une entrée publique séparée du formulaire de connexion. Par défaut, conserver `index.html` pour la HOME authentifiée et introduire une page publique dédiée, par exemple `discover.html`, sans casser les favoris et liens actuels.

La politique de routage de la racine doit être documentée. Elle peut envoyer un nouveau visiteur vers la découverte, mais ne doit jamais perturber un lien profond, une récupération de mot de passe ou une invitation.

### 8.2. Ordre du contenu public

La page présente successivement la promesse et son explication, un exemple de Moment, la continuité entre faits/ressenti/souvenir, l’organisation avec les proches et un accès clair à la création de compte.

Les appels principaux sont « Découvrir un exemple » et « Commencer ». « Se connecter » reste immédiatement disponible pour les utilisateurs existants.

### 8.3. Démonstration

Prévoir un exemple en lecture seule, composé de données entièrement fictives et signalé « Exemple fictif ». Montrer les faits d’une activité, un ressenti explicitement fictif, une photo autorisée et une intention pour la suite.

La démonstration utilise les vrais composants de rendu lorsque c’est raisonnable, mais aucune donnée privée et aucun faux compte en production. Aucun bouton ne simule une sauvegarde réussie.

Toute fonctionnalité montrée comme utilisable doit être disponible. Une future synchronisation ou interprétation avancée ne doit pas être mise en scène comme existante.

### 8.4. Retour à l’authentification

Conserver la page de connexion comme porte de retour. Prévoir un lien vers la découverte depuis cette page, sans alourdir le formulaire pour les personnes déjà inscrites.

**Acceptation :** un visiteur peut comprendre l’usage avant de créer un compte ; l’exemple ne crée aucune donnée métier ; une personne existante atteint toujours rapidement sa connexion.

---

## 9. Authentification et onboarding progressif

### 9.1. Séparation des états d’accès

Le contrôle d’accès distingue au minimum : session en vérification, utilisateur non connecté, session valide, accès expiré confirmé, Passeport absent confirmé, onboarding minimal incomplet, erreur temporaire de lecture.

Une indisponibilité réseau ou un échec de lecture du profil affiche « Impossible de charger ton espace pour le moment » et « Réessayer ». Elle ne supprime pas la session et ne renvoie pas arbitrairement vers l’onboarding.

Seule une absence confirmée d’utilisateur justifie le renvoi vers la connexion. Seule une absence ou une incomplétude confirmée du Passeport minimal justifie le renvoi vers l’accueil progressif.

### 9.2. Fin de l’écran invisible sans issue

Le contrôle d’accès doit afficher un état de chargement accessible plutôt qu’une page indéfiniment masquée. Prévoir une sortie récupérable en cas d’échec ou de délai anormal, sans révéler le contenu protégé.

### 9.3. Configuration minimale

Le nouveau parcours comporte trois séquences légères : prénom ou nom d’usage ; pratiques principales ; intention actuelle. La dernière séquence mène directement à l’import ou à l’ajout du premier Moment.

Le prénom est requis. Les pratiques peuvent être sautées avec « Je verrai plus tard ». L’intention peut rester « Sans objectif particulier pour le moment ». Les détails du profil ne bloquent pas l’entrée.

Ne pas demander date de naissance complète, sexe, taille, poids ou historique compétitif uniquement pour obtenir un profil plus rempli. Si une fonction réellement disponible en a besoin, la demande est contextualisée, son utilité expliquée et les valeurs inconnues restent nulles.

Aucun contrôle d’éligibilité réellement nécessaire au service ne doit être retiré implicitement. Les règles d’accès aux mineurs et les textes d’inscription existants sont à vérifier avant ouverture publique ; ne pas inventer une conformité juridique ni une nouvelle politique d’âge dans le code.

### 9.4. Suppression du faux point de départ physiologique

Retirer du nouveau parcours l’affichage d’une charge chronique prétendument personnelle avant les premières données. Les informations déclarées sur le rythme peuvent être conservées comme préférences, pas injectées silencieusement comme entraînements passés.

Remplacer la promesse automatique des « 42 jours » par : « Tes premières activités construiront progressivement tes repères. Tu pourras compléter ton profil quand ce sera utile. »

### 9.5. Sauvegarde et reprise

Sauvegarder chaque séquence minimalement validée. Une interruption permet la reprise à la dernière étape utile. Les écritures sont idempotentes ; cliquer deux fois ne crée pas deux Passeports.

Créer un indicateur versionné de fin d’onboarding minimal. Les comptes ayant déjà terminé l’ancien onboarding sont reconnus comme terminés sans recommencer. Aucune ancienne donnée déclarée n’est effacée du profil.

### 9.6. Redirections

Après connexion, revenir au chemin autorisé demandé avant la connexion. Les chemins de retour sont validés et limités au site. Une URL fournie dans un paramètre ne doit pas permettre une redirection arbitraire externe.

Une invitation reçue n’est jamais détournée vers cinq écrans de Passeport. Le parcours invité du chapitre 21 reste distinct.

**Acceptation :** une personne peut enregistrer un premier Moment sans profil physiologique ; un utilisateur existant n’est jamais forcé à recommencer ; une panne Supabase n’est pas présentée comme un compte vide.

---

## 10. Navigation commune

### 10.1. Mobile et tablette

Utiliser quatre destinations principales avec icône et libellé visible, dans l’ordre existant : HOME, TOGETHER, Progression, YOU. Un toucher ouvre directement la destination, y compris pour l’avatar YOU.

Le choix d’une barre inférieure est recommandé pour le téléphone. Sur tablette, garder la variante réellement adaptée à l’espace, mais conserver le même comportement direct. Aucun premier toucher ne doit simplement ouvrir un menu caché alors qu’un autre ouvre une page.

Les sous-rubriques se trouvent dans la page. Un menu secondaire éventuel est ouvert par une commande distincte.

### 10.2. Ordinateur

Conserver la barre latérale. Les destinations ont un nom identifiable sans devoir mémoriser leurs pictogrammes ; les infobulles complètent le libellé, elles ne le remplacent pas pour les commandes essentielles.

Un clic reste une navigation directe. Le survol peut ouvrir une aide ou une sous-navigation, mais ne change pas la destination par surprise et reste facultatif au clavier.

### 10.3. Corrections de contenu

Remplacer « Volume hebdomadaire » par « Volume d’activité ». Utiliser « Répartition des activités » quand le périmètre comprend le bien-être. Retirer « Fil d’actualité — Bientôt » de la navigation courante.

Conserver l’accès aux Invitations et aux Clubs. Les anciens liens vers ces vues continuent de fonctionner même si TOGETHER s’ouvre désormais sur les Moments.

### 10.4. Géométrie et session

Prévoir les zones de sécurité des téléphones et le clavier virtuel. La navigation ne masque ni la dernière carte ni les boutons d’un formulaire. Un dialogue plein écran dispose de sa propre sortie et ne subit pas une seconde barre superposée.

À la déconnexion, effacer les caches propres au compte. Deux comptes successifs sur le même appareil ne partagent ni préférences personnelles, ni avatar, ni fragments de données.

---

## 11. HOME, journée et Journal

### 11.1. Ordre cible

Conserver le Hero, puis présenter « Aujourd’hui », la fenêtre des prochains et derniers jours, un accès au Journal mensuel et FLOW. Réduire les développements simultanés sans supprimer les fonctionnalités.

Le calendrier mensuel est replié par défaut lors d’une nouvelle visite sans préférence. « Ouvrir le Journal » le développe. Une ouverture directe sur `#journal` l’affiche immédiatement. Une préférence de repli est mémorisée par utilisateur.

### 11.2. Bloc Aujourd’hui

Afficher la date, les Moments prévus ou réalisés, un accès à « Ajouter un Moment » et le bien-être du jour s’il est renseigné. La météo fournit du contexte ; elle ne remplace pas l’action principale et son échec ne bloque pas les autres données.

Employer « Voir ma journée » à la place de « Ouvrir ». En l’absence de Moment, afficher « Rien de prévu pour le moment » et une action utile, pas un message de retard ou de manque.

Le statut prévu/réalisé est lisible sur chaque entrée. Les événements TOGETHER et activités personnelles liés ne sont pas présentés comme deux réalisations sportives distinctes.

### 11.3. Fenêtre vivante

Conserver trois jours passés, aujourd’hui et trois jours à venir. Sur mobile, aujourd’hui est centré à la première ouverture de la fenêtre, pas le dernier jour futur.

Ne pas recentrer la fenêtre à chaque rechargement de données si l’utilisateur l’a déplacée volontairement. Le bouton « Aujourd’hui » recentre à la demande. Une navigation vers une date choisie prime sur le centrage initial.

Les commandes et les dates restent lisibles au clavier et au toucher. L’orientation passée/future ne repose pas sur une couleur seule.

### 11.4. Journal mensuel

Conserver les déplacements de mois, le retour à aujourd’hui, la consultation d’un jour et l’ajout d’un Moment à cette date. Le formulaire reprend la date sélectionnée, pas systématiquement la date du jour.

Afficher « Sélectionne un jour pour retrouver ou ajouter un Moment. » Les flèches ont pour noms accessibles « Mois précédent » et « Mois suivant ».

Un événement annulé n’est pas assimilé à un vécu ; un événement simplement passé n’est pas automatiquement réalisé. La météo et les phases lunaires existantes peuvent rester secondaires, sans nouvelle interprétation de santé ou de performance.

### 11.5. Journée détaillée

La vue regroupe les activités, événements, notes et mesures du jour sans fusionner leurs propriétaires. Une activité ouvre son détail, puis son édition dans le formulaire commun. Une action d’ajout depuis la journée garde la date et le contexte.

Un état de chargement partiel ne transforme pas les données manquantes en journée vide. Une sauvegarde met à jour la journée, la fenêtre, le calendrier et les modules dépendants sans rechargement destructeur.

### 11.6. FLOW depuis HOME

Conserver la carte complète. Son repli visuel éventuel est une préférence, pas une suppression. L’action « Compléter mon ressenti » depuis une activité ouvre directement la section appropriée du formulaire unique.

**Acceptation :** un utilisateur peut consulter aujourd’hui, ajouter une activité et retrouver un jour passé sans parcourir obligatoirement tous les modules.

---

## 12. Formulaire unique d’un Moment

### 12.1. Principe

Un seul formulaire pour créer ou modifier une activité personnelle ; une seule validation finale. Les points d’entrée depuis HOME, le Journal, FLOW ou YOU appellent ce même composant.

Les activités sportives, les pratiques de bien-être et les aventures restent possibles. Le formulaire ne transforme pas chaque expérience en fiche d’entraînement.

### 12.2. Nature et sens du Moment

Demander d’abord ce qui a été fait : randonnée, trail, vélo, massage, méditation ou autre pratique disponible. Un sélecteur recherché met en avant les pratiques de la personne et conserve un accès au catalogue complet.

Ajouter des qualificatifs facultatifs de vécu, notamment « Aventure », « Avec des proches » et « Découverte ». Ils sont cumulables et ne créent pas de copie de l’activité.

La catégorie technique existante peut être dérivée du référentiel pour préserver les compatibilités. Les données anciennes ne sont pas reclassées en masse à partir d’un texte libre. Une aventure sans discipline identifiable reste enregistrable ; son admissibilité à la charge est alors indéterminée jusqu’à choix explicite d’une nature pertinente.

### 12.3. Champs essentiels

Afficher en premier la nature, la date, l’heure facultative, le statut et une durée lorsque pertinente. La durée peut rester absente pour un souvenir non mesuré ; elle est signalée comme nécessaire au calcul de charge d’une pratique admissible, sans bloquer l’enregistrement de la trace.

Pour un nouveau Moment du passé ou du jour, proposer « Réalisé » ; pour une date future, proposer « Prévu ». Un futur ne peut pas être enregistré comme réalisé sans correction explicite de la date. À la modification, préserver le statut existant.

Distance, dénivelé, fréquence cardiaque et autres mesures s’affichent selon la pratique ou les données importées. Une distance n’est pas exigée pour un massage ; une fréquence cardiaque absente reste absente.

### 12.4. Saisie progressive

Après les informations essentielles, afficher une section facultative « Comment as-tu vécu ce Moment ? », puis les sections Photos et souvenirs, Mesures et détails, Matériel, Nutrition et paramètres de visibilité lorsqu’ils s’appliquent.

Les sections renseignées restent facilement identifiables après repli. L’utilisateur peut enregistrer sans les ouvrir. Une activité simple ne nécessite pas de répondre à tous les champs possibles.

### 12.5. Effort physique et FLOW

Conserver les trois axes existants : effort physique, défi et maîtrise. « Effort physique : Facile — Maximal » est la formulation de référence du RPE.

Les contrôles affichent un état « Non renseigné » tant que la personne n’a pas répondu. La position graphique initiale d’un curseur ne constitue pas une réponse. Aucun `default 5`, aucune conversion implicite de chaîne vide et aucune valeur persistée sans action explicite.

Une commande permet d’effacer une réponse pour revenir à null. Effacer le RPE ne supprime pas le souvenir ; effacer un des deux axes FLOW retire le point de la carte sans supprimer les autres données.

Pour une pratique non admissible à la charge, la question de l’effort peut être masquée ou rendue non pertinente ; elle ne déclenche jamais une charge sportive par défaut. Défi et maîtrise restent facultatifs et disponibles si la personne souhaite les utiliser.

### 12.6. Souvenir et médias

Réutiliser le champ existant `retained_memory` et les médias existants. La question de référence est « Qu’est-ce que tu retiens de ce Moment ? ». Le texte reste facultatif, modifiable, privé par défaut et limité conformément aux contraintes du stockage existant, actuellement 2 000 caractères pour ce champ.

Les photos, légendes et choix de souvenir marquant sont ajoutés au même Moment. Une photo ne doit pas être rendue publique par l’ajout du qualificatif « Avec des proches ».

### 12.7. Durées

Utiliser partout le composant commun. `1:20` signifie une heure et vingt minutes dans un champ de durée d’activité, pas 1,2 heure. Le format attendu est indiqué lorsqu’il pourrait être ambigu.

La saisie au clavier et la sélection tactile fonctionnent. Le stockage conserve une unité canonique documentée ; les conversions s’effectuent à une seule frontière. Ne pas arrondir les secondes importées avant les calculs.

### 12.8. Import au début du parcours

La zone FIT/GPX reste immédiatement accessible. Après import, montrer les champs reconnus et leur provenance. L’utilisateur peut corriger avant validation. Une deuxième importation dans un formulaire déjà modifié demande confirmation des remplacements, sans écraser une saisie silencieusement.

### 12.9. Sauvegarde et conflits

Une validation écrit l’activité et les données structurées associées de manière atomique lorsqu’elles relèvent de la même base. Les téléversements de fichiers sont préparés séparément puis rattachés ; les fichiers orphelins sont nettoyés.

Si une opération ne peut pas être atomique, elle est orchestrée et idempotente. Un échec de photo ou de nutrition ne doit pas donner un message global « Tout est enregistré ». Indiquer précisément ce qui a été enregistré et proposer de reprendre uniquement l’étape manquante.

La fermeture d’un formulaire modifié demande confirmation. Les réponses d’une ancienne requête ne remplacent pas le contenu d’un formulaire plus récent. Une édition concurrente détectée ne doit pas écraser silencieusement les dernières modifications.

### 12.10. Nutrition imbriquée

Depuis le formulaire, la fenêtre de ravitaillement prépare un brouillon. Sa commande est « Appliquer au Moment », pas une seconde création de l’activité. La validation principale du Moment demeure la référence de persistance.

**Acceptation :** une activité, son RPE, son ressenti et ses compléments restent un ensemble cohérent ; aucun retour d’une fenêtre secondaire ne crée de doublon ou n’efface une réponse.

---

## 13. Imports FIT/GPX, provenance et doublons

### 13.1. Périmètre

Conserver le parcours FIT/GPX existant et ses données reconnues. Ce chapitre fiabilise l’import ; il ne demande pas de réécrire tout le parseur ou de prendre en charge l’ensemble des champs d’un format sportif.

### 13.2. Étapes visibles

L’import passe par des états explicites : fichier sélectionné, lecture, analyse, données reconnues, vérification utilisateur, enregistrement et terminé. Une erreur indique l’étape et une action de reprise.

Distinguer fichier non reconnu, fichier corrompu, données incomplètes, format pris en charge partiellement, échec réseau et échec de stockage. Une donnée partielle exploitable peut être conservée avec un avertissement ; un fichier inexploitable ne produit pas une séance de zéro kilomètre et zéro minute.

### 13.3. Préremplissage

Préremplir les valeurs réellement disponibles : date, heure, pratique, durée et mesures prises en charge. Signaler les informations manquantes sans supposer une fréquence cardiaque, un dénivelé ou un effort.

Une valeur corrigée par l’utilisateur garde sa provenance « modifiée manuellement ». L’original importé reste consultable dans les données source, sans être nécessairement affiché partout.

### 13.4. Dates, heures et fuseaux

Conserver l’instant source quand il existe, le fuseau lorsqu’il est disponible et la représentation locale utilisée dans MOMENTUM. À défaut de fuseau source, utiliser une règle documentée liée au compte et signaler l’hypothèse dans le détail d’import.

Ne jamais convertir une date sans heure en minuit UTC comme s’il s’agissait d’un instant exact. Une heure absente reste absente. Les anciennes activités avec date et heure locale ne subissent pas une conversion massive non vérifiée.

Le préremplissage de l’heure de départ demeure obligatoire lorsque le fichier fournit une information exploitable. Tester les activités autour de minuit, les changements de fuseau et les changements d’heure Europe/Zurich.

### 13.5. Durées distinctes

Préserver, lorsqu’elles existent, la durée écoulée, la durée du chronomètre d’activité et la durée en mouvement. Ne pas les renommer les unes pour les autres.

Pour la charge, la durée d’effort suit la règle du chapitre 15. Pour le ravitaillement horaire, la durée écoulée suit la règle du chapitre 19. Les affichages expliquent la base utilisée.

### 13.6. Source de l’effort

Une fréquence cardiaque ou une charge fournie par un appareil ne devient jamais automatiquement un RPE. Un effort explicitement déclaré et importé ne peut alimenter `activities.rpe` que si la signification et la conversion du champ source sont documentées.

Une valeur déjà corrigée manuellement ne doit pas être écrasée par une resynchronisation. Le champ éventuellement nommé « flow » dans une donnée fournisseur ne doit pas être assimilé au FLOW déclaré dans MOMENTUM.

### 13.7. Détection exacte

Calculer une empreinte du fichier et associer la demande à un identifiant d’opération. L’unicité est contrôlée côté serveur ou base pour l’utilisateur concerné ; un contrôle visuel local seul est insuffisant.

Deux imports concurrents du même fichier ne créent pas deux activités. Réimporter un fichier déjà associé à une activité propose « Ouvrir l’activité existante » et, si pertinent, un parcours explicite de mise à jour sans supprimer les enrichissements personnels.

Le système ne révèle jamais qu’un autre utilisateur possède le même fichier.

### 13.8. Doublon probable

Pour des fichiers différents représentant potentiellement la même séance, comparer la pratique, l’heure de départ connue, la durée et la distance. Les tolérances sont documentées et couvertes par des jeux de tests ; aucune fusion automatique n’est autorisée sur une simple proximité de date ou de distance.

Présenter côte à côte le nouvel import et l’activité candidate. Permettre de conserver l’existant, d’enrichir explicitement certaines données, ou de confirmer qu’il s’agit d’une autre séance. Une absence d’heure précise augmente l’incertitude au lieu d’autoriser un rapprochement automatique.

### 13.9. Enrichissement et reprise

Une mise à jour ne remplace pas les souvenirs, photos, RPE, axes FLOW ou quantités consommées sans décision explicite. La reprise après coupure ne recrée pas l’activité déjà enregistrée.

Les activités multisport et les segments d’un même fichier conservent des liens de parenté lorsque le parseur les fournit. Aucun parent et ses segments ne sont additionnés simultanément comme plusieurs séances complètes.

### 13.10. Provenance accessible

Dans le détail du Moment, afficher source, date d’import, valeurs modifiées et éventuelles limites. Une source absente est « Origine non documentée », pas « Import automatique ».

**Acceptation :** l’utilisateur sait ce qui a été reconnu et enregistré ; une reprise ou un double clic ne crée pas de doublon ; les données personnelles ajoutées après import survivent à une mise à jour.

---

## 14. FLOW et expression du ressenti

### 14.1. Carte conservée

Conserver les neuf zones et les seuils actuels de classification. Défi et maîtrise sont les deux seules coordonnées d’un point. Le poids, le RPE, la météo, le dénivelé et la charge ne déplacent pas ce point.

La carte est décrite comme « un repère de ton expérience déclarée ». Ne pas écrire qu’elle mesure ou certifie un état psychologique.

### 14.2. Saisie et absence de réponse

Un point nécessite un défi et une maîtrise explicitement renseignés. Une activité dépourvue d’un axe n’apparaît pas artificiellement au centre de la carte.

L’absence de point ne vaut ni manque d’engagement ni mauvais ressenti. L’activité reste visible dans le Journal. Proposer « Compléter mon ressenti » sans relance insistante.

### 14.3. Accès contextuel

Depuis une activité, ouvrir la section ressenti du formulaire commun. Après validation, actualiser le point et son détail. Aucun popup FLOW supplémentaire ni deuxième confirmation du même effort.

### 14.4. Ton et équilibre

Ne pas présenter la zone FLOW comme l’unique destination souhaitable. Récupérer, pratiquer une routine ou vivre un Moment détendu ne constitue pas un échec. Les états vides, couleurs et messages ne doivent pas introduire une hiérarchie morale absente des données.

### 14.5. Carte et détail

Conserver les périodes existantes et le filtrage des seules expériences éligibles à l’affichage. La sélection d’un point affiche l’activité, les deux réponses, le souvenir éventuel et les éléments de contexte disponibles, avec leur provenance.

Prévoir la sélection clavier et une liste alternative des activités lorsque plusieurs points se superposent. Les points agrégés indiquent leur nombre et s’ouvrent sans dépendre d’un survol précis.

### 14.6. Contexte de charge

Le contexte calculé utilise le moteur du chapitre 15, sa version et ses indicateurs de couverture. Une limite d’historique ou une activité non calculable y reste visible. Les anciens contextes stockés ne sont pas utilisés comme résultats actuels sans contrôle de version.

**Acceptation :** modifier le défi ne change pas le RPE ; modifier le RPE ne déplace pas le point ; l’activité sans ressenti reste pleinement utilisable.

---

## 15. Moteur commun de charge et qualité des données

### 15.1. Décision de cette phase

Créer ou extraire un module unique de calcul partagé par Progression, le contexte FLOW et tout futur consommateur. Son nom physique est libre, par exemple `js/momentum-training-load.js`, mais sa logique ne doit pas être dupliquée.

Le modèle cible est une **convention de suivi des activités renseignées**, pas une mesure de fatigue réelle ou de récupération. La formule simple existante est conservée pour limiter le changement de convention ; ses entrées, exclusions et limites sont corrigées.

Le moteur ne calcule pas une charge fournisseur, un TSS ou un équivalent physiologique garanti. Employer « unités MOMENTUM » dans la définition. Les anciens sigles CTL/ATL/TSB peuvent rester dans l’aide technique, pas comme promesse d’interchangeabilité entre plateformes.

### 15.2. Contrat d’entrée

Une activité normalisée porte au minimum son identifiant, sa date locale de référence, son propriétaire, son statut, sa pratique, ses durées et leur provenance, son RPE éventuellement null, l’origine de ce RPE et sa règle d’admissibilité.

Les paramètres incluent une date de calcul explicite, une version du modèle, le début d’historique utilisé et la preuve que les pages de données requises ont toutes été chargées.

Le moteur est déterministe. Les tests injectent la date du jour ; ils ne dépendent pas de l’horloge de l’ordinateur ou d’un appel réseau.

### 15.3. Admissibilité explicite

Le référentiel des pratiques associe chaque pratique à l’un des états `eligible`, `excluded` ou `undetermined`. Cette classification est une règle produit versionnée, non une déduction à partir d’un nom contenant un mot.

| Exemple | Règle de cette phase | Conséquence |
|---|---|---|
| Course, trail, vélo, natation, randonnée active, renforcement | Admissible | Calcul si durée et effort sont disponibles. |
| Massage, méditation, soin passif, cryothérapie | Exclue | Temps de Moment conservé, aucune charge d’entraînement. |
| Pratique mixte dont l’intensité dépend du type choisi, par exemple yoga ou mobilité | À préciser dans le référentiel | Variante clairement active admissible ; variante passive exclue ; sinon indéterminée. |
| Aventure sans nature physique identifiée, pratique inconnue | Indéterminée | Aucun calcul implicite ; explication dans la qualité des données. |

Ne pas exclure globalement toutes les activités de la catégorie Bien-être. Ne pas inclure globalement toutes les activités de la catégorie Aventure. Le type de pratique est déterminant.

Une entrée exclue n’est pas une donnée manquante. Une entrée indéterminée en est une pour la couverture de charge et doit être identifiable.

### 15.4. Règle d’une activité

Pour une activité réalisée, admissible et exploitable :

```text
charge_activité = durée_effort_en_minutes × effort_physique / 6
```

L’effort physique est explicitement renseigné par un entier entre 1 et 10. La durée est strictement positive. Le facteur 6 est conservé comme convention interne de normalisation ; aucun commentaire ne le présente comme une conversion physiologique universelle.

Les calculs conservent leur précision interne. L’arrondi intervient uniquement à l’affichage. Une activité prévue, annulée, dupliquée ou non personnelle n’alimente pas la somme.

### 15.5. Durée de référence

Utiliser d’abord la durée de chronomètre/effort explicitement disponible. À défaut, utiliser la durée saisie ou importée actuellement stockée dans `duration_min` et indiquer ce repli. Ne pas prendre silencieusement la durée écoulée lorsqu’une durée d’effort est connue.

Ne pas reconstituer arbitrairement les pauses absentes. Un changement manuel de durée recalcule la charge et conserve le lien avec la donnée source originale.

### 15.6. Valeurs absentes, invalides et historiques

RPE absent : `charge_activité = null`, statut `missing_rpe`. Durée absente : `null`, statut `missing_duration`. Valeur invalide : `null`, statut `invalid_input`. Pratique inconnue : `null`, statut `undetermined_type`. Pratique exclue : statut `excluded` et absence de contribution.

Les chaînes vides, zéros invalides, valeurs non numériques ou hors plage ne sont pas rabattus vers 5, 1 ou 10 pour produire une courbe. Le formulaire doit les empêcher ; les anciennes données restent signalées et corrigeables.

Ne jamais remplacer massivement les RPE historiques égaux à 5 par null : certains peuvent être des réponses authentiques. Lorsque l’origine n’est pas documentée, conserver la valeur historique et afficher ce statut. Une confirmation ultérieure de l’utilisateur améliore la provenance sans effacer l’historique.

### 15.7. Agrégation quotidienne et sens du zéro

Pour chaque jour, produire séparément : somme des charges calculables, nombre d’activités admissibles, nombre calculable, identifiants non calculables, raisons d’exclusion, provenance et état de chargement des données.

`known_load` est la somme des activités calculables. `complete_recorded_load` n’est renseignée que si toutes les activités admissibles enregistrées ce jour sont exploitables, qu’aucune pratique de statut indéterminé ne subsiste et que les données ont été chargées entièrement. Un jour avec un RPE manquant a donc une charge complète inconnue, même si sa somme connue vaut zéro.

Un jour dont la requête complète ne renvoie aucune activité est « aucune activité enregistrée ». Ce n’est pas une preuve que la personne s’est reposée. Un échec de requête est une erreur de données, jamais une journée à zéro.

### 15.8. Initialisation et séries de suivi

**Arbitrage explicite :** ne plus injecter quotidiennement une estimation dérivée du Passeport dans les charges. Initialiser les deux filtres à zéro au début de l’historique utilisé, comme convention de calcul, sans prétendre que la personne était sans entraînement avant cette date.

Le début de calcul ne change pas lorsque l’utilisateur change la période affichée. Il correspond à la première date pertinente de l’historique chargé, incluant une activité admissible ou indéterminée même si sa charge ne peut pas encore être calculée, et non au début de la semaine sélectionnée. Ne pas sauter les premières activités non calculables pour masquer une lacune.

Tant qu’aucune activité n’a une charge calculable dans cet historique, ne pas afficher une courbe plate ni des chiffres personnels tirés de l’initialisation à zéro : afficher « Pas encore de charge calculable » et la liste des données éventuellement manquantes.

Les séries des charges renseignées suivent :

```text
chronique[d] = chronique[d-1] + (known_load[d] - chronique[d-1]) / 42
récente[d]   = récente[d-1]   + (known_load[d] - récente[d-1])   / 7
équilibre[d] = chronique[d] - récente[d]
```

Ces séries décrivent uniquement les charges connues et enregistrées. Une activité non calculable n’est pas transformée en effort nul : elle reste présente dans le contrat de qualité et invalide toute présentation de la série comme complète.

Lorsqu’une lacune d’entrée affecte le calcul, marquer les séries comme partielles à partir de cette date tant que la lacune n’a pas été corrigée dans l’historique utilisé. Ne pas déclarer la disparition de cette incertitude après un délai arbitraire. Les valeurs partielles sont distinguées visuellement et aucun commentaire de forme favorable n’en est déduit.

En cas d’historique non chargé intégralement ou d’erreur réseau, ne pas recalculer une nouvelle série sur un extrait accidentel. Conserver éventuellement le dernier résultat explicitement daté avec un état d’erreur, ou afficher l’indisponibilité.

### 15.9. Pas de promesse automatique après 42 jours

Afficher « Historique utilisé : depuis le … » et le nombre de jours disponibles. Expliquer que les filtres restent influencés par leur initialisation et que des activités peuvent ne pas avoir été enregistrées.

Le nombre de jours n’est pas une confiance clinique. Ne pas afficher « 100 % personnalisé », « entièrement fiable » ou « ton corps est disponible » sur la seule base de jours et de séances comptés.

### 15.10. Présentation de la couverture

Pour la période, afficher par exemple « 8 activités calculables sur 10 admissibles ; 2 efforts manquants ». Distinguer également les pratiques indéterminées et l’origine non documentée de valeurs historiques.

Un éventuel pourcentage est nommé « Part des activités renseignées » et son dénominateur est indiqué. Il ne s’appelle pas « confiance » et n’inclut pas les massages exclus comme des échecs de saisie.

Un lien « Voir les données à compléter » ouvre les activités concernées. L’utilisateur reste libre de ne pas renseigner son effort.

### 15.11. Messages et vocabulaire

Conserver le titre de module « Charge & forme » pour la continuité, mais préciser dans le sous-titre « Repères calculés à partir de tes activités renseignées ». Employer de préférence « Charge récente » plutôt que « Fatigue » seule, et « Équilibre de charge » plutôt que « Forme actuelle » seule.

Supprimer les recommandations fondées uniquement sur des seuils absolus de cette unité interne. Les premiers messages sont factuels : période, volume de charge renseigné, différence entre période et historique, présence de données incomplètes.

Un message acceptable est : « Ta charge récente renseignée est inférieure à ton niveau chronique calculé. Ce repère ne décrit pas à lui seul ta récupération. » Il n’est affiché que si les données et la période permettent réellement cette comparaison.

### 15.12. Périodes, repos et futur

Une semaine sans activité dans la sélection reste consultable lorsque l’historique permet d’afficher les séries. Ne pas masquer le graphique uniquement parce que la sélection ne contient aucune nouvelle séance.

Le modèle s’arrête à la date de calcul. Dans une semaine ou un mois en cours, les jours futurs restent hors mesure ; ne pas les traiter comme une succession de jours de repos ou une prévision de fraîcheur.

Les valeurs résumées respectent la période sélectionnée. Des chiffres « Aujourd’hui » peuvent être affichés séparément avec ce libellé, mais ne remplacent pas ceux d’une période ancienne sans explication.

### 15.13. Versionnement et mise à jour

Retourner version, date de calcul, période source, qualité et unités avec chaque résultat. Recalculer après import, modification d’effort, de durée, de pratique, de statut, suppression ou correction d’un doublon.

Les contextes FLOW utilisent exactement les mêmes résultats à date égale et historique égal. Les caches portent la version du modèle et de l’historique. Une bascule de modèle invalide les caches concernés.

Les données brutes et réponses ne changent pas lors d’une correction de calcul. Les anciens résultats conservés pour traçabilité sont identifiés « ancien modèle » ; ils ne sont pas mélangés avec les nouveaux.

### 15.14. Tests de référence minimaux

Une séance de 60 minutes avec effort 6 donne 60 unités. Deux séances admissibles de 30 minutes avec effort 6 donnent la même somme connue quotidienne. Un massage de 60 minutes ne contribue pas à cette charge.

Une séance de 60 minutes sans effort retourne null pour sa charge et une raison explicite. Avec une séance renseignée et une autre inconnue, la somme connue et la somme complète sont différentes dans le contrat.

À historique identique, les résultats de FLOW et Progression sont identiques avant arrondi. Changer uniquement la période affichée ne modifie pas les résultats d’une journée commune aux deux sélections.

---

## 16. Progression et lecture croisée des graphiques

### 16.1. Structure conservée

Conserver les deux groupes : « Ton activité » avec Volume et Répartition ; « Ton équilibre » avec Charge & forme et Bien-être. Ne pas retourner à quatre graphiques isolés sans relation visuelle.

### 16.2. Proportions

Une asymétrie reste admise pour Volume et Répartition. Pour Charge et Bien-être, viser une largeur équivalente sur les écrans permettant réellement la comparaison.

À largeur intermédiaire, préférer des cartes superposées lisibles plutôt que deux graphiques étroits. Les titres, contrôles et unités ne doivent pas occuper l’essentiel de la hauteur disponible au détriment des données.

### 16.3. Périodes

Présenter dans cet ordre : « 7 derniers jours », « Semaine en cours », « 4 dernières semaines », « Mois en cours », « Personnalisé ».

Pour un compte sans préférence explicite, sélectionner les 7 derniers jours, aujourd’hui inclus. Conserver la préférence existante des comptes qui l’ont choisie. Après un déplacement vers une ancienne semaine ou un ancien mois, afficher « Semaine du … » ou « Mois de … », pas « en cours ».

La fenêtre de 4 semaines contient 28 jours. Les semaines calendaires commencent le lundi. Les dates de début et de fin sont affichées, y compris l’année lorsque nécessaire.

### 16.4. Flèches et granularité

Les flèches déplacent les périodes glissantes d’une fenêtre complète, les semaines d’une semaine et les mois d’un mois. Elles sont désactivées pour la période personnalisée dans cette phase ; un message accessible explique ce comportement si nécessaire.

Conserver la granularité adaptative existante : jour jusqu’à 14 jours, semaine jusqu’à 120 jours, mois au-delà. Les périodes partielles aux extrémités sont identifiables ; ne pas compter les jours extérieurs à la sélection.

### 16.5. Indicateurs supérieurs

Afficher uniquement des valeurs correspondant au périmètre et à la sélection. Préférer « Moments réalisés », « Temps d’activité », « Distance enregistrée » et « Jours avec une activité » aux libellés ambigus.

Une mesure sans valeur disponible affiche « Non renseigné ». Un nombre d’activités peut être connu alors que leur durée totale est partielle : conserver le compteur exact et signaler la couverture de la durée.

Ne pas additionner les mesures quotidiennes de sommeil comme du temps d’activité. Le temps de massage reste possible dans le volume général, mais n’est pas compté comme entraînement.

### 16.6. Volume et répartition

Renommer « Répartition sportive » en « Répartition des activités » lorsque le temps inclut le bien-être. Le mode Temps utilise les durées des activités ; le mode Distance ne comprend que les activités ayant une distance exploitable.

La légende doit expliquer l’exclusion des pratiques sans distance, sans les présenter comme disparues du Journal. Le total des barres doit correspondre au total indiqué pour le même périmètre.

La distance multisport est un fait descriptif, pas un indice de difficulté comparable entre disciplines. Un changement de mode ne modifie pas les activités enregistrées.

### 16.7. Charge et bien-être à date commune

Créer un état de sélection de date commun. Un clic ou une sélection clavier dans un des deux graphiques met en évidence la même journée dans l’autre, lorsque cette journée appartient à la période.

En granularité semaine ou mois, sélectionner d’abord la période agrégée, puis permettre de choisir un jour dans le détail. Ne pas présenter une moyenne de semaine comme la mesure d’un jour précis.

Sur mobile, une ligne de date sélectionnée et les deux résumés permettent la comparaison sans juxtaposition forcée. Les échelles restent propres à chaque mesure ; aucun axe unique ne mélange bpm, millisecondes et unités de charge.

### 16.8. Interprétation prudente

La proximité visuelle n’implique pas une causalité. Ne pas écrire « ton entraînement a dégradé ton sommeil » à partir de deux courbes. Présenter « Charge et bien-être sur la même période » et laisser consulter le contexte déclaré.

### 16.9. Qualité et tableaux

Tous les graphiques possèdent une table accessible ou une liste équivalente, les unités, la période et la définition de leur agrégation. Les valeurs partielles, absentes ou calculées sont distinguées dans le tableau comme dans le graphique.

Les courbes de bien-être ne relient pas silencieusement les points à travers des jours non renseignés. Les indicateurs de couverture de charge viennent du moteur unique.

### 16.10. Résumé et conservation d’état

La synthèse de période du chapitre 24 est située près des données, sans nouveau tableau de bord. Les préférences de mode, période et indicateur de bien-être sont mémorisées par compte.

Une requête ancienne terminant après une requête récente ne remplace pas les graphiques de la nouvelle période. Les erreurs proposent de réessayer sans réinitialiser arbitrairement les filtres.

---

## 17. Bien-être et annotations de contexte

### 17.1. Deux notions distinctes

Séparer les **activités de bien-être**, comme un massage, des **observations quotidiennes**, comme le sommeil, la motivation ou une fréquence cardiaque au repos. Leur affichage peut être rapproché, leur calcul ne doit pas être confondu.

### 17.2. Sources quotidiennes

Documenter la règle de rapprochement entre les tables et champs déjà utilisés, notamment `daily_wellbeing` et les observations historiques de `days`. Ne pas créer une troisième source concurrente sans nécessité démontrée.

En cas de deux valeurs pour la même mesure et la même date, une correction explicitement choisie par l’utilisateur prime pour l’affichage. À défaut, utiliser la source explicitement préférée par l’utilisateur ; en l’absence de ce choix, préférer le champ quotidien dédié de `daily_wellbeing`, puis le champ historique de `days` en repli. Pour une même source et une même mesure, la dernière correction explicite horodatée prime. Montrer l’origine et conserver les données alternatives. Ne pas moyenner arbitrairement deux méthodes ou deux moments de mesure ; des méthodes non comparables restent séparées.

### 17.3. Données manquantes

Une absence de mesure est null. Un mauvais chargement est un état d’erreur. Une journée sans sommeil renseigné n’est pas une nuit de zéro heure.

Les scores, agrégats ou moyennes existants doivent documenter leur formule, leurs entrées et leur couverture. Si une synthèse ne peut pas être calculée correctement, afficher les mesures disponibles plutôt qu’un score fabriqué. Aucun nouveau score de bien-être n’est créé dans ce CDC.

### 17.4. Annotations explicites

Les événements de contexte tels que maladie, vacances ou compétition sont issus d’un choix explicite de l’utilisateur ou d’un champ structuré fiable. Arrêter l’attribution automatique définitive par recherche de mots dans les notes.

Une suggestion éventuelle reste à confirmer. La phrase « Je ne suis pas malade » ne doit jamais créer une annotation Maladie. Le statut de santé déclaré reste privé et n’apparaît pas dans l’aperçu d’une invitation.

### 17.5. Interactions

L’ouverture d’une journée depuis Progression ou HOME mène aux mêmes données et au même parcours d’édition. Une modification se répercute partout. Les profils de référence de YOU ne sont pas écrasés par une mesure quotidienne ponctuelle.

---

## 18. YOU, Mon Horizon et Mon Chemin

### 18.1. Nouvelle entrée personnelle

YOU s’ouvre, sans lien profond, sur un aperçu personnel. Les rubriques existantes restent accessibles et les URL `?section=...` conservées.

La synthèse place d’abord le nom d’usage, la photo, les pratiques, l’intention actuelle et un Moment marquant choisi. Âge, taille et poids restent dans le profil ; ils ne dominent plus la carte d’accueil personnelle.

Ne pas remplacer des mensurations par une nouvelle collection de scores. L’aperçu doit rester calme et lisible.

### 18.2. Mon Horizon

Conserver les objectifs chiffrés et datés déjà disponibles. Ajouter la possibilité d’une intention libre sans distance, échéance ou performance : retrouver une régularité, découvrir des endroits, préparer une aventure ou simplement préserver un temps personnel.

Ne pas attribuer une date fictive à une intention non datée. Le Hero et les cartes adaptent leur formulation lorsqu’il n’y a pas de compte à rebours pertinent.

Une intention peut être modifiée, mise en pause ou archivée sans être qualifiée d’échec. Les anciennes missions restent consultables conformément aux droits existants.

### 18.3. Mon Chemin

Mon Chemin est une présentation du Journal personnel et des traces choisies. Réutiliser les activités, souvenirs et médias existants ; ne pas créer un deuxième stockage concurrent du récit d’une même sortie.

Permettre la consultation chronologique, un filtre simple par pratique ou période et l’affichage des seuls Moments marquants. La vue dispose d’une pagination et d’états vides utiles.

Un Moment marquant résulte d’un choix explicite de la personne, pas de la plus grande distance ou de la fréquence cardiaque la plus élevée.

### 18.4. Mise en avant personnelle

Depuis le détail d’un Moment, proposer « Garder parmi mes Moments marquants ». Permettre de retirer ce marquage sans supprimer l’activité.

L’aperçu YOU présente au maximum une mise en avant principale et un accès à la suite. Si aucun Moment n’a été choisi, afficher une invitation discrète à choisir ; ne pas inventer un souvenir ou choisir une performance à sa place.

### 18.5. Pratiques et matériel

Conserver « Je vis pour » ou un sous-titre explicite de pratiques. Les sports déclarés et les pratiques observées doivent être distingués si l’écran les rapproche. Ne pas faire disparaître une pratique déclarée parce qu’elle n’a pas été enregistrée récemment.

Le matériel reste accessible, avec les liens existants vers les activités. La refonte de YOU ne réinitialise ni équipement, ni préférences, ni données physiologiques.

### 18.6. Mon compte

Regrouper préférences d’affichage, accès, sources réellement disponibles, notifications effectives et données personnelles. Les réglages indisponibles ne sont pas présentés comme actifs.

Les contrôles de langue et d’unités présents sont à vérifier. Une langue ou une unité ne peut être affichée comme appliquée si elle ne change que sa valeur de préférence. Conserver uniquement les options fonctionnelles ou indiquer honnêtement leur indisponibilité ; ne pas lancer une traduction générale implicite dans cette phase.

**Acceptation :** YOU raconte d’abord les pratiques et les intentions ; un utilisateur sans compétition ni mensurations dispose d’une page complète et pertinente.

---

## 19. Nutrition pendant l’activité

### 19.1. Périmètre conservé

Conserver la bibliothèque, les favoris, les catégories, les quantités et les calculs utiles au ravitaillement. Le module reste facultatif et contextuel, sans devenir un journal alimentaire quotidien.

### 19.2. Prévu et consommé

Un Moment prévu peut porter un ravitaillement prévu. Un Moment réalisé peut porter un ravitaillement consommé. Les deux listes restent distinctes dans les données et dans les totaux.

Le passage à « Réalisé » ne valide pas automatiquement que tout a été consommé. Proposer explicitement « Reprendre le prévu comme point de départ », puis permettre l’ajustement. L’utilisateur peut aussi saisir directement le consommé.

Les lignes historiques libellées comme consommées conservent leur sens. Ne pas les dupliquer dans une liste prévue à la migration.

### 19.3. Unités et bases de calcul

Afficher l’unité de chaque produit, sa portion de référence et la quantité. Les incréments existants sont conservés lorsqu’ils conviennent ; une unité ne doit pas changer de sens selon le contexte.

Les valeurs horaires utilisent la durée écoulée de l’activité lorsqu’elle est disponible. À défaut, utiliser la durée disponible en affichant « Calculé sur la durée d’activité disponible ». Permettre une correction explicite de la durée de ravitaillement sans écraser la durée sportive source.

Une durée nulle ou absente donne une valeur horaire non calculable, jamais un infini ou zéro trompeur.

### 19.4. Priorité visuelle

Mettre en premier les produits et quantités, puis les glucides totaux et horaires et le sodium lorsque renseigné. La caféine et les autres nutriments restent consultables sans saturer le résumé.

L’absence d’un nutriment dans la fiche produit signifie « non renseigné », pas nécessairement zéro. Une valeur explicitement nulle reste zéro. Les totaux partiels portent ce statut ; documenter une migration additive si les valeurs historiques ne permettent pas encore de distinguer ces cas.

### 19.5. Instantanés nutritionnels

Conserver les instantanés associés aux consommations historiques. Une mise à jour de la bibliothèque ne modifie pas rétroactivement un ravitaillement enregistré.

Pour une modification de quantité historique, réutiliser l’instantané concerné. Un remplacement de produit ou une révision explicite des valeurs est une nouvelle décision traçable. Le caractère approximatif d’une donnée reste affiché.

### 19.6. Ressenti et apprentissage personnel

Permettre un commentaire facultatif lié au ravitaillement : ce qui a bien fonctionné, ce qui a été difficile, ce que la personne souhaite modifier. Ne pas conclure automatiquement qu’un apport a causé une baisse de performance ou un inconfort.

Pas de dosage médical ou de prescription automatique ajouté dans cette phase. Les comparaisons restent des faits déclarés et enregistrés.

### 19.7. Sauvegarde

Respecter le formulaire parent décrit au chapitre 12. Une indisponibilité de la bibliothèque n’efface pas les produits historiques stockés. L’absence de modification nutritionnelle ne doit pas remplacer un ancien ravitaillement par une liste vide.

---

## 20. TOGETHER et organisation des Moments

### 20.1. Entrée principale

TOGETHER s’ouvre sur les Moments, pas obligatoirement sur le Cercle. Le bouton principal devient « Proposer un Moment ». Cercle, Clubs et Invitations restent accessibles avec leurs fonctions et autorisations existantes.

L’état vide explique : « Une sortie, une rencontre ou une aventure à partager. » L’action principale ouvre le formulaire de création, sans demander d’abord d’inviter quelqu’un dans un réseau.

### 20.2. Création progressive

Demander d’abord un titre, le type, une date ou des créneaux possibles et un lieu éventuellement à définir. La capacité, les participants, la description et les réglages avancés viennent ensuite.

Un brouillon peut être enregistré avec des détails incomplets. Pour publier une invitation, le titre et le mode de choix de date doivent être cohérents. L’absence de lieu peut être affichée « Lieu à préciser », jamais inventée.

Conserver les fonctions existantes de choix de créneaux, de capacité, de visibilité et de Club. Ne pas produire un formulaire parallèle uniquement pour les invités.

### 20.3. Statuts visibles

Distinguer préparation, invitation ouverte, date confirmée, terminé et annulé dans l’interface, en mappant ces états sur les statuts existants plutôt qu’en dupliquant inutilement le modèle.

La réponse d’une personne distingue oui, peut-être, non et attente de réponse. Une réponse non vérifiée ou soumise à validation porte un état supplémentaire explicite.

### 20.4. Capacité et modifications

Le contrôle de capacité est exécuté côté serveur de façon concurrente sûre. Deux réponses simultanées ne prennent pas la dernière place deux fois.

En cas de capacité atteinte, expliquer l’état ; ne pas annoncer une participation confirmée puis la retirer silencieusement. Le créateur peut modifier la capacité, dans le respect des réponses déjà confirmées.

Une modification importante de date ou de lieu est visible pour les invités et réouvre une confirmation lorsque cela change réellement leur engagement. Un système d’e-mail absent ne doit pas faire croire que tout le monde a été prévenu.

### 20.5. Intégration dans HOME

Un Moment collectif apparaît dans le calendrier des utilisateurs autorisés avec sa source et son statut. Il ne compte pas automatiquement dans les totaux sportifs.

Après réalisation, une activité personnelle peut être liée au Moment collectif. Ce lien évite le double affichage trompeur tout en préservant la séparation des données et des droits.

### 20.6. Cercle et Clubs

Les invitations au Cercle restent disponibles comme fonction indépendante. Participer ponctuellement à un Moment n’ajoute pas automatiquement quelqu’un au Cercle ou à un Club.

Conserver les rôles de Club, les validations d’adhésion, les logos et les visibilités existantes. Un invité externe n’obtient pas des droits de membre par le seul partage d’un lien.

### 20.7. Souvenirs collectifs et privés

La note personnelle, le FLOW, le RPE, les mesures de santé et les photos privées de chacun ne sont pas recopiés dans le souvenir collectif. Une publication collective est une action séparée portant sur des éléments sélectionnés.

Aucun fil d’actualité généraliste n’est ajouté. La réussite recherchée est un Moment organisé et retrouvé facilement.

---

## 21. Invitations sans compte

### 21.1. Objectif obligatoire

Permettre à une personne de consulter une invitation autorisée et de répondre ponctuellement sans remplir un Passeport MOMENTUM. L’inscription peut être proposée après réponse, jamais imposée pour lire les informations partagées ou exprimer une disponibilité.

### 21.2. Parcours minimal sans dépendance à un nouvel e-mail

Le créateur génère un lien individuel d’invitation, voit ce que ce lien donne à consulter, puis le partage par copie ou par le mécanisme de partage de l’appareil.

Le destinataire choisit un nom d’usage et répond oui, peut-être ou non. La possession du lien prouve l’accès à l’invitation, **pas l’identité civile du destinataire**. L’interface affiche « Réponse externe à valider » jusqu’à confirmation par l’organisateur.

Cette réponse n’ajoute personne à un annuaire public et ne réserve pas définitivement une place avant validation. À la confirmation, le serveur revérifie la capacité.

Le créateur peut ensuite proposer de conserver le lien dans son Cercle lorsque la personne possède un compte ; ce n’est jamais automatique.

### 21.3. Variante avec identité vérifiée

Lorsque l’authentification ou le service d’e-mail réellement disponible le permet, une réponse peut être rattachée à une adresse vérifiée ou à un compte existant sans onboarding complet. L’état « vérifié » nécessite la preuve correspondante ; une adresse simplement saisie n’est pas vérifiée.

Le CDC ne demande pas d’activer un nouveau fournisseur payant ni d’envoyer des e-mails réels pendant les tests. Le parcours par lien du paragraphe précédent reste utilisable.

### 21.4. Portée du lien

Le lien autorise uniquement la lecture de l’aperçu choisi pour ce Moment et la gestion de la réponse concernée. Aucun accès aux autres événements, au Passeport, aux notes privées, à la liste complète des contacts ou aux activités personnelles.

Par défaut, l’aperçu montre titre, date ou créneaux, lieu autorisé, message de l’organisateur et état de la réponse. La liste nominative des participants est masquée aux externes. Une carte détaillée ou une adresse privée exige un choix explicite de l’organisateur.

### 21.5. Sécurité des jetons

Générer un secret aléatoire suffisamment robuste côté serveur, avec au moins 32 octets d’aléa pour cette implémentation. Ne stocker que son empreinte. Associer invitation, rôle, portée, expiration, révocation et identifiant de réponse.

Échanger le secret contre une session invitée limitée ; éviter son stockage persistant dans le navigateur. Un fragment d’URL peut être utilisé pour l’échange, puis retiré de l’adresse. La requête de lecture initiale et les robots d’aperçu ne doivent ni accepter une invitation ni consommer irréversiblement son lien.

Aucun jeton dans les journaux, événements de mesure ou services tiers. La page d’invitation utilise une politique de référent restrictive et ne charge pas de script publicitaire ou analytique tiers.

### 21.6. Expiration, révocation et reprise

Paramètres produit de départ : expiration au plus tard 30 jours après émission ; pour un Moment daté, expiration possible plus tôt, après la fin plus une courte marge de consultation. L’interface affiche la date exacte. Une invitation pour un événement lointain peut être réémise.

Le créateur peut révoquer ou renouveler le lien. Le renouvellement invalide l’ancien secret sans perdre la réponse historique. Un événement annulé n’accepte plus de nouvelle confirmation.

Le destinataire peut modifier sa réponse tant que son accès et le Moment l’autorisent. Une relecture par un logiciel de messagerie ne vaut pas réponse.

### 21.7. Contrôles serveur

Limiter les tentatives d’échange, de réponse et de génération de liens. Valider origine, session, secret, expiration, statut et capacité. Les messages d’erreur ne révèlent pas l’existence de comptes ou de contacts.

La protection ne repose pas sur l’interface ou sur un UUID difficile à deviner. Un appel direct à l’API reçoit les mêmes contrôles.

### 21.8. Recette et publication

Tester avec deux comptes de démonstration et un invité sans compte. Ne partager aucun vrai lien avec des proches sans action explicite du commanditaire. Les nouveaux accès invités ne sont activés qu’après recette des autorisations.

**Acceptation :** un externe répond sans Passeport ; il ne voit que l’aperçu autorisé ; l’organisateur sait si la réponse est vérifiée ou à valider ; révocation et capacité fonctionnent côté serveur.

---

## 22. Services connectés et notifications

### 22.1. Correction des faux états

Dans le code de référence, certaines cases de YOU enregistrent des booléens de sources. Ces préférences ne doivent pas être présentées comme la preuve d’un OAuth, d’une autorisation fournisseur ou d’une synchronisation réussie.

Remplacer les simples interrupteurs ambigus par une fiche de source. Conserver les déclarations historiques comme telles sans les convertir en connexion active.

### 22.2. États de connexion

Distinguer : non disponible ; import manuel possible ; non connecté ; connexion en cours ; autorisation obtenue ; import en cours ; dernière synchronisation réussie ; erreur ; autorisation expirée ou révoquée.

Une date de dernière synchronisation provient d’un succès réel. Une autorisation accordée sans import réussi n’est pas « synchronisé ». Aucun nombre de nouvelles activités n’est inventé.

### 22.3. Contrat d’un futur connecteur

Prévoir une interface commune : identité de source, autorisations accordées, identifiant externe stable, date d’import, statut de synchronisation et erreurs. Les activités suivent les mêmes règles de provenance, doublons et priorité des corrections manuelles que l’import de fichier.

Les secrets restent côté serveur. La révocation coupe l’accès futur sans supprimer automatiquement l’historique déjà importé ; l’utilisateur dispose d’une action distincte pour ses données.

### 22.4. Parcours de repli

Lorsque le connecteur n’est pas disponible, afficher honnêtement « Synchronisation non disponible dans cette version » et l’action FIT/GPX adaptée. Ne pas laisser un bouton « Connecter » qui ne fait qu’enregistrer une préférence.

Une éventuelle connexion future à COROS, Garmin, Strava, WHOOP ou autre fournisseur nécessite une vérification séparée des accès et conditions. Aucune autorisation n’est réputée acquise par ce document.

### 22.5. Notifications

Les réglages d’e-mail, push ou rappels reflètent une capacité réellement opérationnelle. Si une capacité n’est pas disponible, indiquer cet état et ne pas simuler une activation réussie.

Demander une permission de notification uniquement après un choix de l’utilisateur. Les envois transactionnels et les messages facultatifs ont une portée explicite. Aucun rappel sur l’absence de sport ou de ressenti n’est ajouté.

Pour les invitations, distinguer « Lien copié », « Message envoyé au prestataire » et livraison effectivement confirmée si cette information existe. Le système ne promet pas que le destinataire a lu le message.

---

## 23. Confidentialité, partage, export et suppression

### 23.1. Principe de visibilité

Les données personnelles sont privées par défaut. Prévoir une visibilité claire au niveau de l’objet et une sélection des éléments publiés. Les permissions effectives doivent être contrôlées en base et côté serveur.

Le partage d’un Moment collectif ne partage pas automatiquement l’activité personnelle liée. Le qualificatif « Avec des proches » n’accorde aucun droit. Un changement de Cercle ou de Club ne rend pas soudain publiques les notes personnelles.

### 23.2. Aperçu avant partage

Avant de produire un lien ou de publier un souvenir, montrer « Qui pourra voir ceci ? » et un aperçu des champs inclus. Les localisations précises, photos et textes personnels sont explicitement contrôlés.

Les réponses de santé, le RPE et les axes FLOW ne sont jamais inclus par défaut. Une visibilité ne doit pas dépendre uniquement d’une couleur de badge.

### 23.3. Accès aux fichiers

Les originaux personnels restent dans des espaces privés. Les accès temporaires sont limités et révocables. Un objet de stockage n’est pas public pour simplifier une miniature.

Les règles vérifient propriétaire, rattachement de l’activité et autorisation de partage. Tester les identifiants devinés et les URL directes. Ne jamais utiliser les données du propriétaire envoyées par le client comme seule autorisation.

### 23.4. Export complet et explicite

Conserver l’action « Exporter mes données », mais ne plus la construire seulement à partir de l’état de YOU chargé en mémoire. Dans la référence consultée, ces activités sont limitées à une sélection de champs et à une fenêtre de dates ; cela ne constitue pas un export complet.

Créer un export paginé et authentifié de l’ensemble des données personnelles prises en charge : profil, réglages, pratiques, équipement, activités de toutes dates, sources, réponses FLOW, souvenirs, mesures quotidiennes, ravitaillement prévu et consommé, instantanés, médias et éléments collectifs appartenant à l’utilisateur dans la limite des droits des autres personnes.

### 23.5. Format d’export

Le socle est un JSON versionné avec date de génération, fuseau de référence, schéma, unités, compteurs par type et manifeste. Les médias et fichiers source peuvent être proposés dans une archive séparant données structurées et fichiers, mais l’interface doit expliquer exactement ce qui est inclus dans l’option choisie.

Un export sans médias peut être nommé « Données structurées ». Un export annoncé comme complet inclut ou rend récupérables les fichiers autorisés et signale toute omission. Les références aux autres participants se limitent aux informations nécessaires et autorisées, pas à leurs données privées.

Les secrets, jetons OAuth, liens d’invitation actifs et clés techniques ne sont jamais exportés.

### 23.6. Volume et erreurs d’export

Paginer jusqu’à la fin réelle, y compris au-delà de 1 000 activités. Stabiliser l’ordre et le périmètre de l’export pour éviter doublons ou omissions pendant une édition concurrente.

Une interruption donne un échec ou un export explicitement partiel, jamais un fichier annoncé complet. Le manifeste indique le nombre d’objets exportés et les éventuelles exclusions. Le téléchargement temporaire est limité au compte et expire.

### 23.7. Suppression d’un élément

Prévoir la suppression d’une activité ou d’un média selon les règles existantes, avec confirmation et impact explicite. La suppression invalide les résumés, liens dérivés, caches, indices de doublons et charges concernés.

Une suppression de média enlève à la fois l’accès métier et l’objet de stockage ou place l’opération dans un nettoyage fiable et traçable. Un message de succès n’est pas donné avant que l’état annoncé soit vrai.

### 23.8. Suppression du compte

Ajouter ou fiabiliser une procédure réelle dans YOU, distincte de la déconnexion. Réauthentifier lorsque nécessaire, expliquer la portée et demander une confirmation explicite.

La suppression doit couvrir les données propres, fichiers, invitations actives et autorisations de connexion. Pour les Moments collectifs et Clubs, définir la conservation minimale, le transfert éventuel ou l’anonymisation nécessaire sans détruire silencieusement les données des autres membres.

Le compte peut être placé dans un état empêchant les nouvelles écritures pendant une opération de nettoyage. Les échecs sont repris de manière idempotente. La suppression de l’identité ne doit pas rendre impossible le nettoyage ultérieur des fichiers.

### 23.9. Transparence et limites

Les textes de confidentialité doivent décrire les prestataires et opérations réellement utilisés. Ne pas promettre un effacement immédiat de toutes les sauvegardes si cela n’est pas vérifié. Toute durée de conservation et limite liée aux sauvegardes doit être exacte et validée avant communication publique.

Ce chapitre fixe des exigences produit et techniques, pas une validation juridique. Les textes légaux sont revus avec le responsable du projet avant ouverture à un public plus large.

---

## 24. Contenu, synthèses et interprétations

### 24.1. Charte de voix

Être humain, précis et encourageant, sans injonction. Conserver une poésie mesurée dans les titres et les transitions. Les commandes, erreurs, unités et règles de calcul restent concrètes.

Ne pas féliciter automatiquement toute hausse de volume, ne pas culpabiliser une absence et ne pas interpréter une pause comme un échec. Une semaine de récupération peut être racontée sans inventer son bénéfice.

### 24.2. Trois niveaux de contenu

| Niveau | Exemple de source | Formulation attendue |
|---|---|---|
| Enregistré | Durée du fichier, distance, heure, produit consommé | « Le fichier indique… », ou valeur avec source accessible. |
| Déclaré | RPE, souvenir, motivation, événement de contexte | « Tu as indiqué… », avec respect des mots de l’utilisateur. |
| Interprété | Règle de synthèse ou hypothèse | « Cela peut suggérer… », uniquement si utile, étayé et clairement présenté comme interprétation. |

Une interprétation ne doit pas être recopiée comme un fait dans le profil. Le système ne déduit pas une émotion, une maladie ou une relation sociale à partir d’un capteur.

### 24.3. Réécritures prescrites

| Formulation à remplacer ou préciser | Cible |
|---|---|
| Ouvrir, dans le fil du jour | Voir ma journée |
| Temps construit | Temps d’activité |
| Volume hebdomadaire, dans la navigation | Volume d’activité |
| Répartition sportive incluant le bien-être | Répartition des activités |
| Forme actuelle sans contexte | Équilibre de charge — repère calculé |
| Fatigue seule pour le filtre récent | Charge récente |
| Confiance / 100 % personnalisé | Historique utilisé et part des activités renseignées |
| Une promesse d’histoire automatique | Une invitation à conserver ou retrouver ce que l’utilisateur a exprimé |
| Après 42 jours, tes données racontent entièrement l’histoire | Tes repères se précisent avec les activités que tu enregistres. |

### 24.4. Synthèse sobre de période

Créer dans Progression un bloc court fondé sur la période choisie. Il contient au maximum un fait vérifiable de volume ou de répartition, une trace marquante choisie par la personne dans cette période lorsqu’elle existe, et une invitation facultative à définir la suite.

Exemple de structure : « 4 Moments réalisés, dont 2 randonnées. » Puis la phrase réellement conservée par l’utilisateur, attribuée à son Moment. Puis « Quel Moment aimerais-tu revivre ? » avec accès à Mon Horizon ou à une nouvelle proposition.

Ce bloc n’invente pas de souvenir s’il n’y en a pas. Il reste pertinent sans modèle génératif et ne devient pas une cinquième page ni un chapitre hebdomadaire autonome.

### 24.5. Mécanisme de synthèse

Utiliser d’abord des règles déterministes et des citations personnelles exactes. Les données de la période, leur couverture et leurs unités doivent être cohérentes avec les graphiques.

Les comparaisons ne portent que sur des périodes comparables. Une semaine commencée depuis deux jours ne doit pas être comparée comme une semaine complète sans indication. Une augmentation n’est pas automatiquement une amélioration.

### 24.6. IA éventuelle

Ne pas ajouter un nouveau fournisseur d’IA pour réaliser cette phase. Si un module d’interprétation existe déjà et est conservé, vérifier consentement, données transmises, provenance, possibilité de correction et absence d’écriture automatique non autorisée.

L’IA ne choisit pas un objectif, ne modifie pas un entraînement et ne publie pas une histoire au nom de l’utilisateur dans le cadre de ce CDC.

### 24.7. Données insuffisantes

Préférer « Ajoute un premier Moment pour commencer ton Journal » à une synthèse générique prétendument personnalisée. En cas de lacune, indiquer ce qui manque et proposer une action facultative, sans modal bloquante.

**Acceptation :** chaque phrase personnalisée peut être reliée à ses données ou à une déclaration ; aucune émotion ou causalité n’a été fabriquée pour remplir une carte.

---

## 25. Données, migrations et compatibilité

### 25.1. Inventaire avant schéma cible

Relever les tables, colonnes, fonctions, contraintes, politiques de sécurité et espaces de stockage réellement utilisés. Comparer la base cible aux migrations du dépôt. Ne pas supposer que l’environnement de test et la production sont alignés.

Le schéma conceptuel ci-dessous définit les besoins. Ingrid adapte les noms physiques pour réutiliser les structures existantes et documente le mapping. Les noms illustratifs ne sont pas une autorisation de créer des tables parallèles sans vérifier l’existant.

### 25.2. Mapping fonctionnel attendu

| Besoin | Réutilisation prioritaire | Évolution à prévoir si nécessaire |
|---|---|---|
| Activité personnelle et effort | `activities`, `activities.rpe` | Provenance de l’effort, qualificatifs, statut de donnée, durées source et identifiants d’import. |
| Ressenti et souvenir | `activity_flow_assessments`, `retained_memory` | Axes facultatifs sans valeur artificielle ; distinction entre texte conservé et point affichable. |
| Photos personnelles | `activity_media` et stockage privé associé | Mise en avant, dérivés, autorisations de partage et nettoyage contrôlé. |
| Observations quotidiennes | `daily_wellbeing`, données historiques de `days` | Règle unique de résolution, provenance et correction explicite. |
| Profil et onboarding | `passports`, personnalisation et réglages existants | Version de configuration minimale et compatibilité avec les anciens comptes. |
| Préférences | `user_settings` ou espace existant prévu à cet effet | Arrivée immersive/directe, repli du Journal, préférences de période par compte. |
| Horizon et missions | Structures existantes de mission | Intention sans mesure ni échéance, mise en pause et archive sans perte. |
| Ravitaillement | Tables et instantanés nutritionnels existants | Distinction prévu/consommé et valeurs nutritionnelles inconnues. |
| Moments collectifs | Tables de TOGETHER et souvenirs collectifs existants | Liens invités à portée limitée et rattachement facultatif d’activités personnelles. |
| Connexions | Sources déclarées existantes, puis objets de connexion réels | Séparation de la déclaration et de l’état d’autorisation/synchronisation. |
| Charge | Moteur partagé et caches dérivés | Version, historique utilisé, admissibilité, couverture et invalidation. |
| Export/suppression | Services existants s’ils sont complets | Opérations paginées, manifeste, suivi et reprise. |

### 25.3. Souvenir sans réponses FLOW

Point de migration obligatoire à vérifier : la migration initiale de FLOW rendait défi et maîtrise non nuls ; une migration suivante ajoute `retained_memory`.

Pour permettre un souvenir sans réponses chiffrées, retirer par **nouvelle migration** les contraintes de non-nullité des axes concernés si elles sont encore présentes, en conservant les bornes de 1 à 10 lorsqu’une valeur existe. Adapter les validateurs, types et requêtes.

Une ligne peut alors contenir un souvenir sans point FLOW. Le moteur d’affichage exige toujours les deux axes valides pour dessiner un point. Une ligne entièrement vide peut être supprimée uniquement si elle ne contient aucun souvenir, contexte ou information à préserver.

Ne pas contourner une contrainte de base en écrivant 5/5 à la place de réponses absentes.

### 25.4. Provenance et valeurs anciennes

Ajouter les champs de provenance sans déclarer rétroactivement « saisi par l’utilisateur » ce qui n’est pas prouvé. La valeur de reprise par défaut est « origine non documentée » lorsque nécessaire.

Conserver les valeurs sources et les corrections choisies. Les indicateurs calculés portent la version du moteur et peuvent être reconstruits ; ils ne remplacent pas les faits source.

### 25.5. Import et idempotence

Associer les opérations à une clé unique par utilisateur et opération. Une même clé avec un contenu incompatible retourne un conflit explicite au lieu d’écraser une autre action.

Les empreintes de fichiers sont liées à l’utilisateur et à une activité effectivement enregistrée. Prévoir le cas d’une activité supprimée, d’un téléversement abandonné et d’un ancien import sans empreinte. Une absence d’empreinte historique ne bloque pas la consultation ou la modification.

### 25.6. Liens et propriété

Toute référence à une activité, un média, un contexte, une consommation ou une réponse doit vérifier le propriétaire et les droits. Le client ne choisit pas arbitrairement un autre `user_id` pour écrire.

Les invités sont associés à une portée d’invitation dédiée ; ne pas les créer comme faux utilisateurs complets ni élargir les politiques des tables privées pour leur donner accès.

### 25.7. Sauvegardes et migration additive

Avant migration de production, vérifier l’existence d’une sauvegarde ou d’un export de sécurité utilisable et la procédure de restauration. Ne pas annoncer une possibilité de retour arrière non testée.

Créer de nouvelles migrations ordonnées, ne jamais modifier une migration appliquée. Préférer l’ajout de colonnes et l’assouplissement ciblé d’une contrainte aux réécritures destructrices. Toute reprise de données est idempotente et documentée avec nombre de lignes concernées.

### 25.8. Activation progressive

Déployer d’abord le schéma compatible, puis les lecteurs/écrivains compatibles, puis activer le comportement. Des indicateurs de fonctionnalité peuvent isoler un parcours non encore validé, mais ils ne remplacent jamais une autorisation de sécurité.

Le changement de moteur est activé ensemble pour tous ses consommateurs. Les anciens navigateurs encore ouverts doivent échouer proprement ou être invités à recharger ; ils ne doivent pas réintroduire des valeurs par défaut interdites.

### 25.9. Retour arrière

Le retour arrière applicatif doit rester compatible avec le schéma enrichi. Ne pas supprimer les nouvelles données pour revenir à une ancienne interface. Si une ancienne version ne comprend pas des axes FLOW nuls, utiliser une version de repli corrigée plutôt que restaurer un code qui plante.

Les fichiers et textes personnels créés pendant la nouvelle phase restent préservés. Les corrections de charge étant dérivées, leur rollback ne modifie pas le RPE ni les faits enregistrés.

---

## 26. Architecture technique, sécurité et performances

### 26.1. Pas de refonte générale de technologie

Conserver le socle HTML/CSS/JavaScript et les services du projet tant qu’une limitation démontrée ne justifie pas une évolution ciblée. Le présent CDC ne demande ni migration Next.js ni reconstruction de l’application.

Extraire les règles communes et supprimer les duplications effectivement remplacées. Ne pas multiplier les fichiers d’adaptation historiques sans définir leur responsabilité et leurs consommateurs.

### 26.2. Modules partagés attendus

Centraliser au minimum les règles de statut, formatage des durées, interprétation des dates, admissibilité et calcul de charge, résolution des observations, provenance, sauvegarde du Moment et rendu des états d’erreur.

Les modules de calcul sont testables sans DOM ni accès réseau. Les composants graphiques reçoivent un contrat de données, pas une formule copiée localement.

### 26.3. Chargement et pagination

Toutes les requêtes susceptibles de dépasser la limite de réponse de la base utilisent une pagination ou une API adaptée. Vérifier particulièrement historique de charge, export et Mon Chemin.

La pagination est stable et déterministe. Un échec sur une page ne donne pas un faux historique complet. Le chargement complet de l’historique ne doit pas être recommencé inutilement à chaque changement de période.

Les calculs quotidiens regroupent les activités une fois, puis parcourent les dates. Éviter de rechercher l’ensemble des activités à nouveau pour chaque jour lorsque cela produit une complexité inutile.

### 26.4. Protection des entrées

Valider côté serveur les valeurs, droits et limites. Afficher les textes utilisateur comme du texte ou via une sanitation explicite lorsque du contenu enrichi est réellement autorisé.

Refuser les types de fichiers non autorisés, vérifier la taille et ne pas faire confiance à l’extension seule. Les imports volumineux ou invalides ne doivent pas bloquer indéfiniment l’interface.

Ne jamais exposer une clé privilégiée dans le navigateur, dans un export ou dans le dépôt. Une clé publique prévue par un fournisseur ne remplace pas les politiques d’accès.

### 26.5. Services privilégiés

Les opérations invitées, exports de grande taille et suppressions peuvent nécessiter un service serveur. Son autorité est minimale et chaque requête vérifie l’identité ou la portée invitée.

Une fonction utilisant des droits privilégiés ne fait pas confiance à l’identifiant de compte fourni par le client. Fixer explicitement son contexte d’exécution, sa surface autorisée et sa journalisation non sensible.

### 26.6. Performances : mesure avant conclusion

Établir une référence avant modifications pour HOME, Progression, YOU, TOGETHER, l’accueil public et l’ouverture d’un formulaire. Tester sur un profil mobile contraint et un ordinateur, avec les mêmes paramètres avant/après.

Cibles de recette de cette phase : contenu principal lisible sans attente d’animation ; actions répondant visuellement sans délai perceptible ; absence de décalage de mise en page gênant ; aucun gel prolongé pendant un import représentatif.

Repères techniques à mesurer : LCP cible au plus 2,5 s, CLS au plus 0,1 et latence d’interaction cible au plus 200 ms dans les conditions documentées. Ces valeurs sont des objectifs, pas des mesures déjà obtenues. Si une mesure terrain n’est pas disponible, le rapport l’indique et présente les tests de laboratoire sans les faire passer pour des données d’utilisateurs réels.

### 26.7. Optimisations ciblées

Dimensionner les images, prévoir les variantes adaptées au viewport, réserver leur espace et charger les médias hors écran à la demande. L’image principale du Hero ne doit pas être retardée par un chargement différé inadapté.

Limiter les rechargements de graphiques, les traitements synchrones longs et les calculs redondants. Les dépendances externes doivent être inventoriées, leurs versions maîtrisées et leur indisponibilité traitée quand elle bloque un parcours critique.

### 26.8. Hors ligne et réseau dégradé

Un mode hors ligne complet n’est pas demandé. En revanche, l’interface doit signaler l’indisponibilité et préserver raisonnablement le travail en cours sans prétendre l’avoir enregistré sur le serveur.

Un brouillon local sensible ne doit pas survivre à la déconnexion ni être visible par un autre compte. Définir explicitement sa durée de vie et ne pas stocker de secret d’invitation ou de connexion pour faciliter la reprise.

---

## 27. Observabilité et mesure de l’utilité

### 27.1. Observabilité technique

Tracer les étapes et échecs de chargement, import, sauvegarde, export et invitation avec un identifiant d’opération et un type d’erreur exploitable. Ne pas enregistrer les souvenirs, notes de santé, coordonnées GPS brutes, adresses d’invités ou jetons dans les journaux techniques ordinaires.

Distinguer erreur utilisateur, validation métier, droit insuffisant, limite de capacité, indisponibilité fournisseur et défaut applicatif. Les messages publics ne révèlent pas les détails internes sensibles.

### 27.2. Indicateurs produit

Mesurer, lorsque le projet dispose d’un mécanisme approprié et respectueux des choix de confidentialité, la réussite d’une première action, les imports aboutis, les sauvegardes sans erreur, l’usage volontaire du ressenti, la consultation d’un Moment marquant et les invitations confirmées.

Ne pas utiliser comme indicateur principal le temps passé à l’écran, une série de jours d’ouverture ou le nombre de notifications envoyées.

### 27.3. Définitions

« Première action réussie » signifie un premier Moment réellement enregistré, pas seulement le formulaire ouvert. « Ressenti complété » signifie au moins une réponse volontaire, pas un curseur par défaut. « Invitation aboutie » signifie une réponse validée ou confirmée selon son parcours, pas un lien copié.

L’instrumentation ne contient pas les contenus personnels. Les événements sont nommés de façon stable et leur finalité est documentée. Aucun prestataire analytique tiers n’est ajouté implicitement.

### 27.4. Tests qualitatifs

Prévoir cinq personnes ne connaissant pas les conventions internes du projet, dont au moins deux utilisant principalement leur téléphone. Tester également un compte riche en historique et une personne sans montre ou sans objectif chiffré.

Les tâches sont données sans expliquer où cliquer. Noter succès, hésitations, erreurs et vocabulaire incompris. Une préférence esthétique ne remplace pas l’observation de réussite de la tâche.

### 27.5. Seuils de validation produit

Objectifs de recette : au moins quatre personnes sur cinq comprennent l’utilité après découverte ; quatre sur cinq créent un Moment simple sans aide ; quatre sur cinq retrouvent une trace personnelle et comprennent qui la voit ; quatre sur cinq identifient la différence entre une donnée absente et une valeur mesurée.

Ces seuils sont des critères qualitatifs de cette phase, pas une validation statistique du marché. Les échecs répétés sur une tâche essentielle conduisent à une correction avant validation finale.

---

## 28. Plan de réalisation intégré

### 28.1. Lot 0 — État initial et protections

Relever commit, déploiement, schéma, migrations et parcours disponibles. Identifier les duplications, l’export incomplet, les cases de sources et les valeurs de saisie par défaut. Constituer les données de recette et captures de référence.

**Sortie attendue :** inventaire, mapping des chapitres, tests existants exécutés et plan de migrations. Aucun changement destructeur de production.

### 28.2. Lot 1 — Fiabilité P0

Mettre en place le moteur commun, l’admissibilité, les valeurs absentes, les nouveaux messages et l’accès au profil récupérable. Corriger les fausses présentations de connexion. Préparer l’export exact et les règles de propriété nécessaires aux nouveaux parcours.

**Dépendance :** lot 0. **Sortie :** mêmes calculs entre modules, erreurs non trompeuses et tests de données validés.

### 28.3. Lot 2 — Socle UX et pages d’entrée

Consolider design partagé, navigation directe, tailles de texte, Heroes adaptatifs et accès rapides. Mettre en place découverte publique et onboarding progressif compatible avec les anciens comptes.

**Dépendances :** contrôle d’accès fiabilisé et schéma minimal. **Sortie :** parcours nouveau et existant utilisables sur téléphone, tablette et ordinateur.

### 28.4. Lot 3 — Vie quotidienne et lecture du parcours

Faire évoluer HOME, le Journal, le formulaire progressif, les imports, FLOW, Progression et le bien-être. Implémenter sélection de date commune et couverture des données.

**Dépendances :** moteur commun, design et migrations de saisie. **Sortie :** parcours complet import → enrichissement → lecture, sans doublon ni donnée inventée.

### 28.5. Lot 4 — Dimension personnelle

Faire évoluer YOU, Mon Horizon et Mon Chemin. Mettre en avant les Moments choisis et la synthèse sobre de période. Distinguer prévu/consommé et fiabiliser les instantanés nutritionnels.

**Dépendances :** formulaire, données personnelles et règles de visibilité. **Sortie :** parcours pertinent sans compétition, sans biométrie et sans IA ajoutée.

### 28.6. Lot 5 — Organisation collective et maîtrise des données

Réorienter TOGETHER autour du Moment ; livrer les liens invités à portée limitée, les états de réponse, les contrôles de capacité et la liaison avec les activités personnelles. Finaliser export, suppression et visibilité avant partage.

**Dépendances :** autorisations serveur et base, contrats d’invitation, compte et stockage. **Sortie :** un externe peut répondre sans accéder aux données privées ; les actions de données annoncées fonctionnent réellement.

### 28.7. Lot 6 — Recette globale et publication

Exécuter les scénarios complets, tests de non-régression, contrôles de performance et tests qualitatifs. Corriger les écarts bloquants. Produire les preuves de livraison et de déploiement du chapitre 32.

### 28.8. Gestion des dépendances non levées

Une future synchronisation fournisseur peut rester non disponible avec le parcours FIT/GPX correct. Cela ne bloque pas le reste du CDC, car l’activation d’un connecteur non autorisé n’en fait pas partie.

En revanche, un moteur divergent, un export annoncé complet mais tronqué, une saisie rétablissant un RPE arbitraire, une fuite de données ou une invitation prétendument sécurisée sans contrôle serveur empêchent la validation du lot concerné.

---

## 29. Données et environnements de recette

### 29.1. Isolation

Utiliser un environnement de test ou de prévisualisation avec comptes fictifs. Ne pas rendre publiques les données réelles du commanditaire, importer ses photos dans une démonstration publique ou envoyer des invitations à ses contacts pour valider les parcours.

### 29.2. Comptes de test

Préparer un nouveau compte sans profil, un ancien compte avec onboarding terminé, un compte sans objectif, un compte multisport riche en historique, un organisateur, un membre de Cercle, un membre de Club avec rôle limité et un invité sans compte.

Deux comptes distincts doivent pouvoir utiliser le même navigateur successivement pour tester l’isolation des caches. Un utilisateur non autorisé doit tester les accès directs aux ressources d’un autre compte.

### 29.3. Jeu d’activités

| Fixture | Données | Attendu essentiel |
|---|---|---|
| F01 | Course réalisée, 60 min, RPE 6, date connue | Charge 60 unités, provenance conservée. |
| F02 | Massage réalisé, 60 min, RPE absent | Volume de Moment 60 min, aucune charge sportive. |
| F03 | Randonnée réalisée, 60 min, RPE null | Charge inconnue, activité présente dans le Journal. |
| F04 | Renforcement réalisé, durée absente, RPE 7 | Enregistrement possible, charge non calculable. |
| F05 | Aventure sans nature physique précisée | Statut de charge indéterminé, pas de règle devinée. |
| F06 | Même fichier FIT importé deux fois simultanément | Une seule activité personnelle. |
| F07 | Deux fichiers différents, même séance probable | Avertissement, aucune fusion silencieuse. |
| F08 | FIT avec heure UTC proche de minuit et durées distinctes | Date/heure locale cohérente, pauses non perdues. |
| F09 | GPX sans heure ou mesure cardio | Champs absents conservés null, pas de fausse mesure. |
| F10 | Activité avec seul souvenir et photo, sans axes FLOW | Souvenir consultable, aucun point artificiel. |
| F11 | Moment collectif accepté, sans activité personnelle | Présent au calendrier, absent des totaux sportifs. |
| F12 | Ravitaillement prévu puis consommé partiellement | Deux états distincts, total consommé non surévalué. |
| F13 | Historique de plus de 1 000 activités couvrant plusieurs années | Pagination complète, export non tronqué. |
| F14 | Note « Je ne suis pas malade » | Aucune annotation Maladie automatique. |
| F15 | Semaine sans nouvelle activité après historique fourni | Courbe consultable, pas de faux état vide global. |
| F16 | Effort historique égal à 5, origine non documentée | Valeur préservée, provenance honnête. |

### 29.4. Cas de défaillance

Simuler perte de réseau avant et après écriture, réponse lente hors ordre, échec de chargement du Passeport, fichier illisible, échec de téléversement, échec d’une page de données, autorisation expirée, lien révoqué, capacité atteinte et ressource supprimée entre affichage et action.

Les tests ne doivent pas seulement couvrir un compte rempli et une connexion rapide.

---

## 30. Scénarios de recette détaillés

Les identifiants ci-dessous sont les références de recette. Chaque résultat doit être noté « réussi », « échoué », « non exécuté » ou « non applicable avec justification », avec environnement et preuve. Les comportements impossibles à vérifier ne sont pas considérés validés.

### 30.1. Accès, accueil et onboarding

| ID | Situation et action | Résultat attendu |
|---|---|---|
| ACC-01 | Nouveau visiteur ouvre la découverte | Promesse compréhensible, exemple fictif accessible et création de compte visible. |
| ACC-02 | Visiteur utilise la démonstration | Aucune écriture métier, aucune donnée privée, aucun succès simulé. |
| ACC-03 | Nouvel inscrit renseigne seulement le prénom et saute le reste autorisé | Accès au premier Moment sans biométrie ni objectif chiffré. |
| ACC-04 | Ancien compte avec onboarding terminé se connecte | Aucun nouveau parcours obligatoire et aucune donnée effacée. |
| ACC-05 | Compte avec Passeport existant subit une erreur de lecture | Écran récupérable, pas de renvoi erroné vers un nouveau Passeport. |
| ACC-06 | Session réellement absente ou expirée confirmée | Redirection vers connexion, retour interne conservé après authentification. |
| ACC-07 | URL de retour externe injectée dans les paramètres | Refus ou remplacement par destination interne sûre. |
| ACC-08 | Onboarding interrompu puis repris, validation répétée | Reprise correcte et un seul profil. |
| ACC-09 | Récupération de mot de passe ouverte via lien | Fonctionnement préservé malgré les nouvelles routes publiques. |
| ACC-10 | Vérification d’accès ne répond pas | État accessible et possibilité de réessayer, pas d’écran invisible permanent. |

### 30.2. Navigation, design et HOME

| ID | Situation et action | Résultat attendu |
|---|---|---|
| UX-01 | Toucher chacun des quatre territoires sur téléphone | Navigation directe homogène, sans menu intermédiaire imposé. |
| UX-02 | Navigation au clavier sur ordinateur | Focus visible, destinations identifiables, aucun survol indispensable. |
| UX-03 | Ouverture d’un ancien lien de sous-section | Bonne rubrique affichée ; précédent/suivant du navigateur cohérents. |
| UX-04 | Première ouverture puis rotation du téléphone | Aujourd’hui centré dans la fenêtre, aucun décalage vers le dernier jour futur. |
| UX-05 | Déplacement manuel de la fenêtre puis actualisation de données | Position volontaire préservée ; recentrage seulement à la demande. |
| UX-06 | Ouverture de HOME sans préférence puis de `#journal` | Calendrier replié dans le premier cas, développé dans le second. |
| UX-07 | Ajout depuis une date passée sélectionnée | Le formulaire conserve cette date. |
| UX-08 | Accès direct au contenu choisi dans YOU | Hero conservé mais non imposé au retour ; lien profond prioritaire. |
| UX-09 | Hero affiché sur petit téléphone, paysage et texte agrandi | Texte et actions non coupés, pas de minimum fixe inadapté. |
| UX-10 | Fonds photographiques clairs/sombres et image absente | Navigation et texte lisibles avec traitement de secours. |
| UX-11 | Mode de réduction des animations activé | Valeurs et graphiques directement visibles, aucune parallaxe obligatoire. |
| UX-12 | Largeurs de recette, zoom et reflow | Aucun débordement global, contrôles accessibles et unités lisibles. |
| UX-13 | Échec de la météo | Journée, Journal et ajout de Moment restent utilisables. |
| UX-14 | Ouverture puis fermeture d’un dialogue au clavier | Focus contenu dans le dialogue puis rendu au déclencheur. |
| UX-15 | Déconnexion du compte A puis connexion du compte B | Aucun avatar, réglage ou brouillon privé du compte A visible. |

### 30.3. Formulaire, médias et import

| ID | Situation et action | Résultat attendu |
|---|---|---|
| MOM-01 | Enregistrer un Moment simple avec champs essentiels | Aucun complément obligatoire inutile ; statut et nature exacts. |
| MOM-02 | Ouvrir puis enregistrer sans toucher les sliders | RPE et axes FLOW restent null, aucun 5 implicite. |
| MOM-03 | Modifier seulement défi et maîtrise | RPE inchangé ; point mis à jour sans changer l’effort officiel. |
| MOM-04 | Modifier seulement le RPE | Charge recalculée ; coordonnées FLOW inchangées. |
| MOM-05 | Effacer un axe tout en conservant un souvenir | Souvenir préservé ; point retiré ; aucune suppression globale. |
| MOM-06 | Ajouter « Aventure » et « Avec des proches » à une randonnée | Une seule activité, aucune publication automatique, charge selon pratique. |
| MOM-07 | Saisir `1:20` dans le composant de durée | 80 minutes, format cohérent dans tous les écrans. |
| MOM-08 | Préparer une nutrition dans le formulaire puis annuler le Moment | Aucun ravitaillement rattaché à une activité créée par erreur. |
| MOM-09 | Enregistrer activité et photo, avec échec de photo simulé | État exact de sauvegarde, reprise ciblée, pas de succès global trompeur. |
| MOM-10 | Fermer une édition modifiée ou changer de Moment pendant une requête | Confirmation adaptée ; une vieille réponse ne remplace pas le nouveau formulaire. |
| MOM-11 | Import FIT horodaté autour de minuit | Heure préremplie et date locale vérifiées avec le fuseau documenté. |
| MOM-12 | Import GPX sans heure ou mesures | Null conservé pour l’absence ; aucune fausse valeur fabriquée. |
| MOM-13 | Import du même fichier deux fois, y compris concurrent | Une seule activité et proposition d’ouvrir l’existant. |
| MOM-14 | Fichiers différents représentant un doublon probable | Comparaison explicite, aucun écrasement ou fusion automatique. |
| MOM-15 | Réimport après ajout de photos, ressenti et RPE manuel | Enrichissements conservés et remplacements contrôlés. |
| MOM-16 | Coupure réseau après écriture puis nouvel essai | Reprise idempotente, aucun doublon. |
| MOM-17 | Fichier corrompu, trop volumineux ou type non permis | Erreur compréhensible, aucune activité vide créée. |
| MOM-18 | Souvenir seul sans axes chiffrés dans la base migrée | Texte sauvegardé sans valeurs artificielles ; affichage sans point. |
| MOM-19 | Suppression d’une photo ou d’une activité | Mise à jour des vues, accès retiré et nettoyage de stockage traçable. |
| MOM-20 | Création d’une activité datée dans le futur | Statut prévu ; aucune contribution aux réalisés ni à la charge observée. |

### 30.4. Charge, FLOW et Progression

| ID | Situation et action | Résultat attendu |
|---|---|---|
| DAT-01 | F01 : 60 minutes, RPE 6 | 60 unités avant arrondi ; formule et source vérifiables. |
| DAT-02 | F02 : massage 60 minutes | Temps conservé au volume ; aucune charge sportive ni erreur de RPE manquant. |
| DAT-03 | F03 : durée connue, effort absent | Charge individuelle null, raison `missing_rpe`, pas de remplacement par zéro ou 5 ; aucune courbe fictive si aucune charge n’est calculable. |
| DAT-04 | Une séance calculable et une inconnue le même jour | Somme connue correcte et charge complète inconnue ; couverture partielle affichée. |
| DAT-05 | Pratique indéterminée | Exclusion du calcul automatique et statut à préciser distinct d’un soin passif. |
| DAT-06 | RPE historique 5 d’origine incertaine | Valeur préservée ; provenance non inventée. |
| DAT-07 | Même historique, date et version dans FLOW et Progression | Résultats identiques avant arrondi. |
| DAT-08 | Changement de période d’affichage | Les valeurs des dates communes ne changent pas ; début de calcul stable. |
| DAT-09 | Nouveau compte sans activité | Aucun profil physiologique fictif ni charge chronique personnalisée. |
| DAT-10 | Passage du 41e au 42e jour | Aucune promesse de fiabilité totale ou de personnalisation complète. |
| DAT-11 | Semaine sans activité après historique existant | Courbes consultables, état « aucune activité enregistrée » exact. |
| DAT-12 | Période contenant des dates futures | Pas de charges observées ni de fraîcheur simulée dans le futur. |
| DAT-13 | RPE corrigé rétroactivement ou doublon supprimé | Historique et caches recalculés, anciennes données source préservées. |
| DAT-14 | Échec d’une page de chargement d’historique | Pas de nouveau modèle calculé sur une liste tronquée présentée complète. |
| DAT-15 | Plusieurs milliers d’activités | Pagination complète et temps de calcul maîtrisé. |
| DAT-16 | Première ouverture sans préférence, puis préférence existante | 7 derniers jours par défaut ; préférence explicite existante conservée. |
| DAT-17 | Fenêtres de 7 jours, 28 jours, semaine, mois et personnalisé | Bornes exactes, flèches cohérentes et granularité adaptée. |
| DAT-18 | Temps incluant soin, puis passage en Distance | Totaux du bon périmètre ; pratiques sans distance clairement exclues de ce mode seulement. |
| DAT-19 | Sélection d’une date dans Charge puis Bien-être | Même date mise en évidence, unités et échelles distinctes. |
| DAT-20 | Sélection d’une semaine agrégée | Détail de la semaine, pas une moyenne présentée comme mesure quotidienne. |
| DAT-21 | Mesure quotidienne absente ou chargement en erreur | Ni zéro fabriqué ni continuité graphique trompeuse. |
| DAT-22 | Deux sources de bien-être à la même date | Priorité documentée et provenance visible, pas de moyenne arbitraire. |
| DAT-23 | Note « Je ne suis pas malade » | Aucune annotation automatique Maladie. |
| DAT-24 | Plusieurs points FLOW superposés, navigation clavier | Choix d’une activité possible via liste ou contrôle accessible. |
| DAT-25 | Changements rapides de période avec réponses réseau inversées | La dernière période choisie reste la seule affichée. |
| DAT-26 | Tableau accessible d’un graphique | Même données, unités, période et états partiels que le graphique. |

### 30.5. YOU, contenu et nutrition

| ID | Situation et action | Résultat attendu |
|---|---|---|
| PER-01 | YOU ouvert sans mensurations ni compétition | Aperçu personnel cohérent et non vide artificiellement. |
| PER-02 | Intention sans date ni distance | Sauvegarde possible ; aucun compte à rebours ou score fictif. |
| PER-03 | Marquer puis retirer un Moment marquant | Aperçu actualisé ; activité et souvenir inchangés. |
| PER-04 | Mon Chemin consulté sur plusieurs années | Pagination, filtres et accès au détail cohérents avec le Journal. |
| PER-05 | Période sans souvenir déclaré | Aucune émotion inventée ; invitation discrète ou simple résumé factuel. |
| PER-06 | Synthèse d’une période partielle | Bornes et couverture indiquées, pas de comparaison trompeuse avec une période complète. |
| PER-07 | Ravitaillement prévu puis activité réalisée | Aucune consommation automatique ; reprise explicite du prévu possible. |
| PER-08 | Consommation partielle par rapport au prévu | Totaux séparés et exacts. |
| PER-09 | Durée écoulée et durée d’effort différentes | Calcul horaire sur base annoncée, charge sur sa propre durée définie. |
| PER-10 | Durée de ravitaillement absente | Total disponible, valeur horaire non calculable et non infinie. |
| PER-11 | Valeur nutritionnelle inconnue versus zéro explicite | Statuts distincts et total partiel lorsque nécessaire. |
| PER-12 | Bibliothèque modifiée après consommation enregistrée | Instantané historique inchangé. |
| PER-13 | Échec de chargement des produits historiques | Pas d’écrasement du ravitaillement par une liste vide. |
| PER-14 | Paramètre de langue, unité, push ou source non opérationnel | Aucun état de réussite ou d’activation fictif. |

### 30.6. TOGETHER, confidentialité et compte

| ID | Situation et action | Résultat attendu |
|---|---|---|
| SEC-01 | TOGETHER ouvert par un compte sans Cercle | Proposition d’un Moment accessible sans construire d’abord un réseau. |
| SEC-02 | Invité sans compte ouvre un lien valide | Aperçu limité et réponse possible sans Passeport. |
| SEC-03 | Invité répond avec un nom non vérifié | Réponse clairement externe et à valider, aucune identité certifiée. |
| SEC-04 | Robot de messagerie prévisualise le lien | Aucune acceptation ni consommation définitive du lien. |
| SEC-05 | Lien expiré, révoqué ou renouvelé | Ancien accès refusé ; réponse historique préservée. |
| SEC-06 | Tentative de lire un autre Moment ou un profil via session invitée | Refus côté serveur et base. |
| SEC-07 | Deux validations pour la dernière place | Une seule confirmation conforme à la capacité, autre état explicite. |
| SEC-08 | Date modifiée après réponses ou Moment annulé | État visible et nouvelle confirmation si nécessaire ; aucune notification fictive. |
| SEC-09 | Invité participe ponctuellement | Aucun ajout automatique au Cercle ou au Club. |
| SEC-10 | Moment collectif accepté puis activité personnelle liée | Pas de double charge ni de réalisation sportive automatique. |
| SEC-11 | Partage d’un Moment avec photo et lieu sélectionnés | Aperçu exact ; RPE, santé, FLOW et souvenirs privés non inclus par défaut. |
| SEC-12 | Accès direct à un média ou une activité d’un autre compte | Accès refusé, même en contournant l’interface. |
| SEC-13 | Export de F13 avec historique de plusieurs années | Toutes les données promises sont présentes, compteurs exacts et aucune troncature silencieuse. |
| SEC-14 | Export avec médias, notes et consommations | Manifeste cohérent, fichiers autorisés et aucune donnée privée d’un autre participant. |
| SEC-15 | Export interrompu ou page manquante | Échec ou partialité explicitement signalée, pas de succès complet. |
| SEC-16 | Export inspecté pour secrets et jetons | Aucun secret technique, OAuth ou invitation active. |
| SEC-17 | Connexion cochée historiquement mais sans autorisation réelle | Affichage « source déclarée » ou non connectée, jamais synchronisation réussie. |
| SEC-18 | Connecteur révoqué ou import fournisseur en erreur | État réel et repli vers import manuel, historique personnel préservé. |
| SEC-19 | Suppression de compte en présence de fichiers et de Moments collectifs | Nettoyage propre et droits des autres préservés ; état final annoncé exact. |
| SEC-20 | Journaux et événements d’observabilité inspectés | Absence de textes privés, traces GPS brutes et secrets. |
| SEC-21 | Champs texte malveillants et pièces jointes non autorisées | Contenu neutralisé ou rejeté, aucune exécution dans les vues ou exports rendus. |

### 30.7. Déploiement et validation transversale

| ID | Situation et action | Résultat attendu |
|---|---|---|
| LIV-01 | Migrations exécutées sur une copie représentative puis réexécutées selon leur contrat | Résultat prévu, aucune perte, incompatibilités identifiées avant production. |
| LIV-02 | Ancienne session navigateur rencontre le nouveau schéma | Compatibilité ou demande de rechargement propre, aucune réintroduction de données artificielles. |
| LIV-03 | Version de repli testée après création de nouvelles données | Fonctionnement compatible sans suppression de nouveaux souvenirs ou réponses. |
| LIV-04 | Tests de performance avant/après sous mêmes conditions | Mesures documentées, pas de régression critique masquée par un changement de protocole. |
| LIV-05 | Tests qualitatifs sur les tâches principales | Résultats et hésitations consignés ; problèmes répétés corrigés. |
| LIV-06 | Déploiement de la version validée | Commit et migrations concordants, état prêt vérifié, parcours essentiel testé sur l’URL publiée. |
| LIV-07 | Revue finale de la matrice de couverture | Chaque point possède une réalisation et une preuve ou une dépendance explicite, pas d’omission silencieuse. |

### 30.8. Scénarios critiques rédigés en parcours complet

**Parcours A — première valeur sans profil complet.** Étant donné une personne nouvellement inscrite, lorsqu’elle fournit son prénom, saute les pratiques et conserve une intention ouverte, elle atteint l’ajout d’un Moment. Elle enregistre une marche avec une durée, sans RPE ni FLOW. La marche apparaît dans son Journal, le calcul de charge ne la remplace pas par une activité d’effort 5 et le profil reste accessible sans demande répétée de biométrie. Tests : ACC-03, MOM-02, DAT-03, PER-01.

**Parcours B — import, souvenir et reprise.** Étant donné un FIT valide, lorsqu’il est importé, l’heure et la date sont préremplies. La personne ajoute un souvenir sans réponses FLOW puis enregistre. Si la connexion se coupe après l’écriture et qu’elle réessaie, une seule activité subsiste, le souvenir est conservé et aucun point 5/5 n’est créé. Tests : MOM-11, MOM-16, MOM-18.

**Parcours C — soin passif et charge.** Étant donné une sortie de 60 minutes à effort 6 et un massage de 60 minutes le même jour, le volume général peut afficher deux heures de Moments. La charge connue est 60 unités, pas 110. La répartition explique les pratiques et le détail de charge indique que le massage est exclu, non « effort manquant ». Tests : DAT-01, DAT-02, DAT-18.

**Parcours D — modèle partiel sans fausse assurance.** Étant donné une sortie admissible sans RPE au milieu de l’historique, la somme calculable des autres sorties est conservée mais la série est marquée partielle à partir de la lacune. L’interface ne conclut pas à une bonne fraîcheur. Si la personne ajoute ensuite le RPE manquant, les deux modules recalculent depuis le même historique et donnent les mêmes valeurs. Tests : DAT-03, DAT-04, DAT-07, DAT-13.

**Parcours E — invité externe.** Étant donné un organisateur qui partage un lien individuel, l’invité sans compte consulte uniquement l’aperçu choisi, répond et voit que sa réponse sera validée. L’organisateur confirme la participation avec contrôle de capacité. L’invité ne rejoint pas le Cercle et n’accède ni au profil ni aux souvenirs privés. Tests : SEC-02, SEC-03, SEC-06, SEC-07, SEC-09.

**Parcours F — export réellement complet.** Étant donné un compte avec plusieurs années d’activités, médias, réponses de ressenti et ravitaillement, l’export ne se limite pas aux données actuellement affichées dans YOU. Le manifeste et les totaux sont vérifiés sur le jeu de recette. Une requête échouée empêche l’annonce d’un export complet. Tests : SEC-13 à SEC-16.

---

## 31. Matrice de couverture de l’audit

Cette matrice relie l’ensemble des sujets de l’audit aux exigences et aux preuves attendues. Les regroupements ne permettent pas d’omettre un sujet.

| Point de l’audit ou précision vérifiée | Chapitres | Preuves principales |
|---|---|---|
| Identité forte à mieux traduire, pas d’accumulation de fonctions | 2, 3, 24 | ACC-01, PER-05, LIV-05. |
| Positionnement complémentaire aux outils sportifs, cible prioritaire | 2, 8, 27 | Découverte comprise et tests qualitatifs. |
| Valeur commerciale à démontrer, sans paiement ajouté | 2.6, 27 | Mesures d’utilité documentées, aucune fonction de paiement hors périmètre. |
| Acquis de juillet/août à préserver | 3, 10, 14, 16 | UX-03, MOM-03/04, DAT-17/26. |
| Découverte concrète avant création du compte | 8 | ACC-01/02. |
| Onboarding trop lourd avant la première valeur | 9 | ACC-03/04/08. |
| Navigation mobile aux comportements hétérogènes | 10 | UX-01/02/03. |
| Libellés obsolètes et fonction « Bientôt » | 10.3, 24.3 | Contrôle des menus et contenus rendus. |
| HOME : hiérarchie entre journée, fenêtre et mois | 11 | UX-04 à UX-07. |
| Catégorie exclusive Sport/Bien-être/Aventure | 12.2, 15.3 | MOM-06, DAT-05. |
| Formulaire trop complet pour un Moment simple | 12 | MOM-01/02/07/08. |
| YOU trop centré sur la fiche technique | 18 | PER-01/02/03/04. |
| TOGETHER : commencer par le Moment plutôt que le réseau | 20, 21 | SEC-01/02/09. |
| Heroes grands mais accès rapide nécessaire | 7 | UX-08/09. |
| Échelle typographique et place des contrôles | 6 | UX-12, captures comparatives. |
| Graphiques à lire ensemble | 16.1/2/7 | DAT-19/20. |
| Composants cohérents sans pages identiques | 6, 26 | UX-02/12/14. |
| Contraste, tableaux, clavier et réduction du mouvement | 6, 7.6, 16.9 | UX-10 à UX-14, DAT-24/26. |
| Photos plus proches de l’aventure accessible | 7.4/5 | Revue éditoriale et droits de médias. |
| RPE absent remplacé par 5 | 12.5, 15.6 | MOM-02, DAT-03/04/06. |
| Bien-être passif inclus dans la charge | 15.3/4 | DAT-02, parcours C. |
| Calculs de charge différents entre FLOW et Progression | 15 | DAT-07/08/13. |
| Confiance, 42 jours et disponibilité physique surinterprétés | 9.4, 15.8 à 15.11 | DAT-09/10 et revue des formulations. |
| Erreur de profil assimilée à un onboarding incomplet | 9.1/2 | ACC-05/10. |
| Poésie à conserver avec commandes explicites | 5, 24 | Revue des textes, tests qualitatifs. |
| FLOW facultatif, non certifiant et non culpabilisant | 14 | MOM-05, DAT-24, parcours D. |
| Distinction enregistré/déclaré/interprété | 13, 17, 24 | PER-05/06, provenance vérifiable. |
| Annotation Maladie déclenchée par simple mot | 17.4 | DAT-23. |
| Nutrition contextuelle, prévu/consommé et durée claire | 19 | PER-07 à PER-13. |
| Contenu personnel plutôt que récit générique | 18, 24 | PER-03 à PER-06. |
| Double saisie, imports, reprises et doublons | 13 | MOM-11 à MOM-17, DAT-15. |
| Synchronisations disponibles versus préparées | 22 | SEC-17/18, PER-14. |
| Visibilité, médias et droits avant partage | 21, 23 | SEC-05/06/11/12. |
| Transparence des droits sur les données | 23 | SEC-13 à SEC-19. |
| Robustesse sans migration générale de technologie | 25, 26 | LIV-01 à LIV-04. |
| Tests d’usage et mesure de la réussite réelle | 27, 29, 30 | LIV-05/07. |
| Précision vérifiée : cases de connexion = préférences, pas preuve de lien fournisseur | 22.1/2 | SEC-17. |
| Précision vérifiée : export actuel fondé sur une sélection chargée dans YOU | 23.4 à 23.6 | SEC-13/15. |
| Précision vérifiée : souvenir stocké avec un FLOW aux axes initialement obligatoires | 12.6, 25.3 | MOM-18, LIV-01/03. |

---

## 32. Livraison, déploiement et définition de terminé

### 32.1. Livrables d’Ingrid

La livraison comprend le code, les migrations nouvelles, les tests et fixtures non sensibles, la mise à jour des définitions métier et la matrice de couverture renseignée. Le présent CDC reste la référence unique ; les preuves techniques peuvent être annexées dans le dépôt sans créer un nouveau périmètre fonctionnel.

Les comptes rendus indiquent les fichiers touchés, les décisions techniques, les impacts visibles, les données reprises, les limites et ce qui n’a pas été testé. Aucun état « tout fonctionne » sans preuves adaptées au périmètre.

### 32.2. Captures et vérification visuelle

Fournir des captures avant/après des écrans concernés sur téléphone, tablette et ordinateur, avec jeux fictifs comparables. Inclure un état vide, un état avec données et un état d’erreur significatif, pas uniquement le Hero.

Vérifier aussi des textes longs, valeurs absentes, plusieurs disciplines, ancien historique et absence de photographie. Une capture ne prouve pas le contrôle des droits ou la justesse des calculs ; ces points ont leurs tests propres.

### 32.3. Procédure de publication

Préparer les changements dans la branche et le circuit de revue du projet. Vérifier les tests, migrations et compatibilités avant fusion. Ne pas modifier directement la production pour « essayer » un nouveau formulaire ou un partage invité.

L’autorisation de rédiger ce CDC ne vaut pas autorisation de créer des comptes réels, envoyer des invitations, changer les prestataires ou publier le code. Ingrid suit l’autorisation de livraison applicable au projet.

### 32.4. Vérification après déploiement

Un commit fusionné ne prouve pas un déploiement réussi. Un déploiement déclaré prêt ne prouve pas la réussite des parcours ni l’application des migrations.

Le compte rendu final relève le commit, l’URL publiée, l’état du déploiement, les migrations appliquées et les résultats des tests de fumée sur l’environnement publié : connexion, HOME, ouverture du formulaire, affichage de Progression et accès aux données du compte de test.

Si la nouvelle fonction de partage est activée, vérifier un lien invité de test et son retrait. Ne pas envoyer de vrai message à un proche pour cette vérification.

### 32.5. Critères bloquants

Toute perte de données personnelles, fuite intercompte, divergence du moteur de charge, RPE généré sans réponse, écriture d’un point FLOW fictif, import dupliqué par reprise, export faussement complet ou fausse synchronisation empêche la validation.

Une interface qui a perdu une fonction existante sans décision explicite est également bloquante. Un détail esthétique mineur peut être consigné, mais ne doit pas masquer un défaut de lisibilité ou d’usage essentiel.

### 32.6. Définition de terminé pour l’ensemble du CDC

Le CDC est terminé lorsque les exigences obligatoires sont réalisées ou vérifiées dans l’existant, les tests critiques sont réussis, les différences de calcul sont expliquées, les données antérieures sont préservées, les nouveaux accès sont sécurisés et les parcours essentiels sont validés sur les formats cibles.

Les dépendances externes réellement hors activation — par exemple l’obtention d’un connecteur fournisseur — sont nommées et affichées honnêtement dans le produit. Elles ne justifient pas de laisser inachevée une fonction interne requise.

La synthèse finale doit permettre de répondre sans ambiguïté à quatre questions : qu’est-ce qui a changé ; qu’est-ce qui a été testé ; qu’est-ce qui est effectivement publié ; qu’est-ce qui reste dépendant d’un tiers ?

### 32.7. Critère produit final

Une personne doit pouvoir enregistrer simplement ce qu’elle a vécu, comprendre les limites de ses repères, retrouver ce qui compte pour elle et proposer un prochain Moment sans se sentir enfermée dans une obligation de performance.

**Si le site est plus spectaculaire mais moins évident, ou si les chiffres semblent plus précis alors que les données restent incertaines, cette phase n’est pas réussie.**

---

## 33. Références et distinction entre existant et décisions nouvelles

### 33.1. Sources de cadrage

**S1 — Audit global MOMENTUM**, présenté dans la conversation du 8 septembre 2026 : UX, design, positionnement, fiabilité, contenus, priorités et tests. Ce CDC en reprend le périmètre, sans prétendre transformer ses appréciations visuelles en mesures terrain.

**S2 — `CONSTITUTION.md`**, dépôt `grizou-Sport/Momentum`, référence `dd8b37eb72c4ddc1a255c8f4e3a3f42f9f9fcfa0` : mission, philosophie, simplicité, soin des données, règles de contribution et non-régression. Consulté à nouveau pendant la rédaction.

**S3 — `ADN_Fondateur_Projet_V1.docx`**, fichier fourni au projet : données comme outil, émotions, histoire, ton humain et absence de comparaison entre personnes. Le document est fondateur et indique historiquement un nom non figé ; cette phase conserve la dénomination MOMENTUM déjà utilisée dans le projet et la Constitution.

**S4 — Décisions antérieures conservées**, échanges du projet : grands Heroes harmonisés, composants de durée et sliders partagés, effort physique comme RPE officiel, ressenti intégré au formulaire avec validation unique, photo de profil dans la navigation, paramètres dans YOU et absence de nouveau chapitre hebdomadaire autonome.

### 33.2. Sources techniques de l’audit

À la référence de dépôt ci-dessus, l’audit a consulté notamment : `index.html`, `progression.html`, `you.html`, `together.html`, `login.html`, `welcome.html`, `css/style.css`, `css/momentum-hero.css`, `css/progression.css`, `js/navigation.js`, `js/guard.js`, `js/home-progression.js`, `js/home-flow.js`, `js/momentum-moments.js` et `js/activity-nutrition.js`.

Ces sources fondent les constats repris dans les chapitres 6 à 24. La publication de référence n’a pas fait l’objet ici d’une session authentifiée complète ou d’un audit de sécurité en production. Ingrid doit vérifier le comportement réel avant et après changement.

### 33.3. Précisions vérifiées pendant la rédaction

**S5 — `js/you.js`** : les états COROS/Garmin/Strava sont enregistrés dans `connected_sources` par des cases ; la fonction d’export utilise les objets déjà chargés ; le chargement des activités de YOU est limité à une fenêtre d’un an et à certains champs. Ce constat impose les corrections des chapitres 22 et 23. Il ne prouve pas à lui seul l’absence de tout autre connecteur ailleurs dans le système.

**S6 — `supabase/migrations/20260718000100_flow_module_v1.sql`** : les axes défi/maîtrise sont initialement non nuls ; la table porte les droits propres au compte et une relation vers l’activité.

**S7 — `supabase/migrations/20260718000200_moment_form_and_shared_duration.sql`** : ajout de `retained_memory`, limite de 2 000 caractères, `activities.rpe` comme source officielle après migration, et médias d’activités dans un espace privé. La migration initiale et cette évolution doivent être considérées ensemble ; ne pas recréer un deuxième effort ni des réponses chiffrées artificielles pour sauvegarder un souvenir.

**S8 — Référence GitHub recontrôlée** : la branche `main` consultée pendant cette rédaction pointe vers `dd8b37eb72c4ddc1a255c8f4e3a3f42f9f9fcfa0`, commit « feat(home): préparer la nutrition dans le formulaire », daté du 5 septembre 2026. Tout code plus récent doit être rapproché du CDC lors du lot 0.

### 33.4. Arbitrages ajoutés pour rendre le CDC exécutable

Les choix suivants complètent explicitement l’audit : moteur de suivi des charges renseignées initialisé à zéro sans injection quotidienne du Passeport ; signalement persistant des lacunes d’entrée ; maintien du facteur de normalisation interne ; préférences d’arrivée non inférées ; onboarding minimal versionné ; invitation externe limitée et non réputée identifiée ; export paginé avec manifeste ; axes FLOW nullable pour conserver un souvenir seul ; protocole de migration et de recette.

Ces choix sont des exigences de cette version du CDC. Ils ne sont ni décrits comme existants ni attribués à une validation scientifique ou juridique. Toute modification de ces arbitrages pendant la réalisation doit être explicite, motivée, couverte par des tests et reportée dans ce même document avant publication.

### 33.5. Fin du périmètre

Aucun fichier complémentaire de spécifications fonctionnelles n’est nécessaire pour comprendre le résultat attendu. Les annexes de code, captures, tests et migrations sont des preuves ou des moyens de réalisation de ce périmètre, pas de nouvelles obligations implicites.

**FIN DU CDC — VERSION 1.0 — 8 SEPTEMBRE 2026**
