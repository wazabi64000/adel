(function () {
  var modal = document.getElementById('review-modal');
  if (!modal) return;

  var csrf = modal.getAttribute('data-csrf') || '';
  var title = document.getElementById('review-title');
  var loading = document.getElementById('review-loading');
  var layout = document.getElementById('review-layout');
  var image = document.getElementById('review-image');
  var frame = document.getElementById('review-frame');
  var thumbs = document.getElementById('review-thumbs');
  var zoom = document.getElementById('review-zoom');
  var zoomLabel = document.getElementById('review-zoom-label');
  var comments = document.getElementById('review-comments');
  var commentForm = document.getElementById('review-comment-form');
  var commentInput = document.getElementById('review-comment');
  var commentStatus = document.getElementById('review-comment-status');
  var reportForm = document.getElementById('review-report-form');
  var reportInput = document.getElementById('review-report');
  var reportState = document.getElementById('review-report-state');
  var reportStatus = document.getElementById('review-report-status');
  var validateBtn = document.getElementById('review-validate');
  var sessionId = null;
  var activeView = '';
  var photos = [];

  function text(value) {
    return String(value == null ? '' : value);
  }

  var pan = null;

  function applyZoom() {
    var value = Number(zoom.value) || 1;
    image.style.width = value * 100 + '%';
    zoomLabel.textContent = Math.round(value * 100) + ' %';
    var canPan = frame.scrollWidth > frame.clientWidth + 2 || frame.scrollHeight > frame.clientHeight + 2;
    frame.classList.toggle('can-pan', canPan);
  }

  image.draggable = false;
  frame.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || !frame.classList.contains('can-pan')) return;
    pan = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      left: frame.scrollLeft,
      top: frame.scrollTop,
    };
    frame.classList.add('is-panning');
    frame.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  frame.addEventListener('pointermove', function (e) {
    if (!pan || e.pointerId !== pan.id) return;
    frame.scrollLeft = pan.left - (e.clientX - pan.x);
    frame.scrollTop = pan.top - (e.clientY - pan.y);
  });
  function endPan(e) {
    if (!pan || e.pointerId !== pan.id) return;
    pan = null;
    frame.classList.remove('is-panning');
  }
  frame.addEventListener('pointerup', endPan);
  frame.addEventListener('pointercancel', endPan);
  image.addEventListener('load', applyZoom);

  function showPhoto(view) {
    var photo = photos.find(function (p) { return p.view === view; }) || photos[0];
    if (!photo) return;
    activeView = photo.view;
    image.src = photo.url;
    image.alt = photo.label;
    frame.scrollTop = 0;
    frame.scrollLeft = 0;
    Array.prototype.forEach.call(thumbs.children, function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-view') === activeView);
    });
  }

  function render(data, options) {
    photos = data.photos || [];
    var who = data.athlete ? data.athlete.firstName + ' ' + data.athlete.lastName : 'Athlète';
    title.textContent = who.trim() + (data.session && data.session.dateLabel ? ' · ' + data.session.dateLabel : '');
    thumbs.textContent = '';
    photos.forEach(function (photo) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-view', photo.view);
      btn.setAttribute('aria-label', photo.label);
      var img = document.createElement('img');
      img.src = photo.url;
      img.alt = '';
      btn.appendChild(img);
      btn.addEventListener('click', function () { showPhoto(photo.view); });
      thumbs.appendChild(btn);
    });
    showPhoto(activeView);

    comments.textContent = '';
    if (!data.comments || !data.comments.length) {
      var empty = document.createElement('li');
      empty.textContent = 'Aucun commentaire pour l’instant.';
      comments.appendChild(empty);
    } else {
      data.comments.forEach(function (c) {
        var li = document.createElement('li');
        var p = document.createElement('p');
        p.textContent = c.content;
        var meta = document.createElement('small');
        meta.textContent = c.author + (c.createdAt ? ' · ' + c.createdAt : '');
        li.appendChild(p);
        li.appendChild(meta);
        comments.appendChild(li);
      });
    }

    var report = data.report;
    if (!report) {
      reportState.textContent = 'Évalue la séance, puis valide le rapport pour l’enregistrer dans l’historique de l’athlète et le lui envoyer.';
      validateBtn.textContent = 'Valider et envoyer';
    } else if (report.status === 'validated') {
      var sent = report.sentAt ? ' Envoyé le ' + report.sentAt + '.' : ' Pas encore envoyé par e-mail.';
      reportState.textContent = 'Validé le ' + report.validatedAt + '.' + sent + ' Tu peux encore éditer le texte, puis renvoyer.';
      validateBtn.textContent = 'Mettre à jour et renvoyer';
    } else {
      reportState.textContent = 'Brouillon enregistré. Valide-le pour l’ajouter à l’historique et l’envoyer.';
      validateBtn.textContent = 'Valider et envoyer';
    }
    if (!options || !options.keepReport) reportInput.value = report ? report.content : '';
    loading.hidden = true;
    layout.hidden = false;
  }

  function fail(el, message) {
    el.textContent = message || 'Enregistrement impossible.';
  }

  async function request(url, body) {
    var res = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Enregistrement impossible.');
    return data;
  }

  async function openReview(id, view) {
    sessionId = id;
    activeView = view || '';
    commentStatus.textContent = '';
    reportStatus.textContent = '';
    commentInput.value = '';
    reportInput.value = '';
    zoom.value = '1';
    applyZoom();
    loading.hidden = false;
    loading.textContent = 'Chargement…';
    layout.hidden = true;
    if (typeof modal.showModal === 'function') modal.showModal();
    else modal.setAttribute('open', '');
    try {
      render(await request('/admin/suivi/sessions/' + id));
    } catch (err) {
      loading.textContent = err.message;
    }
  }

  document.querySelectorAll('.follow-photo').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openReview(btn.getAttribute('data-session'), btn.getAttribute('data-view'));
    });
  });

  document.getElementById('review-close').addEventListener('click', function () {
    if (typeof modal.close === 'function') modal.close();
    else modal.removeAttribute('open');
  });
  modal.addEventListener('click', function (e) {
    if (e.target === modal && typeof modal.close === 'function') modal.close();
  });

  zoom.addEventListener('input', applyZoom);
  document.getElementById('review-zoom-out').addEventListener('click', function () {
    zoom.value = String(Math.max(1, Number(zoom.value) - 0.2));
    applyZoom();
  });
  document.getElementById('review-zoom-in').addEventListener('click', function () {
    zoom.value = String(Math.min(3, Number(zoom.value) + 0.2));
    applyZoom();
  });

  commentForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    commentStatus.textContent = '';
    try {
      render(await request('/admin/suivi/sessions/' + sessionId + '/comments', { content: commentInput.value }), { keepReport: true });
      commentInput.value = '';
      commentStatus.textContent = 'Commentaire ajouté.';
    } catch (err) {
      fail(commentStatus, err.message);
    }
  });

  document.getElementById('review-save').addEventListener('click', async function () {
    reportStatus.textContent = '';
    try {
      render(await request('/admin/suivi/sessions/' + sessionId + '/rapport', { content: reportInput.value }));
      reportStatus.textContent = 'Rapport enregistré. Il reste à valider pour l’historique et l’envoi.';
    } catch (err) {
      fail(reportStatus, err.message);
    }
  });

  reportForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    reportStatus.textContent = '';
    try {
      var data = await request('/admin/suivi/sessions/' + sessionId + '/rapport/valider', { content: reportInput.value });
      render(data);
      if (data.delivery && data.delivery.sent) {
        reportStatus.textContent = 'Rapport validé, ajouté à l’historique et envoyé à l’athlète.';
      } else if (data.delivery && data.delivery.reason === 'no-email') {
        reportStatus.textContent = 'Rapport validé et ajouté à l’historique. Aucun e-mail sur le profil.';
      } else {
        reportStatus.textContent = 'Rapport validé et ajouté à l’historique. L’e-mail n’a pas pu partir.';
      }
    } catch (err) {
      fail(reportStatus, err.message);
    }
  });
})();
