/**
 * widgets.js — Decision Widget (Accept/Counter/Reject/Falar) + Share Widget
 * Loaded on proposal viewer pages.
 */
(function () {
  'use strict';

  // ─── DECISION WIDGET ──────────────────────────────────────────────────────

  let dwCurrentAction = null;
  let dwSubmitted = false;

  // Update WhatsApp button in decision widget with personalized message
  function updateDwWaLink() {
    var company = window.COMPANY_NAME || '';
    var person  = window.LEAD_NAME    || '';
    var label   = company || person || '';
    var msg     = 'Olá! Estou analisando a proposta da Envox' + (label ? ' para ' + label : '') + ' e gostaria de conversar.';
    var encoded = encodeURIComponent(msg);
    var url     = 'https://wa.me/554133000404?text=' + encoded;

    var dwWaBtn    = document.getElementById('dwWaBtn');
    var dwQuickWa  = document.getElementById('dwQuickWa');
    if (dwWaBtn)   dwWaBtn.href   = url;
    if (dwQuickWa) dwQuickWa.href = url;
  }

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
    const widget = document.getElementById('decisionWidget');
    if (widget) {
      setTimeout(() => widget.scrollIntoView({ behavior: 'smooth', block: 'end' }), 150);
    }
  };

  window.dwSelectAction = function (action) {
    if (dwSubmitted) return;
    dwCurrentAction = action;

    const formAccept  = document.getElementById('dwFormAccept');
    const formCounter = document.getElementById('dwFormCounter');
    const formReject  = document.getElementById('dwFormReject');
    const dwForm      = document.getElementById('dwForm');

    if (formAccept)  formAccept.style.display  = action === 'accept'  ? 'block' : 'none';
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
    // Always keep WhatsApp button full opacity
    const waBtn = document.querySelector('.dw-btn-whatsapp');
    if (waBtn) { waBtn.style.opacity = '1'; waBtn.style.transform = 'none'; }
  };

  // Toggle Pessoa Física / Jurídica inside the accept form
  window.dwSwitchTipo = function (tipo) {
    const sectionPf = document.getElementById('dw-section-pf');
    const sectionPj = document.getElementById('dw-section-pj');
    const btnPf     = document.getElementById('dw-btn-pf');
    const btnPj     = document.getElementById('dw-btn-pj');
    const inputTipo = document.getElementById('dwTipoPessoa');

    if (sectionPf) sectionPf.style.display = tipo === 'pf' ? 'block' : 'none';
    if (sectionPj) sectionPj.style.display = tipo === 'pj' ? 'block' : 'none';
    if (btnPf) btnPf.classList.toggle('active', tipo === 'pf');
    if (btnPj) btnPj.classList.toggle('active', tipo === 'pj');
    if (inputTipo) inputTipo.value = tipo;
  };

  window.dwSubmit = function () {
    if (!dwCurrentAction || dwSubmitted) return;

    const token  = window.PROPOSAL_TOKEN;
    const leadId = window.PROPOSAL_LEAD_ID;

    // ── ACCEPT: collect cadastral data and POST to /proposta/finalizar-aceitar ──
    if (dwCurrentAction === 'accept') {
      const tipo    = (document.getElementById('dwTipoPessoa')?.value || 'pf');
      const errDiv  = document.getElementById('dw-accept-error');
      if (errDiv) errDiv.style.display = 'none';

      let formData = { tipo_pessoa: tipo };
      let missing  = [];

      if (tipo === 'pf') {
        const fields = [
          { id: 'dw-nome_completo',        key: 'nome_completo',        label: 'Nome completo' },
          { id: 'dw-cpf',                  key: 'cpf',                  label: 'CPF' },
          { id: 'dw-rg',                   key: 'rg',                   label: 'RG' },
          { id: 'dw-data_nascimento',      key: 'data_nascimento',      label: 'Data de Nascimento' },
          { id: 'dw-endereco_residencial', key: 'endereco_residencial', label: 'Endereço Residencial' },
          { id: 'dw-email_assinatura',     key: 'email_assinatura',     label: 'E-mail assinatura' },
          { id: 'dw-email_financeiro',     key: 'email_financeiro',     label: 'E-mail financeiro' }
        ];
        fields.forEach(f => {
          const val = (document.getElementById(f.id)?.value || '').trim();
          formData[f.key] = val;
          if (!val) missing.push(f.label);
        });
      } else {
        const fields = [
          { id: 'dw-cnpj',                      key: 'cnpj',                      label: 'CNPJ' },
          { id: 'dw-razao_social',              key: 'razao_social',              label: 'Razão Social' },
          { id: 'dw-endereco_sede',             key: 'endereco_sede',             label: 'Endereço da Sede' },
          { id: 'dw-nome_socio',                key: 'nome_socio',                label: 'Nome do Sócio' },
          { id: 'dw-cpf_socio',                 key: 'cpf_socio',                 label: 'CPF do Sócio' },
          { id: 'dw-rg_socio',                  key: 'rg_socio',                  label: 'RG do Sócio' },
          { id: 'dw-data_nascimento_socio',     key: 'data_nascimento_socio',     label: 'Data de Nascimento do Sócio' },
          { id: 'dw-endereco_residencial_socio',key: 'endereco_residencial_socio',label: 'Endereço Residencial do Sócio' },
          { id: 'dw-email_assinatura-pj',       key: 'email_assinatura',          label: 'E-mail assinatura' },
          { id: 'dw-email_financeiro-pj',       key: 'email_financeiro',          label: 'E-mail financeiro' }
        ];
        fields.forEach(f => {
          const val = (document.getElementById(f.id)?.value || '').trim();
          formData[f.key] = val;
          if (!val) missing.push(f.label);
        });
      }

      if (missing.length) {
        if (errDiv) {
          errDiv.textContent = 'Preencha os campos obrigatórios: ' + missing.join(', ') + '.';
          errDiv.style.display = 'block';
        }
        return;
      }

      const submitBtn = document.getElementById('dwSubmitBtn');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Enviando...'; }

      fetch('/proposta/finalizar-aceitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          lead_id:      leadId,
          current_page: window._currentSlide || 1,
          ...formData
        })
      })
      .then(r => r.json())
      .then(data => {
        if (!data.success) {
          throw new Error(data.error || 'Erro ao registrar aceite.');
        }
        dwSubmitted = true;
        _dwShowSuccess('accept');
      })
      .catch(err => {
        console.error('[DecisionWidget] Accept error:', err);
        if (errDiv) {
          errDiv.textContent = err.message || 'Erro ao enviar. Tente novamente.';
          errDiv.style.display = 'block';
        }
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Enviar Decisão'; }
      });

      return; // do not fall through to generic flow
    }

    // ── COUNTER / REJECT: generic flow ──────────────────────────────────────
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
      _dwShowSuccess(dwCurrentAction);

      // If rejected, redirect to rejected page after delay
      if (dwCurrentAction === 'reject') {
        setTimeout(() => {
          if (token) window.location.href = '/proposta/' + token + '/view';
        }, 2500);
      }
    })
    .catch(err => {
      console.error('[DecisionWidget] Error:', err);
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Tentar novamente'; }
    });
  };

  // ── Internal helper: show success state ────────────────────────────────────
  function _dwShowSuccess(action) {
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
    if (dwSuccessMsg) dwSuccessMsg.textContent = msgs[action] || '✅ Decisão registrada!';
    if (dwSuccess) dwSuccess.classList.add('show');

    // Disable quick buttons
    document.querySelectorAll('.dw-quick-btn').forEach(b => {
      if (!b.classList.contains('dw-quick-whatsapp')) {
        b.disabled = true;
        b.style.opacity = '0.4';
      }
    });
  }

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
    const cargo    = (document.getElementById('swCargo')?.value || '').trim();
    const whatsapp = (document.getElementById('swWhatsapp')?.value || '').replace(/\D/g, '');
    const email    = (document.getElementById('swEmail')?.value || '').trim();

    if (!name || !whatsapp || !email) {
      alert('Preencha Nome, WhatsApp e E-mail para enviar o acesso.');
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
      body: JSON.stringify({ token, lead_id: leadId, name, cargo, whatsapp, email })
    })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        const sw = document.getElementById('swSuccess');
        if (sw) sw.classList.add('show');
        if (submitBtn) submitBtn.style.display = 'none';
        // Clear fields
        ['swName', 'swCargo', 'swWhatsapp', 'swEmail'].forEach(id => {
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
    // Personalize WhatsApp links
    updateDwWaLink();

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
