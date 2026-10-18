(() => {
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const bar = document.getElementById('pwa-install');
  const btn = document.getElementById('pwa-install-btn');
  const dismiss = document.getElementById('pwa-install-dismiss');
  const hint = document.getElementById('pwa-install-hint');

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  function showInstallBar() {
    if (!bar || isStandalone) return;
    bar.hidden = false;
    bar.classList.add('is-forced');
  }

  function hideInstallBar() {
    if (bar) bar.hidden = true;
  }

  /* ---------- Mises à jour forcées ---------- */
  if ('serviceWorker' in navigator) {
    let refreshing = false;

    // Nouveau SW actif → rechargement immédiat de tous les onglets
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    const forceUpdate = (reg) => {
      if (!reg) return;
      reg.update().catch(() => {});
      const worker = reg.installing || reg.waiting;
      if (worker) worker.postMessage('SKIP_WAITING');
      if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
    };

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });

        forceUpdate(reg);

        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed') {
              worker.postMessage('SKIP_WAITING');
            }
          });
        });

        // Vérifie souvent (focus, visibilité, intervalle)
        const check = () => forceUpdate(reg);
        window.addEventListener('focus', check);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check();
        });
        setInterval(check, 60_000);
      } catch {
        /* non bloquant */
      }
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register);
  }

  /* ---------- Installation forcée (bandeau persistant) ---------- */
  if (isStandalone) {
    hideInstallBar();
    return;
  }

  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    if (hint) hint.hidden = true;
    showInstallBar();
  });

  // iOS Safari : pas d'API d'install → guide permanent
  if (isIos && isSafari) {
    if (hint) {
      hint.hidden = false;
      hint.textContent = 'Sur iPhone : Partager → Sur l’écran d’accueil';
    }
    showInstallBar();
  }

  btn?.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (choice?.outcome === 'accepted') hideInstallBar();
      else showInstallBar(); // refuse → on réaffiche
      return;
    }
    // Fallback : guide iOS / navigateur sans beforeinstallprompt
    if (hint) {
      hint.hidden = false;
      if (isIos) hint.textContent = 'Tape Partager, puis « Sur l’écran d’accueil ».';
      else hint.textContent = 'Menu du navigateur → Installer l’application.';
    }
    showInstallBar();
  });

  // « Plus tard » ne cache que 30 min — puis réapparaît
  dismiss?.addEventListener('click', () => {
    hideInstallBar();
    setTimeout(showInstallBar, 30 * 60 * 1000);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallBar();
  });
})();
