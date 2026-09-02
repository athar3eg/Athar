/**
 * ==============================================================================
 * أَثَر — Ultra Light Fluid Motion & Scroll Reveal Engine (120 FPS Native)
 * ==============================================================================
 */

(function() {
  'use strict';

  // 1. ── Scroll Reveal Intersection Observer (أنيميشن التمرير السلس) ──
  let revealObserver = null;

  function initScrollReveal() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal-on-scroll').forEach(el => el.classList.add('is-revealed'));
      return;
    }

    if (!revealObserver) {
      revealObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            obs.unobserve(entry.target);
          }
        });
      }, {
        threshold: 0.08,
        rootMargin: '0px 0px -25px 0px'
      });
    }

    const selectors = [
      '.card-3d',
      '.card-interactive',
      '#how-it-works',
      '#subjectsList > div',
      '#todayList > div',
      '#tasksPreview > div',
      '#lateTasksList > div',
      '#tasksList > div',
      '#examsList > div',
      '#teachersList > div',
      '.gemini-card',
      '[data-scroll-reveal]'
    ];

    document.querySelectorAll(selectors.join(',')).forEach((el, index) => {
      if (!el.classList.contains('is-revealed') && !el.dataset.revealedBound) {
        el.dataset.revealedBound = 'true';
        el.classList.add('reveal-on-scroll');
        
        const delayClass = `stagger-${(index % 4) + 1}`;
        if (!el.className.includes('stagger-')) {
          el.classList.add(delayClass);
        }
        
        revealObserver.observe(el);
      }
    });
  }

  // 2. ── Smooth Button Ripple Effect ──
  function initRipple(e) {
    const btn = e.currentTarget;
    if (btn.classList.contains('no-ripple')) return;

    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    const wave = document.createElement('span');
    wave.className = 'ripple-wave';
    wave.style.width = wave.style.height = `${size}px`;
    wave.style.left = `${x}px`;
    wave.style.top = `${y}px`;

    const oldPos = window.getComputedStyle(btn).position;
    if (oldPos === 'static') btn.style.position = 'relative';
    btn.style.overflow = 'hidden';

    btn.appendChild(wave);
    wave.addEventListener('animationend', () => wave.remove(), { once: true });
  }

  // 3. ── Lightweight Micro-Confetti Burst ──
  window.triggerConfetti = function(x, y) {
    const colors = ['#0077CC', '#38bdf8', '#00875f', '#8fe9c4', '#ffd28a', '#ff4d6d'];
    const count = 18;
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-particle';
      const size = Math.random() * 6 + 4;
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      p.style.backgroundColor = colors[i % colors.length];
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;

      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const distance = Math.random() * 60 + 30;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance - 15;

      p.style.setProperty('--tx', `${tx}px`);
      p.style.setProperty('--ty', `${ty}px`);

      fragment.appendChild(p);
      setTimeout(() => p.remove(), 700);
    }

    document.body.appendChild(fragment);
  };

  // 4. ── Smooth Task Completion Animation ──
  window.animateTaskElementDone = function(taskRow, callback) {
    if (!taskRow) {
      if (callback) callback();
      return;
    }
    taskRow.classList.add('task-row', 'completing');
    setTimeout(() => {
      taskRow.remove();
      if (callback) callback();
    }, 320);
  };

  // 5. ── Count-Up Animation Helper (2.2) ──
  window.animateCountUp = function(el, targetVal, duration = 800) {
    if (!el) return;
    const startVal = 0;
    const startTime = performance.now();

    function step(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // cubic out
      const current = Math.round(startVal + (targetVal - startVal) * ease);
      el.textContent = current;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  };

  // 6. ── Shake Micro Animation Helper ──
  window.animateElementShake = function(el) {
    if (!el) return;
    el.classList.remove('shake-micro');
    void el.offsetWidth; // trigger reflow
    el.classList.add('shake-micro');
    setTimeout(() => el.classList.remove('shake-micro'), 400);
  };

  // 7. ── Subtle 3D Card Tilt (Desktop Only) ──
  function init3DTilt() {
    if (window.innerWidth < 768 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    document.querySelectorAll('.card-3d:not([data-tilt-bound])').forEach(card => {
      card.dataset.tiltBound = 'true';

      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -4; // max 4 deg
        const rotateY = ((x - centerX) / centerX) * 4;

        card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-2px)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  function bindRipples() {
    document.querySelectorAll('button:not([data-ripple-bound]), a.btn:not([data-ripple-bound])').forEach(btn => {
      btn.dataset.rippleBound = 'true';
      btn.addEventListener('click', initRipple, { passive: true });
    });
  }

  function refreshMotion() {
    initScrollReveal();
    bindRipples();
    init3DTilt();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refreshMotion);
  } else {
    refreshMotion();
  }

  let throttleTimer = null;
  const observer = new MutationObserver(() => {
    if (throttleTimer) return;
    throttleTimer = setTimeout(() => {
      refreshMotion();
      throttleTimer = null;
    }, 150);
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

})();