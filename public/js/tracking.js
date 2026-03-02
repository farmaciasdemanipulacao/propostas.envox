/**
 * tracking.js — Frontend Tracking para Proposta Envox
 * Rastreia: abertura, slides, revisitas, fechamento
 */
(function() {
  'use strict';
  
  // Variáveis de rastreamento (injetadas pelo servidor via viewer.ejs)
  const TOKEN   = window.PROPOSAL_TOKEN;
  const API_BASE = '/api/track';

  let sessionId     = null;
  let currentSlide  = 1;
  let slideStartTime = Date.now();
  let totalStartTime = Date.now();
  let visitedSlides  = new Set();
  let proposalClosed = false;

  // ====== INICIALIZAÇÃO ======
  async function init() {
    if (!TOKEN) return;
    
    try {
      const resp = await fetch(`${API_BASE}/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TOKEN })
      });
      const data = await resp.json();
      if (data.sessionId) {
        sessionId = data.sessionId;
        window._sessionId = sessionId; // expose for builder.js
        console.log('[Tracking] Session started:', sessionId);
        
        // Registrar slide 1 como visualizado ao abrir
        trackCurrentSlide(1);
      }
    } catch (err) {
      console.error('[Tracking] Error opening proposal:', err);
    }
  }

  // ====== REGISTRAR SLIDE ======
  function trackCurrentSlide(slideNumber) {
    if (!sessionId || !TOKEN) return;
    
    const now      = Date.now();
    const duration = (now - slideStartTime) / 1000;
    const isRevisit = visitedSlides.has(slideNumber);
    
    // Marcar como visitado
    visitedSlides.add(slideNumber);
    
    // Registrar tempo no slide ANTERIOR (se houver mudança)
    if (slideNumber !== currentSlide && currentSlide > 0) {
      sendSlideEvent(currentSlide, duration, visitedSlides.has(currentSlide) && currentSlide !== slideNumber);
    }
    
    // Atualizar slide atual
    currentSlide    = slideNumber;
    slideStartTime  = now;
    
    // Registrar visualização do novo slide
    if (!isRevisit) {
      sendSlideEvent(slideNumber, 0, false);
    } else {
      sendSlideEvent(slideNumber, 0, true);
    }
  }

  function sendSlideEvent(slideNumber, duration, isRevisit) {
    if (!sessionId || !TOKEN) return;
    
    fetch(`${API_BASE}/slide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: TOKEN,
        sessionId: sessionId,
        slideNumber: slideNumber,
        duration: Math.max(0, duration),
        isRevisit: isRevisit
      })
    }).catch(err => console.warn('[Tracking] Slide track error:', err));
  }

  // ====== FECHAR PROPOSTA ======
  function closeProposal() {
    if (!sessionId || !TOKEN || proposalClosed) return;
    proposalClosed = true;
    
    // Registrar último slide com duração final
    const duration = (Date.now() - slideStartTime) / 1000;
    const totalDuration = Math.round((Date.now() - totalStartTime) / 1000);
    
    const payload = JSON.stringify({
      token: TOKEN,
      sessionId: sessionId,
      slideNumber: currentSlide,
      duration: duration,
      isRevisit: false
    });
    
    const closePayload = JSON.stringify({
      token: TOKEN,
      sessionId: sessionId,
      totalDuration: totalDuration
    });

    // Usar sendBeacon para garantir envio mesmo ao fechar a aba
    if (navigator.sendBeacon) {
      navigator.sendBeacon(`${API_BASE}/slide`, new Blob([payload], { type: 'application/json' }));
      navigator.sendBeacon(`${API_BASE}/close`, new Blob([closePayload], { type: 'application/json' }));
    } else {
      // Fallback síncrono
      const xhr1 = new XMLHttpRequest();
      xhr1.open('POST', `${API_BASE}/slide`, false);
      xhr1.setRequestHeader('Content-Type', 'application/json');
      try { xhr1.send(payload); } catch(e) {}
      
      const xhr2 = new XMLHttpRequest();
      xhr2.open('POST', `${API_BASE}/close`, false);
      xhr2.setRequestHeader('Content-Type', 'application/json');
      try { xhr2.send(closePayload); } catch(e) {}
    }
  }

  // ====== EVENTOS DE SAÍDA ======
  
  // Visibilidade da aba (muda para outra aba)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      closeProposal();
    }
  });
  
  // Fechamento da janela/navegação
  window.addEventListener('beforeunload', () => {
    closeProposal();
  });
  
  // Pagehide (iOS Safari)
  window.addEventListener('pagehide', () => {
    closeProposal();
  });

  // Inatividade (2 minutos sem mudar de slide)
  let inactivityTimer;
  function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      // Registra fechamento por inatividade mas não fecha de fato
      closeProposal();
    }, 120000); // 2 minutos
  }
  document.addEventListener('mousemove', resetInactivityTimer);
  document.addEventListener('keydown', resetInactivityTimer);
  document.addEventListener('touchstart', resetInactivityTimer);
  document.addEventListener('click', resetInactivityTimer);

  // ====== API PÚBLICA ======
  window.Tracking = {
    init,
    trackSlide: trackCurrentSlide,
    close: closeProposal
  };

  // Auto-inicializar quando DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Iniciar timer de inatividade
  resetInactivityTimer();

})();
