# MOMENTUM — Authentification et Onboarding v1.0

## État de la configuration Supabase

Projet : `momentum-alpha`

### Authentification

- Inscriptions par e-mail : activées.
- Confirmation de l'adresse e-mail : activée.
- Connexions anonymes : désactivées.
- Liaison manuelle d'identités : désactivée.
- Fournisseurs sociaux : désactivés en v1, prêts à être ajoutés ultérieurement.

### Politique de mot de passe

- Longueur minimale : 8 caractères.
- Changement de mot de passe sécurisé : activé.
- Confirmation sécurisée d'un changement d'adresse e-mail : activée.
- Mot de passe actuel exigé lors d'une modification : désactivé pour préserver le parcours de récupération par e-mail.
- Détection des mots de passe compromis : indisponible sur le plan Free ; à activer lors du passage au plan Pro.

### Durcissement de sécurité

- L'énumération anonyme des objets du bucket `avatars` est interdite.
- Les URL publiques directes des avatars restent accessibles.
- La modification d'un avatar est limitée au dossier de son propriétaire.
- La fonction privilégiée de maintenance RLS n'est pas exécutable par les rôles API.
- Le chemin de recherche de la fonction `set_updated_at` est fixé explicitement.

### URL principale

`https://momentum-alpha-rho.vercel.app`

### URL de redirection autorisées

Production :

- `https://momentum-alpha-rho.vercel.app/welcome.html`
- `https://momentum-alpha-rho.vercel.app/login.html?recovery=1`
- `https://momentum-alpha-rho.vercel.app/you.html`
- `https://momentum-alpha-rho.vercel.app/index.html`

Développement local :

- `http://127.0.0.1:5500/welcome.html`
- `http://127.0.0.1:5500/login.html?recovery=1`
- `http://127.0.0.1:5500/you.html`
- `http://127.0.0.1:5500/index.html`

## Parcours attendu

1. L'utilisateur crée son compte depuis `login.html`.
2. Supabase envoie l'e-mail de confirmation.
3. Le lien ouvre `welcome.html` avec une session valide.
4. Le déclencheur de base de données a déjà préparé toutes les structures utilisateur.
5. Chaque chapitre du Passeport est sauvegardé dans `onboarding_progress`.
6. La dernière étape marque `personalization.onboarding_completed` comme vrai.
7. L'utilisateur est redirigé vers `you.html`.

## Vérification avant mise en production

- Configurer un serveur SMTP dédié ; le service e-mail intégré de Supabase est destiné aux essais et possède des limites strictes.
- Fournir les contenus juridiques définitifs avant d'activer les liens Conditions générales et Politique de confidentialité.
- Effectuer un test avec une nouvelle adresse e-mail réelle : inscription, confirmation, reprise d'onboarding, finalisation et récupération du mot de passe.
- Envisager Cloudflare Turnstile ou hCaptcha lorsque les clés et les domaines de production sont disponibles.
- Activer la protection contre les mots de passe compromis lors d'un passage au plan Pro.

## Évolutions prévues

Les futurs fournisseurs Google et Apple pourront être activés dans Supabase Auth sans modifier le parcours principal. Les connexions COROS, Garmin, Polar, Suunto et Strava resteront des intégrations sportives distinctes de l'identité Momentum.
