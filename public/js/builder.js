/**
 * builder.js — Montador de Plano Personalizado (Slide 8)
 * Carrega serviços do banco via /admin/services/api/list
 * Agrupa variações automaticamente (separador " - ")
 * Aplica descontos por combinação (discount_rules) e desconto do lead
 */
(function () {
  'use strict';

  // ── Utilitários ──────────────────────────────────────────────────────
  function fmtBRL(val) {
    return 'R$ ' + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  function fmtPct(val) { return val + '%'; }

  // ── Estado ──────────────────────────────────────────────────────────
  let allServices = [];
  let discountRules = [];
  let serviceGroups = []; // { baseName, icon, unit, variants: [{id, name, key, price, unit, category}] }
  let selectedKeys = {}; // { groupIdx: { active: bool, selectedVariantKey: key } }
  let captacaoQty = 1;

  // ── Ícones por palavra-chave no nome ────────────────────────────────
  const ICONS = {
    'social': '📱',
    'google': '🔵',
    'meta': '🟣',
    'tráfego': '🎯',
    'captação': '🎬',
    'conteúdo': '🎬',
    'sdr': '💬',
    'atendimento': '💬',
    'website': '🌐',
    'identidade': '🎨',
    'blog': '✍️',
    'email': '📧',
    'e-commerce': '🛒',
  };
  function getIcon(name) {
    const n = name.toLowerCase();
    for (const [kw, ico] of Object.entries(ICONS)) {
      if (n.includes(kw)) return ico;
    }
    return '⚙️';
  }

  // ── Agrupar serviços por nome base (antes do " - ") ─────────────────
  function groupServices(services) {
    const map = new Map();
    services.forEach(svc => {
      const dashIdx = svc.name.indexOf(' - ');
      const base = dashIdx > -1 ? svc.name.substring(0, dashIdx).trim() : svc.name.trim();
      if (!map.has(base)) map.set(base, []);
      map.get(base).push(svc);
    });
    const groups = [];
    map.forEach((variants, base) => {
      groups.push({
        baseName: base,
        icon: getIcon(base),
        variants: variants,
        isCaptacao: base.toLowerCase().includes('captação') || base.toLowerCase().includes('captacao'),
      });
    });
    return groups;
  }

  // ── Renderizar o builder no container do slide 8 ─────────────────────
  function renderBuilder() {
    const container = document.getElementById('plan-builder-container');
    if (!container) return;

    let groupsHTML = '';
    serviceGroups.forEach((group, gi) => {
      const hasVariants = group.variants.length > 1;
      const isCaptacao = group.isCaptacao;
      const price0 = group.variants[0].price;
      const unit0 = group.variants[0].unit || '/mês';

      // Options HTML
      let optionsHTML = '';
      if (hasVariants && !isCaptacao) {
        // Select dropdown para variantes
        const firstVariant = group.variants[0];
        selectedKeys[gi] = selectedKeys[gi] || { active: false, selectedVariantKey: firstVariant.key };
        optionsHTML = `
          <div class="bs-options bs-options-select" id="opts-group-${gi}" style="display:none">
            <select class="builder-select" id="sel-group-${gi}" onchange="builderGroupChange(${gi})">
              ${group.variants.map(v => `<option value="${v.key}" data-price="${v.price}">${v.name.includes(' - ') ? v.name.split(' - ').slice(1).join(' - ') : v.name} — ${fmtBRL(v.price)}${v.unit ? '/' + v.unit.replace('/', '') : '/mês'}</option>`).join('')}
            </select>
          </div>`;
      } else if (isCaptacao) {
        selectedKeys[gi] = selectedKeys[gi] || { active: false, selectedVariantKey: group.variants[0].key };
        optionsHTML = `
          <div class="bs-options bs-options-row" id="opts-group-${gi}" style="display:none">
            <span class="bs-qty-label">Sessões/mês:</span>
            <div class="bs-qty-btns">
              <button type="button" class="qty-btn" onclick="captacaoChange(-1)">−</button>
              <span id="captacao-qty-val" class="qty-val">1</span>
              <button type="button" class="qty-btn" onclick="captacaoChange(1)">+</button>
            </div>
            <span class="bs-qty-note">${fmtBRL(price0)} × <span id="captacao-qty-x">1</span> = <strong id="captacao-qty-total">${fmtBRL(price0)}</strong></span>
          </div>`;
      } else {
        selectedKeys[gi] = selectedKeys[gi] || { active: false, selectedVariantKey: group.variants[0].key };
      }

      const isOnetime = group.variants[0].category === 'onetime';
      const priceLabel = isOnetime ? `${fmtBRL(price0)} (único)` : `a partir de ${fmtBRL(price0)}/mês`;

      groupsHTML += `
        <div class="builder-section" id="bs-group-${gi}">
          <div class="bs-title-row">
            <div class="bs-icon">${group.icon}</div>
            <div class="bs-info">
              <div class="bs-label">${group.baseName}</div>
              <div class="bs-price-hint">${priceLabel}</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="tog-group-${gi}" onchange="builderGroupToggle(${gi})">
              <span class="toggle-slider"></span>
            </label>
          </div>
          ${optionsHTML}
        </div>`;
    });

    container.innerHTML = `
      <div class="slide-content slide-builder">
        <div class="builder-layout">
          <div class="builder-main">
            <div class="builder-header">
              <span class="slide-tag">PERSONALIZADO</span>
              <h2>Monte seu <span class="text-pink">plano ideal</span></h2>
              <p class="slide-desc">Selecione os serviços que fazem sentido para o seu negócio</p>
            </div>
            ${groupsHTML}
            <div id="discount-combo-alert" class="discount-combo-alert" style="display:none"></div>
          </div>

          <!-- RESUMO SIDEBAR -->
          <div class="builder-summary" id="builder-summary">
            <div class="summary-title">✦ Seu Plano Personalizado</div>
            <div id="summary-items" class="summary-items">
              <p class="summary-empty">Selecione pelo menos um serviço para montar seu plano</p>
            </div>
            <div id="summary-monthly" class="summary-total" style="display:none">
              <span>Investimento Mensal</span>
              <div class="summary-price" id="summary-monthly-val">${fmtBRL(0)}</div>
            </div>
            <div id="summary-monthly-disc" class="summary-total summary-disc" style="display:none">
              <span>Com desconto aplicado</span>
              <div class="summary-price summary-price-disc" id="summary-monthly-disc-val">${fmtBRL(0)}</div>
            </div>
            <div id="summary-onetime" class="summary-total summary-onetime" style="display:none">
              <span>Investimento Único</span>
              <div class="summary-price-small" id="summary-onetime-val">${fmtBRL(0)}</div>
            </div>
            <div id="summary-onetime-disc" class="summary-total summary-onetime summary-disc" style="display:none">
              <span>Com desconto aplicado</span>
              <div class="summary-price-small summary-price-disc" id="summary-onetime-disc-val">${fmtBRL(0)}</div>
            </div>
            <button id="btn-send-plan" class="btn-whatsapp-builder" style="display:none" onclick="sendPlanWhatsApp()">
              💬 Gostei assim! Enviar pelo WhatsApp
            </button>
            <div class="builder-cta-doubt">
              Ficou com dúvida sobre os valores?<br>
              <a href="https://wa.me/554133000404?text=Olá!%20Tenho%20dúvida%20sobre%20os%20valores%20da%20proposta." target="_blank" class="btn-doubt-wa">
                💬 Fale com a gente agora
              </a>
            </div>
          </div>
        </div>
      </div>`;
  }

  // ── Toggle de grupo ─────────────────────────────────────────────────
  window.builderGroupToggle = function (gi) {
    const tog = document.getElementById(`tog-group-${gi}`);
    const opts = document.getElementById(`opts-group-${gi}`);
    const section = document.getElementById(`bs-group-${gi}`);
    if (!selectedKeys[gi]) selectedKeys[gi] = { active: false, selectedVariantKey: serviceGroups[gi]?.variants[0]?.key };
    selectedKeys[gi].active = tog?.checked || false;
    if (opts) opts.style.display = selectedKeys[gi].active ? 'flex' : 'none';
    if (section) section.classList.toggle('active', selectedKeys[gi].active);
    builderCalc();
  };

  window.builderGroupChange = function (gi) {
    const sel = document.getElementById(`sel-group-${gi}`);
    if (sel && selectedKeys[gi]) {
      selectedKeys[gi].selectedVariantKey = sel.value;
    }
    builderCalc();
  };

  window.captacaoChange = function (delta) {
    captacaoQty = Math.max(1, Math.min(5, captacaoQty + delta));
    const qv = document.getElementById('captacao-qty-val');
    const qx = document.getElementById('captacao-qty-x');
    const qt = document.getElementById('captacao-qty-total');
    // Find captacao group
    const gi = serviceGroups.findIndex(g => g.isCaptacao);
    if (gi < 0) return;
    const price = serviceGroups[gi].variants[0].price;
    if (qv) qv.textContent = captacaoQty;
    if (qx) qx.textContent = captacaoQty;
    if (qt) qt.textContent = fmtBRL(price * captacaoQty);
    builderCalc();
  };

  // ── Calcular e renderizar resumo ─────────────────────────────────────
  function builderCalc() {
    const items = [];
    let monthly = 0;
    let onetime = 0;
    const activeKeys = [];

    serviceGroups.forEach((group, gi) => {
      const state = selectedKeys[gi];
      if (!state || !state.active) return;

      let svc;
      if (group.isCaptacao) {
        svc = group.variants[0];
        const total = svc.price * captacaoQty;
        items.push({ name: `${group.baseName} × ${captacaoQty}`, price: total, isMonthly: true, key: svc.key });
        monthly += total;
        activeKeys.push(svc.key);
      } else {
        const key = state.selectedVariantKey || group.variants[0].key;
        svc = group.variants.find(v => v.key === key) || group.variants[0];
        const isOnetime = svc.category === 'onetime';
        const price = svc.price;
        const label = group.variants.length > 1
          ? (svc.name.includes(' - ') ? group.baseName + ' — ' + svc.name.split(' - ').slice(1).join(' - ') : svc.name)
          : group.baseName;
        items.push({ name: label, price, isMonthly: !isOnetime, key: svc.key });
        if (isOnetime) onetime += price;
        else monthly += price;
        activeKeys.push(svc.key);
      }
    });

    // ── Verificar regras de desconto por combinação ──────────────────
    let comboDiscPct = 0;
    let comboDescMsg = '';
    discountRules.forEach(rule => {
      const ruleKeys = (rule.service_keys || '').split(',').map(k => k.trim());
      const allPresent = ruleKeys.every(k => activeKeys.includes(k));
      if (allPresent && rule.discount_pct > comboDiscPct) {
        comboDiscPct = rule.discount_pct;
        comboDescMsg = rule.name || `Desconto por combinação: ${rule.discount_pct}%`;
      }
    });

    // ── Desconto do lead ─────────────────────────────────────────────
    const leadDiscM = window.LEAD_DISCOUNT_MONTHLY || 0;
    const leadDiscO = window.LEAD_DISCOUNT_ONETIME || 0;
    const leadExpires = window.LEAD_DISCOUNT_EXPIRES || '';
    let leadDiscActive = (leadDiscM > 0 || leadDiscO > 0);
    if (leadExpires) {
      const expDate = new Date(leadExpires + 'T23:59:59');
      if (expDate < new Date()) leadDiscActive = false;
    }

    // ── Totais com desconto ──────────────────────────────────────────
    const totalDiscPctM = Math.min(100, comboDiscPct + (leadDiscActive ? leadDiscM : 0));
    const totalDiscPctO = Math.min(100, leadDiscActive ? leadDiscO : 0);
    const monthlyDisc = monthly > 0 ? Math.round(monthly * (1 - totalDiscPctM / 100)) : 0;
    const onetimeDisc = onetime > 0 ? Math.round(onetime * (1 - totalDiscPctO / 100)) : 0;

    // ── Render summary ───────────────────────────────────────────────
    const summaryItems = document.getElementById('summary-items');
    const summaryMon = document.getElementById('summary-monthly');
    const summaryMonVal = document.getElementById('summary-monthly-val');
    const summaryMonDisc = document.getElementById('summary-monthly-disc');
    const summaryMonDiscVal = document.getElementById('summary-monthly-disc-val');
    const summaryOne = document.getElementById('summary-onetime');
    const summaryOneVal = document.getElementById('summary-onetime-val');
    const summaryOneDisc = document.getElementById('summary-onetime-disc');
    const summaryOneDiscVal = document.getElementById('summary-onetime-disc-val');
    const btnSend = document.getElementById('btn-send-plan');
    const comboAlert = document.getElementById('discount-combo-alert');

    if (!summaryItems) return;

    if (items.length === 0) {
      summaryItems.innerHTML = '<p class="summary-empty">Selecione pelo menos um serviço para montar seu plano</p>';
      [summaryMon, summaryMonDisc, summaryOne, summaryOneDisc, btnSend].forEach(el => { if (el) el.style.display = 'none'; });
      if (comboAlert) comboAlert.style.display = 'none';
      return;
    }

    summaryItems.innerHTML = items.map(i =>
      `<div class="summary-item">
        <span class="summary-item-name">${i.name}</span>
        <span class="summary-item-price">${fmtBRL(i.price)}</span>
      </div>`
    ).join('');

    if (summaryMon && monthly > 0) {
      summaryMon.style.display = 'flex';
      if (summaryMonVal) summaryMonVal.textContent = fmtBRL(monthly);
      const showDiscM = totalDiscPctM > 0 && monthlyDisc < monthly;
      if (summaryMonDisc) summaryMonDisc.style.display = showDiscM ? 'flex' : 'none';
      if (summaryMonDiscVal && showDiscM) summaryMonDiscVal.textContent = fmtBRL(monthlyDisc) + ' (-' + fmtPct(totalDiscPctM) + ')';
    } else if (summaryMon) { summaryMon.style.display = 'none'; if (summaryMonDisc) summaryMonDisc.style.display = 'none'; }

    if (summaryOne && onetime > 0) {
      summaryOne.style.display = 'flex';
      if (summaryOneVal) summaryOneVal.textContent = fmtBRL(onetime);
      const showDiscO = totalDiscPctO > 0 && onetimeDisc < onetime;
      if (summaryOneDisc) summaryOneDisc.style.display = showDiscO ? 'flex' : 'none';
      if (summaryOneDiscVal && showDiscO) summaryOneDiscVal.textContent = fmtBRL(onetimeDisc) + ' (-' + fmtPct(totalDiscPctO) + ')';
    } else if (summaryOne) { summaryOne.style.display = 'none'; if (summaryOneDisc) summaryOneDisc.style.display = 'none'; }

    if (btnSend) btnSend.style.display = 'flex';

    // Combo alert
    if (comboAlert) {
      if (comboDiscPct > 0) {
        comboAlert.style.display = 'flex';
        comboAlert.innerHTML = `<span class="combo-icon">🎉</span><span>Combinação inteligente! <strong>${comboDescMsg}</strong> — serviços que se complementam e otimizam o custo.</span>`;
      } else {
        comboAlert.style.display = 'none';
      }
    }

    // Store globally
    window._builderItems = items;
    window._builderMonthly = monthly;
    window._builderMonthlyDisc = monthlyDisc;
    window._builderOnetime = onetime;
    window._builderOnetimeDisc = onetimeDisc;
    window._builderDiscPctM = totalDiscPctM;
    window._builderDiscPctO = totalDiscPctO;
  }

  // ── Enviar pelo WhatsApp ─────────────────────────────────────────────
  window.sendPlanWhatsApp = function () {
    const items = window._builderItems || [];
    const monthly = window._builderMonthly || 0;
    const monthlyDisc = window._builderMonthlyDisc || monthly;
    const onetime = window._builderOnetime || 0;
    const onetimeDisc = window._builderOnetimeDisc || onetime;
    const discPctM = window._builderDiscPctM || 0;
    const discPctO = window._builderDiscPctO || 0;
    if (items.length === 0) return;

    const listLines = items.map(i => `• ${i.name}: ${fmtBRL(i.price)}`).join('\n');
    let msg = `Olá! 👋\n\nMontei meu plano personalizado na proposta da Envox:\n\n📋 *MEU PLANO PERSONALIZADO:*\n\n${listLines}\n\n`;

    if (discPctM > 0 && monthlyDisc < monthly) {
      msg += `💰 *Total mensal:* ${fmtBRL(monthly)}\n✅ *Com desconto (${discPctM}%): ${fmtBRL(monthlyDisc)}/mês*\n`;
    } else if (monthly > 0) {
      msg += `💰 *Total mensal: ${fmtBRL(monthly)}/mês*\n`;
    }

    if (onetime > 0) {
      if (discPctO > 0 && onetimeDisc < onetime) {
        msg += `💰 *Serviços únicos:* ${fmtBRL(onetime)}\n✅ *Com desconto (${discPctO}%): ${fmtBRL(onetimeDisc)}*\n`;
      } else {
        msg += `💰 *Serviços únicos: ${fmtBRL(onetime)}*\n`;
      }
    }

    msg += `\nGostei assim! Vamos conversar? 🚀`;

    // Save to backend
    const token = window.PROPOSAL_TOKEN;
    const sessionId = window._sessionId || null;
    if (token) {
      const selections = items.map(i => ({ name: i.name, value: i.price }));
      fetch('/api/custom-plan/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, sessionId, selections, monthlyTotal: monthlyDisc || monthly, onetimeTotal: onetimeDisc || onetime })
      }).then(r => r.json()).then(data => {
        if (data.planId) {
          fetch('/api/custom-plan/sent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId: data.planId, token })
          }).catch(() => {});
        }
      }).catch(() => {});
    }

    window.open('https://wa.me/554133000404?text=' + encodeURIComponent(msg), '_blank');
  };

  // ── Init: carregar serviços e renderizar ─────────────────────────────
  function init() {
    const container = document.getElementById('plan-builder-container');
    if (!container) return; // Não estamos no slide 8

    // Loading state
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:300px;color:#666;flex-direction:column;gap:1rem"><div style="width:40px;height:40px;border:3px solid #eee;border-top-color:#E91E63;border-radius:50%;animation:spin 0.8s linear infinite"></div><p style="font-size:0.85rem">Carregando serviços...</p></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>';

    fetch('/admin/services/api/list')
      .then(r => r.json())
      .then(data => {
        allServices = (data.services || []).filter(s => s.active !== 0);
        discountRules = (data.rules || []).filter(r => r.active !== 0);
        serviceGroups = groupServices(allServices);
        selectedKeys = {};
        renderBuilder();
        builderCalc();
      })
      .catch(err => {
        console.error('[Builder] Failed to load services:', err);
        container.innerHTML = '<div style="padding:2rem;text-align:center;color:#E91E63">Erro ao carregar serviços. Recarregue a página.</div>';
      });
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
