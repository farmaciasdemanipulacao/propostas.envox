/**
 * proposal.js — Step-by-step vertical page navigation
 * Scrolls to each page-section, tracks current slide, updates progress/dots
 */
(function () {
  'use strict';

  const totalSlides  = window.TOTAL_SLIDES || 12;
  const slideTitles  = window.SLIDE_TITLES || [];

  let currentIndex   = 0;
  let isScrolling    = false;
  let scrollTimeout  = null;
  let titleTimeout   = null;

  // DOM
  const container     = document.getElementById('pagesContainer');
  const progressFill  = document.getElementById('progressFill');
  const slideCountEl  = document.getElementById('currentSlideNum');
  const slideTitleEl  = document.getElementById('slideTitleText');
  const titleToast    = document.getElementById('slideTitleToast');
  const btnPrev       = document.getElementById('btnPrev');
  const btnNext       = document.getElementById('btnNext');
  const stepDots      = document.querySelectorAll('.step-dot');

  // ── Get all page sections ──────────────────────────────────────────
  function getPages() {
    return Array.from(document.querySelectorAll('.page-section'));
  }

  // ── Scroll to a specific page ─────────────────────────────────────
  function scrollToSlide(index) {
    const pages = getPages();
    if (index < 0 || index >= pages.length) return;
    const target = pages[index];
    if (!target) return;

    isScrolling = true;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });

    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      isScrolling = false;
    }, 700);

    setCurrentIndex(index);
  }
  window.scrollToSlide = scrollToSlide;

  // ── Navigate relative to current ──────────────────────────────────
  function navigatePage(delta) {
    const pages = getPages();
    const next = currentIndex + delta;
    if (next >= 0 && next < pages.length) {
      scrollToSlide(next);
    }
  }
  window.navigatePage = navigatePage;

  // ── Update UI for current index ───────────────────────────────────
  function setCurrentIndex(idx) {
    currentIndex = idx;
    const slideNum  = idx + 1;
    const progress  = (slideNum / totalSlides) * 100;

    // Progress bar
    if (progressFill) progressFill.style.width = progress + '%';

    // Counter
    if (slideCountEl) slideCountEl.textContent = slideNum;

    // Title toast
    if (slideTitleEl && slideTitles[idx]) {
      slideTitleEl.textContent = slideTitles[idx];
    }
    showTitleToast();

    // Prev/Next buttons
    const pageCount = getPages().length || totalSlides;
    if (btnPrev) btnPrev.disabled = idx === 0;
    if (btnNext) btnNext.disabled = idx >= pageCount - 1;

    // Step dots
    stepDots.forEach((dot, i) => {
      dot.classList.toggle('step-dot-active',   i === idx);
      dot.classList.toggle('step-dot-visited',  i < idx);
    });

    // Track slide
    if (window.Tracking) {
      window.Tracking.trackSlide(slideNum);
    }
  }

  // ── Show title toast briefly ──────────────────────────────────────
  function showTitleToast() {
    if (!titleToast) return;
    titleToast.classList.add('toast-visible');
    clearTimeout(titleTimeout);
    titleTimeout = setTimeout(() => {
      titleToast.classList.remove('toast-visible');
    }, 2200);
  }

  // ── Scroll-based detection: works with slides of ANY height ─────────
  // Finds the page whose top edge is closest to (and just above) the
  // 30% mark of the viewport — robust against tall builder/budget slides.
  function getActiveIndexByScroll() {
    const pages = getPages();
    if (!pages.length) return 0;
    const trigger = window.innerHeight * 0.30; // 30% from top of viewport
    let best = 0;
    let bestDist = Infinity;
    pages.forEach((page, i) => {
      const rect = page.getBoundingClientRect();
      // Distance between the slide's top and the trigger line
      // We want the slide whose top is just above (or at) the trigger
      const dist = Math.abs(rect.top - trigger);
      if (rect.top <= trigger + 10 && dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  }

  function initObserver() {
    let rafPending = false;
    let lastIdx = -1;

    function onScroll() {
      if (isScrolling) return;
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        const idx = getActiveIndexByScroll();
        if (idx !== lastIdx) {
          lastIdx = idx;
          setCurrentIndex(idx);
        }
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // ── Keyboard navigation ───────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    const active = document.activeElement;
    // Don't hijack if user is typing in an input/textarea/select
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return;

    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      e.preventDefault();
      navigatePage(1);
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      navigatePage(-1);
    }
  });

  // ── Touch swipe (vertical) ────────────────────────────────────────
  let touchStartY = 0;
  document.addEventListener('touchstart', e => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dy) > 60) {
      navigatePage(dy < 0 ? 1 : -1);
    }
  }, { passive: true });

  // ── Init ──────────────────────────────────────────────────────────
  function init() {
    setCurrentIndex(0);
    initObserver();

    // Show title on load
    setTimeout(showTitleToast, 600);

    if (window.Tracking) {
      console.log('[Proposal] Step-by-step viewer initialized');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
