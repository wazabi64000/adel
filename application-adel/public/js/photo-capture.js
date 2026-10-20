(function () {
  var form = document.getElementById('photo-form');
  if (!form) return;

  form.querySelectorAll('.photo-capture-item').forEach(function (item) {
    var camInput = item.querySelector('input[data-source="camera"]');
    var upInput = item.querySelector('input[data-source="upload"]');
    var previewWrap = item.querySelector('.photo-preview-wrap');
    var previewImg = item.querySelector('.photo-preview-img');
    var cropData = item.querySelector('.crop-data');
    var rangeX = item.querySelector('.crop-range[data-axis="x"]');
    var rangeY = item.querySelector('.crop-range[data-axis="y"]');
    var camBtn = item.querySelector('.photo-action-camera');
    var upBtn = item.querySelector('.photo-action-upload');
    var previewUrl = '';

    if (!camInput || !upInput || !previewWrap || !previewImg) return;

    function clearPreview() {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = '';
      previewWrap.style.display = 'none';
      previewImg.removeAttribute('src');
    }

    function showFile(file, input) {
      if (!file) return;
      if (file.type && file.type.indexOf('image/') !== 0) {
        window.alert('Format invalide. Choisis une image.');
        input.value = '';
        return;
      }
      var other = input === camInput ? upInput : camInput;
      other.value = '';
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(file);
      previewImg.src = previewUrl;
      previewWrap.style.display = 'block';
      previewImg.style.objectPosition = '50% 50%';
      if (rangeX) rangeX.value = 50;
      if (rangeY) rangeY.value = 50;
      if (cropData) cropData.value = '50% 50%';
    }

    if (camBtn) {
      camBtn.addEventListener('click', function (e) {
        e.preventDefault();
        camInput.click();
      });
    }
    if (upBtn) {
      upBtn.addEventListener('click', function (e) {
        e.preventDefault();
        upInput.click();
      });
    }

    camInput.addEventListener('change', function () {
      showFile(camInput.files && camInput.files[0], camInput);
    });
    upInput.addEventListener('change', function () {
      showFile(upInput.files && upInput.files[0], upInput);
    });

    function updateCrop() {
      var x = rangeX ? rangeX.value : 50;
      var y = rangeY ? rangeY.value : 50;
      previewImg.style.objectPosition = x + '% ' + y + '%';
      if (cropData) cropData.value = x + '% ' + y + '%';
    }
    if (rangeX) rangeX.addEventListener('input', updateCrop);
    if (rangeY) rangeY.addEventListener('input', updateCrop);

    var removeBtn = previewWrap.querySelector('.photo-remove');
    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        clearPreview();
        camInput.value = '';
        upInput.value = '';
        if (cropData) cropData.value = '50% 50%';
        if (rangeX) rangeX.value = 50;
        if (rangeY) rangeY.value = 50;
      });
    }
  });
})();
