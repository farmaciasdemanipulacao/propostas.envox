const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const slides = require('../slides/content');
const emailService = require('../services/email');

// ── Shared token viewer — DEVE VIR ANTES de /:token ─────────────────────────
// GET /proposta/s/:sharedToken — acesso via link compartilhado (auto-login)
router.get('/s/:sharedToken', (req, res) => {
  const { sharedToken } = req.params;
  const sharedRecord = db.getSharedLeadByToken(sharedToken);

  if (!sharedRecord) {
    return res.render('proposal/auth', {
      token: null,
      error: 'Link de compartilhamento inválido ou expirado. Entre em contato com a Envox.',
      validToken: false
    });
  }

  const lead = db.getLeadById(sharedRecord.lead_id);
  if (!lead) {
    return res.render('proposal/auth', {
      token: null,
      error: 'Proposta não encontrada. Entre em contato com a Envox.',
      validToken: false
    });
  }

  if (!req.session.authenticatedTokens) req.session.authenticatedTokens = [];
  if (!req.session.authenticatedTokens.includes(lead.token)) {
    req.session.authenticatedTokens.push(lead.token);
  }
  req.session.sharedAccess = req.session.sharedAccess || {};
  req.session.sharedAccess[lead.token] = { sharedToken, name: sharedRecord.shared_name };

  db.logEvent(lead.id, null, 'shared_view', {
    shared_token: sharedToken,
    viewer_name: sharedRecord.shared_name,
    viewer_email: sharedRecord.shared_email
  });

  return res.redirect(`/proposta/${lead.token}/view`);
});

// GET /proposta/:token — tela de autenticação
router.get('/:token', (req, res) => {
  const { token } = req.params;
  const lead = db.getLeadByToken(token);
  
  if (!lead) {
    return res.render('proposal/auth', { 
      token, 
      error: 'Link inválido ou expirado. Entre em contato com a Envox.',
      validToken: false
    });
  }
  
  // Verificar se já está autenticado para este token
  if (req.session && req.session.authenticatedTokens && 
      req.session.authenticatedTokens.includes(token)) {
    return res.redirect(`/proposta/${token}/view`);
  }
  
  res.render('proposal/auth', { token, error: null, validToken: true });
});

// POST /proposta/:token/auth — autenticação do lead
router.post('/:token/auth', (req, res) => {
  const { token } = req.params;
  const { whatsapp, email } = req.body;
  
  const lead = db.getLeadByToken(token);
  
  if (!lead) {
    return res.render('proposal/auth', { 
      token, 
      error: 'Link inválido. Entre em contato com a Envox.',
      validToken: false
    });
  }
  
  // Normalizar WhatsApp para comparação (apenas dígitos)
  const inputWa = (whatsapp || '').replace(/\D/g, '');
  const storedWa = (lead.whatsapp || '').replace(/\D/g, '');
  const inputEmail = (email || '').trim().toLowerCase();
  const storedEmail = (lead.email || '').trim().toLowerCase();
  
  // Verificar se os dados conferem (WhatsApp parcial: últimos 8 dígitos ou completo)
  const waMatch = inputWa === storedWa || 
    (inputWa.length >= 8 && storedWa.endsWith(inputWa.slice(-8)));
  const emailMatch = inputEmail === storedEmail;
  
  if (!waMatch || !emailMatch) {
    return res.render('proposal/auth', { 
      token, 
      error: 'Dados não conferem. Entre em contato com a Envox.',
      validToken: true
    });
  }
  
  // Autenticar: salvar token na sessão
  if (!req.session.authenticatedTokens) {
    req.session.authenticatedTokens = [];
  }
  req.session.authenticatedTokens.push(token);
  
  return res.redirect(`/proposta/${token}/view`);
});

// GET /proposta/:token/view — visualizador da proposta
router.get('/:token/view', (req, res) => {
  const { token } = req.params;
  const lead = db.getLeadByToken(token);
  
  if (!lead) {
    return res.redirect(`/proposta/${token}`);
  }
  
  // Verificar autenticação
  if (!req.session || !req.session.authenticatedTokens || 
      !req.session.authenticatedTokens.includes(token)) {
    return res.redirect(`/proposta/${token}`);
  }

  // Se proposta foi rejeitada, mostrar tela de rejeição
  if (lead.proposal_status === 'rejected') {
    return res.render('proposal/rejected', { lead, token });
  }

  // Attach proposal items and content fields to the lead object
  const proposalItems = db.getProposalItemsByLead(lead.id);
  const enrichedLead  = {
    ...lead,
    proposal_items:       proposalItems.length > 0 ? proposalItems : null,
    proposal_description: lead.proposal_description || null,
    proposal_scope:       lead.proposal_scope       || null,
    proposal_timeline:    lead.proposal_timeline     || null,
  };
  
  res.render('proposal/viewer', { 
    lead:   enrichedLead, 
    slides,
    token
  });
});

// ── API: Save Proposal Action (Accept / Counter / Reject) ────────────────────
router.post('/action', async (req, res) => {
  const { token, lead_id, action_type, comment, counter_value, current_page } = req.body;

  if (!token || !action_type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const lead = db.getLeadByToken(token);
  let resolvedLeadId = lead ? lead.id : parseInt(lead_id);

  if (!resolvedLeadId) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  if (!['accept','counter','reject'].includes(action_type)) {
    return res.status(400).json({ error: 'Invalid action_type' });
  }

  try {
    const actionId = db.saveProposalAction(
      resolvedLeadId,
      action_type,
      comment || null,
      counter_value ? parseFloat(counter_value) : null
    );
    db.logEvent(resolvedLeadId, null, 'proposal_action', {
      action_type,
      comment: comment ? comment.substring(0, 200) : null,
      counter_value: counter_value || null,
      current_page: current_page || null
    });

    // Se REJEITAR: inativar proposta e notificar admin
    if (action_type === 'reject') {
      db.setProposalStatus(resolvedLeadId, 'rejected');
      const leadData = lead || db.getLeadById(resolvedLeadId);
      const motivo = comment ? comment.substring(0, 300) : '(sem motivo informado)';
      // Notificar admin via email (não bloqueante)
      emailService.sendAdminNotification({
        subject: `❌ Proposta REJEITADA — ${leadData ? leadData.name : 'Lead #'+resolvedLeadId}`,
        body: `O lead ${leadData ? leadData.name : '#'+resolvedLeadId} (${leadData ? leadData.company_name || '' : ''}) rejeitou a proposta.\n\nMotivo: ${motivo}\n\nAcesse o painel para ver detalhes.`
      }).catch(e => console.error('[Action] Notif email err:', e));
    }

    // Se ACEITAR: notificar admin
    if (action_type === 'accept') {
      const leadData = lead || db.getLeadById(resolvedLeadId);
      emailService.sendAdminNotification({
        subject: `✅ Proposta ACEITA — ${leadData ? leadData.name : 'Lead #'+resolvedLeadId}`,
        body: `O lead ${leadData ? leadData.name : '#'+resolvedLeadId} (${leadData ? leadData.company_name || '' : ''}) ACEITOU a proposta!\n\nAcesse o painel para dar andamento.`
      }).catch(e => console.error('[Action] Notif email err:', e));
    }

    return res.json({ success: true, actionId });
  } catch (err) {
    console.error('[ProposalAction] Error:', err);
    return res.status(500).json({ error: 'Failed to save action' });
  }
});

// ── API: Solicitar nova proposta (após rejeição) ──────────────────────────────
router.post('/request-new', async (req, res) => {
  const { token, lead_id, company_name, cargo, briefing } = req.body;
  if (!company_name || !briefing) {
    return res.status(400).json({ error: 'Preencha empresa e briefing' });
  }
  const lead = token ? db.getLeadByToken(token) : null;
  const resolvedLeadId = lead ? lead.id : (parseInt(lead_id) || null);
  try {
    const reqId = db.createProposalRequest(resolvedLeadId, company_name, cargo||'', briefing);
    db.logEvent(resolvedLeadId || 0, null, 'new_proposal_request', { company_name, cargo, briefing: briefing.substring(0,200) });
    const leadData = lead || (resolvedLeadId ? db.getLeadById(resolvedLeadId) : null);
    emailService.sendAdminNotification({
      subject: `🆕 Solicitação de Nova Proposta — ${company_name}`,
      body: `${leadData ? leadData.name : 'Lead'} solicitou uma nova proposta.\n\nEmpresa: ${company_name}\nCargo: ${cargo||''}\n\nBriefing:\n${briefing}\n\nAcesse o painel para criar a proposta.`
    }).catch(e => console.error('[RequestNew] Email err:', e));
    return res.json({ success: true, requestId: reqId });
  } catch(err) {
    console.error('[RequestNew] Error:', err);
    return res.status(500).json({ error: 'Erro ao registrar solicitação' });
  }
});

// ── API: Enviar plano por email ───────────────────────────────────────────────
router.post('/send-plan-email', async (req, res) => {
  const { token, lead_id, email, plan_html } = req.body;
  if (!email) return res.status(400).json({ error: 'Email obrigatório' });
  const lead = token ? db.getLeadByToken(token) : null;
  const resolvedLeadId = lead ? lead.id : (parseInt(lead_id)||null);
  try {
    await emailService.sendPlanEmail({ to: email, leadName: lead ? lead.name : '', companyName: lead ? lead.company_name||'' : '', planHtml: plan_html||'' });
    if (resolvedLeadId) db.logEvent(resolvedLeadId, null, 'plan_email_sent', { to: email });
    // Notify admin
    emailService.sendAdminNotification({
      subject: `📧 Cliente enviou plano por email — ${lead ? lead.name : email}`,
      body: `O lead ${lead ? lead.name : email} enviou seu plano personalizado para ${email}. Acesse o painel para acompanhar.`
    }).catch(()=>{});
    return res.json({ success: true });
  } catch(err) {
    console.error('[SendPlanEmail] Error:', err);
    return res.status(500).json({ error: 'Erro ao enviar email' });
  }
});

// ── API: Share Proposal (add secondary viewer + email + auto-lead) ──────────
router.post('/share', async (req, res) => {
  const { token, lead_id, name, whatsapp, email, cargo } = req.body;

  if (!token || !name || !whatsapp || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const lead = db.getLeadByToken(token);
  const resolvedLeadId = lead ? lead.id : parseInt(lead_id);

  if (!resolvedLeadId) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  const cleanEmail    = email.trim().toLowerCase();
  const cleanWhatsapp = whatsapp.replace(/\D/g, '');
  const cleanName     = name.trim();
  const cleanCargo    = (cargo||'').trim();

  try {
    // 1. Gerar token compartilhado
    const sharedToken = uuidv4().replace(/-/g, '').substring(0, 16);
    const sharedId = db.addSharedLead(
      resolvedLeadId,
      cleanName,
      cleanWhatsapp,
      cleanEmail,
      sharedToken,
      cleanCargo
    );

    // 2. Auto-cadastrar como lead no painel com cargo e empresa
    let sharedLeadRecord = db.getLeadByEmail ? db.getLeadByEmail(cleanEmail) : null;
    if (!sharedLeadRecord) {
      try {
        const newLeadToken = uuidv4().replace(/-/g, '').substring(0, 16);
        db.createLead(cleanName, cleanWhatsapp, cleanEmail, newLeadToken);
        sharedLeadRecord = db.getLeadByToken(newLeadToken);
        // Set company_name and cargo from the original lead
        if (sharedLeadRecord) {
          const origCompany = lead ? lead.company_name || '' : '';
          db.updateLeadCompany(sharedLeadRecord.id, origCompany, cleanCargo);
        }
        console.log(`[ProposalShare] Auto-cadastrou lead: ${cleanName} <${cleanEmail}> (${cleanCargo})`);
      } catch (leadErr) {
        console.log(`[ProposalShare] Lead já existe para ${cleanEmail}.`);
      }
    }

    // 3. Montar link de acesso com o token compartilhado
    const baseUrl   = (process.env.BASE_URL || 'https://envox.com.br').replace(/\/$/, '');
    const shareLink = `${baseUrl}/proposta/s/${sharedToken}`;

    // 4. Enviar email com link de acesso (não-bloqueante)
    emailService.sendSharedProposalEmail({
      to:         cleanEmail,
      toName:     cleanName,
      fromName:   lead ? lead.name : 'um colega',
      shareLink,
      whatsapp:   cleanWhatsapp,
    }).then(result => {
      if (result && result.ok) {
        console.log(`[ProposalShare] Email enviado para ${cleanEmail}`);
      } else if (result && !result.skipped) {
        console.warn(`[ProposalShare] Falha ao enviar email para ${cleanEmail}:`, result.error);
      }
    }).catch(err => console.error('[ProposalShare] Email error:', err));

    // 5. Notificar admin sobre compartilhamento
    const companyName = lead ? (lead.company_name || '') : '';
    emailService.sendAdminNotification({
      subject: `📤 Proposta compartilhada — ${lead ? lead.name : 'Lead'} → ${cleanName}`,
      body: `${lead ? lead.name : 'Um lead'} compartilhou a proposta${companyName ? ' de '+companyName : ''} com:\n\nNome: ${cleanName}\nCargo: ${cleanCargo||'não informado'}\nWhatsApp: ${cleanWhatsapp}\nEmail: ${cleanEmail}\n\nLink de acesso gerado: ${shareLink}\nAcesse o painel para ver o histórico completo.`
    }).catch(e => console.error('[ProposalShare] Admin notif err:', e));

    db.logEvent(resolvedLeadId, null, 'proposal_shared', { shared_with: cleanEmail, name: cleanName, cargo: cleanCargo });

    return res.json({ success: true, sharedId, sharedToken });
  } catch (err) {
    console.error('[ProposalShare] Error:', err);
    return res.status(500).json({ error: 'Failed to share proposal' });
  }
});

module.exports = router;
