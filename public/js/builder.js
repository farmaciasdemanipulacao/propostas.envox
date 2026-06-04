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

  // WhatsApp base URL
  function waUrl(msg) {
    return 'https://wa.me/554133000404?text=' + encodeURIComponent(msg);
  }

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

  // ── Categorias dos serviços ────────────────────────────────────────
  const CATEGORY_MAP = {
    'social':      { label: '📱 Social Media & Conteúdo', order: 1 },
    'tráfego':     { label: '🎯 Tráfego Pago & Performance', order: 2 },
    'captação':    { label: '🎬 Captação de Conteúdo', order: 3 },
    'captacao':    { label: '🎬 Captação de Conteúdo', order: 3 },
    'atendimento': { label: '💬 Atendimento de Leads (SDR)', order: 4 },
    'sdr':         { label: '💬 Atendimento de Leads (SDR)', order: 4 },
    'website':     { label: '🌐 Web & Digital', order: 5 },
    'identidade':  { label: '🎨 Identidade & Branding', order: 6 },
    'blog':        { label: '✍️ Conteúdo & Blog', order: 7 },
  };

  function getCategory(name) {
    const n = name.toLowerCase();
    for (const [kw, cat] of Object.entries(CATEGORY_MAP)) {
      if (n.includes(kw)) return cat;
    }
    return { label: '⚙️ Outros Serviços', order: 99 };
  }

  // ── Tab switch ─────────────────────────────────────────────────────
  window.switchBuilderTab = function (tab) {
    const tabAdmin  = document.getElementById('tab-admin');
    const tabCustom = document.getElementById('tab-custom');
    const viewAdmin = document.getElementById('view-admin-proposal');
    const viewCust  = document.getElementById('view-custom-builder');
    if (!viewAdmin || !viewCust) return;

    if (tab === 'admin') {
      if (tabAdmin) tabAdmin.classList.add('active');
      if (tabCustom) tabCustom.classList.remove('active');
      viewAdmin.style.display = '';
      viewCust.style.display  = 'none';
    } else {
      if (tabCustom) tabCustom.classList.add('active');
      if (tabAdmin) tabAdmin.classList.remove('active');
      viewAdmin.style.display = 'none';
      viewCust.style.display  = '';
      if (!builderLoaded) loadBuilder();
    }
  };

  // ── Inline action buttons HTML ─────────────────────────────────────
  function buildInlineActionButtons(context) {
    var company = window.COMPANY_NAME || '';
    var person  = window.LEAD_NAME    || '';
    var label   = company || person || '';
    var waBase  = 'Olá! Estou analisando a proposta da Envox' + (label ? ' para ' + label : '');

    return `
      <div class="budget-inline-actions" id="budget-inline-actions-${context}">
        <div class="bia-title">Qual é a sua decisão?</div>
        <div class="bia-btns">
          <button class="bia-btn bia-accept" onclick="dwQuickAction && dwQuickAction('accept')">✅ Aceitar Proposta</button>
          <button class="bia-btn bia-counter" onclick="dwQuickAction && dwQuickAction('counter')">🔄 Contraproposta</button>
          <button class="bia-btn bia-reject" onclick="dwQuickAction && dwQuickAction('reject')">❌ Rejeitar</button>
          <a class="bia-btn bia-whatsapp"
             href="${waUrl(waBase + ' e gostaria de conversar sobre ela.')}"
             target="_blank">💬 Falar sobre esta Proposta</a>
        </div>
      </div>`;
  }

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
    const company = window.COMPANY_NAME   || '';

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

    // ── Context sections: Entendimento + Cronograma BEFORE table ──
    let contextHTML = '';
    if (desc) {
      const label = company ? `Entendimento do Cenário da ${company}` : 'Entendimento do Cenário';
      contextHTML += `
        <div class="budget-context-block">
          <div class="budget-context-title">📋 ${esc(label)}</div>
          <div class="budget-context-text">${esc(desc)}</div>
        </div>`;
    }
    if (timeline) {
      contextHTML += `
        <div class="budget-context-block">
          <div class="budget-context-title">📅 Cronograma</div>
          <div class="budget-context-text">${esc(timeline)}</div>
        </div>`;
    }
    if (contextHTML) {
      contextHTML = `<div class="budget-context-section">${contextHTML}</div>`;
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

    // Summary cards — Investimento
    let summaryCards = '<div class="budget-summary-cards">';
    if (monthlyItems.length > 0) {
      const discNote = discActive && discM > 0 ? ` · Desconto de ${discM}% aplicado` : '';
      const avistaPct = (discActive && discM > 0) ? 0 : 10;
      const avistaBRL = grandMonthly * (1 - avistaPct / 100);
      summaryCards += `
        <div class="budget-summary-card" style="flex:1;min-width:120px">
          <div class="budget-summary-label">Serviços Mensais</div>
          <div style="font-size:0.8rem;color:#555;margin-top:0.25rem">${monthlyItems.length} serviço${monthlyItems.length !== 1 ? 's' : ''} selecionado${monthlyItems.length !== 1 ? 's' : ''}</div>
          ${discActive && discM > 0 ? `<div style="font-size:0.72rem;color:#E91E63;margin-top:0.35rem;font-weight:700">✅ Desconto de ${discM}% aplicado</div>` : ''}
        </div>
        <div class="budget-summary-card highlight" style="flex:1.3;text-align:right">
          <div class="budget-summary-label">💳 Investimento Mensal</div>
          <div class="budget-summary-value">${fmtBRL(grandMonthly)}</div>
          <div class="budget-summary-note">por mês${discNote}</div>
        </div>`;
    }
    if (onetimeItems.length > 0) {
      summaryCards += `
        <div class="budget-summary-card highlight-right" style="flex:1.3;text-align:right">
          <div class="budget-summary-label">💳 Investimento Único</div>
          <div class="budget-summary-value">${fmtBRL(grandOnetime)}</div>
          <div class="budget-summary-note">pagamento único${discActive && discO > 0 ? ` · Desconto de ${discO}% aplicado` : ''}</div>
        </div>`;
    }
    summaryCards += '</div>';

    // Opções de pagamento (à vista vs mensal) — somente para serviços mensais
    let paymentOptions = '';
    if (monthlyItems.length > 0 && !(discActive && discM > 0)) {
      const avista3 = grandMonthly * 3 * 0.90;
      paymentOptions = `
        <div class="budget-payment-options">
          <div class="budget-payment-card payment-mensal" style="flex:1">
            <div class="budget-payment-badge">Mensal</div>
            <div class="budget-payment-value">${fmtBRL(grandMonthly)}</div>
            <div class="budget-payment-note">por mês · sem fidelidade</div>
          </div>
          <div class="budget-payment-card payment-avista" style="flex:1">
            <div class="budget-payment-badge">À Vista (3 meses) 💰</div>
            <div class="budget-payment-value">${fmtBRL(avista3)}</div>
            <div class="budget-payment-note">10% de desconto · <strong>${fmtBRL(grandMonthly * 3 - avista3)}</strong> de economia</div>
          </div>
        </div>`;
    }

    // Email send button for client
    const emailBtnHTML = `
      <div class="budget-email-btn-wrapper">
        <button class="budget-email-btn" onclick="sendPlanEmailToClient()">
          📧 Enviar para meu e-mail
        </button>
        <div class="budget-email-sent" id="budgetEmailSent" style="display:none">
          ✅ E-mail enviado! Verifique sua caixa de entrada.
        </div>
      </div>`;

    // Inline decision buttons below total
    const inlineActionsHTML = buildInlineActionButtons('admin');

    container.innerHTML = `
      <div class="admin-proposal-view">
        ${contextHTML}
        ${tableHTML}
        ${summaryCards}
        ${paymentOptions}
        ${emailBtnHTML}
        ${inlineActionsHTML}
      </div>`;
  }

  // Send plan email to client
  window.sendPlanEmailToClient = function() {
    const token  = window.PROPOSAL_TOKEN;
    const btn    = document.querySelector('.budget-email-btn');
    const sentEl = document.getElementById('budgetEmailSent');
    if (!token) { alert('Token não encontrado.'); return; }
    if (btn) { btn.disabled = true; btn.textContent = '📨 Enviando...'; }

    fetch('/proposta/send-plan-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        if (sentEl) sentEl.style.display = 'block';
        if (btn) btn.style.display = 'none';
      } else {
        alert('Erro ao enviar: ' + (data.error || 'tente novamente.'));
        if (btn) { btn.disabled = false; btn.textContent = '📧 Enviar para meu e-mail'; }
      }
    })
    .catch(() => {
      alert('Erro de conexão. Tente novamente.');
      if (btn) { btn.disabled = false; btn.textContent = '📧 Enviar para meu e-mail'; }
    });
  };

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
        category: getCategory(base),
        variants,
        isCaptacao: base.toLowerCase().includes('captação') || base.toLowerCase().includes('captacao'),
      });
    });
    return groups;
  }

  // Group services by category for accordion
  function groupByCategory(groups) {
    const catMap = new Map();
    groups.forEach((group, gi) => {
      const catLabel = group.category.label;
      if (!catMap.has(catLabel)) {
        catMap.set(catLabel, { label: catLabel, order: group.category.order, groups: [] });
      }
      catMap.get(catLabel).groups.push({ group, gi });
    });
    // Sort categories by order
    return Array.from(catMap.values()).sort((a, b) => a.order - b.order);
  }

  function renderBuilder() {
    const container = document.getElementById('plan-builder-container');
    if (!container) return;

    const categories = groupByCategory(serviceGroups);

    let accordionHTML = '';
    categories.forEach((cat, catIdx) => {
      let groupsHTML = '';
      cat.groups.forEach(({ group, gi }) => {
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

      accordionHTML += `
        <div class="builder-accordion" id="acc-cat-${catIdx}">
          <button class="builder-accordion-header" onclick="toggleAccordion(${catIdx})" type="button">
            <span class="bah-label">${cat.label}</span>
            <span class="bah-count" id="acc-count-${catIdx}">0 selecionado(s)</span>
            <span class="bah-arrow" id="acc-arrow-${catIdx}">▾</span>
          </button>
          <div class="builder-accordion-body" id="acc-body-${catIdx}">
            ${groupsHTML}
          </div>
        </div>`;
    });

    const company = window.COMPANY_NAME || '';
    const emailBtn = `
      <button id="btn-send-plan-email" class="btn-email-builder-sm" style="display:none" onclick="sendBuilderPlanEmail()">
        📧 Enviar para meu e-mail
      </button>
      <button id="btn-finalizar" class="btn-finalizar-builder" style="display:none" onclick="abrirFinalizacao()">
        ✅ Finalizar Proposta
      </button>
      <div id="builder-email-sent" class="builder-email-sent" style="display:none">
        ✅ E-mail enviado!
      </div>`;

    container.innerHTML = `
      <div class="builder-layout">
        <div class="builder-main">
          <div class="builder-header">
            <h2>Monte seu <span class="text-pink">plano ideal</span></h2>
            <p class="slide-desc">Selecione os serviços que fazem sentido para o seu negócio${company ? ' — <strong>' + company + '</strong>' : ''}</p>
          </div>
          ${accordionHTML}
          <div id="discount-combo-alert" class="discount-combo-alert" style="display:none"></div>
        </div>
      </div>

      <div class="builder-summary" id="builder-summary">
          <div class="summary-title">✦ Seu Plano${company ? '<br><small style="font-size:0.7rem;font-weight:400;color:#E91E63">' + company + '</small>' : ''}</div>
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
          ${emailBtn}
          <button class="btn-go-orcamento" onclick="(function(){const pages=document.querySelectorAll('.page-section');let idx=-1;pages.forEach((p,i)=>{if((p.dataset.slideTitle||'').toLowerCase().includes('orçamento')||(p.dataset.slide=='7'))idx=i;});if(idx>=0&&window.scrollToSlide)window.scrollToSlide(idx);else if(idx>=0)pages[idx].scrollIntoView({behavior:'smooth'});})()">
            💰 Ver Orçamento Pronto
          </button>
          <div class="builder-cta-doubt">
            Ficou com dúvida?<br>
            <a href="${waUrl('Olá! Tenho dúvida sobre os valores da proposta' + (company ? ' para ' + company : '') + '.')}" target="_blank" class="btn-doubt-wa">
              💬 Fale com a gente
            </a>
          </div>
      </div><!-- /builder-summary -->

      <!-- Inline actions for custom builder -->
      <div class="builder-inline-actions" id="builder-inline-actions" style="display:none">
        ${buildInlineActionButtons('builder')}
      </div>`;

    // Auto-open first accordion
    if (categories.length > 0) {
      const firstBody = document.getElementById('acc-body-0');
      if (firstBody) firstBody.classList.add('open');
      const firstArrow = document.getElementById('acc-arrow-0');
      if (firstArrow) firstArrow.textContent = '▴';
    }

    // Inicia o fixed DEPOIS que o DOM do summary foi criado
    initSummaryFixed();
  }

  // Accordion toggle
  window.toggleAccordion = function(catIdx) {
    const body  = document.getElementById(`acc-body-${catIdx}`);
    const arrow = document.getElementById(`acc-arrow-${catIdx}`);
    if (!body) return;
    const isOpen = body.classList.contains('open');
    body.classList.toggle('open', !isOpen);
    if (arrow) arrow.textContent = isOpen ? '▾' : '▴';
  };

  // Update accordion counters
  function updateAccordionCounts() {
    const categories = groupByCategory(serviceGroups);
    categories.forEach((cat, catIdx) => {
      const selected = cat.groups.filter(({ gi }) => selectedKeys[gi] && selectedKeys[gi].active).length;
      const countEl = document.getElementById(`acc-count-${catIdx}`);
      if (countEl) {
        countEl.textContent = selected > 0 ? `${selected} selecionado${selected !== 1 ? 's' : ''}` : '';
        countEl.style.display = selected > 0 ? 'inline-block' : 'none';
      }
    });
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
    updateAccordionCounts();
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
    const btnSendEmail    = document.getElementById('btn-send-plan-email');
    const btnFinalizar    = document.getElementById('btn-finalizar');
    const comboAlert      = document.getElementById('discount-combo-alert');
    const inlineActions   = document.getElementById('builder-inline-actions');

    if (!summaryItems) return;

    // Mostrar/ocultar painel via has-items
    const bsPanel = document.getElementById('builder-summary');

    if (items.length === 0) {
      summaryItems.innerHTML = '<p class="summary-empty">Selecione pelo menos um serviço</p>';
      [summaryMon, summaryMonDisc, summaryOne, summaryOneDisc, btnSendEmail, btnFinalizar].forEach(el => { if (el) el.style.display = 'none'; });
      if (comboAlert) comboAlert.style.display = 'none';
      if (inlineActions) inlineActions.style.display = 'none';
      if (bsPanel) bsPanel.classList.remove('has-items');
      return;
    }
    if (bsPanel) bsPanel.classList.add('has-items');

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

    if (btnSendEmail) btnSendEmail.style.display = 'block';
    if (btnFinalizar) btnFinalizar.style.display = 'block';
    if (inlineActions) inlineActions.style.display = 'block';

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
    const company     = window.COMPANY_NAME || '';
    const person      = window.LEAD_NAME    || '';
    if (items.length === 0) return;

    const listLines = items.map(i => `• ${i.name}: ${fmtBRL(i.price)}`).join('\n');
    let msg = `Olá! 👋\n\nMontei meu plano personalizado na proposta da Envox${company ? ' para ' + company : ''}:\n\n📋 *MEU PLANO:*\n\n${listLines}\n\n`;

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

    window.open(waUrl(msg), '_blank');
  };

  // ── Enviar plano por email (builder) ───────────────────────────────
  window.sendBuilderPlanEmail = function() {
    const token   = window.PROPOSAL_TOKEN;
    const items   = window._builderItems || [];
    const monthly = window._builderMonthlyDisc || window._builderMonthly || 0;
    const onetime = window._builderOnetimeDisc || window._builderOnetime || 0;
    if (!token || items.length === 0) return;

    const btn    = document.getElementById('btn-send-plan-email');
    const sentEl = document.getElementById('builder-email-sent');
    if (btn) { btn.disabled = true; btn.textContent = '📨 Enviando...'; }

    // Build simple plan HTML
    const listHTML = items.map(i => `<li>${i.name} — ${fmtBRL(i.price)}</li>`).join('');
    let planHtml = `<ul style="padding-left:1.5rem;line-height:1.8">${listHTML}</ul>`;
    if (monthly > 0) planHtml += `<p style="margin-top:1rem"><strong>Total mensal: ${fmtBRL(monthly)}/mês</strong></p>`;
    if (onetime > 0) planHtml += `<p><strong>Total único: ${fmtBRL(onetime)}</strong></p>`;

    fetch('/proposta/send-plan-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, planHtml, source: 'builder' })
    })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        if (sentEl) { sentEl.style.display = 'block'; }
        if (btn) btn.style.display = 'none';
      } else {
        alert('Erro ao enviar: ' + (data.error || 'tente novamente.'));
        if (btn) { btn.disabled = false; btn.textContent = '📧 Enviar para meu e-mail'; }
      }
    })
    .catch(() => {
      alert('Erro de conexão.');
      if (btn) { btn.disabled = false; btn.textContent = '📧 Enviar para meu e-mail'; }
    });
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
    const adminContainer = document.getElementById('admin-proposal-container');
    if (!adminContainer) return;

    const mode = (window.PROPOSAL_MODE || 'both').trim();
    const tabsWrapper = document.getElementById('builderModeTabs');
    const tabAdmin  = document.getElementById('tab-admin');
    const tabCustom = document.getElementById('tab-custom');

    if (mode === 'ready') {
      if (tabCustom) tabCustom.style.display = 'none';
      if (tabsWrapper) tabsWrapper.style.display = 'none';
      renderAdminProposal();
      switchBuilderTab('admin');
    } else if (mode === 'build') {
      if (tabAdmin) tabAdmin.style.display = 'none';
      if (tabsWrapper) tabsWrapper.style.display = 'none';
      renderAdminProposal();
      switchBuilderTab('custom');
    } else {
      renderAdminProposal();
      const hasItems = window.PROPOSAL_ITEMS && window.PROPOSAL_ITEMS.length > 0;
      if (!hasItems) {
        switchBuilderTab('custom');
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ── Abrir página de finalização ────────────────────────────────────
  window.abrirFinalizacao = function() {
    const token = window.PROPOSAL_TOKEN;
    if (!token) { alert('Token não encontrado.'); return; }
    // Salvar seleções do builder na sessão antes de navegar
    const items       = window._builderItems || [];
    const monthly     = window._builderMonthlyDisc || window._builderMonthly || 0;
    const onetime     = window._builderOnetimeDisc || window._builderOnetime || 0;
    const discPctM    = window._builderDiscPctM || 0;
    const discPctO    = window._builderDiscPctO || 0;
    const rawMonthly  = window._builderMonthly || 0;
    const rawOnetime  = window._builderOnetime || 0;
    // Encode selections in sessionStorage so finalize page can read them
    try {
      sessionStorage.setItem('builderSelections', JSON.stringify({
        items, monthly, onetime, discPctM, discPctO, rawMonthly, rawOnetime
      }));
    } catch(e) {}
    window.location.href = '/proposta/' + token + '/finalizar';
  };

  // ── Builder-summary: painel fixo na esquerda ─────────────────────
  // Sem âncora — posição é sempre left:16px via CSS
  // Esta função só faz o bounce de entrada
  function initSummaryFixed() {
    const bs = document.getElementById('builder-summary');
    if (!bs || bs._summaryInited) return;
    bs._summaryInited = true;
    // Bounce de entrada
    bs.classList.remove('float-bounce');
    void bs.offsetWidth;
    bs.classList.add('float-bounce');
  }

})();
