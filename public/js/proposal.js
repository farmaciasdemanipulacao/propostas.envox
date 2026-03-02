/**
 * proposal.js — Navegação de Slides da Proposta Envox
 */
(function() {
  'use strict';

  const totalSlides = window.TOTAL_SLIDES || 11;
  const slideTitles = window.SLIDE_TITLES || [];
  
  let currentIndex  = 0;
  let isAnimating   = false;

  // DOM Elements
  const btnPrev       = document.getElementById('btnPrev');
  const btnNext       = document.getElementById('btnNext');
  const navDots       = document.querySelectorAll('.dot');
  const progressFill  = document.getElementById('progressFill');
  const slideCountEl  = document.getElementById('currentSlideNum');
  const slideTitleEl  = document.getElementById('slideTitleText');

  // ====== SHOW SLIDE ======
  function showSlide(index, direction) {
    if (isAnimating) return;
    if (index < 0 || index >= totalSlides) return;
    
    isAnimating = true;
    
    // Hide current
    const currentSlide = document.querySelector(`.slide[data-index="${currentIndex}"]`);
    if (currentSlide) {
      currentSlide.style.display = 'none';
    }
    
    // Show new
    const newSlide = document.querySelector(`.slide[data-index="${index}"]`);
    if (newSlide) {
      newSlide.style.display = 'flex';
      newSlide.style.animation = 'none';
      newSlide.offsetHeight; // reflow
      
      if (direction === 'back') {
        newSlide.classList.add('going-back');
        newSlide.style.animation = '';
      } else {
        newSlide.classList.remove('going-back');
        newSlide.style.animation = '';
      }
    }
    
    const prevIndex = currentIndex;
    currentIndex = index;
    
    // Update UI
    updateUI();
    
    // Track slide
    if (window.Tracking) {
      window.Tracking.trackSlide(index + 1);
    }
    
    setTimeout(() => {
      isAnimating = false;
      if (newSlide) {
        newSlide.classList.remove('going-back');
      }
    }, 350);
  }

  function updateUI() {
    const slideNum = currentIndex + 1;
    const progress = (slideNum / totalSlides) * 100;
    
    // Progress bar
    if (progressFill) progressFill.style.width = progress + '%';
    
    // Counter
    if (slideCountEl) slideCountEl.textContent = slideNum;
    
    // Title
    if (slideTitleEl && slideTitles[currentIndex]) {
      slideTitleEl.textContent = slideTitles[currentIndex];
    }
    
    // Buttons
    if (btnPrev) btnPrev.disabled = currentIndex === 0;
    if (btnNext) btnNext.disabled = currentIndex === totalSlides - 1;
    
    // Dots
    navDots.forEach((dot, i) => {
      dot.classList.toggle('dot-active', i === currentIndex);
    });
  }

  // ====== NAVIGATION EVENTS ======
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      if (currentIndex < totalSlides - 1) {
        showSlide(currentIndex + 1, 'forward');
      }
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (currentIndex > 0) {
        showSlide(currentIndex - 1, 'back');
      }
    });
  }

  // Dot navigation
  navDots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      if (i !== currentIndex) {
        showSlide(i, i > currentIndex ? 'forward' : 'back');
      }
    });
  });

  // ====== KEYBOARD NAVIGATION ======
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
      e.preventDefault();
      if (currentIndex < totalSlides - 1) showSlide(currentIndex + 1, 'forward');
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentIndex > 0) showSlide(currentIndex - 1, 'back');
    }
  });

  // ====== TOUCH/SWIPE NAVIGATION ======
  let touchStartX = 0;
  let touchStartY = 0;

  document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;

    // Only horizontal swipes
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0 && currentIndex < totalSlides - 1) {
        showSlide(currentIndex + 1, 'forward');
      } else if (dx > 0 && currentIndex > 0) {
        showSlide(currentIndex - 1, 'back');
      }
    }
  }, { passive: true });

  // ====== MOUSE WHEEL ======
  let wheelTimeout;
  document.addEventListener('wheel', (e) => {
    e.preventDefault();
    clearTimeout(wheelTimeout);
    wheelTimeout = setTimeout(() => {
      if (e.deltaY > 30 && currentIndex < totalSlides - 1) {
        showSlide(currentIndex + 1, 'forward');
      } else if (e.deltaY < -30 && currentIndex > 0) {
        showSlide(currentIndex - 1, 'back');
      }
    }, 50);
  }, { passive: false });

  // ====== INIT ======
  function init() {
    updateUI();
    
    // Initial track (slide 1)
    if (window.Tracking) {
      // Tracking is initialized in tracking.js
      console.log('[Proposal] Slide viewer initialized');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
