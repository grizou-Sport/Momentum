# Audit UX complet — MOMENTUM

**Date :** 18 juillet 2026  
**Périmètre :** HOME, Progression, FLOW, YOU, TOGETHER, authentification, onboarding et navigation partagée.  
**Niveau de confiance :** élevé sur les causes techniques et les incohérences structurelles ; moyen sur certains détails visuels des écrans authentifiés, faute de session utilisateur disponible pendant l’audit.

## 1. Synthèse exécutive

MOMENTUM possède une direction éditoriale forte, un vocabulaire distinctif et une architecture de pages globalement compréhensible. Le problème principal n’est pas le manque de design : c’est le décalage entre la promesse racontée par l’interface et ce que la logique affiche ou enregistre réellement.

Les défauts les plus importants sont :

1. Les données **prévues** sont encore affichées dans trois analyses alors que le texte parle de ce qui a été « construit » ou « réellement consacré ».
2. « Semaine en cours » produit une seule barre hebdomadaire : la période change, mais pas la granularité du graphique.
3. Le parcours FLOW comporte plusieurs chemins d’échec mal contenus et peut donner l’impression que le site a planté ou que l’enregistrement a été perdu.
4. Répondre à FLOW réécrit silencieusement le RPE de l’activité, ce qui peut modifier ensuite les graphiques de charge.
5. Toutes les activités de bien-être utilisent la même icône générique `mobility`; l’icône Massage dédiée n’est jamais utilisée et n’existe pas dans les assets.
6. La sidebar est effectivement trop transparente sur le hero sombre de HOME : son contraste dépend de la photographie et ne peut pas être garanti.
7. Plusieurs erreurs de chargement sont masquées et transformées en faux états vides, ce qui peut expliquer des activités « manquantes » jusqu’au prochain rechargement.

### Verdict

- **Cohérence produit : 5/10** — le langage de marque est bon, mais plusieurs vues contredisent leur propre promesse.
- **Fiabilité perçue : 4/10** — trop d’échecs silencieux, de valeurs estimées non signalées et de dépendances réseau visibles indirectement.
- **Clarté des données : 5/10** — les calculs sont présents, mais leur périmètre, leur statut et leur granularité sont souvent ambigus.
- **Accessibilité : 4/10** — focus global présent, mais graphiques, contraste contextuel et certains contrôles restent insuffisants.
- **Qualité visuelle : 7/10** — identité cohérente dans les pages, affaiblie par la navigation flottante et quelques composants génériques.

## 2. Réponses directes aux questions posées

### Pourquoi « Prévu » apparaît-il encore dans les graphiques ?

Parce qu’il n’a pas été retiré de la logique de Progression. Il existe encore explicitement dans :

- le volume hebdomadaire, qui crée un dataset `${groupe} · Prévu` ;
- la répartition sportive, qui empile `Réalisé` et `Prévu` ;
- la charge, qui ajoute des barres `Charge prévue` ;
- les détails de semaine et de discipline, qui réaffichent le nombre et la durée prévus.

Ce n’est donc pas un résidu visuel de Chart.js : c’est une décision encore encodée à plusieurs endroits. Aucun test actuel ne vérifie sa suppression.

### Pourquoi « Semaine en cours » n’affiche-t-il qu’une barre ?

Le graphique est toujours construit avec des **seaux hebdomadaires**. La période « semaine en cours » crée exactement une semaine, donc exactement une étiquette et une barre, empilée par discipline et par statut. La granularité devrait devenir quotidienne pour une période de sept jours.

### Pourquoi heures et minutes sont-elles dans deux cases ?

La base ne conserve qu’une seule donnée, `duration_min`. L’interface la décompose en `duration_hours` et `duration_minutes`, puis les recombine à l’enregistrement. Techniquement, ce ne sont pas deux données, mais deux fragments d’une même durée. Le choix est fonctionnel mais inutilement lourd. Un seul composant groupé « Durée — 1 h 30 » ou un contrôle heures/minutes visuellement unifié serait plus juste.

Le même problème existe pour la durée du sommeil.

### Pourquoi Massage affiche-t-il des flèches croisées ?

L’icône vue est le SVG `mobility`, qui est réellement une icône Lucide `move` à quatre directions. La fonction d’affichage ignore le type précis de bien-être et retourne `mobility` pour **toute** la catégorie. Le référentiel déclare pourtant `massage`, `meditation`, `sauna`, etc., mais ces icônes ne sont pas utilisées et les fichiers correspondants ne sont pas présents. Il faut à la fois corriger le routage et fournir une vraie bibliothèque d’icônes, dont le lotus demandé pour Massage si c’est le symbole produit retenu.

### Les données FLOW sont-elles correctement remontées ?

Les coordonnées d’un point utilisent bien uniquement `perceived_challenge` et `perceived_mastery`, conformément à la spécification. En revanche, la fiabilité de l’expérience autour de ces points n’est pas suffisante : activités exclues par statut, erreurs silencieuses, points superposés, rechargements concurrents et mise à jour cachée du RPE peuvent produire une impression de manque ou d’incohérence.

## 3. Anomalies critiques — P0

### P0-01 — FLOW peut échouer avant d’entrer dans son bloc de gestion d’erreur

**Constat.** Dans la soumission FLOW, le chargement de l’activité et de l’utilisateur se fait avant le `try/catch`. Si l’une de ces opérations échoue, la promesse est rejetée sans message exploitable dans le formulaire. Le bouton n’est pas encore verrouillé à ce moment.

**Impact.** Clic sur « Enregistrer mon ressenti » sans résultat, formulaire qui semble figé, besoin de quitter/revenir.

**Correction.** Placer l’intégralité du parcours dans le `try`, verrouiller le bouton dès le début, gérer une temporisation et proposer « Réessayer » sans fermer le dialogue.

**Critère d’acceptation.** Toute erreur réseau ou Supabase laisse le dialogue ouvert, réactive le bouton et affiche un message non technique.

### P0-02 — Un FLOW enregistré peut sembler perdu après un échec de rechargement

**Constat.** Après l’upsert réussi, le dialogue est fermé, puis toutes les données FLOW sont rechargées. Si ce deuxième appel échoue, l’erreur est traitée comme un échec d’enregistrement alors que l’écriture a déjà réussi ; le message d’erreur est envoyé dans un dialogue déjà fermé.

**Impact.** L’utilisateur ne sait pas si sa réponse est enregistrée. Un rechargement ultérieur peut faire réapparaître le point, donnant une impression d’instabilité.

**Correction.** Séparer « écriture réussie » et « rafraîchissement échoué ». Mettre à jour l’état local immédiatement, afficher un succès, puis rafraîchir en arrière-plan avec une bannière distincte si nécessaire.

### P0-03 — FLOW modifie silencieusement le RPE de l’activité

**Constat.** La réponse « effort physique » est enregistrée dans l’évaluation FLOW, puis copiée dans `activities.rpe`.

**Impact.** Répondre à FLOW peut modifier rétroactivement la charge calculée dans Progression et changer d’autres analyses. Une saisie narrative devient une mutation analytique non annoncée.

**Correction.** Choisir une source de vérité explicite : soit FLOW ne touche jamais au RPE de l’activité, soit l’utilisateur est averti et confirme la synchronisation. La préférence recommandée est de conserver les deux concepts séparés.

### P0-04 — Les erreurs HOME peuvent devenir de faux états vides

**Constat.** Quand le chargement des activités ou des Moments échoue, l’erreur est seulement écrite dans la console. L’interface continue avec un tableau vide et affiche « Aucun moment ».

**Impact.** Une activité existe en base mais paraît manquante. Sortir du site et revenir relance la requête et peut la faire réapparaître — comportement très proche du problème décrit.

**Correction.** Distinguer `loading`, `empty`, `partial` et `error`. Ne jamais afficher un état vide si la requête a échoué. Ajouter « Réessayer » et conserver les dernières données connues.

### P0-05 — Double soumission possible lors de la création d’une activité

**Constat.** Le bouton principal du formulaire d’activité n’est pas désactivé pendant le téléversement, l’insertion, le rendu HOME et l’ouverture de FLOW.

**Impact.** Plusieurs clics peuvent créer des doublons ou des requêtes concurrentes ; l’ouverture du formulaire FLOW devient imprévisible.

**Correction.** Ajouter un verrou de soumission, désactiver tous les contrôles d’action et rendre l’état « Enregistrement… » visible.

### P0-06 — Conditions générales et politique de confidentialité non accessibles

**Constat.** Les deux liens d’inscription pointent vers `#` et leur clic est systématiquement annulé.

**Impact.** L’utilisateur doit accepter des documents qu’il ne peut pas lire. C’est un défaut de confiance, de conformité et de conversion.

**Correction.** Fournir les documents réels, ouvrables avant consentement, avec version et date.

## 4. Anomalies majeures — P1

### P1-01 — Les données prévues restent présentes dans trois graphiques

**Écrans concernés.** Volume, répartition sportive, charge aiguë/chronique, détails de semaine et de discipline.

**Incohérence.** « Qu’est-ce que j’ai construit ? » et « temps réellement consacré » incluent visuellement du futur. Même si les couleurs diffèrent, la hauteur empilée agrège réalisé et prévu et fausse la lecture immédiate.

**Correction recommandée.** Retirer totalement `planned` des analyses réalisées. Si la planification doit revenir un jour, la placer dans une vue séparée « À venir », jamais empilée dans « construit ».

### P1-02 — La granularité ne s’adapte pas à la période

**Constat.** Le volume reste hebdomadaire quelle que soit la période.

**Règle recommandée.** Semaine en cours → jours ; 4 à 12 semaines → semaines ; 6 à 12 mois → semaines ou mois selon densité ; période personnalisée → granularité automatique indiquée dans le titre.

**Critère.** Une semaine doit afficher lundi à dimanche, y compris les jours à zéro.

### P1-03 — Le modèle de charge dépend de la période d’affichage

**Constat.** Les activités chargées pour calculer les EMA aiguë/chronique sont limitées à la période visible. Changer de filtre peut donc changer la valeur de charge du même jour, car l’historique nécessaire au calcul disparaît et le modèle redémarre depuis le Passeport.

**Impact.** Résultats perçus comme faux ou instables.

**Correction.** Charger un historique de calcul indépendant du viewport, au minimum 42 jours avant le début affiché, idéalement 90 à 180 jours. Ne découper que la série rendue.

### P1-04 — Les données annexes de Progression peuvent échouer silencieusement

**Constat.** Seule l’erreur de la requête d’activités déclenche l’état d’erreur global. Les erreurs Passeport, bien-être, historique legacy ou profil physiologique sont ignorées.

**Impact.** Graphiques partiels présentés comme fiables, synthèse à zéro ou estimation par défaut sans avertissement.

**Correction.** Afficher la provenance et la complétude par carte ; ne pas remplacer silencieusement une source indisponible par une valeur par défaut.

### P1-05 — La notion « réalisé » n’est pas cohérente entre modules

**Constat.** Progression considère toute activité dont le statut n’est pas `planned` comme terminée. FLOW exige exactement `done`.

**Impact.** Une activité au statut nul, ancien ou inattendu peut compter dans Progression mais manquer dans FLOW.

**Correction.** Centraliser les statuts et utiliser une seule fonction de classification partagée.

### P1-06 — Les points FLOW identiques se superposent parfaitement

**Constat.** Deux évaluations avec le même défi et la même maîtrise reçoivent exactement les mêmes coordonnées, sans décalage, compteur ni cluster.

**Impact.** Certaines activités paraissent absentes et seul le point au-dessus est facilement sélectionnable.

**Correction.** Ajouter un léger jitter déterministe, un cluster avec compteur, ou une liste filtrée au clic.

### P1-07 — Les curseurs FLOW créent une donnée par défaut sans intention explicite

**Constat.** Les trois valeurs commencent à 5. Le formulaire peut être enregistré sans que l’utilisateur touche aux curseurs.

**Impact.** Accumulation artificielle de points centraux et fausse précision.

**Correction.** État non renseigné au départ, marqueur « Choisir », ou confirmation explicite que 5 est bien la réponse.

### P1-08 — Requêtes FLOW concurrentes non protégées

**Constat.** Changement rapide de période, chargement initial et invitation post-activité peuvent lancer plusieurs chargements qui écrivent tous le même état global.

**Impact.** Une réponse plus ancienne peut arriver après la plus récente et afficher une mauvaise période ou une liste incomplète.

**Correction.** Identifiant de requête, annulation logique et application du résultat uniquement s’il correspond au dernier filtre actif.

### P1-09 — Sidebar : contraste non garanti, particulièrement sur HOME

**Constat.** La rail desktop est totalement transparente et ses icônes sont `#111`. Or HOME commence sur une photographie sombre avec overlays noirs. Sur mobile, le fond n’est blanc qu’à 14 %.

**Impact.** Les icônes noires deviennent peu visibles ou invisibles sur les zones sombres. Le contraste varie avec l’image, donc aucune conformité WCAG ne peut être garantie.

**Correction.** Utiliser un fond réel plus opaque, ou une variante de navigation claire sur le hero puis sombre sur fond clair. Tester au minimum 3:1 pour les icônes et 4,5:1 pour le texte.

**Note.** Le panneau contextuel a le même problème avec seulement 14 % de blanc et du texte noir.

### P1-10 — Icône Massage erronée et système d’icônes bien-être incomplet

**Constat.** Toutes les activités de bien-être affichent `mobility.svg`, une icône `move` à quatre flèches. Le référentiel déclare dix icônes spécifiques mais aucun fichier correspondant n’existe.

**Correction.** Résoudre l’icône par `MomentumWellbeing.getIcon(activity_type)` et ajouter les SVG manquants. Pour Massage, utiliser le lotus validé par le produit, pas une icône de déplacement.

### P1-11 — Les graphiques ne sont pas réellement accessibles

**Constat.** Les quatre graphiques sont des `canvas` sans tableau équivalent, résumé détaillé, navigation clavier ou contrôle alternatif. Les détails s’ouvrent uniquement au clic sur un élément graphique.

**Impact.** Lecture impossible ou très dégradée au clavier et avec lecteur d’écran.

**Correction.** Ajouter un résumé textuel, un tableau de données basculable et une liste de points/jours activables au clavier.

### P1-12 — Dépendance CDN : contenu analytique potentiellement invisible

**Constat.** Si Chart.js ne charge pas, les fonctions quittent silencieusement avant d’ajouter la classe qui rend les cartes visibles. Les cartes peuvent rester avec leur contenu animé à `opacity: 0` sans message.

**Correction.** Détecter l’échec du CDN, révéler les cartes, afficher une version tabulaire et un bouton de nouvelle tentative.

## 5. Anomalies importantes — P2

### P2-01 — Durée fragmentée en deux champs

Deux cases augmentent les déplacements, les erreurs et la charge cognitive pour une seule donnée. Regrouper visuellement heures et minutes dans un seul composant, avec libellé unique et exemple.

### P2-02 — Le sommeil répète la même fragmentation

La saisie bien-être utilise aussi heures et minutes séparées. La solution doit être un composant de durée partagé, pas deux corrections différentes.

### P2-03 — Le titre « Volume hebdomadaire » devient faux selon la période

Même si la granularité est corrigée, le titre doit devenir « Volume quotidien », « hebdomadaire » ou « mensuel » selon la vue. Le sous-titre doit annoncer exactement l’agrégation active.

### P2-04 — Zone centrale FLOW sans nom visible

Le centre de la grille a la clé `equilibre`, mais aucun libellé visuel ; le code l’annonce ensuite comme « Expérience ». Les huit autres zones sont nommées.

**Correction.** Choisir un nom produit unique et l’utiliser dans la grille, les détails et l’accessibilité.

### P2-05 — Seuils FLOW non documentés et asymétriques

Les niveaux sont regroupés 1–3, 4–6 et 7–10. La dernière bande contient quatre valeurs et occupe la même surface que les bandes de trois valeurs.

**Impact.** Une valeur 7 bascule déjà dans la zone haute ; cette règle n’est expliquée nulle part.

**Correction.** Documenter et valider scientifiquement les seuils, ou utiliser une échelle continue avec zones géométriques explicites.

### P2-06 — Valeurs estimées insuffisamment signalées dans la charge

Une activité sans RPE reçoit implicitement 5 pour le calcul. Le détail dit « estimé à 5 », mais le graphique global ne distingue pas les jours estimés des jours renseignés.

**Correction.** Indiquer la qualité des données dans le graphique et permettre de filtrer ou compléter les valeurs estimées.

### P2-07 — Le parcours post-enregistrement attend trop de services

Après une activité, l’interface attend un rerendu HOME complet, dont la météo sur sept jours, avant de proposer FLOW.

**Impact.** Une lenteur météo ou géocodage retarde une action qui n’en dépend pas.

**Correction.** Confirmer immédiatement l’activité, ouvrir FLOW, puis rafraîchir météo et HOME en arrière-plan.

### P2-08 — Les messages d’erreur exposent parfois le texte backend

FLOW, YOU et TOGETHER peuvent afficher directement `error.message`.

**Impact.** Messages techniques, incohérents, parfois en anglais, sans action proposée.

**Correction.** Mapper les erreurs connues vers un langage produit et journaliser le détail technique séparément.

### P2-09 — YOU peut afficher un âge faux pendant une partie de l’année

L’âge est calculé par `année courante - année de naissance`, sans vérifier si l’anniversaire est passé.

**Correction.** Calculer depuis `birth_date` complète.

### P2-10 — YOU journalise l’état utilisateur complet en console

Un bloc de debug s’exécute 1,5 seconde après le chargement et affiche le client, l’objet YOU et plusieurs éléments.

**Impact.** Bruit, exposition inutile de données de profil dans la console, impression de version non finalisée.

**Correction.** Supprimer le bloc de debug en production.

### P2-11 — YOU masque les erreurs partielles

Si sports, activités, matériel ou bien-être échouent, la page continue avec des tableaux vides et des textes comme « Apparaîtra avec tes activités ».

**Impact.** Une panne ressemble à une absence de données.

**Correction.** État d’erreur par section et conservation des dernières données.

### P2-12 — « Sources connectées » est un champ texte manuel

L’utilisateur peut écrire « Garmin, Strava » et faire apparaître ces sources comme connectées, sans connexion réelle.

**Impact.** Fausse assurance sur l’origine et la synchronisation des données.

**Correction.** Remplacer par des intégrations réelles ou renommer clairement « Sources déclarées ».

### P2-13 — Les onglets ne proposent pas le comportement clavier complet

Authentification et TOGETHER utilisent `role="tab"` mais n’implémentent pas les flèches gauche/droite, la gestion de `tabindex` ni l’association complète onglet/panneau.

**Correction.** Suivre le pattern ARIA Tabs ou revenir à de simples boutons si le comportement d’onglet n’est pas nécessaire.

### P2-14 — Navigation : identité visuelle incohérente

La marque de la sidebar est un carré noir avec « M », alors que les autres écrans utilisent le triangle `△`. Les pages HOME contiennent encore des styles d’une ancienne topbar non utilisée.

**Impact.** Sensation de couches de design superposées.

**Correction.** Choisir un seul symbole et retirer les styles/composants legacy.

### P2-15 — Paramètres « bientôt disponible » non actionnables et peu explicites

L’icône est un `span` non focusable avec `aria-disabled`. À la souris, aucun texte n’explique la situation ; au clavier, elle n’est pas atteignable.

**Correction.** Soit la retirer jusqu’à disponibilité, soit utiliser un bouton désactivé avec infobulle accessible.

## 6. Améliorations de finition — P3

### P3-01 — Texte secondaire trop discret

Plusieurs textes utilisent 9 à 11 px, une forte capitalisation et des gris très légers. Le footer de connexion (`#979a95` sur `#f7f6f1`) et les libellés à faible opacité doivent être revus pour lisibilité, particulièrement sur écran peu contrasté.

### P3-02 — Les dialogues utilisent plusieurs modèles d’interaction

Certains affichent des messages inline, d’autres des alertes natives, confirmations ou prompts. TOGETHER demande une légende photo via `prompt`, HOME supprime via `confirm`, YOU affiche parfois `alert`.

**Correction.** Unifier confirmations, erreurs et saisies courtes dans les dialogues MOMENTUM.

### P3-03 — État de succès FLOW absent

Le dialogue se ferme immédiatement, sans toast ni confirmation visible. Ajouter une confirmation courte (« Ressenti enregistré ») et mettre en évidence le point créé.

### P3-04 — Mémorisation des préférences d’analyse absente

Le retour sur Progression réinitialise période, mode temps/distance et indicateur de bien-être. Conserver les derniers choix rendrait l’outil plus stable.

### P3-05 — Libellés et unités parfois trop techniques

CTL/ATL sont remplacés dans l’interface principale, mais « charge aiguë / chronique », « VFC » et « confiance » restent peu expliqués. Ajouter une définition courte, surtout lorsque les valeurs sont modélisées.

### P3-06 — Favicon absent

Le navigateur demande `/favicon.ico` et reçoit une erreur 404. Ajouter l’icône de marque et ses variantes améliore la finition, l’identification des onglets et l’installation mobile.

## 7. Analyse spécifique de la fiabilité FLOW

### Ce qui est correct

- Un point dépend uniquement du défi et de la maîtrise déclarés.
- La base impose des valeurs de 1 à 10 et une évaluation unique par activité/utilisateur.
- Les politiques RLS protègent la propriété de l’évaluation.
- Les activités considérées sont filtrées sur le statut `done`.

### Ce qui explique les erreurs ou manques perçus

1. Une activité non exactement `done` n’apparaît pas, même si Progression la considère réalisée.
2. Plusieurs points identiques se masquent mutuellement.
3. Une requête de période peut écraser le résultat d’une autre.
4. Les erreurs d’ouverture sont seulement journalisées, sans message à l’utilisateur.
5. Les erreurs bien-être sont ignorées, donc le contexte peut manquer sans indication.
6. Pour une activité historique ouverte hors de la fenêtre chargée, le contexte de charge est reconstruit avec un historique incomplet.
7. Le formulaire peut enregistrer trois valeurs 5 non réellement choisies.
8. L’écriture du RPE de l’activité crée un effet secondaire dans Progression.

### Instrumentation minimale à ajouter

- identifiant de tentative d’enregistrement ;
- durée de chaque étape (activité, assessment, RPE, rechargement) ;
- résultat séparé de l’upsert et du rafraîchissement ;
- nombre d’activités chargées, évaluées, en attente et exclues par statut ;
- journal d’erreur corrélé, sans données personnelles ;
- événement UX `flow_submit_success`, `flow_submit_error`, `flow_reload_error`.

## 8. Plan de correction recommandé

### Lot 1 — Fiabilité et confiance

1. Sécuriser toute la soumission FLOW et séparer succès d’écriture / échec de rafraîchissement.
2. Supprimer la synchronisation silencieuse du RPE.
3. Verrouiller la création d’activité contre les doubles clics.
4. Remplacer les faux états vides HOME/YOU par de vrais états d’erreur.
5. Rendre les documents légaux accessibles.

### Lot 2 — Cohérence analytique

1. Retirer `planned` de tous les graphiques et détails réalisés.
2. Rendre la granularité du volume adaptative.
3. Calculer la charge avec une fenêtre historique indépendante de la période affichée.
4. Centraliser les statuts réalisés/prévus.
5. Signaler visuellement les valeurs estimées.

### Lot 3 — FLOW et données perçues

1. Empêcher les superpositions invisibles.
2. Exiger une intention explicite sur les trois curseurs.
3. Annuler les résultats de requêtes obsolètes.
4. Ajouter succès, retry et instrumentation.

### Lot 4 — Design et accessibilité

1. Corriger la sidebar avec variantes clair/sombre ou fond suffisamment opaque.
2. Créer les icônes bien-être et router Massage vers le lotus.
3. Ajouter alternatives textuelles/tableaux aux graphiques.
4. Unifier les composants de durée.
5. Revoir petits textes et contrastes secondaires.

## 9. Critères de recette prioritaires

- Sur « Semaine en cours », le volume présente sept colonnes quotidiennes.
- Aucune occurrence de « Prévu » n’existe dans Volume, Répartition sportive, Charge ou leurs détails.
- Une panne réseau pendant FLOW ne ferme jamais le dialogue et ne nécessite jamais de quitter le site.
- Après un upsert réussi, le succès reste acquis même si le rafraîchissement échoue.
- Enregistrer FLOW ne modifie pas le RPE d’origine sans consentement explicite.
- Deux activités ayant les mêmes réponses FLOW restent toutes deux découvrables.
- Une erreur de chargement HOME n’affiche jamais « Aucun moment ».
- Le bouton d’activité ne peut produire qu’une insertion par soumission.
- Massage affiche le lotus ; chaque autre activité de bien-être a une icône dédiée ou un fallback cohérent.
- La sidebar respecte le contraste sur le pixel le plus sombre et le plus clair du hero.
- Les graphiques restent compréhensibles et navigables sans souris et sans canvas.

## 10. Méthode et limites

L’audit a combiné :

- inspection de la version publiée non authentifiée et de l’écran de connexion ;
- lecture croisée des spécifications, de la charte FLOW, du HTML, des styles, de la logique JavaScript et des migrations Supabase ;
- analyse des états de chargement, erreur, vide, succès et concurrence ;
- vérification responsive et accessibilité à partir des règles CSS et de la structure sémantique ;
- exécution des 29 tests existants, tous réussis ;
- seconde passe contradictoire centrée sur les effets de bord et les écarts entre modules.

Les tests existants confirment surtout la présence des composants et certaines règles structurelles ; ils ne couvrent pas les doubles soumissions, erreurs réseau, courses de requêtes, contrastes contextuels, superposition des points, granularité ni suppression du prévu.

L’absence de session utilisateur disponible a empêché une reproduction visuelle directe des écrans authentifiés avec les données réelles du compte. Les causes relevées ci-dessus sont néanmoins directement observables dans le code. Une dernière recette avec un compte de test et un jeu de données contrôlé reste indispensable après correction.

---

# Complément — Audit de vision produit

## 11. Diagnostic de positionnement

La meilleure idée de MOMENTUM est déjà présente dans sa documentation : **la donnée ne doit pas être la finalité, elle doit aider une personne à comprendre l’histoire qu’elle est en train de vivre**.

Cette intention est différenciante. Strava, Garmin, TrainingPeaks et les applications de santé savent déjà compter, comparer, segmenter et modéliser. MOMENTUM ne gagnera pas en devenant un tableau de bord supplémentaire, même plus élégant. Il peut gagner en devenant le lieu où les activités cessent d’être des lignes de données pour devenir des expériences, des souvenirs et des transformations.

Aujourd’hui, le produit se trouve exactement entre ces deux identités :

- son langage, ses photographies et FLOW promettent un compagnon sensible ;
- ses interactions principales restent celles d’un outil de suivi : formulaires, calendrier, cartes KPI, graphiques et réglages de profil.

Le risque stratégique est donc clair : **une identité émotionnelle en surface, avec un produit analytique conventionnel en profondeur**.

### Évaluation de l’alignement à la vision

| Promesse | Expression actuelle | Diagnostic |
|---|---|---|
| La personne précède la performance | FLOW et certains textes le disent | Partiellement vrai ; Progression reprend vite le dessus |
| La donnée sert le récit | La donnée est souvent la structure principale de l’écran | Inversé dans Progression et dans plusieurs fiches |
| La progression compte plus que la comparaison | Aucune comparaison sociale directe | Bien respecté |
| Encourager sans culpabiliser | Ton calme, absence de streak | Bonne base, mais certains états vides soulignent le manque |
| Transformer l’activité en histoire | Journal, Horizon, Moments et FLOW existent | Les briques existent, mais ne forment pas encore un récit continu |
| Relier sport, bien-être, aventure et liens humains | Les quatre univers existent | Ils cohabitent plus qu’ils ne se répondent |

## 12. L’émotion actuelle : belle entrée, faible continuité

### Ce que MOMENTUM fait déjà ressentir

- **Aspiration.** La montagne, l’Horizon et les grands titres donnent de l’ampleur.
- **Calme.** L’interface évite la pression, les badges agressifs et la compétition.
- **Intimité.** Passeport, Cercle et ressenti FLOW parlent d’une expérience personnelle.
- **Possibilité.** « Écris la suite » est une bonne invitation fondatrice.

### Là où l’émotion retombe

1. Après le hero, HOME devient un assemblage météo, compteurs, calendrier et formulaires.
2. Le récit du jour se limite souvent à compter les « moments inscrits » au lieu de raconter ce qui s’est passé.
3. Après une activité, l’utilisateur est envoyé vers une nouvelle saisie chiffrée plutôt que vers un instant de reconnaissance ou de mémoire.
4. Progression ressemble à un dashboard analytique premium, mais encore générique.
5. YOU ressemble davantage à un espace de paramètres qu’à un portrait vivant.
6. TOGETHER organise efficacement, mais ne transmet pas encore la chaleur d’une expérience partagée.

Le parcours émotionnel démarre donc haut puis s’aplatit. La forme dit « aventure personnelle » ; les micro-interactions disent encore « renseigne et consulte tes données ».

## 13. Le storytelling : beaucoup de beaux concepts, pas encore une grammaire unique

MOMENTUM possède un vocabulaire riche : **Horizon, Journal, Moment, FLOW, Passeport, Cercle, Club, Progression, Fenêtre vivante, HOME, YOU, TOGETHER**.

Pris séparément, plusieurs de ces noms sont forts. Ensemble, ils produisent trop de métaphores concurrentes et un mélange français/anglais insuffisamment assumé. L’utilisateur doit comprendre simultanément une histoire, une carte, un passeport, une fenêtre, un cercle et plusieurs noms de modules anglais.

### Grammaire narrative recommandée

Chaque espace devrait répondre à une question humaine stable :

- **Horizon — Où ai-je envie d’aller ?**
- **Journal — Qu’ai-je vécu ?**
- **FLOW — Comment l’ai-je vécu ?**
- **Progression — Qu’est-ce qui change en moi et dans ma pratique ?**
- **Together — Avec qui ai-je partagé le chemin ?**
- **Passeport — Qui suis-je devenu au fil du parcours ?**

Cette grammaire relie les modules au lieu de les juxtaposer. Elle peut apparaître dans les introductions, les états vides et la navigation contextuelle.

### Principe éditorial

Chaque écran devrait respecter cet ordre :

1. **Une signification humaine.** Ce que cette journée ou période raconte.
2. **Une trace concrète.** Activité, photo, note, personne ou lieu.
3. **Une donnée explicative.** Les chiffres uniquement lorsqu’ils éclairent le récit.
4. **Une impulsion libre.** Ce que l’utilisateur peut choisir ensuite, sans injonction.

Aujourd’hui, plusieurs écrans commencent directement au niveau 3.

## 14. La boucle produit signature à construire

La boucle centrale ne devrait pas être « enregistrer → analyser → recommencer ». Elle devrait être :

1. **Choisir une intention** — un Horizon, même modeste.
2. **Vivre quelque chose** — sport, récupération, aventure ou moment partagé.
3. **En garder une trace** — activité, quelques mots, lieu ou photo.
4. **Nommer le ressenti** — FLOW, sans note de réussite.
5. **Faire émerger du sens** — une observation liée à plusieurs expériences.
6. **Retrouver la mémoire** — revoir un moment au bon instant.
7. **Choisir la prochaine impulsion** — pas une prescription, une possibilité.

Cette boucle correspond exactement au nom MOMENTUM : une expérience produit l’élan de la suivante. Actuellement, les étapes 1 à 4 existent séparément ; les étapes 5 à 7 sont encore faibles.

## 15. Audit émotionnel par moment du parcours

### Première visite et inscription

**Force.** L’écran de connexion est le plus accompli visuellement. Il communique aventure, calme et qualité.

**Faiblesse.** L’onboarding collecte surtout identité, disciplines, volume, objectif, événement et montre connectée. Il apprend ce que la personne fait, mais peu ce qui la met en mouvement.

**Question fondatrice manquante.** « Qu’aimerais-tu ressentir davantage dans ta vie grâce au mouvement ? »

Une réponse libre ou quelques intentions — liberté, confiance, énergie, présence, lien, dépassement, apaisement — offriraient une base émotionnelle bien plus distinctive qu’un simple volume hebdomadaire.

### Retour quotidien

**Force.** HOME peut devenir un rituel, avec son image et son ouverture sur la journée.

**Faiblesse.** L’utilisateur ne reçoit pas encore une raison émotionnelle de revenir. La météo et le calendrier sont utiles, mais remplaçables.

**Signature possible.** Une seule phrase vraie et contextualisée : « Hier, tu as repris le chemin après six jours de pause » ou « Cette semaine a surtout été une semaine de récupération ». Elle doit rester factuelle, humble et explicable.

### Juste après une activité

**Force.** C’est le meilleur moment pour FLOW.

**Faiblesse.** Trois curseurs successifs ressemblent à une évaluation. L’expérience risque d’être transformée en questionnaire au moment même où MOMENTUM prétend préserver le vécu.

**Recommandation.** Commencer par une question émotionnelle simple : « Qu’est-ce que tu veux garder de ce moment ? » La note ou la photo est facultative. Les trois dimensions FLOW peuvent ensuite apparaître comme un approfondissement rapide.

### Fin de semaine

**Manque actuel.** Il n’existe pas de véritable chapitre hebdomadaire. Une barre de volume ne produit pas une histoire.

**Signature possible.** Une page « Cette semaine » composée de trois blocs :

- ce que tu as vécu ;
- ce qui semble avoir changé ;
- ce que tu veux emporter dans la semaine suivante.

Le volume et la charge restent disponibles en détail, mais ne sont plus le titre principal.

### Retour après une longue absence

**Risque.** Les espaces vides et données manquantes peuvent faire ressentir un retard.

**Positionnement recommandé.** MOMENTUM ne doit jamais parler de série interrompue, d’objectif manqué ou de retard. Le retour lui-même est un moment : « Le chemin reprend ici. »

### Expérience partagée

**Force.** Cercle, Clubs, invitations et souvenirs donnent une base solide.

**Faiblesse.** La majorité des actions concernent l’organisation : créer, inviter, accepter, refuser, confirmer.

**Signature possible.** Après un Moment, chaque participant peut laisser une trace légère : une photo, un mot, une sensation ou « ce que j’emporte ». TOGETHER devient alors un album vivant, pas seulement un agenda social.

## 16. Audit de l’identité visuelle

### Forces

- La photographie de montagne installe immédiatement un territoire émotionnel.
- La palette minérale et végétale soutient la promesse de calme.
- Les grands titres éditoriaux donnent de l’ambition.
- Les formes arrondies et les surfaces aérées évitent l’esthétique de performance agressive.
- Progression possède une exécution visuelle plus soignée que beaucoup de dashboards sportifs.

### Faiblesses

#### 1. L’identité repose trop sur une photographie générique

La montagne fonctionne pour l’acquisition, mais elle ne peut pas rester l’émotion principale de tous les utilisateurs. Quelqu’un qui pratique la natation, le yoga, le padel ou la musculation ne doit pas avoir l’impression d’entrer dans un produit de trail.

**Direction.** La photographie de marque ouvre l’univers ; les propres images, lieux, traces et couleurs de la personne doivent progressivement le personnaliser.

#### 2. Les pages ne semblent pas toutes appartenir au même récit

HOME est photographique, Progression éditoriale, YOU minimaliste noir et blanc, TOGETHER forestier et social. La variété peut être riche, mais elle manque d’un fil visuel constant.

**Direction.** Conserver des atmosphères par module tout en partageant : typographie, symbole, rythme vertical, traitement photo, système d’icônes, transitions et structure narrative.

#### 3. La marque hésite entre triangle et « M »

Le triangle `△` évoque horizon, ascension et mouvement. Le « M » de la sidebar est plus générique et affaiblit la mémorisation.

**Direction.** Choisir un symbole principal et lui donner une signification stable. Le triangle paraît aujourd’hui plus distinctif.

#### 4. Le système d’icônes ne raconte pas le produit

Une vaste bibliothèque sportive existe, mais le bien-être, les émotions et les souvenirs ne bénéficient pas du même soin. L’erreur Massage illustre ce déséquilibre : le sport est précis, le vécu est générique.

**Direction.** Concevoir une famille d’icônes propriétaire ou au moins curatée pour FLOW, bien-être, mémoire, lien et aventure.

#### 5. La transparence est devenue une règle esthétique sans garde-fou

Le verre peut évoquer légèreté et immersion, mais lorsqu’il réduit la lisibilité de la navigation, l’effet de marque devient un obstacle.

**Direction.** La clarté doit primer sur la transparence. Le verre doit avoir une densité minimale et une variante contextuelle.

## 17. Audit stratégique par espace

### HOME — de tableau du jour à ouverture de chapitre

**Rôle actuel.** Regrouper journée, météo, moments, calendrier et FLOW.

**Rôle recommandé.** Faire sentir à la personne où elle se trouve dans son histoire aujourd’hui.

**Évolution :**

- remplacer le comptage mécanique par une phrase narrative ;
- faire émerger un souvenir récent ou une continuité avec l’Horizon ;
- hiérarchiser une seule action utile ;
- déplacer les informations secondaires derrière une révélation progressive ;
- adapter le hero à la personne à mesure que son histoire s’enrichit.

### FLOW — du graphique au cœur émotionnel de MOMENTUM

FLOW est l’actif le plus différenciant du produit. Il devrait être traité comme une expérience centrale, pas comme une section au bas de HOME.

**Évolution :**

- chaque point devient une miniature de souvenir, pas seulement un marqueur ;
- la carte doit permettre de retrouver des expériences, lieux, saisons et personnes ;
- les observations apparaissent seulement après assez de matière ;
- aucune zone ne doit être récompensée visuellement au détriment des autres ;
- le vocabulaire doit rester descriptif, jamais prescriptif.

### Progression — de mesure à compréhension

**Rôle actuel.** Rassembler les analyses.

**Risque.** Devenir la page que n’importe quelle application sportive pourrait proposer.

**Évolution :**

- commencer par « ce qui change » et non par quatre KPI ;
- distinguer faits, estimations et interprétations ;
- relier charge, bien-être et FLOW dans une lecture prudente ;
- montrer les données détaillées à la demande ;
- remplacer les formulations qui jugent par des observations qui ouvrent une réflexion.

Exemple : « Tes sorties les plus engageantes ont souvent lieu après une journée de récupération » est plus MOMENTUM que « Forme +12 » — à condition que le lien soit robuste et explicable.

### YOU — de formulaire de profil à portrait évolutif

**Rôle actuel.** Profil, Horizon, sports, bien-être, matériel, passeport.

**Évolution :**

- présenter les saisons de pratique et les évolutions d’identité ;
- faire apparaître ce qui compte pour la personne, pas seulement ses mensurations ;
- distinguer « ce que j’ai déclaré », « ce que je vis actuellement » et « ce qui a changé » ;
- transformer le Passeport en archive personnelle exportable et maîtrisée.

### TOGETHER — de coordination à mémoire partagée

**Rôle actuel.** Cercle, Clubs, invitations et Moments.

**Évolution :**

- conserver la qualité logistique, mais rendre l’après-Moment aussi important que l’avant ;
- créer des cartes-souvenirs collectives ;
- permettre une réciprocité légère, sans fil social compétitif ;
- éviter les métriques de popularité, les classements et la pression de publication.

### Onboarding — de qualification à pacte émotionnel

**Évolution :**

- garder les questions nécessaires à la personnalisation ;
- demander l’intention émotionnelle principale ;
- expliquer comment les réponses seront utilisées ;
- montrer immédiatement un premier HOME personnalisé ;
- permettre de passer les questions non essentielles.

## 18. Principes produit à inscrire dans l’ADN

### 1. Une donnée n’apparaît que si elle aide à comprendre

Chaque métrique doit répondre à une question humaine. Sinon, elle reste disponible en détail mais ne structure pas l’expérience.

### 2. Le produit observe avant d’interpréter

Une observation factuelle est préférable à une conclusion psychologique fragile. MOMENTUM doit dire ce qu’il voit, le niveau de confiance et ce qu’il ne sait pas.

### 3. Le souvenir vaut autant que la performance

Une photo, une phrase ou une personne peut être plus importante qu’un record. L’architecture doit traiter ces traces comme des données de premier rang.

### 4. Aucune absence n’est une faute

Pas de streak culpabilisant, pas de rouge pour sanctionner l’inactivité, pas de « retard ». Le produit accueille les pauses comme une partie normale d’un parcours.

### 5. La prochaine impulsion reste un choix

MOMENTUM peut proposer, jamais ordonner. Toute recommandation doit pouvoir être ignorée sans pénalité ni jugement.

### 6. L’intimité augmente avec la confiance

Le produit commence sobrement et devient plus personnel à mesure que l’utilisateur lui confie du vécu. Il explique toujours pourquoi une donnée est demandée.

### 7. La narration ne doit jamais masquer l’incertitude

Un beau texte ne doit pas transformer une estimation faible en vérité. La poésie de marque doit renforcer la confiance, pas maquiller le modèle.

## 19. Concepts d’expérience signature

### « Le chapitre de la semaine »

Un récit court généré à partir de faits vérifiables, accompagné de trois traces choisies : activité, ressenti, souvenir. L’utilisateur peut corriger ou réécrire la phrase.

### « Ce moment revient »

Une expérience passée réapparaît lorsqu’elle résonne avec la date, le lieu, la saison ou l’Horizon actuel. Pas comme une notification fréquente, mais comme une mémoire rare et pertinente.

### « La carte de ce qui me fait vivre »

Une évolution de FLOW où les points peuvent être explorés par activité, personne, lieu, saison ou sensation. La carte révèle progressivement des contextes, sans score global.

### « Mon portrait en mouvement »

Dans YOU, une chronologie douce montre les pratiques qui apparaissent, disparaissent ou reviennent. L’identité sportive devient vivante plutôt que figée dans l’onboarding.

### « La trace partagée »

Après un Moment TOGETHER, chaque participant peut déposer une image ou une phrase. MOMENTUM compose une carte collective que chacun conserve selon ses droits.

## 20. Ton éditorial recommandé

### À préserver

- phrases courtes et calmes ;
- langage de chemin, d’expérience et de présence ;
- tutoiement proche sans familiarité excessive ;
- invitations ouvertes ;
- reconnaissance des pauses, de la récupération et de l’incertitude.

### À éviter

- surpromesses psychologiques (« ton corps est prêt ») ;
- langage de réussite appliqué aux zones FLOW ;
- injonctions déguisées en encouragement ;
- accumulation de slogans sur un même écran ;
- poésie générique non liée aux données réelles de la personne.

### Formule éditoriale utile

> **Fait observé → signification possible → liberté de choix**

Exemple : « Tu as couru deux fois cette semaine, toutes deux avec une maîtrise élevée. Peut-être que ce rythme te convient en ce moment. À toi de voir ce que tu veux garder. »

## 21. Mesures de succès cohérentes avec la vision

Les métriques classiques de rétention restent utiles, mais elles ne doivent pas devenir la boussole unique.

### Indicateurs de valeur

- proportion d’activités auxquelles une trace personnelle est ajoutée ;
- taux de complétion FLOW volontaire, sans rappel insistant ;
- nombre de semaines où l’utilisateur consulte ou édite son chapitre ;
- revisites d’anciens Moments ou souvenirs ;
- proportion d’observations jugées utiles, corrigées ou ignorées ;
- nombre de Moments partagés enrichis après leur réalisation ;
- retour après une pause, sans désabonnement ni abandon du parcours.

### Garde-fous

- ne pas optimiser le nombre de saisies au détriment de leur sens ;
- ne pas augmenter artificiellement les notifications ;
- ne pas transformer FLOW en objectif de complétion ;
- ne pas utiliser la comparaison sociale comme moteur de rétention ;
- mesurer la confiance et la compréhension des données.

## 22. Roadmap de vision recommandée

### Horizon 1 — Rendre la promesse vraie

- résoudre les défauts de fiabilité de l’audit UX ;
- unifier le vocabulaire et le symbole de marque ;
- transformer les états vides et erreurs ;
- créer le système d’icônes émotion/bien-être ;
- distinguer partout faits, estimations et interprétations.

### Horizon 2 — Installer le récit continu

- chapitre hebdomadaire ;
- trace post-activité ;
- HOME narratif et personnalisé ;
- portrait évolutif dans YOU ;
- souvenirs post-Moment dans TOGETHER.

### Horizon 3 — Construire les expériences signature

- carte FLOW enrichie ;
- mémoire contextuelle rare et pertinente ;
- observations longitudinales explicables ;
- prochaine impulsion choisie ;
- export personnel du parcours et de ses souvenirs.

## 23. Conclusion de vision

MOMENTUM ne doit pas chercher à mieux compter le sport. Il doit chercher à **mieux préserver ce que le mouvement change dans une vie**.

Le produit possède déjà les bons matériaux : Horizon pour l’intention, Journal pour la trace, FLOW pour le vécu, Progression pour la compréhension, Together pour le lien et Passeport pour l’identité. Sa prochaine étape n’est pas d’ajouter davantage de modules. C’est de faire circuler une même histoire entre ceux qui existent.

La question directrice pour chaque future fonctionnalité devrait être :

> **Est-ce que cela aide la personne à vivre, comprendre ou se rappeler son chemin — ou est-ce seulement une donnée de plus ?**

Si MOMENTUM tient cette ligne, il peut effectivement devenir bien plus qu’une application de suivi sportif : un compagnon de continuité personnelle, sensible aux expériences, aux pauses, aux relations et à la manière unique dont chacun construit son propre élan.
