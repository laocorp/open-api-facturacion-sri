(function(){
  'use strict';

  const navbar = document.querySelector('.nav');
  const sectionNav = document.querySelector('.section-nav');

  function onScroll() {
    const y = window.scrollY;
    navbar.classList.toggle('scrolled', y > 60);

    if (sectionNav) {
      const links = sectionNav.querySelectorAll('a');
      let current = '';
      document.querySelectorAll('section[id]').forEach(function(section) {
        const top = section.offsetTop - 120;
        if (y >= top) current = section.getAttribute('id');
      });
      links.forEach(function(link) {
        link.style.color = link.getAttribute('href') === '#' + current
          ? 'var(--navy-800)'
          : '';
      });
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Mobile menu */
  const toggle = document.getElementById('nav-toggle');
  const overlay = document.getElementById('mobile-overlay');
  const closeBtn = document.getElementById('mobile-close');

  if (toggle && overlay) {
    function openMenu() {
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
      toggle.setAttribute('aria-expanded', 'true');
    }

    function closeMenu() {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
      toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', openMenu);
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeMenu();
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && overlay.classList.contains('open')) closeMenu();
    });

    overlay.querySelectorAll('.mobile-nav a').forEach(function(link) {
      link.addEventListener('click', closeMenu);
    });
  }

  /* IntersectionObserver: reveal animations */
  const revealElements = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.08,
      rootMargin: '0px 0px -40px 0px',
    });

    revealElements.forEach(function(el) {
      observer.observe(el);
    });
  } else {
    revealElements.forEach(function(el) { el.classList.add('visible'); });
  }

  /* Smooth scroll */
  document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
      var targetId = this.getAttribute('href');
      if (targetId === '#') return;
      var target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        var offset = 80;
        var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
    });
  });

  /* FAQ accordion */
  document.querySelectorAll('.faq-q').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var item = this.parentElement;
      var open = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(function(el) {
        el.classList.remove('open');
        el.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
      });
      if (!open) {
        item.classList.add('open');
        item.querySelector('.faq-q').setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* CTA form */
  var ctaForm = document.getElementById('cta-form');
  if (ctaForm) {
    ctaForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var input = this.querySelector('.cta-input');
      if (input && input.value.trim()) {
        // Demo: would POST to /api/leads in production
        input.value = '';
        var note = this.parentElement.querySelector('.cta-note');
        if (note) {
          var orig = note.textContent;
          note.textContent = 'Gracias. Le contactaremos en menos de 24 horas.';
          setTimeout(function() { note.textContent = orig; }, 4000);
        }
      }
    });
  }

})();
