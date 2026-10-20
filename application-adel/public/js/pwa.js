(() => {
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const bar = document.getElementById('pwa-install');
  const btn = document.getElementById('pwa-install-btn');
  const dismiss = document.getElementById('pwa-install-dismiss');
  const hint = document.getElementById('pwa-install-hint');

  const updateModal = document.getElementById('pwa-update');
  const updateBtn = document.getElementById('pwa-update-btn');

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  let waitingWorker = null;
  let refreshing = false;
  let updateLocked = false;

  function showInstallBar() {
    if (!bar || isStandalone) return;
    bar.hidden = false;
    bar.classList.add('is-forced');
  }

  function hideInstallBar() {
    if (bar) bar.hidden = true;
  }

  function lockPage() {
    document.documentElement.classList.add('pwa-update-locked');
    document.body.classList.add('pwa-update-locked');
  }

  function unlockPage() {
    document.documentElement.classList.remove('pwa-update-locked');
    document.body.classList.remove('pwa-update-locked');
  }

  function showUpdateModal(worker) {
    if (!updateModal || !worker) return;
    waitingWorker = worker;
    updateLocked = true;
    updateModal.hidden = false;
    lockPage();
    hideInstallBar();
    updateBtn?.focus({ preventScroll: true });
  }

  function applyUpdate() {
    if (!waitingWorker) {
      window.location.reload();
      return;
    }
    if (updateBtn) {
      updateBtn.disabled = true;
      updateBtn.textContent = 'Mise à jour…';
    }
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    waitingWorker.postMessage('SKIP_WAITING');
  }

  updateBtn?.addEventListener('click', applyUpdate);

  // Empêche Escape / clic fond : mise à jour obligatoire
  updateModal?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  /* ---------- Mises à jour forcées (modal bloquant) ---------- */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SW_UPDATED' && updateLocked) {
        // SW déjà actif après SKIP_WAITING → recharger si controllerchange a raté
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      }
    });

    const promptIfWaiting = (reg) => {
      if (!reg) return;
      const worker = reg.waiting;
      if (!worker) return;
      if (navigator.serviceWorker.controller) {
        showUpdateModal(worker);
      } else {
        // Première installation : activer sans modal
        worker.postMessage({ type: 'SKIP_WAITING' });
      }
    };

    const watchInstalling = (reg, worker) => {
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state !== 'installed') return;
        if (navigator.serviceWorker.controller) {
          showUpdateModal(worker);
        } else {
          worker.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    };

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });

        promptIfWaiting(reg);
        if (reg.installing) watchInstalling(reg, reg.installing);

        reg.addEventListener('updatefound', () => {
          watchInstalling(reg, reg.installing);
        });

        const check = () => {
          reg.update().catch(() => {});
          promptIfWaiting(reg);
        };
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

  /* ---------- Installation (bandeau) ---------- */
  if (isStandalone) {
    hideInstallBar();
    return;
  }

  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    if (updateLocked) return;
    if (hint) hint.hidden = true;
    showInstallBar();
  });

  if (isIos && isSafari) {
    if (hint) {
      hint.hidden = false;
      hint.textContent = 'Sur iPhone : Partager → Sur l’écran d’accueil';
    }
    if (!updateLocked) showInstallBar();
  }

  btn?.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (choice?.outcome === 'accepted') hideInstallBar();
      else showInstallBar();
      return;
    }
    if (hint) {
      hint.hidden = false;
      if (isIos) hint.textContent = 'Tape Partager, puis « Sur l’écran d’accueil ».';
      else hint.textContent = 'Menu du navigateur → Installer l’application.';
    }
    showInstallBar();
  });

  dismiss?.addEventListener('click', () => {
    hideInstallBar();
    setTimeout(() => {
      if (!updateLocked) showInstallBar();
    }, 30 * 60 * 1000);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallBar();
  });
})();
