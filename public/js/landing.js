(function(){
  'use strict';

  const navbar = document.querySelector('.nav');

  function onScroll() {
    const y = window.scrollY;
    navbar.classList.toggle('scrolled', y > 60);
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
  var revealSelectors = '[class*="reveal"]';
  var revealElements = document.querySelectorAll(revealSelectors);

  function makeObserver(rootMargin, threshold) {
    if (!('IntersectionObserver' in window)) return null;
    return new IntersectionObserver(function(entries, obs) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          entry.target.dispatchEvent(new CustomEvent('revealed'));
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: threshold || 0.08, rootMargin: rootMargin || '0px 0px -40px 0px' });
  }

  var revealObserver = makeObserver();
  if (revealObserver) {
    revealElements.forEach(function(el) { revealObserver.observe(el); });
  } else {
    revealElements.forEach(function(el) { el.classList.add('visible'); });
  }

  /* Counter animation for metrics */
  function animateCounter(el) {
    var raw = el.getAttribute('data-target');
    var target = parseFloat(raw);
    var decimals = (raw.indexOf('.') !== -1) ? raw.split('.')[1].length : 0;
    var suffix = el.getAttribute('data-suffix') || '';
    var prefix = el.getAttribute('data-prefix') || '';
    var duration = 1500;
    var start = performance.now();

    function tick(now) {
      var elapsed = now - start;
      var progress = Math.min(elapsed / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = eased * target;
      var formatted = current.toFixed(decimals);
      el.textContent = prefix + formatted + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  document.querySelectorAll('.counter-num').forEach(function(el) {
    el.addEventListener('revealed', function() { animateCounter(el); }, { once: true });
  });

  /* Step connection line animation */
  var stepLineFill = document.getElementById('step-line-fill');
  if (stepLineFill) {
    var stepsObserver = makeObserver('0px 0px -80px 0px', 0.15);
    if (stepsObserver) {
      stepsObserver.observe(stepLineFill);
      stepLineFill.addEventListener('revealed', function() {
        document.querySelectorAll('.step-line-dot').forEach(function(dot, i) {
          setTimeout(function() { dot.classList.add('filled'); }, i * 250);
        });
      }, { once: true });
    } else {
      stepLineFill.classList.add('visible');
      document.querySelectorAll('.step-line-dot').forEach(function(dot) {
        dot.classList.add('filled');
      });
    }
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
