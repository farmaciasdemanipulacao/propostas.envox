/**
 * widgets.js — Decision Widget (Accept/Counter/Reject) + Share Widget
 * Loaded on proposal viewer pages.
 */
(function () {
  'use strict';

  // ─── DECISION WIDGET ──────────────────────────────────────────────────────

  let dwCurrentAction = null;
  let dwSubmitted = false;

  // Open widget and optionally pre-select an action
  window.toggleDecisionWidget = function (preAction) {
    const widget = document.getElementById('decisionWidget');
    if (!widget) return;
    const isHidden = widget.classList.contains('hidden');
    if (isHidden) {
      widget.classList.remove('hidden');
    } else if (!preAction) {
      widget.classList.add('hidden');
    }
    if (preAction) {
      widget.classList.remove('hidden');
      window.dwSelectAction(preAction);
    }
  };

  // Quick-action from the persistent pill buttons — open widget + pre-select
  window.dwQuickAction = function (action) {
    window.toggleDecisionWidget(action);
    // Smooth scroll so widget is visible
    const widget = document.getElementById('decisionWidget');
    if (widget) {
      setTimeout(() => widget.scrollIntoView({ behavior: 'smooth', block: 'end' }), 150);
    }
  };

  window.dwSelectAction = function (action) {
    if (dwSubmitted) return;
    dwCurrentAction = action;

    const formCounter = document.getElementById('dwFormCounter');
    const formReject  = document.getElementById('dwFormReject');
    const dwForm      = document.getElementById('dwForm');

    if (formCounter) formCounter.style.display = action === 'counter' ? 'block' : 'none';
    if (formReject)  formReject.style.display  = action === 'reject'  ? 'block' : 'none';
    if (dwForm) dwForm.classList.add('show');

    // Highlight selected button
    document.querySelectorAll('.dw-btn').forEach(btn => {
      btn.style.opacity = '0.5';
      btn.style.transform = 'none';
    });
    const btnMap = { accept: '.dw-btn-accept', counter: '.dw-btn-counter', reject: '.dw-btn-reject' };
    const activeBtn = document.querySelector(btnMap[action]);
    if (activeBtn) {
      activeBtn.style.opacity = '1';
      activeBtn.style.transform = 'scale(1.02)';
    }
  };

  window.dwSubmit = function () {
    if (!dwCurrentAction || dwSubmitted) return;

    const token      = window.PROPOSAL_TOKEN;
    const leadId     = window.PROPOSAL_LEAD_ID;
    const counterVal = document.getElementById('dwCounterValue');
    const commentEl  = document.getElementById(dwCurrentAction === 'reject' ? 'dwRejectComment' : 'dwComment');

    const payload = {
      token,
      lead_id:       leadId,
      action_type:   dwCurrentAction,
      comment:       commentEl ? commentEl.value.trim() : '',
      counter_value: counterVal && dwCurrentAction === 'counter' ? parseFloat(counterVal.value) || null : null,
      current_page:  window._currentSlide || 1
    };

    const submitBtn = document.getElementById('dwSubmitBtn');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Enviando...'; }

    fetch('/proposta/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(data => {
      dwSubmitted = true;
      const dwSuccess    = document.getElementById('dwSuccess');
      const dwBody       = document.getElementById('dwBody');
      const dwForm       = document.getElementById('dwForm');
      const dwSuccessMsg = document.getElementById('dwSuccessMsg');

      if (dwBody) dwBody.style.display = 'none';
      if (dwForm) dwForm.classList.remove('show');

      const msgs = {
        accept:  '✅ Proposta aceita! Entraremos em contato para dar andamento.',
        counter: '🔄 Contra-proposta enviada! Vamos analisar e retornar.',
        reject:  '❌ Proposta rejeitada. Obrigado pelo feedback.'
      };
      if (dwSuccessMsg) dwSuccessMsg.textContent = msgs[dwCurrentAction] || '✅ Decisão registrada!';
      if (dwSuccess) dwSuccess.classList.add('show');

      // Disable quick buttons too
      document.querySelectorAll('.dw-quick-btn').forEach(b => {
        b.disabled = true;
        b.style.opacity = '0.4';
      });
    })
    .catch(err => {
      console.error('[DecisionWidget] Error:', err);
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Tentar novamente'; }
    });
  };

  // Update "Slide X" label in widget header when slide changes
  function updateDwPageLabel(slideIndex) {
    const label = document.getElementById('dwPageLabel');
    if (label) label.textContent = 'Slide ' + (slideIndex + 1);
  }

  // ─── SHARE WIDGET ─────────────────────────────────────────────────────────

  window.toggleShareWidget = function () {
    const widget = document.getElementById('shareWidget');
    if (!widget) return;
    widget.classList.toggle('hidden');
  };

  window.swSubmit = function () {
    const name     = (document.getElementById('swName')?.value || '').trim();
    const whatsapp = (document.getElementById('swWhatsapp')?.value || '').replace(/\D/g, '');
    const email    = (document.getElementById('swEmail')?.value || '').trim();

    if (!name || !whatsapp || !email) {
      alert('Preencha todos os campos para enviar o acesso.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('Por favor, informe um e-mail válido.');
      return;
    }

    const token  = window.PROPOSAL_TOKEN;
    const leadId = window.PROPOSAL_LEAD_ID;

    const submitBtn = document.getElementById('swSubmitBtn');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '📨 Enviando...'; submitBtn.classList.add('sw-sending'); }

    fetch('/proposta/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, lead_id: leadId, name, whatsapp, email })
    })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        const sw = document.getElementById('swSuccess');
        if (sw) sw.classList.add('show');
        if (submitBtn) submitBtn.style.display = 'none';
        // Clear fields
        ['swName', 'swWhatsapp', 'swEmail'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = '';
        });
      } else {
        alert('Erro ao enviar: ' + (data.error || 'tente novamente.'));
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '📤 Enviar Link de Acesso'; submitBtn.classList.remove('sw-sending'); }
      }
    })
    .catch(err => {
      console.error('[ShareWidget] Error:', err);
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '📤 Enviar Link de Acesso'; submitBtn.classList.remove('sw-sending'); }
    });
  };

  // ─── SYNC WITH PROPOSAL SCROLL ────────────────────────────────────────────

  const _origScrollToSlide = window.scrollToSlide;
  window.scrollToSlide = function (index) {
    updateDwPageLabel(index);
    window._currentSlide = index + 1;
    if (_origScrollToSlide) _origScrollToSlide(index);
  };

  document.addEventListener('DOMContentLoaded', function () {
    // Track slide number via IntersectionObserver
    const sections = document.querySelectorAll('.page-section');
    if (!sections.length) return;

    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting && e.intersectionRatio > 0.4) {
          const idx = parseInt(e.target.dataset.index || 0);
          updateDwPageLabel(idx);
          window._currentSlide = idx + 1;
        }
      });
    }, { threshold: 0.4 });

    sections.forEach(s => obs.observe(s));
  });

})();
