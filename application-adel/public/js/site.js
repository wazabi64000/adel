(function(){
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById('year').textContent = new Date().getFullYear();
  var bar = document.getElementById('progress');
  var totop = document.getElementById('totop');
  var topbarEl = document.querySelector('.topbar');
  var mobilebarEl = document.querySelector('.mobilebar');
  function onScroll(){
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
    if (h.scrollTop > 700) totop.classList.add('show'); else totop.classList.remove('show');
    var sc = h.scrollTop > 8;
    if (topbarEl) topbarEl.classList.toggle('scrolled', sc);
    if (mobilebarEl) mobilebarEl.classList.toggle('scrolled', sc);
  }
  document.addEventListener('scroll', onScroll, {passive:true}); onScroll();
  totop.addEventListener('click', function(){ window.scrollTo({top:0, behavior: reduce ? 'auto' : 'smooth'}); });
  var burger = document.getElementById('burger');
  var mmenu = document.getElementById('mobilemenu');
  function setMenu(open){
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    mmenu.classList.toggle('open', open);
    mmenu.setAttribute('aria-hidden', String(!open));
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) { var f = mmenu.querySelector('a'); if (f) f.focus(); }
  }
  burger.addEventListener('click', function(){ setMenu(burger.getAttribute('aria-expanded') !== 'true'); });
  mmenu.addEventListener('click', function(e){ if (e.target.closest('a') || e.target === mmenu) setMenu(false); });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && mmenu.classList.contains('open')) { setMenu(false); burger.focus(); } });
  window.addEventListener('resize', function(){ if (window.innerWidth >= 1024 && mmenu.classList.contains('open')) setMenu(false); });
  mmenu.addEventListener('keydown', function(e){
    if (e.key !== 'Tab' || !mmenu.classList.contains('open')) return;
    var f = Array.prototype.slice.call(mmenu.querySelectorAll('a[href]'));
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  /* Modale pré-inscription (dialog natif) */
  document.querySelectorAll('[data-modal-open]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var d = document.getElementById(btn.getAttribute('data-modal-open'));
      if (!d) return;
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    });
  });
  document.querySelectorAll('dialog.modal').forEach(function(d){
    var closeBtn = d.querySelector('[data-modal-close]');
    if (closeBtn) closeBtn.addEventListener('click', function(){ d.close(); });
    d.addEventListener('click', function(e){ if (e.target === d) d.close(); });
    d.addEventListener('close', function(){
      var opener = document.querySelector('[data-modal-open="' + d.id + '"]');
      if (opener) opener.focus();
    });
  });
  var els = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    }, {threshold:.12});
    els.forEach(function(el){ io.observe(el); });
  } else { els.forEach(function(el){ el.classList.add('in'); }); }
  var links = document.querySelectorAll('[data-nav]');
  var map = {};
  links.forEach(function(a){ (map[a.getAttribute('data-nav')] = map[a.getAttribute('data-nav')] || []).push(a); });
  if ('IntersectionObserver' in window) {
    var io3 = new IntersectionObserver(function(es){
      es.forEach(function(e){
        if(e.isIntersecting){
          var id = e.target.id;
          Object.keys(map).forEach(function(k){ map[k].forEach(function(a){ a.removeAttribute('aria-current'); }); });
          (map[id] || []).forEach(function(a){ a.setAttribute('aria-current','true'); });
        }
      });
    }, {rootMargin:'-40% 0px -55% 0px'});
    ['accueil','programme','conseils','rejoindre'].forEach(function(id){ var s = document.getElementById(id); if(s) io3.observe(s); });
  }
  function fitTitles(){
    document.querySelectorAll('h1,h2').forEach(function(el){
      el.style.fontSize='';
      el.style.whiteSpace='nowrap';
      var avail=el.clientWidth||el.parentNode.clientWidth||1;
      var size=parseFloat(getComputedStyle(el).fontSize)||16;
      var floor=el.tagName==='H1'?16:15;
      var guard=0;
      while(el.scrollWidth>avail+1&&size>floor&&guard<80){size-=1;el.style.fontSize=size+'px';guard++;}
      if(el.scrollWidth>avail+1){el.style.fontSize='';el.style.whiteSpace='';}
    });
  }
  var fitT=null;
  function scheduleFit(){clearTimeout(fitT);fitT=setTimeout(fitTitles,150);}
  window.addEventListener('resize',scheduleFit);
  window.addEventListener('orientationchange',scheduleFit);
  if(document.fonts&&document.fonts.ready){document.fonts.ready.then(fitTitles);}
  fitTitles();
})();
