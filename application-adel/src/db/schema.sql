-- =========================================================
--  Application Coach Adel — schéma MySQL / MariaDB
--  Encodage : utf8mb4 — Moteur : InnoDB
--  Rejouable : CREATE TABLE IF NOT EXISTS
-- =========================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------
--  Utilisateurs (administrateur / coach + accès sportifs)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(150) NOT NULL,
  email         VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin','athlete') NOT NULL DEFAULT 'athlete',
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  last_login_at DATETIME NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------
--  Profils sportifs suivis par le coach (1 profil = 1 user athlete)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS athletes (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NULL,
  first_name  VARCHAR(100) NOT NULL,
  last_name   VARCHAR(100) NOT NULL,
  email       VARCHAR(190) NULL,
  phone       VARCHAR(40)  NULL,
  birthdate   DATE NULL,
  gender      ENUM('femme','homme','autre') NULL,
  height_cm   SMALLINT UNSIGNED NULL,
  weight_kg   DECIMAL(5,2) NULL,
  level       ENUM('debutant','intermediaire','avance') NOT NULL DEFAULT 'debutant',
  goal        VARCHAR(255) NULL,
  notes       TEXT NULL,
  photo_url   VARCHAR(500) NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_athletes_user (user_id),
  KEY idx_athletes_name (last_name, first_name),
  CONSTRAINT fk_athletes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------
--  Photos de progression avant / après (4 vues, par date)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS progress_photos (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  athlete_id      INT UNSIGNED NOT NULL,
  taken_on        DATE NOT NULL,
  phase           ENUM('avant','apres') NOT NULL,
  view_key        ENUM('devant','dos','profil_droit','profil_gauche') NOT NULL,
  image_url       VARCHAR(500) NOT NULL,
  image_public_id VARCHAR(255) NULL,
  notes           VARCHAR(255) NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_photos_athlete (athlete_id, taken_on),
  CONSTRAINT fk_photos_athlete FOREIGN KEY (athlete_id) REFERENCES athletes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------
--  Programmes sportifs (salle ou à la maison)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS programs (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  athlete_id  INT UNSIGNED NOT NULL,
  title       VARCHAR(190) NOT NULL,
  description TEXT NULL,
  location    ENUM('salle','home') NOT NULL DEFAULT 'salle',
  goal        VARCHAR(255) NULL,
  level       ENUM('debutant','intermediaire','avance') NOT NULL DEFAULT 'debutant',
  weeks       TINYINT UNSIGNED NOT NULL DEFAULT 4,
  sessions_per_week TINYINT UNSIGNED NOT NULL DEFAULT 3,
  start_date  DATE NULL,
  end_date    DATE NULL,
  status      ENUM('draft','active','archived') NOT NULL DEFAULT 'active',
  created_by  INT UNSIGNED NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_programs_athlete (athlete_id),
  KEY idx_programs_status (status),
  CONSTRAINT fk_programs_athlete FOREIGN KEY (athlete_id) REFERENCES athletes (id) ON DELETE CASCADE,
  CONSTRAINT fk_programs_author FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------
--  Jours du programme (semaine + jour de la semaine)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS program_days (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  program_id   INT UNSIGNED NOT NULL,
  week_number  TINYINT UNSIGNED NOT NULL DEFAULT 1,
  day_of_week  TINYINT UNSIGNED NOT NULL, -- 1 = lundi ... 7 = dimanche
  title        VARCHAR(150) NULL,
  focus        VARCHAR(150) NULL,
  session_type ENUM('full_body','body_part') NOT NULL DEFAULT 'full_body',
  scheduled_time TIME NOT NULL DEFAULT '18:00:00',
  notes        TEXT NULL,
  is_rest_day  TINYINT(1) NOT NULL DEFAULT 0,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_day (program_id, week_number, day_of_week),
  CONSTRAINT fk_days_program FOREIGN KEY (program_id) REFERENCES programs (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------
--  Rappels e-mail 1 h avant séance (anti-doublon par jour)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS session_reminders (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  program_day_id  INT UNSIGNED NOT NULL,
  athlete_id      INT UNSIGNED NOT NULL,
  session_date    DATE NOT NULL,
  reminded_at     DATETIME NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reminder_day_date (program_day_id, session_date),
  KEY idx_reminders_athlete (athlete_id, session_date),
  CONSTRAINT fk_reminders_day FOREIGN KEY (program_day_id) REFERENCES program_days (id) ON DELETE CASCADE,
  CONSTRAINT fk_reminders_athlete FOREIGN KEY (athlete_id) REFERENCES athletes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------
--  Exercices d'une journée de programme
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS exercises (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  program_day_id INT UNSIGNED NOT NULL,
  name          VARCHAR(190) NOT NULL,
  description   TEXT NULL,
  muscle_group  VARCHAR(100) NULL,
  equipment     VARCHAR(150) NULL,
  type          ENUM('force','cardio','mobilite','gainage','etirement','autre') NOT NULL DEFAULT 'force',
  sets          SMALLINT UNSIGNED NULL,
  reps          VARCHAR(40) NULL, -- ex: "10-12" ou "30s"
  rest_seconds  SMALLINT UNSIGNED NULL,
  weight        VARCHAR(60) NULL,
  image_url     VARCHAR(500) NULL,
  video_url     VARCHAR(500) NULL,
  order_index   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_exercises_day (program_day_id, order_index),
  CONSTRAINT fk_exercises_day FOREIGN KEY (program_day_id) REFERENCES program_days (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------
--  Suivi / statistiques : réalisations de l'athlète par exercice
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS exercise_logs (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  exercise_id   INT UNSIGNED NOT NULL,
  athlete_id    INT UNSIGNED NOT NULL,
  log_date      DATE NOT NULL,
  week_number   TINYINT UNSIGNED NOT NULL DEFAULT 1,
  sets_done     SMALLINT UNSIGNED NULL,
  reps_done     VARCHAR(40) NULL,
  weight_used   VARCHAR(60) NULL,
  duration_min  SMALLINT UNSIGNED NULL,
  rpe           TINYINT UNSIGNED NULL, -- effort ressenti 1..10
  feeling       ENUM('facile','ok','difficile') NULL,
  notes         TEXT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_log (exercise_id, athlete_id, log_date),
  KEY idx_logs_athlete_date (athlete_id, log_date),
  KEY idx_logs_exercise (exercise_id),
  CONSTRAINT fk_logs_exercise FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE,
  CONSTRAINT fk_logs_athlete FOREIGN KEY (athlete_id) REFERENCES athletes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------
--  Articles (section "Conseils" de la page d'accueil)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS articles (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title        VARCHAR(220) NOT NULL,
  slug         VARCHAR(240) NOT NULL,
  excerpt      VARCHAR(400) NULL,
  content      MEDIUMTEXT NULL,
  category     VARCHAR(80) NULL,
  cover_url    VARCHAR(500) NULL,
  status       ENUM('draft','published') NOT NULL DEFAULT 'draft',
  read_minutes TINYINT UNSIGNED NULL,
  published_at DATETIME NULL,
  author_id    INT UNSIGNED NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_articles_slug (slug),
  KEY idx_articles_status (status, published_at),
  CONSTRAINT fk_articles_author FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------
--  Posts (actualités courtes publiées par le coach)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS posts (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title        VARCHAR(220) NULL,
  content      TEXT NOT NULL,
  image_url    VARCHAR(500) NULL,
  status       ENUM('draft','published') NOT NULL DEFAULT 'draft',
  published_at DATETIME NULL,
  author_id    INT UNSIGNED NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_posts_status (status, published_at),
  CONSTRAINT fk_posts_author FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------
--  Messages du formulaire de contact (landing)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_messages (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(150) NOT NULL,
  email      VARCHAR(190) NOT NULL,
  phone      VARCHAR(40) NULL,
  message    TEXT NOT NULL,
  is_read    TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_contact_read (is_read, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------
--  Réinitialisation de mot de passe (jeton à usage unique)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_resets (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL COMMENT 'SHA-256 du jeton en clair',
  expires_at DATETIME NOT NULL,
  used_at    DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_token_hash (token_hash),
  KEY idx_resets_user (user_id),
  CONSTRAINT fk_resets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------
--  Demandes d'accès sportif (activation manuelle par le coach)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS access_requests (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name  VARCHAR(190) NOT NULL,
  email      VARCHAR(190) NOT NULL,
  phone      VARCHAR(40) NULL,
  message    TEXT NULL,
  uuid       CHAR(36) NULL,
  status     ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  approved_at DATETIME NULL,
  athlete_id INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_requests_uuid (uuid),
  KEY idx_requests_status (status, created_at),
  KEY idx_requests_athlete (athlete_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
