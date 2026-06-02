/**
 * builder.js — Orçamento Vertical (estilo Word/PDF) + Montador Interativo
 * 
 * Modo A (admin-proposal): Exibe itens pré-configurados pelo admin em tabela vertical
 * Modo B (custom builder): Carrega serviços do DB e deixa cliente montar o plano
 */
(function () {
  'use strict';

  // ── Utilitários ────────────────────────────────────────────────────
  function fmtBRL(val) {
    return 'R$ ' + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  function fmtPct(val) { return val + '%'; }
  function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // ── Estado do builder interativo ───────────────────────────────────
  let allServices   = [];
  let discountRules = [];
  let serviceGroups = [];
  let selectedKeys  = {};
  let captacaoQty   = 1;
  let builderLoaded = false;

  // ── Ícones por palavra-chave ───────────────────────────────────────
  const ICONS = {
    'social': '📱', 'google': '🔵', 'meta': '🟣', 'tráfego': '🎯',
    'captação': '🎬', 'conteúdo': '🎬', 'sdr': '💬', 'atendimento': '💬',
    'website': '🌐', 'identidade': '🎨', 'blog': '✍️', 'email': '📧', 'e-commerce': '🛒',
  };
  function getIcon(name) {
    const n = name.toLowerCase();
    for (const [kw, ico] of Object.entries(ICONS)) { if (n.includes(kw)) return ico; }
    return '⚙️';
  }

  // ── Tab switch ─────────────────────────────────────────────────────
  window.switchBuilderTab = function (tab) {
    const tabAdmin  = document.getElementById('tab-admin');
    const tabCustom = document.getElementById('tab-custom');
    const viewAdmin = document.getElementById('view-admin-proposal');
    const viewCust  = document.getElementById('view-custom-builder');
    if (!tabAdmin || !tabCustom || !viewAdmin || !viewCust) return;

    if (tab === 'admin') {
      tabAdmin.classList.add('active');
      tabCustom.classList.remove('active');
      viewAdmin.style.display = '';
      viewCust.style.display  = 'none';
    } else {
      tabCustom.classList.add('active');
      tabAdmin.classList.remove('active');
      viewAdmin.style.display = 'none';
      viewCust.style.display  = '';
      if (!builderLoaded) loadBuilder();
    }
  };

  // ──────────────────────────────────────────────────────────────────
  // ─── MODE A: Admin Proposal — Vertical PDF/Word Style ────────────
  // ──────────────────────────────────────────────────────────────────
  function renderAdminProposal() {
    const container = document.getElementById('admin-proposal-container');
    if (!container) return;

    const items   = window.PROPOSAL_ITEMS || [];
    const desc    = window.PROPOSAL_DESC  || '';
    const scope   = window.PROPOSAL_SCOPE || '';
    const timeline= window.PROPOSAL_TIMELINE || '';

    // Check discounts
    const discM = window.LEAD_DISCOUNT_MONTHLY || 0;
    const discO = window.LEAD_DISCOUNT_ONETIME || 0;
    const discExpires = window.LEAD_DISCOUNT_EXPIRES || '';
    let discActive = (discM > 0 || discO > 0);
    if (discExpires) {
      const expDate = new Date(discExpires + 'T23:59:59');
      if (expDate < new Date()) discActive = false;
    }

    if (!items || items.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:3rem;color:#999;font-size:0.85rem">
          <div style="font-size:2rem;margin-bottom:0.5rem">📋</div>
          Nenhuma proposta configurada pelo consultor ainda.<br>
          <span style="font-size:0.75rem">Use a aba "Montar Plano" para personalizar seu orçamento.</span>
        </div>`;
      return;
    }

    // Separate monthly vs onetime items
    const monthlyItems  = items.filter(i => i.category !== 'onetime');
    const onetimeItems  = items.filter(i => i.category === 'onetime');
    const monthlyTotal  = monthlyItems.reduce((s, i) => s + (i.price * (i.qty || 1)), 0);
    const onetimeTotal  = onetimeItems.reduce((s, i) => s + (i.price * (i.qty || 1)), 0);
    const monthlyDisc   = discActive && discM > 0 ? Math.round(monthlyTotal * (1 - discM / 100)) : monthlyTotal;
    const onetimeDisc   = discActive && discO > 0 ? Math.round(onetimeTotal * (1 - discO / 100)) : onetimeTotal;

    // Build table rows helper
    function buildRows(itemList) {
      return itemList.map(item => {
        const qty   = item.qty || 1;
        const total = item.price * qty;
        return `
          <tr>
            <td class="budget-td-name">${esc(item.name)}</td>
            <td class="budget-td-desc">${esc(item.description || '')}</td>
            <td class="budget-td-qty">${qty}</td>
            <td class="budget-td-unit">${esc(item.unit || '/mês')}</td>
            <td class="budget-td-price">${fmtBRL(item.price)}</td>
            <td>${fmtBRL(total)}</td>
          </tr>`;
      }).join('');
    }

    let tableHTML = `
      <div class="budget-table-wrapper">
        <table class="budget-table">
          <thead>
            <tr>
              <th>Serviço</th>
              <th>Descrição</th>
              <th style="text-align:center">Qtd</th>
              <th>Unidade</th>
              <th style="text-align:right">Preço Unit.</th>
              <th style="text-align:right">Total</th>
            </tr>
          </thead>
          <tbody>`;

    if (monthlyItems.length > 0) {
      tableHTML += `<tr class="budget-category-row"><td colspan="6">📅 Serviços Recorrentes (mensais)</td></tr>`;
      tableHTML += buildRows(monthlyItems);
      tableHTML += `
        <tr class="budget-subtotal-row">
          <td colspan="5">Subtotal Mensal</td>
          <td>${fmtBRL(monthlyTotal)}</td>
        </tr>`;
      if (discActive && discM > 0 && monthlyDisc < monthlyTotal) {
        tableHTML += `
          <tr class="budget-discount-row">
            <td colspan="5">✅ Desconto especial (${discM}%)</td>
            <td>− ${fmtBRL(monthlyTotal - monthlyDisc)}</td>
          </tr>
          <tr class="budget-subtotal-row">
            <td colspan="5"><strong>Mensalidade com desconto</strong></td>
            <td>${fmtBRL(monthlyDisc)}</td>
          </tr>`;
      }
    }

    if (onetimeItems.length > 0) {
      tableHTML += `<tr class="budget-category-row"><td colspan="6">💳 Serviços Pontuais (pagamento único)</td></tr>`;
      tableHTML += buildRows(onetimeItems);
      tableHTML += `
        <tr class="budget-subtotal-row">
          <td colspan="5">Subtotal Único</td>
          <td>${fmtBRL(onetimeTotal)}</td>
        </tr>`;
      if (discActive && discO > 0 && onetimeDisc < onetimeTotal) {
        tableHTML += `
          <tr class="budget-discount-row">
            <td colspan="5">✅ Desconto especial (${discO}%)</td>
            <td>− ${fmtBRL(onetimeTotal - onetimeDisc)}</td>
          </tr>`;
      }
    }

    // Grand total row
    const grandMonthly = discActive && discM > 0 ? monthlyDisc : monthlyTotal;
    const grandOnetime = discActive && discO > 0 ? onetimeDisc : onetimeTotal;
    if (monthlyItems.length > 0) {
      tableHTML += `
        <tr class="budget-total-row">
          <td colspan="5">🔖 INVESTIMENTO MENSAL TOTAL</td>
          <td>${fmtBRL(grandMonthly)}<span style="font-size:0.7rem;opacity:0.6">/mês</span></td>
        </tr>`;
    }
    if (onetimeItems.length > 0) {
      tableHTML += `
        <tr class="budget-total-row" style="background:#1a3a1a">
          <td colspan="5">💳 INVESTIMENTO ÚNICO TOTAL</td>
          <td>${fmtBRL(grandOnetime)}</td>
        </tr>`;
    }

    tableHTML += `</tbody></table></div>`;

    // Summary cards
    let summaryCards = '<div class="budget-summary-cards">';
    if (monthlyItems.length > 0) {
      summaryCards += `
        <div class="budget-summary-card highlight">
          <div class="budget-summary-label">Investimento Mensal</div>
          <div class="budget-summary-value">${fmtBRL(grandMonthly)}</div>
          <div class="budget-summary-note">por mês${discActive && discM > 0 ? ' · Desconto de ' + discM + '% aplicado' : ''}</div>
        </div>`;
    }
    if (onetimeItems.length > 0) {
      summaryCards += `
        <div class="budget-summary-card">
          <div class="budget-summary-label">Investimento Único</div>
          <div class="budget-summary-value" style="color:#1565C0">${fmtBRL(grandOnetime)}</div>
          <div class="budget-summary-note">pagamento único${discActive && discO > 0 ? ' · Desconto de ' + discO + '% aplicado' : ''}</div>
        </div>`;
    }
    summaryCards += '</div>';

    // Sections: desc, scope, timeline
    let sectionsHTML = '';

    if (desc) {
      sectionsHTML += `
        <div class="admin-proposal-view" style="margin-top:1.25rem">
          <div class="admin-proposal-section">
            <div class="admin-section-title">📄 Descrição da Proposta</div>
            <div class="admin-section-text">${esc(desc)}</div>
          </div>
        </div>`;
    }

    if (scope || timeline) {
      sectionsHTML += `<div class="admin-proposal-view" style="margin-top:1.25rem">`;
      if (scope) {
        sectionsHTML += `
          <div class="admin-proposal-section">
            <div class="admin-section-title">🎯 Escopo do Projeto</div>
            <div class="admin-section-text">${esc(scope)}</div>
          </div>`;
      }
      if (timeline) {
        sectionsHTML += `
          <div class="admin-proposal-section">
            <div class="admin-section-title">📅 Cronograma</div>
            <div class="admin-section-text">${esc(timeline)}</div>
          </div>`;
      }
      sectionsHTML += `</div>`;
    }

    // CTA button
    const ctaHTML = `
      <div style="text-align:center;margin-top:1.5rem;padding-bottom:1rem">
        <a href="https://wa.me/554133000404?text=${encodeURIComponent('Olá! Vi a proposta da Envox e gostaria de fechar negócio. Podemos conversar?')}"
           target="_blank"
           style="display:inline-flex;align-items:center;gap:0.6rem;background:#25D366;color:#fff;border-radius:50px;padding:0.85rem 2rem;font-family:Poppins,sans-serif;font-size:0.9rem;font-weight:700;text-decoration:none;box-shadow:0 4px 20px rgba(37,211,102,0.3)">
          💬 Aceitar e Falar com a Envox
        </a>
      </div>`;

    container.innerHTML = `
      <div class="admin-proposal-view">
        ${tableHTML}
        ${summaryCards}
      </div>
      ${sectionsHTML}
      ${ctaHTML}`;
  }

  // ──────────────────────────────────────────────────────────────────
  // ─── MODE B: Interactive Builder ──────────────────────────────────
  // ──────────────────────────────────────────────────────────────────

  // Group services by base name (before " - ")
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
        variants,
        isCaptacao: base.toLowerCase().includes('captação') || base.toLowerCase().includes('captacao'),
      });
    });
    return groups;
  }

  function renderBuilder() {
    const container = document.getElementById('plan-builder-container');
    if (!container) return;

    let groupsHTML = '';
    serviceGroups.forEach((group, gi) => {
      const hasVariants = group.variants.length > 1;
      const isCaptacao  = group.isCaptacao;
      const price0      = group.variants[0].price;

      let optionsHTML = '';
      if (hasVariants && !isCaptacao) {
        selectedKeys[gi] = selectedKeys[gi] || { active: false, selectedVariantKey: group.variants[0].key };
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

      const isOnetime  = group.variants[0].category === 'onetime';
      const priceLabel = isOnetime ? `${fmtBRL(price0)} (único)` : `a partir de ${fmtBRL(price0)}/mês`;

      groupsHTML += `
        <div class="builder-section" id="bs-group-${gi}">
          <div class="bs-title-row">
            <div class="bs-icon">${group.icon}</div>
            <div class="bs-info">
              <div class="bs-label">${esc(group.baseName)}</div>
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
      <div class="builder-layout">
        <div class="builder-main">
          <div class="builder-header">
            <h2>Monte seu <span class="text-pink">plano ideal</span></h2>
            <p class="slide-desc">Selecione os serviços que fazem sentido para o seu negócio</p>
          </div>
          ${groupsHTML}
          <div id="discount-combo-alert" class="discount-combo-alert" style="display:none"></div>
        </div>

        <div class="builder-summary" id="builder-summary">
          <div class="summary-title">✦ Seu Plano</div>
          <div id="summary-items" class="summary-items">
            <p class="summary-empty">Selecione pelo menos um serviço</p>
          </div>
          <div id="summary-monthly" class="summary-total" style="display:none">
            <span>Mensal</span>
            <div class="summary-price" id="summary-monthly-val">${fmtBRL(0)}</div>
          </div>
          <div id="summary-monthly-disc" class="summary-total summary-disc" style="display:none">
            <span>Com desconto</span>
            <div class="summary-price summary-price-disc" id="summary-monthly-disc-val">${fmtBRL(0)}</div>
          </div>
          <div id="summary-onetime" class="summary-total summary-onetime" style="display:none">
            <span>Único</span>
            <div class="summary-price-small" id="summary-onetime-val">${fmtBRL(0)}</div>
          </div>
          <div id="summary-onetime-disc" class="summary-total summary-onetime summary-disc" style="display:none">
            <span>Com desconto</span>
            <div class="summary-price-small summary-price-disc" id="summary-onetime-disc-val">${fmtBRL(0)}</div>
          </div>
          <button id="btn-send-plan" class="btn-whatsapp-builder" style="display:none" onclick="sendPlanWhatsApp()">
            💬 Enviar pelo WhatsApp
          </button>
          <div class="builder-cta-doubt">
            Ficou com dúvida?<br>
            <a href="https://wa.me/554133000404?text=${encodeURIComponent('Olá! Tenho dúvida sobre os valores da proposta.')}" target="_blank" class="btn-doubt-wa">
              💬 Fale com a gente
            </a>
          </div>
        </div>
      </div>`;
  }

  // ── Toggle de grupo ────────────────────────────────────────────────
  window.builderGroupToggle = function (gi) {
    const tog  = document.getElementById(`tog-group-${gi}`);
    const opts = document.getElementById(`opts-group-${gi}`);
    const sec  = document.getElementById(`bs-group-${gi}`);
    if (!selectedKeys[gi]) selectedKeys[gi] = { active: false, selectedVariantKey: serviceGroups[gi]?.variants[0]?.key };
    selectedKeys[gi].active = tog?.checked || false;
    if (opts) opts.style.display = selectedKeys[gi].active ? 'flex' : 'none';
    if (sec)  sec.classList.toggle('active', selectedKeys[gi].active);
    builderCalc();
  };

  window.builderGroupChange = function (gi) {
    const sel = document.getElementById(`sel-group-${gi}`);
    if (sel && selectedKeys[gi]) selectedKeys[gi].selectedVariantKey = sel.value;
    builderCalc();
  };

  window.captacaoChange = function (delta) {
    captacaoQty = Math.max(1, Math.min(5, captacaoQty + delta));
    const gi = serviceGroups.findIndex(g => g.isCaptacao);
    if (gi < 0) return;
    const price = serviceGroups[gi].variants[0].price;
    const qv = document.getElementById('captacao-qty-val');
    const qx = document.getElementById('captacao-qty-x');
    const qt = document.getElementById('captacao-qty-total');
    if (qv) qv.textContent = captacaoQty;
    if (qx) qx.textContent = captacaoQty;
    if (qt) qt.textContent = fmtBRL(price * captacaoQty);
    builderCalc();
  };

  // ── Calcular e renderizar resumo ───────────────────────────────────
  function builderCalc() {
    const items = [];
    let monthly = 0;
    let onetime = 0;
    const activeKeys = [];

    serviceGroups.forEach((group, gi) => {
      const state = selectedKeys[gi];
      if (!state || !state.active) return;

      if (group.isCaptacao) {
        const svc = group.variants[0];
        const total = svc.price * captacaoQty;
        items.push({ name: `${group.baseName} × ${captacaoQty}`, price: total, isMonthly: true, key: svc.key });
        monthly += total;
        activeKeys.push(svc.key);
      } else {
        const key = state.selectedVariantKey || group.variants[0].key;
        const svc = group.variants.find(v => v.key === key) || group.variants[0];
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

    // Combo discounts
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

    // Lead discounts
    const leadDiscM = window.LEAD_DISCOUNT_MONTHLY || 0;
    const leadDiscO = window.LEAD_DISCOUNT_ONETIME || 0;
    const leadExpires = window.LEAD_DISCOUNT_EXPIRES || '';
    let leadDiscActive = (leadDiscM > 0 || leadDiscO > 0);
    if (leadExpires) {
      const expDate = new Date(leadExpires + 'T23:59:59');
      if (expDate < new Date()) leadDiscActive = false;
    }

    const totalDiscPctM = Math.min(100, comboDiscPct + (leadDiscActive ? leadDiscM : 0));
    const totalDiscPctO = Math.min(100, leadDiscActive ? leadDiscO : 0);
    const monthlyDisc   = monthly > 0 ? Math.round(monthly * (1 - totalDiscPctM / 100)) : 0;
    const onetimeDisc   = onetime > 0 ? Math.round(onetime * (1 - totalDiscPctO / 100)) : 0;

    const summaryItems    = document.getElementById('summary-items');
    const summaryMon      = document.getElementById('summary-monthly');
    const summaryMonVal   = document.getElementById('summary-monthly-val');
    const summaryMonDisc  = document.getElementById('summary-monthly-disc');
    const summaryMonDV    = document.getElementById('summary-monthly-disc-val');
    const summaryOne      = document.getElementById('summary-onetime');
    const summaryOneVal   = document.getElementById('summary-onetime-val');
    const summaryOneDisc  = document.getElementById('summary-onetime-disc');
    const summaryOneDV    = document.getElementById('summary-onetime-disc-val');
    const btnSend         = document.getElementById('btn-send-plan');
    const comboAlert      = document.getElementById('discount-combo-alert');

    if (!summaryItems) return;

    if (items.length === 0) {
      summaryItems.innerHTML = '<p class="summary-empty">Selecione pelo menos um serviço</p>';
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
      if (summaryMonDV && showDiscM) summaryMonDV.textContent = fmtBRL(monthlyDisc) + ' (-' + fmtPct(totalDiscPctM) + ')';
    } else if (summaryMon) { summaryMon.style.display = 'none'; if (summaryMonDisc) summaryMonDisc.style.display = 'none'; }

    if (summaryOne && onetime > 0) {
      summaryOne.style.display = 'flex';
      if (summaryOneVal) summaryOneVal.textContent = fmtBRL(onetime);
      const showDiscO = totalDiscPctO > 0 && onetimeDisc < onetime;
      if (summaryOneDisc) summaryOneDisc.style.display = showDiscO ? 'flex' : 'none';
      if (summaryOneDV && showDiscO) summaryOneDV.textContent = fmtBRL(onetimeDisc) + ' (-' + fmtPct(totalDiscPctO) + ')';
    } else if (summaryOne) { summaryOne.style.display = 'none'; if (summaryOneDisc) summaryOneDisc.style.display = 'none'; }

    if (btnSend) btnSend.style.display = 'flex';

    if (comboAlert) {
      if (comboDiscPct > 0) {
        comboAlert.style.display = 'flex';
        comboAlert.innerHTML = `<span class="combo-icon">🎉</span><span>Combinação inteligente! <strong>${comboDescMsg}</strong></span>`;
      } else {
        comboAlert.style.display = 'none';
      }
    }

    window._builderItems       = items;
    window._builderMonthly     = monthly;
    window._builderMonthlyDisc = monthlyDisc;
    window._builderOnetime     = onetime;
    window._builderOnetimeDisc = onetimeDisc;
    window._builderDiscPctM    = totalDiscPctM;
    window._builderDiscPctO    = totalDiscPctO;
  }

  // ── Enviar pelo WhatsApp ───────────────────────────────────────────
  window.sendPlanWhatsApp = function () {
    const items       = window._builderItems || [];
    const monthly     = window._builderMonthly || 0;
    const monthlyDisc = window._builderMonthlyDisc || monthly;
    const onetime     = window._builderOnetime || 0;
    const onetimeDisc = window._builderOnetimeDisc || onetime;
    const discPctM    = window._builderDiscPctM || 0;
    const discPctO    = window._builderDiscPctO || 0;
    if (items.length === 0) return;

    const listLines = items.map(i => `• ${i.name}: ${fmtBRL(i.price)}`).join('\n');
    let msg = `Olá! 👋\n\nMontei meu plano personalizado na proposta da Envox:\n\n📋 *MEU PLANO:*\n\n${listLines}\n\n`;

    if (discPctM > 0 && monthlyDisc < monthly) {
      msg += `💰 *Mensal:* ${fmtBRL(monthly)}\n✅ *Com desconto (${discPctM}%): ${fmtBRL(monthlyDisc)}/mês*\n`;
    } else if (monthly > 0) {
      msg += `💰 *Total mensal: ${fmtBRL(monthly)}/mês*\n`;
    }

    if (onetime > 0) {
      if (discPctO > 0 && onetimeDisc < onetime) {
        msg += `💰 *Único:* ${fmtBRL(onetime)}\n✅ *Com desconto (${discPctO}%): ${fmtBRL(onetimeDisc)}*\n`;
      } else {
        msg += `💰 *Único: ${fmtBRL(onetime)}*\n`;
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

  // ── Load builder data from API ─────────────────────────────────────
  function loadBuilder() {
    const container = document.getElementById('plan-builder-container');
    if (!container) return;

    container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:200px;color:#666;flex-direction:column;gap:1rem">
      <div style="width:36px;height:36px;border:3px solid #eee;border-top-color:#E91E63;border-radius:50%;animation:spin 0.8s linear infinite"></div>
      <p style="font-size:0.82rem">Carregando serviços...</p>
    </div>`;

    fetch('/admin/services/api/list')
      .then(r => r.json())
      .then(data => {
        allServices   = (data.services || []).filter(s => s.active !== 0);
        discountRules = (data.rules   || []).filter(r => r.active !== 0);
        serviceGroups = groupServices(allServices);
        selectedKeys  = {};
        builderLoaded = true;
        renderBuilder();
        builderCalc();
      })
      .catch(err => {
        console.error('[Builder] Failed to load services:', err);
        container.innerHTML = '<div style="padding:2rem;text-align:center;color:#E91E63">Erro ao carregar serviços. Recarregue a página.</div>';
      });
  }

  // ── Init ───────────────────────────────────────────────────────────
  function init() {
    // Check if we're on the slide 8 page
    const adminContainer = document.getElementById('admin-proposal-container');
    if (!adminContainer) return;

    // Render admin proposal first (Mode A)
    renderAdminProposal();

    // If admin has set items, default to admin tab; else default to builder
    const hasItems = window.PROPOSAL_ITEMS && window.PROPOSAL_ITEMS.length > 0;
    if (!hasItems) {
      // Switch to custom builder tab by default
      switchBuilderTab('custom');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
