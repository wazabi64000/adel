import config from './config/env.js';
import app from './app.js';
import { pingDatabase } from './config/database.js';

function start() {
  // Écoute tout de suite. Un await MySQL avant listen() empêche Vercel
  // d'attacher le serveur, et la requête part en 504.
  const server = app.listen(config.port, () => {
    console.log(`\n  Coach Adel — application démarrée`);
    console.log(`  Environnement : ${config.env}`);
    console.log(`  URL           : ${config.appUrl}\n`);
  });

  pingDatabase()
    .then(() => {
      console.log(`[db] Connecté à "${config.db.database}" sur ${config.db.host}:${config.db.port}`);
    })
    .catch((err) => {
      console.warn(
        `[db] Connexion impossible (${err.message}). Vérifie les variables MySQL du fichier .env.`,
      );
    });

  const shutdown = (signal) => {
    console.log(`\n[server] ${signal} reçu — arrêt propre…`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 8000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
