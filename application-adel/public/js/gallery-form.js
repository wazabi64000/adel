(function () {
  var input = document.getElementById('image');
  var preview = document.getElementById('image-preview');
  var form = document.getElementById('gallery-form');
  if (!input || !preview || !form) return;

  function renderPreview() {
    preview.innerHTML = '';
    var files = Array.from(input.files || []);
    files.forEach(function (file, idx) {
      if (file.type && file.type.indexOf('image/') !== 0) return;
      var url = URL.createObjectURL(file);
      var wrap = document.createElement('div');
      wrap.className = 'image-preview-item';
      wrap.style.position = 'relative';
      var img = document.createElement('img');
      img.src = url;
      img.alt = file.name;
      img.className = 'image-preview-thumb';
      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'image-preview-remove';
      del.setAttribute('aria-label', 'Retirer ' + file.name);
      del.textContent = '×';
      del.addEventListener('click', function () {
        var dt = new DataTransfer();
        Array.from(input.files)
          .filter(function (_, i) {
            return i !== idx;
          })
          .forEach(function (f) {
            dt.items.add(f);
          });
        input.files = dt.files;
        renderPreview();
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      wrap.appendChild(img);
      wrap.appendChild(del);
      preview.appendChild(wrap);
    });
  }

  input.addEventListener('change', renderPreview);

  form.addEventListener('submit', function (e) {
    if (input.files && input.files.length > 0) return;
    e.preventDefault();
    var err = document.getElementById('image-error');
    if (!err) {
      err = document.createElement('small');
      err.id = 'image-error';
      err.className = 'field-error';
      err.textContent = 'Au moins une image est obligatoire.';
      input.parentNode.appendChild(err);
    }
    input.focus();
  });
})();
