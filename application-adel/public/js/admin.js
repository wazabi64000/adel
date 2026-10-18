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
})();
