/**
 * builder.js — Montador de Plano Customizado (Slide 8 - Monte seu Plano)
 */
(function() {
  'use strict';

  const PRECOS = {
    social:   { 6: 1170, 9: 1470, 12: 1970 },
    google:   1490,
    meta:     1490,
    captacao: 1200,
    sdr:      { sdr1: 990, sdr2: 1770, sdr3: 2180 },
    web5:     3999,
    web7:     4999
  };

  let captacaoQty = 1;

  function fmtBRL(val) {
    return 'R$ ' + val.toLocaleString('pt-BR', { minimumFractionDigits: 0 });
  }

  window.setQty = function(type, delta) {
    if (type === 'captacao') {
      captacaoQty = Math.max(1, Math.min(3, captacaoQty + delta));
      const el = document.getElementById('qty-captacao');
      const elx = document.getElementById('qty-captacao-x');
      const elt = document.getElementById('captacao-total');
      if (el) el.textContent = captacaoQty;
      if (elx) elx.textContent = captacaoQty;
      if (elt) elt.textContent = fmtBRL(PRECOS.captacao * captacaoQty);
    }
    builderUpdate();
  };

  window.builderUpdate = function() {
    const social   = document.getElementById('tog-social')?.checked;
    const google   = document.getElementById('tog-google')?.checked;
    const meta     = document.getElementById('tog-meta')?.checked;
    const captacao = document.getElementById('tog-captacao')?.checked;
    const sdr      = document.getElementById('tog-sdr')?.checked;
    const web5     = document.getElementById('tog-web5')?.checked;
    const web7     = document.getElementById('tog-web7')?.checked;
    const fds      = document.getElementById('tog-fds')?.checked;

    // Toggle visibility of sub-options
    const optSocial   = document.getElementById('opts-social');
    const optCaptacao = document.getElementById('opts-captacao');
    const optSdr      = document.getElementById('opts-sdr');
    if (optSocial)   optSocial.style.display   = social   ? 'flex' : 'none';
    if (optCaptacao) optCaptacao.style.display  = captacao ? 'flex' : 'none';
    if (optSdr)      optSdr.style.display       = sdr      ? 'flex' : 'none';

    // Mark active sections
    document.getElementById('bs-social')?.classList.toggle('active', !!social);
    document.getElementById('bs-captacao')?.classList.toggle('active', !!captacao);
    document.getElementById('bs-sdr')?.classList.toggle('active', !!sdr);

    // ── Calculate ──────────────────────────────────────────────────────
    const items = [];
    let monthly = 0;
    let onetime = 0;

    if (social) {
      const sel = document.querySelector('input[name="social_posts"]:checked');
      if (sel) {
        const posts = parseInt(sel.value);
        const price = PRECOS.social[posts] || 0;
        items.push({ name: `Social Media — ${posts} posts/mês`, price, isMonthly: true });
        monthly += price;
      }
    }

    if (google) {
      items.push({ name: 'Google Ads', price: PRECOS.google, isMonthly: true });
      monthly += PRECOS.google;
    }
    if (meta) {
      items.push({ name: 'Meta Ads', price: PRECOS.meta, isMonthly: true });
      monthly += PRECOS.meta;
    }

    if (captacao) {
      const price = PRECOS.captacao * captacaoQty;
      items.push({ name: `Captação de Conteúdo × ${captacaoQty}`, price, isMonthly: true });
      monthly += price;
    }

    if (sdr) {
      const selSdr = document.querySelector('input[name="sdr_plan"]:checked');
      if (selSdr) {
        const basePrice = PRECOS.sdr[selSdr.value] || 0;
        const fdsAdd    = fds ? Math.round(basePrice * 0.3) : 0;
        const total     = basePrice + fdsAdd;
        const label     = selSdr.value === 'sdr1' ? '6h/dia' : selSdr.value === 'sdr2' ? '8h/dia' : '11h às 20h';
        items.push({ name: `SDR — ${label}${fds ? ' + Sáb/Dom' : ''}`, price: total, isMonthly: true });
        monthly += total;
      }
    }

    if (web5 && !web7) {
      items.push({ name: 'Website até 5 páginas', price: PRECOS.web5, isMonthly: false });
      onetime += PRECOS.web5;
    }
    if (web7) {
      items.push({ name: 'Website até 7 páginas', price: PRECOS.web7, isMonthly: false });
      onetime += PRECOS.web7;
      // uncheck web5 to avoid double
      const w5 = document.getElementById('tog-web5');
      if (w5) w5.checked = false;
    }

    // ── Render Summary ─────────────────────────────────────────────────
    const summaryItems  = document.getElementById('summary-items');
    const summaryMon    = document.getElementById('summary-monthly');
    const summaryMonVal = document.getElementById('summary-monthly-val');
    const summaryOne    = document.getElementById('summary-onetime');
    const summaryOneVal = document.getElementById('summary-onetime-val');
    const btnSend       = document.getElementById('btn-send-plan');

    if (!summaryItems) return;

    if (items.length === 0) {
      summaryItems.innerHTML = '<p class="summary-empty">Selecione pelo menos um serviço para montar seu plano</p>';
      if (summaryMon) summaryMon.style.display = 'none';
      if (summaryOne) summaryOne.style.display = 'none';
      if (btnSend)    btnSend.style.display = 'none';
      return;
    }

    summaryItems.innerHTML = items.map(i =>
      `<div class="summary-item"><span class="summary-item-name">${i.name}</span><span class="summary-item-price">${fmtBRL(i.price)}</span></div>`
    ).join('');

    if (summaryMon) {
      summaryMon.style.display = monthly > 0 ? 'flex' : 'none';
      if (summaryMonVal) summaryMonVal.textContent = fmtBRL(monthly);
    }
    if (summaryOne) {
      summaryOne.style.display = onetime > 0 ? 'flex' : 'none';
      if (summaryOneVal) summaryOneVal.textContent = fmtBRL(onetime);
    }
    if (btnSend) btnSend.style.display = items.length > 0 ? 'flex' : 'none';

    // Store globally for WhatsApp
    window._builderItems   = items;
    window._builderMonthly = monthly;
    window._builderOnetime = onetime;
  };

  window.sendPlanWhatsApp = function() {
    const items   = window._builderItems   || [];
    const monthly = window._builderMonthly || 0;
    const onetime = window._builderOnetime || 0;
    if (items.length === 0) return;

    const listLines = items.map(i => `• ${i.name}: ${fmtBRL(i.price)}`).join('\n');
    const msg = `Olá Gustavo! 👋\n\nMontei meu plano personalizado na proposta da Envox:\n\n📋 *MEU PLANO PERSONALIZADO:*\n\n${listLines}\n\n💰 *Investimento Mensal: ${fmtBRL(monthly)}*\n${onetime > 0 ? `💰 *Investimento Único: ${fmtBRL(onetime)}*\n` : ''}\nGostei assim! Vamos conversar? 🚀`;

    // Save to backend
    const token = window.PROPOSAL_TOKEN;
    const sessionId = window._sessionId || null;
    if (token) {
      // Build selections array for API
      const selections = items.map(i => ({ name: i.name, value: i.price }));
      fetch('/api/custom-plan/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, sessionId, selections, monthlyTotal: monthly, onetimeTotal: onetime })
      }).then(r => r.json()).then(data => {
        if (data.planId) {
          // mark as sent
          fetch('/api/custom-plan/sent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId: data.planId, token })
          }).catch(() => {});
        }
      }).catch(() => {});
    }

    window.open('https://wa.me/5541992369292?text=' + encodeURIComponent(msg), '_blank');
  };

  // Expose sessionId for builder (set by tracking.js after session start)
  const origInit = window.Tracking && window.Tracking.init;
  // After tracking initializes, it sets window._sessionId via tracking.js
})();
