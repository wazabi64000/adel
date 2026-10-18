# Coach Adel — application Full-Stack

Application complète pour **Coach Adel** : landing page dynamique, **espace
administrateur** (coach) et **espace sportif** (athlètes), avec suivi et
statistiques d'entraînement.

- Atterrissage repris de la landing statique d'origine (HTML/CSS/images).
- Backend **Express (ESM)** + **Twig** (moteur de vues) + **MySQL**.
- Images envoyées sur **Cloudinary** (repli local en développement).
- E-mails transactionnels via **Brevo** (SMTP).

> Le dossier s'appelle `application-adel` (avec un tiret) pour éviter les
> espaces dans les chemins. Le projet d'origine (landing `index.html`, `image/`)
> n'est ni modifié ni supprimé.

---

## 1. Fonctionnalités

### Site public
- Landing page (`/`) : hero, sections présentation, **articles** et **posts**
  publiés depuis la base, formulaire de **contact** et demande d'**accès sportif**.
- `/articles` : liste des conseils ; `/articles/:slug` : détail d'un article.

### Espace administrateur (`/admin`, rôle `admin`)
- Tableau de bord (compteurs, messages non lus, demandes en attente).
- **Articles** : créer / éditer / publier / supprimer (avec image de couverture).
- **Posts** : créer / éditer / supprimer (réseaux sociaux).
- **Profils sportifs** : créer / éditer / supprimer un athlète, créer (ou
  réinitialiser) son **compte d'accès** (mot de passe provisoire + e-mail).
- **Photos de progression** (dans le profil d'un athlète) : téléverser des photos
  **avant / après**, **par date** et par **vue** (devant, dos, profil droit,
  profil gauche) ; galerie de comparaison et suppression.
- **Programmes** : créer un programme (`salle` ou `home`), gérer les
  **journées** (semaine + jour de la semaine, repos éventuel) et les
  **exercices** (type, séries, répétitions, repos, charge, image, vidéo).
- Vue programme avec **statistiques** d'assiduité pour adapter les séances.
- **Messages** de contact et **pré-inscriptions** (valider/refuser, créer l'accès).
  - Flux de pré-inscription : le visiteur se pré-inscrit via la **modale** de la
    page d'accueil. Le coach reçoit un e-mail avec un **lien de validation par UUID**
    (`/preinscription/valider/:uuid`) et peut aussi valider depuis `/admin/demandes`.
  - Depuis une demande approuvée, **« Créer l'accès »** génère le profil sportif +
    le compte, envoie un **mot de passe provisoire** par e-mail ; l'athlète doit
    choisir son mot de passe à la **première connexion** (redirection `/compte`).

### Espace sportif (`/mon-espace`, rôle `athlete`)
- Tableau de bord : programmes actifs, progression, dernières séances.
- Programme visible **jour / semaine / mois**, exercices du jour avec image.
- Enregistrement d'une séance (séries, reps, charge, durée, RPE, ressenti).
- `/mon-espace/stats` : statistiques personnelles et historique.

---

## 2. Prérequis
- **Node.js ≥ 20** (développé et testé sur Node 22).
- **MySQL 8** (ou MariaDB récente), encodage `utf8mb4`.
- (Optionnel, production) compte **Cloudinary** et compte **Brevo**.

---

## 3. Installation

```bash
cd application-adel
npm install
cp .env.example .env      # puis renseigner les variables
npm run db:setup          # crée la base et les 11 tables
npm run db:seed           # crée l'admin + des données de démonstration
npm start                 # http://localhost:3000
```

En développement : `npm run dev` (redémarrage automatique).

### Variables d'environnement (`.env`)
Toutes les variables sont documentées dans `.env.example` :

| Groupe | Variables |
| ------ | --------- |
| Application | `NODE_ENV`, `PORT`, `APP_URL`, `APP_NAME` |
| Session | `SESSION_SECRET` (longue chaîne aléatoire) |
| MySQL | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_CONNECTION_LIMIT` |
| Cloudinary | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER` |
| Brevo SMTP | `BREVO_SMTP_HOST`, `BREVO_SMTP_PORT`, `BREVO_SMTP_USER`, `BREVO_SMTP_PASSWORD`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME` |
| Seed admin | `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` |

Comportements de repli (aucun blocage) :
- **Cloudinary non configuré** → l'image est enregistrée dans `public/uploads/`.
- **Brevo non configuré** → l'envoi d'e-mail est ignoré et journalisé, le flux
  applicatif continue normalement.

### Comptes créés par le seed
- **Administrateur** : `ADMIN_EMAIL` / `ADMIN_PASSWORD` (valeurs `.env`).
- **Sportif de démonstration** : `hami@example.com` / `athlete123` (à changer).

---

## 4. Scripts npm

| Script | Rôle |
| ------ | ---- |
| `npm start` | Démarre le serveur (`src/server.js`). |
| `npm run dev` | Démarre avec `node --watch`. |
| `npm run db:setup` | Applique `src/db/schema.sql` + migrations de colonnes (idempotent). |
| `npm run db:seed` | Insère l'admin et des données de démonstration. |
| `npm run check` | Vérification syntaxique du point d'entrée. |

---

## 5. Architecture

```
application-adel/
├── public/                 # fichiers statiques (CSS, JS, images, uploads de repli)
│   ├── css/site.css        # styles de la landing (repris) + composants publics
│   ├── css/admin.css       # styles des espaces admin & sportif
│   ├── js/site.js          # script de la landing (copie à l'identique)
│   ├── js/admin.js         # petites interactions admin (previews, confirmations)
│   └── image/              # images de la landing
├── src/
│   ├── config/             # env, database (pool), twig, cloudinary, mailer
│   ├── controllers/        # public, auth, admin/*, athlete/*
│   ├── db/                 # schema.sql, setup.js, seed.js
│   ├── middlewares/        # auth, csrf, upload (multer), rateLimit, badges, locals, errors
│   ├── repositories/       # accès SQL (une par entité)
│   ├── routes/             # index, public, auth, admin, athlete
│   ├── services/           # auth, upload, mail, stats
│   ├── utils/              # http (asyncHandler, paginate…), slugify
│   ├── validators/         # validation des entrées
│   ├── app.js              # câblage Express
│   └── server.js           # point d'entrée
└── views/                  # templates Twig
    ├── layouts/            # public, admin, auth, athlete
    ├── partials/           # flash, navigation, pagination
    ├── public/             # home, articles, article
    ├── admin/              # dashboard, articles, posts, athletes, programs, messages, requests
    ├── athlete/            # dashboard, program, day, stats
    ├── auth/               # login, forgot/reset password, compte
    └── errors/             # 403, 404, 500
```

### Base de données (11 tables)
`users`, `athletes`, `programs`, `program_days`, `exercises`,
`exercise_logs`, `articles`, `posts`, `contact_messages`,
`access_requests`, `password_resets`. La table `sessions` est créée
automatiquement par `express-mysql-session`.

---

## 6. Sécurité
- Sessions serveur (`express-session` + stockage MySQL), cookie `httpOnly`.
- Mots de passe **bcrypt** (12 rounds).
- **CSRF** par jeton synchronisé (session) sur toutes les requêtes mutantes ;
  vérification différée après `multer` pour les formulaires d'upload.
- `helmet` avec CSP adaptée (Cloudinary autorisé, styles inline de la landing).
- **Rate limiting** global et renforcé sur l'authentification et les formulaires.
- Contrôle d'accès : `requireAdmin` / `requireAthlete` + vérification
  d'appartenance (anti-IDOR) sur les programmes et les journées.
- Requêtes SQL **préparées** (aucune concaténation de valeurs).
- Jetons de réinitialisation stockés **hachés** (SHA-256), usage unique, 1 h.

---

## 7. Routes principales

| Méthode | Chemin | Accès |
| ------- | ------ | ----- |
| GET | `/` | public |
| GET | `/articles`, `/articles/:slug` | public |
| POST | `/contact`, `/acces-sportif` | public |
| GET | `/preinscription/valider/:uuid` | public (lien e-mail coach) |
| GET/POST | `/login`, `/forgot-password`, `/reset-password` | public |
| GET/POST | `/compte` | connecté |
| GET | `/admin`, `/admin/articles`, `/admin/posts`, `/admin/athletes`, `/admin/programs`, `/admin/messages`, `/admin/demandes` | admin |
| GET | `/mon-espace`, `/mon-espace/programme/:id`, `/mon-espace/programme/:id/jour/:dayId`, `/mon-espace/stats` | athlète |
| POST | `/mon-espace/log` | athlète |

---

## 8. Démarrage en production (aperçu)
1. Renseigner `.env` (dont `NODE_ENV=production`, `SESSION_SECRET`,
   Cloudinary et Brevo).
2. `npm run db:setup` puis `npm run db:seed`.
3. Servir derrière un reverse-proxy HTTPS (`trust proxy` est activé en prod)
   et lancer `npm start` (par ex. via systemd / pm2 / Docker).
