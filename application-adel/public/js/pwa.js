(() => {
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches;

  const bar = document.getElementById('pwa-install');
  const btn = document.getElementById('pwa-install-btn');
  const dismiss = document.getElementById('pwa-install-dismiss');
  const hint = document.getElementById('pwa-install-hint');

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  const DISMISS_KEY = 'adel-pwa-install-dismissed-at';
  const DISMISS_MS = 24 * 60 * 60 * 1000;
  const APPLIED_KEY = 'adel-pwa-update-applied';

  let waitingWorker = null;
  let refreshing = false;
  let updateLocked = false;
  let deferredPrompt = null;
  let updateModal = null;
  let updateBtn = null;

  function lockInstall() {
    document.documentElement.classList.add('pwa-install-locked');
    document.body.classList.add('pwa-install-locked');
  }

  function unlockInstall() {
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

  function markUpdateApplied() {
    try {
      sessionStorage.setItem(APPLIED_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }

  function justAppliedUpdate() {
    try {
      const at = Number(sessionStorage.getItem(APPLIED_KEY) || 0);
      if (at && Date.now() - at < 15_000) return true;
      if (at) sessionStorage.removeItem(APPLIED_KEY);
      return false;
    } catch {
      return false;
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

  /* Crée le modal si la page PWA en cache ne l’a pas encore (HTML ancien) */
  function ensureUpdateModal() {
    updateModal = document.getElementById('pwa-update');
    if (!updateModal) {
      updateModal = document.createElement('div');
      updateModal.id = 'pwa-update';
      updateModal.className = 'pwa-update';
      updateModal.setAttribute('role', 'dialog');
      updateModal.setAttribute('aria-modal', 'true');
      updateModal.hidden = true;
      updateModal.innerHTML = `
        <div class="pwa-update__backdrop" aria-hidden="true"></div>
        <div class="pwa-update__card">
          <p class="pwa-update__badge">Mise à jour obligatoire</p>
          <h2 id="pwa-update-title">Nouvelle version disponible</h2>
          <p id="pwa-update-desc" class="pwa-update__desc">
            Une mise à jour est nécessaire pour continuer. Sans cette étape, l’application reste verrouillée.
          </p>
          <button type="button" class="pwa-update__btn" id="pwa-update-btn">Mettre à jour maintenant</button>
        </div>`;
      document.body.appendChild(updateModal);

      // Styles de secours si CSS ancien en cache
      if (!document.getElementById('pwa-update-fallback-style')) {
        const style = document.createElement('style');
        style.id = 'pwa-update-fallback-style';
        style.textContent = `
          .pwa-update{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px}
          .pwa-update[hidden]{display:none!important}
          .pwa-update__backdrop{position:absolute;inset:0;background:rgba(10,46,28,.88)}
          .pwa-update__card{position:relative;z-index:1;width:min(420px,100%);background:#fff;color:#0a2e1c;border:2px solid #1f9d55;padding:28px 24px;text-align:center}
          .pwa-update__badge{display:inline-block;margin:0 0 12px;padding:6px 12px;background:#e8f8ef;color:#146c3a;font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
          .pwa-update__card h2{margin:0 0 10px;font-size:1.35rem}
          .pwa-update__desc{margin:0 0 22px;font-size:.95rem;line-height:1.55;color:#245c3d}
          .pwa-update__btn{display:inline-flex;width:100%;min-height:48px;align-items:center;justify-content:center;border:0;background:#1f9d55;color:#fff;font-weight:700;letter-spacing:.06em;text-transform:uppercase;cursor:pointer}
          html.pwa-update-locked,body.pwa-update-locked{overflow:hidden!important}`;
        document.head.appendChild(style);
      }
    }

    updateBtn = document.getElementById('pwa-update-btn');
    if (updateBtn && !updateBtn.dataset.bound) {
      updateBtn.dataset.bound = '1';
      updateBtn.addEventListener('click', applyUpdate);
    }
    if (updateModal && !updateModal.dataset.bound) {
      updateModal.dataset.bound = '1';
      updateModal.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
        }
      });
    }
    return updateModal;
  }

  function showUpdateModal(worker) {
    if (!navigator.serviceWorker.controller) return;
    if (refreshing || justAppliedUpdate()) return;
    if (!worker || worker === navigator.serviceWorker.controller) return;

    ensureUpdateModal();
    if (!updateModal) return;
    if (updateLocked && waitingWorker === worker) return;

    waitingWorker = worker;
    updateLocked = true;
    updateModal.hidden = false;
    lockUpdate();
    hideInstallModal();
    if (updateBtn) {
      updateBtn.disabled = false;
      updateBtn.textContent = 'Mettre à jour maintenant';
    }
    try {
      updateBtn?.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
  }

  function applyUpdate() {
    if (refreshing) return;
    markUpdateApplied();
    ensureUpdateModal();
    if (updateBtn) {
      updateBtn.disabled = true;
      updateBtn.textContent = 'Mise à jour…';
    }
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      waitingWorker.postMessage('SKIP_WAITING');
      setTimeout(() => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      }, 1500);
      return;
    }
    refreshing = true;
    window.location.reload();
  }

  dismiss?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    dismissInstall();
  });

  /* ---------- Mises à jour (PWA installée + web) ---------- */
  if ('serviceWorker' in navigator) {
    ensureUpdateModal();

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      markUpdateApplied();
      window.location.reload();
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
      const type = event.data?.type;
      if (type === 'SW_WAITING') {
        if (!navigator.serviceWorker.controller || refreshing || justAppliedUpdate()) return;
        navigator.serviceWorker.getRegistration().then((reg) => {
          if (reg?.waiting) showUpdateModal(reg.waiting);
        });
      }
    });

    const promptIfWaiting = (reg) => {
      if (!reg || refreshing || justAppliedUpdate()) return;
      if (!navigator.serviceWorker.controller) {
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        return;
      }
      if (reg.waiting) showUpdateModal(reg.waiting);
    };

    const watchInstalling = (worker) => {
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state !== 'installed') return;
        if (!navigator.serviceWorker.controller) {
          worker.postMessage({ type: 'SKIP_WAITING' });
          return;
        }
        showUpdateModal(worker);
      });
    };

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });

        promptIfWaiting(reg);
        if (reg.installing) watchInstalling(reg.installing);

        reg.addEventListener('updatefound', () => {
          watchInstalling(reg.installing);
        });

        const check = () => {
          if (refreshing) return;
          // Force le navigateur à re-télécharger sw.js (important en PWA)
          fetch('/sw.js', { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }).catch(
            () => {},
          );
          reg.update().catch(() => {});
          promptIfWaiting(reg);
        };

        window.addEventListener('focus', check);
        window.addEventListener('pageshow', (event) => {
          // PWA / bfcache : relance la vérif à chaque ouverture
          check();
          if (event.persisted) check();
        });
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check();
        });

        // Plus fréquent en PWA installée (les checks navigateur y sont plus lents)
        setInterval(check, isStandalone ? 15_000 : 60_000);
        check();
        // 2ᵉ passage après démarrage (certains Android n’ont le waiting qu’après un délai)
        setTimeout(check, 2500);
        setTimeout(check, 8000);
      } catch {
        /* non bloquant */
      }
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register);
  }

  /* ---------- Installation (navigateur uniquement) ---------- */
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
