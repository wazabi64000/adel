import config from './config/env.js';
import { createApp } from './app.js';
import { pingDatabase } from './config/database.js';

async function start() {
  const app = createApp();

  // Vérification non bloquante de la base (le serveur démarre quand même).
  try {
    await pingDatabase();
    console.log(`[db] Connecté à "${config.db.database}" sur ${config.db.host}:${config.db.port}`);
  } catch (err) {
    console.warn(
      `[db] Connexion impossible (${err.message}). Vérifie les variables MySQL du fichier .env.`,
    );
  }

  const server = app.listen(config.port, () => {
    console.log(`\n  Coach Adel — application démarrée`);
    console.log(`  Environnement : ${config.env}`);
    console.log(`  URL           : ${config.appUrl}\n`);
  });

  const shutdown = (signal) => {
    console.log(`\n[server] ${signal} reçu — arrêt propre…`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 8000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  console.error('[server] Démarrage impossible :', err);
  process.exit(1);
});
