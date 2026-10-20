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

  const DISMISS_KEY = 'adel-pwa-install-dismissed-at';
  const DISMISS_MS = 24 * 60 * 60 * 1000;

  let waitingWorker = null;
  let refreshing = false;
  let updateLocked = false;
  let installLocked = false;
  let deferredPrompt = null;

  function lockInstall() {
    installLocked = true;
    document.documentElement.classList.add('pwa-install-locked');
    document.body.classList.add('pwa-install-locked');
  }

  function unlockInstall() {
    installLocked = false;
    document.documentElement.classList.remove('pwa-install-locked');
    document.body.classList.remove('pwa-install-locked');
  }

  function lockUpdate() {
    document.documentElement.classList.add('pwa-update-locked');
    document.body.classList.add('pwa-update-locked');
  }

  function wasInstallDismissed() {
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
      return Boolean(at && Date.now() - at < DISMISS_MS);
    } catch {
      return false;
    }
  }

  function rememberInstallDismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }

  function showInstallModal() {
    if (!bar || isStandalone || updateLocked || wasInstallDismissed()) return;
    bar.hidden = false;
    lockInstall();
    btn?.focus({ preventScroll: true });
  }

  function hideInstallModal() {
    if (bar) bar.hidden = true;
    unlockInstall();
  }

  function dismissInstall() {
    rememberInstallDismiss();
    hideInstallModal();
  }

  function setInstallHint(message) {
    if (!hint) return;
    if (!message) {
      hint.hidden = true;
      hint.textContent = '';
      return;
    }
    hint.hidden = false;
    hint.textContent = message;
  }

  function showUpdateModal(worker) {
    if (!updateModal || !worker) return;
    waitingWorker = worker;
    updateLocked = true;
    updateModal.hidden = false;
    lockUpdate();
    hideInstallModal();
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
  dismiss?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    dismissInstall();
  });

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

  /* ---------- Installation (modal + Plus tard) ---------- */
  if (isStandalone) {
    hideInstallModal();
    return;
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    setInstallHint('');
    showInstallModal();
  });

  if (isIos && isSafari) {
    setInstallHint('Sur iPhone : tape Partager, puis « Sur l’écran d’accueil ».');
  } else {
    setInstallHint(
      'Appuie sur « Installer maintenant ». Si le navigateur ne propose rien, ouvre le menu → Installer l’application.',
    );
  }
  showInstallModal();

  btn?.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (choice?.outcome === 'accepted') {
        hideInstallModal();
      } else {
        setInstallHint('Installation refusée. Tu peux réessayer ou choisir « Plus tard ».');
        showInstallModal();
      }
      return;
    }
    if (isIos) {
      setInstallHint('Tape Partager, puis « Sur l’écran d’accueil ». Ensuite rouvre l’icône Coach Adel.');
    } else {
      setInstallHint('Menu du navigateur (⋮ ou ⋯) → Installer l’application / Ajouter à l’écran d’accueil.');
    }
    showInstallModal();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallModal();
  });
})();
