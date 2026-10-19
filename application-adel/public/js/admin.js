/* Espace admin / sportif — interactions légères (sans dépendance). */
(function () {
  'use strict';

  // Menu latéral (mobile)
  var burger = document.getElementById('admin-burger');
  var shell = document.querySelector('.admin-shell');
  if (burger && shell) {
    burger.addEventListener('click', function () {
      var open = shell.classList.toggle('nav-open');
      burger.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', function (e) {
      if (!shell.classList.contains('nav-open')) return;
      if (e.target.closest('.admin-side') || e.target.closest('#admin-burger')) return;
      shell.classList.remove('nav-open');
      burger.setAttribute('aria-expanded', 'false');
    });
  }

  // Confirmation avant les actions destructrices
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!window.confirm(form.getAttribute('data-confirm') || 'Confirmer ?')) {
        e.preventDefault();
      }
    });
  });

  // Aperçu local des images avant envoi
  document.querySelectorAll('input[type="file"][data-preview]').forEach(function (input) {
    input.addEventListener('change', function () {
      var target = document.getElementById(input.getAttribute('data-preview'));
      if (!target || !input.files || !input.files[0]) return;
      target.src = URL.createObjectURL(input.files[0]);
      target.hidden = false;
    });
  });

  // Toasts / alertes flash : fermeture manuelle + auto-dismiss
  document.querySelectorAll('[data-toast]').forEach(function (toast) {
    var close = toast.querySelector('.app-flash__close');
    function dismiss() {
      toast.classList.add('is-leaving');
      window.setTimeout(function () {
        toast.remove();
        var root = document.getElementById('app-flash');
        if (root && !root.children.length) root.remove();
      }, 220);
    }
    if (close) close.addEventListener('click', dismiss);
    var delay = toast.classList.contains('app-flash__item--error') ? 9000 : 5200;
    window.setTimeout(dismiss, delay);
  });

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function readJson(id, fallback) {
    var el = document.getElementById(id);
    if (!el) return fallback;
    try {
      return JSON.parse(el.textContent || 'null') || fallback;
    } catch (e) {
      return fallback;
    }
  }

  /* -------- Zoom GIF : hover (temporaire) + clic (lightbox + croix) -------- */
  var gifHover = null;
  var gifLightbox = null;

  function ensureGifHover() {
    if (gifHover) return gifHover;
    gifHover = document.createElement('div');
    gifHover.className = 'gif-zoom-hover';
    gifHover.hidden = true;
    gifHover.setAttribute('aria-hidden', 'true');
    gifHover.innerHTML = '<img alt="">';
    document.body.appendChild(gifHover);
    return gifHover;
  }

  function ensureGifLightbox() {
    if (gifLightbox) return gifLightbox;
    gifLightbox = document.createElement('div');
    gifLightbox.className = 'gif-lightbox';
    gifLightbox.hidden = true;
    gifLightbox.setAttribute('role', 'dialog');
    gifLightbox.setAttribute('aria-modal', 'true');
    gifLightbox.setAttribute('aria-label', 'Aperçu exercice');
    gifLightbox.innerHTML =
      '<div class="gif-lightbox__backdrop" data-gif-close></div>' +
      '<div class="gif-lightbox__panel">' +
      '<button type="button" class="gif-lightbox__close" data-gif-close aria-label="Fermer">×</button>' +
      '<img class="gif-lightbox__img" alt="">' +
      '<p class="gif-lightbox__caption" hidden></p>' +
      '</div>';
    document.body.appendChild(gifLightbox);
    gifLightbox.addEventListener('click', function (e) {
      if (e.target.closest('[data-gif-close]')) closeGifLightbox();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && gifLightbox && !gifLightbox.hidden) closeGifLightbox();
    });
    return gifLightbox;
  }

  function positionGifHover(anchor) {
    var box = ensureGifHover();
    var img = box.querySelector('img');
    var rect = anchor.getBoundingClientRect();
    var size = Math.min(280, window.innerWidth - 24, window.innerHeight - 24);
    box.style.width = size + 'px';
    box.style.height = size + 'px';
    var left = rect.right + 12;
    var top = rect.top + rect.height / 2 - size / 2;
    if (left + size > window.innerWidth - 12) left = rect.left - size - 12;
    if (left < 12) left = 12;
    if (top < 12) top = 12;
    if (top + size > window.innerHeight - 12) top = window.innerHeight - size - 12;
    box.style.left = left + 'px';
    box.style.top = top + 'px';
    return img;
  }

  function showGifHover(anchor, src) {
    if (!src || window.matchMedia('(hover: none)').matches) return;
    var box = ensureGifHover();
    var img = positionGifHover(anchor);
    img.src = src;
    box.hidden = false;
  }

  function hideGifHover() {
    if (!gifHover) return;
    gifHover.hidden = true;
    var img = gifHover.querySelector('img');
    if (img) img.removeAttribute('src');
  }

  function openGifLightbox(src, caption) {
    if (!src) return;
    hideGifHover();
    var box = ensureGifLightbox();
    var img = box.querySelector('.gif-lightbox__img');
    var cap = box.querySelector('.gif-lightbox__caption');
    img.src = src;
    if (caption) {
      cap.textContent = caption;
      cap.hidden = false;
    } else {
      cap.textContent = '';
      cap.hidden = true;
    }
    box.hidden = false;
    document.body.classList.add('gif-lightbox-open');
  }

  function closeGifLightbox() {
    if (!gifLightbox) return;
    gifLightbox.hidden = true;
    var img = gifLightbox.querySelector('.gif-lightbox__img');
    if (img) img.removeAttribute('src');
    document.body.classList.remove('gif-lightbox-open');
  }

  function bindGifZoom(container) {
    if (!container || container.__adelGifZoom) return;
    container.__adelGifZoom = true;

    container.addEventListener('mouseover', function (e) {
      var thumb = e.target.closest('[data-gif-zoom]');
      if (!thumb || !container.contains(thumb)) return;
      showGifHover(thumb, thumb.getAttribute('data-gif') || (thumb.querySelector('img') || {}).src);
    });
    container.addEventListener('mouseout', function (e) {
      var thumb = e.target.closest('[data-gif-zoom]');
      if (!thumb) return;
      var to = e.relatedTarget;
      if (to && thumb.contains(to)) return;
      hideGifHover();
    });
    container.addEventListener(
      'click',
      function (e) {
        var thumb = e.target.closest('[data-gif-zoom]');
        if (!thumb || !container.contains(thumb)) return;
        e.preventDefault();
        e.stopPropagation();
        var src = thumb.getAttribute('data-gif') || (thumb.querySelector('img') || {}).src;
        var caption = thumb.getAttribute('data-gif-caption') || '';
        openGifLightbox(src, caption);
      },
      true,
    );
  }

  /* -------- Sélecteur catalogue (famille / zone / focus) -------- */
  function bindCatalogPicker(root) {
    var search = root.querySelector('[data-catalog-search]');
    var results = root.querySelector('[data-catalog-results]');
    var hiddenId = root.querySelector('[data-catalog-id]');
    var hiddenName = root.querySelector('[data-catalog-name]');
    var picked = root.querySelector('[data-catalog-picked]');
    var preview = root.querySelector('[data-catalog-preview]');
    var familySel = root.querySelector('[data-catalog-family]');
    var regionSel = root.querySelector('[data-catalog-region]');
    if (!search || !results || !hiddenId) return;

    bindGifZoom(root);
    if (preview && preview.src) {
      preview.setAttribute('data-gif-zoom', '');
      preview.setAttribute('data-gif', preview.src);
    }

    var timer = null;
    function sessionType() {
      var block = root.closest('[data-session-index], .day-panel, form');
      if (block) syncTypeFromFocus(block);
      var sel = block && block.querySelector('[data-session-type], input[name="session_type"], select[name="session_type"]');
      if (sel && sel.value) return sel.value;
      var focusVal = focus();
      return focusVal ? 'body_part' : 'full_body';
    }
    function focus() {
      var block = root.closest('[data-session-index], .day-panel, form');
      var f = block && block.querySelector('[data-focus-input], select[name="focus"], select[name*="[focus]"]');
      if (f && f.value && f.value !== 'Tout le corps') return f.value;
      var attr = root.getAttribute('data-focus') || '';
      return attr && attr !== 'Tout le corps' ? attr : '';
    }

    function syncTypeFromFocus(block) {
      if (!block) return;
      var focusSel = block.querySelector('[data-focus-input], select[name="focus"]');
      var typeEl = block.querySelector('[data-session-type], input[name="session_type"], select[name="session_type"]');
      if (!focusSel || !typeEl) return;
      var full = !focusSel.value || focusSel.value === 'Tout le corps';
      typeEl.value = full ? 'full_body' : 'body_part';
      block.querySelectorAll('.catalog-exercise-form, .builder-exercise').forEach(function (row) {
        row.setAttribute('data-session-type', typeEl.value);
        row.setAttribute('data-focus', full ? '' : focusSel.value);
      });
      block.setAttribute('data-session-type', typeEl.value);
      block.setAttribute('data-focus', full ? '' : focusSel.value);
    }

    function renderResults(items) {
      if (!items.length) {
        results.innerHTML = '<p class="muted">Aucun exercice pour ces filtres.</p>';
        results.hidden = false;
        return;
      }
      results.innerHTML = items
        .map(function (item) {
          return (
            '<button type="button" class="catalog-result" data-id="' +
            escapeHtml(item.id) +
            '" data-name="' +
            escapeHtml(item.name) +
            '" data-gif="' +
            escapeHtml(item.gifUrl) +
            '"><span class="catalog-thumb" data-gif-zoom data-gif="' +
            escapeHtml(item.gifUrl) +
            '" data-gif-caption="' +
            escapeHtml(item.name) +
            '" title="Survoler pour agrandir · cliquer pour ouvrir"><img src="' +
            escapeHtml(item.gifUrl) +
            '" alt="" loading="lazy" width="56" height="56"></span><span class="catalog-result__meta"><strong>' +
            escapeHtml(item.name) +
            '</strong><small>' +
            escapeHtml((item.bodyParts || []).join(', ')) +
            (item.families && item.families.length ? ' · ' + escapeHtml(item.families.join(', ')) : '') +
            '</small></span></button>'
          );
        })
        .join('');
      results.hidden = false;
      bindGifZoom(results);
    }

    function fetchCatalog(q) {
      var params = new URLSearchParams({
        limit: '40',
        session_type: sessionType(),
        focus: focus(),
        q: q || '',
        family: (familySel && familySel.value) || '',
        region: (regionSel && regionSel.value) || '',
      });
      fetch('/admin/api/exercise-catalog?' + params.toString(), {
        headers: { Accept: 'application/json' },
      })
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          renderResults((data && data.results) || []);
        })
        .catch(function () {
          results.innerHTML = '<p class="muted">Erreur de chargement du catalogue.</p>';
          results.hidden = false;
        });
    }

    function pick(id, name, gif) {
      hiddenId.value = id;
      if (hiddenName) hiddenName.value = name;
      search.value = name;
      if (picked) {
        picked.textContent = 'Choisi : ' + name;
        picked.hidden = false;
      }
      if (preview) {
        preview.src = gif;
        preview.hidden = false;
        preview.setAttribute('data-gif-zoom', '');
        preview.setAttribute('data-gif', gif);
        preview.setAttribute('data-gif-caption', name || '');
        preview.setAttribute('title', 'Survoler pour agrandir · cliquer pour ouvrir');
        bindGifZoom(preview.parentElement || root);
      }
      results.hidden = true;
      hideGifHover();
    }

    function scheduleFetch() {
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        fetchCatalog(search.value.trim());
      }, 200);
    }

    search.addEventListener('input', function () {
      hiddenId.value = '';
      scheduleFetch();
    });
    search.addEventListener('focus', function () {
      fetchCatalog(search.value.trim());
    });
    if (familySel) familySel.addEventListener('change', scheduleFetch);
    if (regionSel) regionSel.addEventListener('change', scheduleFetch);
    results.addEventListener('click', function (e) {
      var btn = e.target.closest('.catalog-result');
      if (!btn) return;
      pick(btn.getAttribute('data-id'), btn.getAttribute('data-name'), btn.getAttribute('data-gif'));
    });

    var sessionBlock = root.closest('[data-session-index], .day-panel, form');
    if (sessionBlock && !sessionBlock.__adelFocusBound) {
      sessionBlock.__adelFocusBound = true;
      var focusSel = sessionBlock.querySelector('[data-focus-input], select[name="focus"]');
      if (focusSel) {
        focusSel.addEventListener('change', function () {
          syncTypeFromFocus(sessionBlock);
          // Nouvelle catégorie → vider les choix hors filtre
          sessionBlock.querySelectorAll('.catalog-exercise-form, .builder-exercise').forEach(function (row) {
            var id = row.querySelector('[data-catalog-id]');
            var name = row.querySelector('[data-catalog-name]');
            var searchEl = row.querySelector('[data-catalog-search]');
            var pickedEl = row.querySelector('[data-catalog-picked]');
            var previewEl = row.querySelector('[data-catalog-preview]');
            var res = row.querySelector('[data-catalog-results]');
            if (id) id.value = '';
            if (name) name.value = '';
            if (searchEl) searchEl.value = '';
            if (pickedEl) {
              pickedEl.textContent = '';
              pickedEl.hidden = true;
            }
            if (previewEl) {
              previewEl.removeAttribute('src');
              previewEl.hidden = true;
            }
            if (res) res.hidden = true;
          });
        });
      }
    }
  }

  document.querySelectorAll('.catalog-exercise-form').forEach(bindCatalogPicker);

  /* -------- Assistant programme (une étape visible) -------- */
  (function initProgramWizard() {
    var form = document.getElementById('program-builder');
    var root = document.getElementById('sessions-root');
    var countHidden = document.querySelector('[data-sessions-count]');
    var countUi = document.querySelector('[data-sessions-ui]');
    if (!form || !root || !countHidden) return;

    var focusOptions = readJson('program-focus-options', []);
    var families = readJson('catalog-families', []);
    var step = 'infos'; // infos | session-N | review
    var sessionIndex = 0;

    function sessionCount() {
      return Math.max(1, Math.min(7, Number(countHidden.value) || 3));
    }

    function familyOptionsHtml() {
      return (
        '<option value="">Toutes les familles</option>' +
        families
          .map(function (f) {
            return '<option value="' + escapeHtml(f.id) + '">' + escapeHtml(f.label.fr) + '</option>';
          })
          .join('')
      );
    }

    function focusSelectHtml(sessionIndex, selected) {
      var opts = focusOptions
        .map(function (o) {
          var sel = o === selected ? ' selected' : '';
          return '<option value="' + escapeHtml(o) + '"' + sel + '>' + escapeHtml(o) + '</option>';
        })
        .join('');
      return (
        '<select name="sessions[' +
        sessionIndex +
        '][focus]" data-focus-input required>' +
        opts +
        '</select>'
      );
    }

    function exerciseRowHtml(sIdx, eIdx) {
      return (
        '<div class="builder-exercise catalog-exercise-form" data-ex-index="' +
        eIdx +
        '">' +
        '<input type="hidden" name="sessions[' +
        sIdx +
        '][exercises][' +
        eIdx +
        '][catalog_id]" value="" data-catalog-id>' +
        '<input type="hidden" name="sessions[' +
        sIdx +
        '][exercises][' +
        eIdx +
        '][name]" value="" data-catalog-name>' +
        '<div class="field"><label>Famille d’exercice</label><select data-catalog-family>' +
        familyOptionsHtml() +
        '</select></div>' +
        '<div class="field"><label>Choisir dans le catalogue *</label>' +
        '<input type="search" data-catalog-search placeholder="Exercices de cette partie du corps…" autocomplete="off">' +
        '<div class="catalog-results" data-catalog-results hidden></div>' +
        '<p class="muted catalog-picked" data-catalog-picked hidden></p>' +
        '<img class="catalog-preview" data-catalog-preview hidden alt=""></div>' +
        '<div class="field-stack">' +
        '<div class="field"><label>Séries</label><input type="number" min="0" name="sessions[' +
        sIdx +
        '][exercises][' +
        eIdx +
        '][sets]" value="3"></div>' +
        '<div class="field"><label>Reps approx.</label><input type="text" name="sessions[' +
        sIdx +
        '][exercises][' +
        eIdx +
        '][reps]" value="10" placeholder="8-12"></div></div>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-remove-ex>Retirer l’exercice</button></div>'
      );
    }

    function sessionPaneHtml(sIdx) {
      return (
        '<section class="wizard-pane builder-session" data-wizard-pane="session-' +
        sIdx +
        '" data-session-index="' +
        sIdx +
        '" hidden>' +
        '<header class="wizard-header">' +
        '<h2 class="wizard-title">Séance ' +
        (sIdx + 1) +
        ' <small>sur ' +
        sessionCount() +
        '</small></h2>' +
        '<p class="wizard-help">Partie du corps d’abord — le catalogue ne montre que les GIF de cette catégorie.</p>' +
        '</header>' +
        '<div class="wizard-group">' +
        '<h3 class="wizard-group__title">Séance</h3>' +
        '<div class="field"><label>Partie du corps *</label>' +
        focusSelectHtml(sIdx, 'Tout le corps') +
        '<input type="hidden" name="sessions[' +
        sIdx +
        '][session_type]" value="full_body" data-session-type></div>' +
        '<div class="field"><label>Titre <span class="label-opt">(optionnel)</span></label>' +
        '<input type="text" name="sessions[' +
        sIdx +
        '][title]" placeholder="Ex. Push / Jambes" maxlength="190"></div>' +
        '</div>' +
        '<div class="wizard-group">' +
        '<h3 class="wizard-group__title">Exercices</h3>' +
        '<div class="builder-exercises" data-exercises></div>' +
        '<div class="wizard-session-actions">' +
        '<button type="button" class="btn btn-secondary btn-sm" data-add-ex>+ Exercice</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-dup-session>Dupliquer cette séance</button>' +
        '</div></div>' +
        '<div class="wizard-nav">' +
        '<button type="button" class="btn btn-secondary" data-wizard-prev>← Retour</button>' +
        '<button type="button" class="btn btn-primary" data-wizard-next>Continuer →</button>' +
        '</div></section>'
      );
    }

    function syncSessionType(block) {
      var focusInput = block.querySelector('[data-focus-input]');
      var typeHidden = block.querySelector('[data-session-type]');
      function apply() {
        var focusVal = focusInput.value || 'Tout le corps';
        var full = focusVal === 'Tout le corps';
        typeHidden.value = full ? 'full_body' : 'body_part';
        block.setAttribute('data-session-type', typeHidden.value);
        block.setAttribute('data-focus', full ? '' : focusVal);
        block.querySelectorAll('.builder-exercise').forEach(function (row) {
          row.setAttribute('data-session-type', typeHidden.value);
          row.setAttribute('data-focus', full ? '' : focusVal);
        });
      }
      focusInput.addEventListener('change', function () {
        apply();
        block.querySelectorAll('.builder-exercise').forEach(function (row) {
          var id = row.querySelector('[data-catalog-id]');
          var name = row.querySelector('[data-catalog-name]');
          var searchEl = row.querySelector('[data-catalog-search]');
          var pickedEl = row.querySelector('[data-catalog-picked]');
          var previewEl = row.querySelector('[data-catalog-preview]');
          var res = row.querySelector('[data-catalog-results]');
          if (id) id.value = '';
          if (name) name.value = '';
          if (searchEl) searchEl.value = '';
          if (pickedEl) {
            pickedEl.textContent = '';
            pickedEl.hidden = true;
          }
          if (previewEl) {
            previewEl.removeAttribute('src');
            previewEl.hidden = true;
          }
          if (res) res.hidden = true;
        });
      });
      apply();
    }

    function bindSessionPane(block) {
      var sIdx = Number(block.getAttribute('data-session-index'));
      var exRoot = block.querySelector('[data-exercises]');
      syncSessionType(block);

      function reindex() {
        exRoot.querySelectorAll('.builder-exercise').forEach(function (row, i) {
          row.setAttribute('data-ex-index', String(i));
          row.querySelectorAll('input[name], select[name]').forEach(function (input) {
            input.name = String(input.name).replace(
              /sessions\[\d+]\[exercises]\[\d+]/,
              'sessions[' + sIdx + '][exercises][' + i + ']',
            );
          });
        });
      }

      function addExercise(prefill) {
        var idx = exRoot.querySelectorAll('.builder-exercise').length;
        exRoot.insertAdjacentHTML('beforeend', exerciseRowHtml(sIdx, idx));
        var row = exRoot.lastElementChild;
        syncSessionType(block);
        bindCatalogPicker(row);
        if (prefill) {
          var idInput = row.querySelector('[data-catalog-id]');
          var nameInput = row.querySelector('[data-catalog-name]');
          var search = row.querySelector('[data-catalog-search]');
          var preview = row.querySelector('[data-catalog-preview]');
          var picked = row.querySelector('[data-catalog-picked]');
          var sets = row.querySelector('input[name*="[sets]"]');
          var reps = row.querySelector('input[name*="[reps]"]');
          if (idInput) idInput.value = prefill.catalogId || '';
          if (nameInput) nameInput.value = prefill.name || '';
          if (search) search.value = prefill.name || '';
          if (sets && prefill.sets != null) sets.value = prefill.sets;
          if (reps && prefill.reps != null) reps.value = prefill.reps;
          if (preview && prefill.gif) {
            preview.src = prefill.gif;
            preview.hidden = false;
          }
          if (picked && prefill.name) {
            picked.textContent = 'Choisi : ' + prefill.name;
            picked.hidden = false;
          }
        }
      }

      block.querySelector('[data-add-ex]').addEventListener('click', function () {
        addExercise();
      });
      exRoot.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-remove-ex]');
        if (!btn) return;
        var row = btn.closest('.builder-exercise');
        if (row) row.remove();
        reindex();
      });
      block.querySelector('[data-dup-session]').addEventListener('click', function () {
        duplicateSession(sIdx);
      });
      if (!exRoot.children.length) addExercise();
    }

    function collectSessionPrefill(sIdx) {
      var block = root.querySelector('[data-session-index="' + sIdx + '"]');
      if (!block) return [];
      var out = [];
      block.querySelectorAll('.builder-exercise').forEach(function (row) {
        out.push({
          catalogId: row.querySelector('[data-catalog-id]').value,
          name: row.querySelector('[data-catalog-name]').value,
          gif: (row.querySelector('[data-catalog-preview]') || {}).src || '',
          sets: row.querySelector('input[name*="[sets]"]').value,
          reps: row.querySelector('input[name*="[reps]"]').value,
        });
      });
      return out;
    }

    function duplicateSession(fromIdx) {
      var n = sessionCount();
      if (n >= 7) {
        window.alert('Maximum 7 séances par semaine.');
        return;
      }
      var prefills = collectSessionPrefill(fromIdx);
      var src = root.querySelector('[data-session-index="' + fromIdx + '"]');
      var focusVal = src.querySelector('[data-focus-input]').value || 'Tout le corps';
      var titleVal = (src.querySelector('input[name*="[title]"]').value || 'Séance') + ' (copie)';
      var dest = n;
      countHidden.value = String(n + 1);
      if (countUi) countUi.value = String(n + 1);
      root.insertAdjacentHTML('beforeend', sessionPaneHtml(dest));
      var destBlock = root.querySelector('[data-session-index="' + dest + '"]');
      bindSessionPane(destBlock);
      destBlock.querySelector('[data-focus-input]').value = focusVal;
      var fullBody = focusVal === 'Tout le corps';
      destBlock.querySelector('[data-session-type]').value = fullBody ? 'full_body' : 'body_part';
      destBlock.setAttribute('data-session-type', fullBody ? 'full_body' : 'body_part');
      destBlock.setAttribute('data-focus', fullBody ? '' : focusVal);
      destBlock.querySelector('input[name*="[title]"]').value = titleVal;
      var exRoot = destBlock.querySelector('[data-exercises]');
      exRoot.innerHTML = '';
      if (!prefills.length) {
        destBlock.querySelector('[data-add-ex]').click();
      } else {
        prefills.forEach(function (p) {
          destBlock.querySelector('[data-add-ex]').click();
          var row = exRoot.lastElementChild;
          if (!row) return;
          if (p.catalogId) {
            row.querySelector('[data-catalog-id]').value = p.catalogId;
            row.querySelector('[data-catalog-name]').value = p.name;
            row.querySelector('[data-catalog-search]').value = p.name;
            var picked = row.querySelector('[data-catalog-picked]');
            picked.textContent = 'Choisi : ' + p.name;
            picked.hidden = false;
          }
          row.querySelector('input[name*="[sets]"]').value = p.sets;
          row.querySelector('input[name*="[reps]"]').value = p.reps;
          if (p.gif) {
            var preview = row.querySelector('[data-catalog-preview]');
            preview.src = p.gif;
            preview.hidden = false;
          }
        });
      }
      refreshSessionLabels();
      goTo('session-' + dest);
    }

    function refreshSessionLabels() {
      root.querySelectorAll('.builder-session').forEach(function (block) {
        var idx = Number(block.getAttribute('data-session-index'));
        var title = block.querySelector('.wizard-title');
        if (!title) return;
        title.innerHTML =
          'Séance ' + (idx + 1) + ' <small>sur ' + sessionCount() + '</small>';
      });
    }

    /** Crée / ajuste les panneaux sans écraser les séances déjà remplies. */
    function ensureSessionPanes() {
      var n = sessionCount();
      var existing = root.querySelectorAll('.builder-session').length;
      if (existing > n) {
        for (var i = existing - 1; i >= n; i -= 1) {
          var el = root.querySelector('[data-session-index="' + i + '"]');
          if (el) el.remove();
        }
      } else if (existing < n) {
        for (var j = existing; j < n; j += 1) {
          root.insertAdjacentHTML('beforeend', sessionPaneHtml(j));
          bindSessionPane(root.querySelector('[data-session-index="' + j + '"]'));
        }
      }
      refreshSessionLabels();
    }

    function updateProgress() {
      form.querySelectorAll('[data-progress-step]').forEach(function (li) {
        li.classList.remove('is-active', 'is-done');
      });
      var infos = form.querySelector('[data-progress-step="0"]');
      var sess = form.querySelector('[data-progress-step="sessions"]');
      var rev = form.querySelector('[data-progress-step="review"]');
      if (step === 'infos') infos.classList.add('is-active');
      else if (String(step).indexOf('session-') === 0) {
        infos.classList.add('is-done');
        sess.classList.add('is-active');
      } else {
        infos.classList.add('is-done');
        sess.classList.add('is-done');
        rev.classList.add('is-active');
      }
    }

    function hideAllPanes() {
      form.querySelectorAll('[data-wizard-pane]').forEach(function (p) {
        p.hidden = true;
        p.classList.remove('is-active');
      });
    }

    function goTo(next) {
      step = next;
      if (String(next).indexOf('session-') === 0) {
        sessionIndex = Number(String(next).split('-')[1]) || 0;
      }
      hideAllPanes();
      root.hidden = String(next).indexOf('session-') !== 0;
      var pane;
      if (next === 'infos') pane = form.querySelector('[data-wizard-pane="infos"]');
      else if (next === 'review') pane = form.querySelector('[data-wizard-pane="review"]');
      else pane = form.querySelector('[data-wizard-pane="' + next + '"]');
      if (pane) {
        pane.hidden = false;
        pane.classList.add('is-active');
        if (next === 'review') fillSummary();
      }
      updateProgress();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function fillSummary() {
      var box = form.querySelector('[data-wizard-summary]');
      if (!box) return;
      var title = (form.querySelector('#title') || {}).value || '—';
      var athlete = form.querySelector('#athlete_id');
      var athleteLabel = athlete && athlete.selectedOptions[0] ? athlete.selectedOptions[0].textContent : '—';
      var weeks = (form.querySelector('#weeks') || {}).value || '—';
      var html = '<ul class="kv"><li><span>Titre</span><b>' + escapeHtml(title) + '</b></li>';
      html += '<li><span>Sportif</span><b>' + escapeHtml(athleteLabel) + '</b></li>';
      html += '<li><span>Durée</span><b>' + escapeHtml(weeks) + ' sem. · ' + sessionCount() + ' séances/sem.</b></li></ul>';
      for (var i = 0; i < sessionCount(); i += 1) {
        var block = root.querySelector('[data-session-index="' + i + '"]');
        var focus = block.querySelector('[data-focus-input]');
        var exNames = [];
        block.querySelectorAll('[data-catalog-name]').forEach(function (n) {
          if (n.value) exNames.push(n.value);
        });
        html +=
          '<div class="wizard-summary-session"><strong>Séance ' +
          (i + 1) +
          '</strong> — ' +
          escapeHtml(focus.value || 'Tout le corps') +
          '<br><span class="muted">' +
          (exNames.length ? escapeHtml(exNames.join(', ')) : 'Aucun exercice') +
          '</span></div>';
      }
      box.innerHTML = html;
    }

    function validateInfos() {
      var title = form.querySelector('#title');
      var athlete = form.querySelector('#athlete_id');
      if (!title.value.trim()) {
        title.focus();
        window.alert('Indique un titre.');
        return false;
      }
      if (!athlete.value) {
        athlete.focus();
        window.alert('Choisis un sportif.');
        return false;
      }
      return true;
    }

    function validateSession(idx) {
      var block = root.querySelector('[data-session-index="' + idx + '"]');
      var ids = block.querySelectorAll('[data-catalog-id]');
      var ok = false;
      ids.forEach(function (el) {
        if (el.value) ok = true;
      });
      if (!ok) {
        window.alert('Ajoute au moins un exercice du catalogue pour la séance ' + (idx + 1) + '.');
        return false;
      }
      return true;
    }

    form.addEventListener('click', function (e) {
      var nextBtn = e.target.closest('[data-wizard-next]');
      var prevBtn = e.target.closest('[data-wizard-prev]');
      if (nextBtn) {
        if (step === 'infos') {
          if (!validateInfos()) return;
          ensureSessionPanes();
          goTo('session-0');
          return;
        }
        if (String(step).indexOf('session-') === 0) {
          if (!validateSession(sessionIndex)) return;
          if (sessionIndex + 1 < sessionCount()) goTo('session-' + (sessionIndex + 1));
          else goTo('review');
          return;
        }
      }
      if (prevBtn) {
        if (step === 'review') goTo('session-' + (sessionCount() - 1));
        else if (String(step).indexOf('session-') === 0) {
          if (sessionIndex <= 0) goTo('infos');
          else goTo('session-' + (sessionIndex - 1));
        }
      }
    });

    if (countUi) {
      countUi.addEventListener('change', function () {
        var n = Math.max(1, Math.min(7, Number(countUi.value) || 3));
        countUi.value = String(n);
        countHidden.value = String(n);
      });
    }

    form.addEventListener('submit', function (e) {
      if (step !== 'review') {
        e.preventDefault();
        goTo('review');
      }
    });

    goTo('infos');
  })();
})();
