# Relevé technique du 23 septembre 2026

Source : `main` 60e293d2ed2eb9b507ca0135f0635f1da8402120. Vercel confirme ce commit sur la production `momentum-alpha`, déploiement dpl_9KcrB5DwLSqAEEXgWFuBshxHDet8. Le travail iOS 040acc4 est distinct. Supabase : projet momentum-alpha, région déclarée **eu-west-1**, Postgres 17.6. La région de la base ne prouve ni les pays de support ni tous les transferts. Aucune donnée utilisateur lue pour cet audit.

## Traitements et destinataires constatés

| Usage / provenance | Données / stockage | Destinataires techniques | Durée constatée / décision restant nécessaire |
|---|---|---|---|
| Compte saisi par l’utilisateur | Supabase Auth ; e-mail et secret d’authentification, sessions | Supabase ; SMTP réel à vérifier | Durée du compte, comptes incomplets et logs à décider |
| Profil et journal saisis/importés | passports, profiles, activities, activity_timeline, days, activity_flow_assessments, daily_wellbeing, wellbeing_profile, user_locations, user_sport_preferences, user_goals, user_load_estimates | Supabase ; propriétaire ; projections sociales restreintes | Compte actif / inactif, sauvegardes à décider |
| Sport / nutrition / matériel | user_sports, user_equipment, activity_equipment, nutrition_products, activity_nutrition_items, user_missions | Supabase ; instantanés nutritionnels utilisés par d’autres conservés | Purge account-deletion documentée, durée normale à décider |
| Cercle, Clubs, Moments | circle_relationships, circle_preferences, blocked_users, connections, clubs, club_members, club_member_preferences, moments, moment_participants, moment_availability, moment_date_options, moment_activities, reactions, invitations | Destinataires selon RLS et membership, Supabase | Titres/dates collectifs et contributions d’autrui conservés après suppression ; durées à valider |
| FIT/GPX et photos | activities, activity-media, moment-media, avatars, club-logos + références SQL | Supabase Storage ; personnes autorisées selon objet | Fichiers nettoyés de façon asynchrone, reprise en erreur ; sauvegardes non vérifiées |
| Invitation sans compte | private.guest_invitations / guest_sessions ; nom d’usage, réponse, créneaux ; libellé fourni par l’organisateur | Organisateur ; capacités individuelles | Lien : max 30 jours, limité par date de fin + 2 jours ; session 1 h. Cela ne fixe PAS la durée de conservation des réponses |
| Anti-abus invités | private.guest_rate_buckets ; empreinte de l’IP transmise par l’infrastructure | Supabase | Anciennes fenêtres supprimées après 2 jours lors d’un nouvel appel ; absence de cron de purge dédiée |
| Export | private.personal_exports / personal_export_items | Titulaire uniquement | Snapshot 1 h ; suppression opportuniste à l’export suivant / suppression compte ; purge globale à compléter |
| Suppression | private.account_deletions, storage_cleanup, receipt | Traitement serveur ; titulaire par reçu privé | Reçu : 7 jours après fin, purge planifiée existante ; statut actif distinct des sauvegardes |
| SDK, graphiques, carte | scripts cdn.jsdelivr.net (plusieurs anciennes versions flottantes) | jsDelivr et infrastructure ; IP/requête | Cache HTTP et logs fournisseur non vérifiés |
| Carte | tuiles OpenStreetMap demandées par le navigateur | OpenStreetMap ; IP et tuiles couvrant la zone | Durée fournisseur et pays à valider |
| Recherche de lieu | api/locations.js → Geoapify | Vercel + Geoapify ; recherche ou coordonnées, IP serveur | Le CDC initial omettait Geoapify ; contrat, logs et pays à valider |
| Météo | coordonnées + date envoyées directement à Open-Meteo | Open-Meteo ; IP/requête | Ancien code : précision exacte ; nouvelle branche : arrondi à 2 décimales ; durée fournisseur à valider |
| Hébergement / journaux | fichiers statiques et API locations | Vercel ; accès et logs | Configuration région/logs/analytique externe et contrats à contrôler |
| Preuve juridique (nouveau) | private.legal_documents, legal_events et legal_release ; empreinte exacte, version, date serveur, identité interne | Titulaire par RPC / export ; administration habilitée | Pas d’IP, UA, jeton, texte utilisateur. Événements supprimés en cascade à la suppression de l’identité ; conservation à valider avant activation |

## Stockage réel côté navigateur (analyse source)

| Famille | Émetteur / finalité | Nature / durée | Contrôle |
|---|---|---|---|
| `sb-<ref>-auth-token` et clés PKCE associées | SDK Supabase ; maintenir la session | localStorage par défaut ; persiste après fermeture jusqu’à déconnexion/effacement ; expiration/rotation Auth distinctes | Déconnexion, suppression stockage du site ; qualification nécessaire à valider |
| `momentum:ui:<user>:*` | MOMENTUM ; état d’interface du compte | sessionStorage ; onglet, nettoyé à déconnexion/changement de compte | Fermeture onglet ; aucune donnée sensible dans ces clés |
| Saisies, import en cours, lien invité, reçu | Mémoire JS de l’onglet | Pas de preuve juridique locale ; détruit avec page/onglet | Fermeture, annulation ; aucun mot de passe persistant ajouté |
| Cache HTTP | Navigateur / tiers | Selon en-têtes ; à mesurer | Paramètres navigateur |

Aucun analytics/publicité/pixel identifié dans les sources. Cette observation ne valide pas la configuration Vercel ni les requêtes réelles : pas de bannière générique ajoutée. Toute activation future passe par le contrôle de publication.

## Visibilité Storage constatée en production

`activities`, `activity-media`, `moment-media`, `club-logos` : privés. `avatars` et ancien `media` : **publics**. Ne pas promettre que tous les médias sont privés. Pas de changement destructeur de bucket dans ce lot ; les références historiques et caches doivent être traités avant une éventuelle fermeture. Les liens privés d’export durent une heure.

## Limitations du relevé

SMTP, sous-traitants ultérieurs, contrats, lieux d’accès support, rétentions des logs et sauvegardes ne sont pas établis par ces appels. La recette locale Supabase a confirmé les parcours multi-comptes, Storage, export et suppression asynchrone avec données fictives. La restauration des sauvegardes hébergées et la vérification de leurs durées restent requises. Advisors Supabase : aucun nouvel objet distant créé ; avertissement existant « leaked password protection disabled », tables privées sans politiques volontairement inaccessibles directement. Ne pas assimiler cet audit technique à une validation juridique.

## Mesure navigateur anonyme — 23 septembre 2026

Chromium, profil neuf, aucune connexion ni interaction métier sur le domaine de production :

| Page | Origines réseau observées | Stockages après chargement |
|---|---|---|
| login.html | domaine MOMENTUM et cdn.jsdelivr.net | Aucun nom de clé localStorage/sessionStorage ; aucun cookie accessible à document.cookie |
| discover.html | domaine MOMENTUM | Aucun nom de clé localStorage/sessionStorage ; aucun cookie accessible à document.cookie |

Cette mesure couvre les ressources visibles dans Performance Resource Timing et le stockage accessible à la page, pas les cookies HttpOnly, les journaux serveurs ni tous les comportements régionaux. La session authentifiée a seulement été testée sur la fixture locale ; aucun compte réel n’a été utilisé. Le scénario UE dépend de L02 et reste à réaliser.
