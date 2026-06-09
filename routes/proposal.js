const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const slides = require('../slides/content');
const emailService = require('../services/email');

// ══════════════════════════════════════════════════════════
// HELPER — determinar o lead autenticado para este token
// Resolve: lead que fez login normal OU lead de link compartilhado
// ══════════════════════════════════════════════════════════
function getViewerLead(req, proposal) {
  // Link compartilhado tem o lead_id gravado na sessão por shared-token
  const sharedCtx = req.session.sharedAccess && req.session.sharedAccess[proposal.token];
  if (sharedCtx && sharedCtx.lead_id) {
    const lead = db.getLeadById(sharedCtx.lead_id);
    if (lead) return lead;
  }
  // Override de admin (preview)
  const override = req.session.proposalLeadOverride && req.session.proposalLeadOverride[proposal.token];
  if (override) {
    const lead = db.getLeadById(override);
    if (lead) return lead;
  }
  // Lead primário da proposta
  if (proposal.leads && proposal.leads.length > 0) {
    const primary = proposal.leads.find(l => l.is_primary) || proposal.leads[0];
    return primary;
  }
  return null;
}

// ── Shared token viewer — DEVE VIR ANTES de /:token ─────
// GET /proposta/s/:sharedToken — acesso via link compartilhado
// NÃO autentica automaticamente: guarda sharedToken pendente e redireciona para tela de auth
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

  // sharedRecord tem proposal_token e new_lead_id
  const proposalToken = sharedRecord.proposal_token;
  const proposal = db.getProposalByToken(proposalToken);

  if (!proposal) {
    return res.render('proposal/auth', {
      token: null,
      error: 'Proposta não encontrada. Entre em contato com a Envox.',
      validToken: false
    });
  }

  // Se já está autenticado (ex: recarregou a aba), redirecionar direto
  if (req.session && req.session.authenticatedTokens &&
      req.session.authenticatedTokens.includes(proposalToken) &&
      req.session.sharedAccess && req.session.sharedAccess[proposalToken]) {
    return res.redirect(`/proposta/${proposalToken}/view`);
  }

  // Guardar sharedToken pendente para ser resolvido após login bem-sucedido
  req.session.pendingSharedToken = sharedToken;

  // Redirecionar para tela de autenticação — lead DEVE inserir email + WhatsApp
  return res.redirect(`/proposta/${proposalToken}`);
});

// GET /proposta/:token — tela de autenticação
router.get('/:token', (req, res) => {
  const { token } = req.params;
  const proposal = db.getProposalByToken(token);

  if (!proposal) {
    return res.render('proposal/auth', {
      token, error: 'Link inválido ou expirado. Entre em contato com a Envox.', validToken: false
    });
  }

  // Já autenticado → redirecionar direto
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
  const proposal = db.getProposalByTokenWithLeads(token);

  if (!proposal) {
    return res.render('proposal/auth', {
      token, error: 'Link inválido. Entre em contato com a Envox.', validToken: false
    });
  }

  // Verificar se algum lead vinculado tem as credenciais informadas
  const inputWa = (whatsapp || '').replace(/\D/g, '');
  const inputEmail = (email || '').trim().toLowerCase();

  const matchedLead = proposal.leads.find(lead => {
    const storedWa = (lead.whatsapp || '').replace(/\D/g, '');
    const storedEmail = (lead.email || '').trim().toLowerCase();
    const waMatch = inputWa === storedWa ||
      (inputWa.length >= 8 && storedWa.endsWith(inputWa.slice(-8)));
    const emailMatch = inputEmail === storedEmail;
    return waMatch && emailMatch;
  });

  if (!matchedLead) {
    return res.render('proposal/auth', {
      token, error: 'Dados não conferem. Entre em contato com a Envox.', validToken: true
    });
  }

  // Autenticar
  if (!req.session.authenticatedTokens) req.session.authenticatedTokens = [];
  req.session.authenticatedTokens.push(token);

  // Guardar qual lead fez login
  req.session.sharedAccess = req.session.sharedAccess || {};
  req.session.sharedAccess[token] = { lead_id: matchedLead.id, name: matchedLead.name };

  // Se havia um sharedToken pendente, resolver contexto de compartilhamento
  if (req.session.pendingSharedToken) {
    const pendingToken = req.session.pendingSharedToken;
    delete req.session.pendingSharedToken;
    const sharedRecord = db.getSharedLeadByToken(pendingToken);
    if (sharedRecord && sharedRecord.proposal_token === token && sharedRecord.new_lead_id === matchedLead.id) {
      // Sobrescrever com contexto do link compartilhado (já está correto em sharedAccess)
      req.session.sharedAccess[token] = {
        sharedToken: pendingToken,
        lead_id: sharedRecord.new_lead_id,
        name: sharedRecord.lead_name
      };
      // Registrar evento de acesso compartilhado
      db.logEvent(sharedRecord.new_lead_id, null, 'shared_view', {
        shared_token: pendingToken,
        viewer_name: sharedRecord.lead_name,
      }, sharedRecord.proposal_id || null);
    }
  }

  return res.redirect(`/proposta/${token}/view`);
});

// GET /proposta/:token/view — visualizador da proposta
router.get('/:token/view', (req, res) => {
  const { token } = req.params;
  const proposal = db.getProposalByTokenWithLeads(token);

  if (!proposal) return res.redirect(`/proposta/${token}`);

  // Verificar autenticação
  if (!req.session || !req.session.authenticatedTokens ||
      !req.session.authenticatedTokens.includes(token)) {
    return res.redirect(`/proposta/${token}`);
  }

  // Resolver lead viewer
  const viewerLead = getViewerLead(req, proposal);
  if (!viewerLead) return res.redirect(`/proposta/${token}`);

  // Se proposta foi rejeitada, mostrar tela de rejeição
  if (proposal.proposal_status === 'rejected') {
    return res.render('proposal/rejected', {
      lead: viewerLead, proposal, token
    });
  }

  // Se proposta está bloqueada (lead enviou email ou foi para /finalizar), redirecionar para painel
  if (proposal.client_locked) {
    return res.redirect(`/proposta/painel/${token}`);
  }

  // Montar itens e enriquecer proposta para o viewer
  const proposalItems = db.getProposalItems(proposal.id);
  const enrichedProposal = {
    ...proposal,
    proposal_items: proposalItems.length > 0 ? proposalItems : null,
  };

  res.render('proposal/viewer', {
    proposal: enrichedProposal,
    lead: viewerLead,
    slides,
    token,
    isAdminPreview: false
  });
});

// GET /proposta/:token/view-iframe — renderiza o viewer como o cliente vê, para uso no iframe do admin
// Não redireciona para /painel mesmo se client_locked=1. Apenas admins autenticados.
router.get('/:token/view-iframe', (req, res) => {
  if (!req.session || !req.session.isAdmin) return res.redirect('/admin');

  const { token } = req.params;
  const proposal = db.getProposalByTokenWithLeads(token);
  if (!proposal) return res.redirect('/admin/proposals');

  // Lead primário como viewer (admin sempre vê pela perspectiva do lead primário)
  let viewerLead = null;
  if (proposal.leads && proposal.leads.length > 0) {
    // Respeitar override de lead se admin selecionou outro
    const overrideId = req.session.proposalLeadOverride && req.session.proposalLeadOverride[token];
    if (overrideId) viewerLead = proposal.leads.find(l => l.id === overrideId);
    if (!viewerLead) viewerLead = proposal.leads.find(l => l.is_primary) || proposal.leads[0];
  }
  if (!viewerLead) return res.redirect('/admin/proposals');

  const proposalItems = db.getProposalItems(proposal.id);
  res.render('proposal/viewer', {
    proposal: { ...proposal, proposal_items: proposalItems.length > 0 ? proposalItems : null },
    lead: viewerLead,
    slides,
    token,
    isAdminPreview: true   // desabilita tracking e ações reais no viewer
  });
});

// GET /proposta/:token/view-admin — visualização da proposta para admin (igual ao cliente vê)
router.get('/:token/view-admin', (req, res) => {
  // Apenas admins autenticados
  if (!req.session || !req.session.isAdmin) {
    return res.redirect('/admin');
  }

  const { token } = req.params;
  const proposal = db.getProposalByTokenWithLeads(token);
  if (!proposal) return res.redirect('/admin/leads');

  // Resolver lead primário — sem exigir sessão de lead
  let viewerLead = null;
  if (proposal.leads && proposal.leads.length > 0) {
    viewerLead = proposal.leads.find(l => l.is_primary) || proposal.leads[0];
  }
  if (!viewerLead) return res.redirect('/admin/leads');

  // Carregar itens, ações e totais (igual ao painel do cliente)
  const items   = db.getProposalItems(proposal.id);
  const actions = db.getProposalActionsByProposal ? db.getProposalActionsByProposal(proposal.id) : [];

  let rawM = 0, rawO = 0;
  items.forEach(it => {
    const t = (parseFloat(it.price) || 0) * (parseInt(it.qty) || 1);
    if (it.category === 'onetime') rawO += t; else rawM += t;
  });
  const discM = parseFloat(proposal.admin_discount_monthly || 0);
  const discO = parseFloat(proposal.admin_discount_onetime || 0);
  const finM  = rawM * (1 - discM / 100);
  const finO  = rawO * (1 - discO / 100);

  // Calcular dias em aberto para propostas criadas pelo cliente sem itens
  let daysOpen = null;
  if (proposal.created_by_client && items.length === 0) {
    const created = new Date(proposal.created_at);
    daysOpen = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
  }

  res.render('admin/proposal-view', {
    lead: viewerLead,
    proposal: { ...proposal, items },
    actions,
    totals: { rawM, rawO, discM, discO, finM, finO },
    daysOpen,
    backUrl: `/admin/leads/${viewerLead.id}/proposals`,
  });
});

// ── API: Mark viewer bounced (lead viu slide mas não preencheu) ───────────────
// POST /proposta/mark-viewer-bounced
router.post('/mark-viewer-bounced', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token required' });
  try {
    const proposal = db.getProposalByToken(token);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    // Só marca bounced se modo inclui build e ainda não tem itens
    if ((proposal.proposal_mode === 'build' || proposal.proposal_mode === 'both')) {
      const items = db.getProposalItems(proposal.id);
      if (items.length === 0) {
        db.setViewerBounced(proposal.id, true);
      }
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('[mark-viewer-bounced]', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// ── API: Session tracking ─────────────────────────────────────────────────────

// POST /proposta/session/start
router.post('/session/start', (req, res) => {
  const { token, lead_id } = req.body;
  const proposal = token ? db.getProposalByToken(token) : null;
  const resolvedLeadId = parseInt(lead_id);
  if (!resolvedLeadId || isNaN(resolvedLeadId)) {
    return res.status(400).json({ error: 'lead_id required' });
  }
  try {
    const sessionId = db.createSession(resolvedLeadId, proposal ? proposal.id : null);
    db.logEvent(resolvedLeadId, sessionId, 'proposal_opened', {}, proposal ? proposal.id : null);
    return res.json({ success: true, sessionId });
  } catch (err) {
    console.error('[Session/start]', err);
    return res.status(500).json({ error: 'Failed to create session' });
  }
});

// POST /proposta/session/end
router.post('/session/end', (req, res) => {
  const { session_id, total_duration, lead_id, token } = req.body;
  const sessionId = parseInt(session_id);
  const duration = parseFloat(total_duration) || 0;
  const resolvedLeadId = parseInt(lead_id);
  if (!sessionId) return res.status(400).json({ error: 'session_id required' });
  try {
    db.closeSession(sessionId, Math.round(duration));
    const proposal = token ? db.getProposalByToken(token) : null;
    if (resolvedLeadId) {
      db.logEvent(resolvedLeadId, sessionId, 'proposal_closed', { total_duration: duration }, proposal ? proposal.id : null);
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('[Session/end]', err);
    return res.status(500).json({ error: 'Failed to close session' });
  }
});

// POST /proposta/slide/event
router.post('/slide/event', (req, res) => {
  const { session_id, lead_id, token, slide_number, event_type, duration_seconds } = req.body;
  const resolvedLeadId = parseInt(lead_id);
  const slideNum = parseInt(slide_number);
  if (!resolvedLeadId || !slideNum || !event_type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const proposal = token ? db.getProposalByToken(token) : null;
    db.recordSlideEvent(
      session_id ? parseInt(session_id) : null,
      resolvedLeadId,
      proposal ? proposal.id : null,
      slideNum,
      event_type,
      parseFloat(duration_seconds) || 0
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('[Slide/event]', err);
    return res.status(500).json({ error: 'Failed to record event' });
  }
});

// ── API: Save Proposal Action (Accept / Counter / Reject) ────────────────────
router.post('/action', async (req, res) => {
  const { token, lead_id, action_type, comment, counter_value, current_page } = req.body;

  if (!token || !action_type) return res.status(400).json({ error: 'Missing required fields' });

  const proposal = db.getProposalByToken(token);
  if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

  const resolvedLeadId = parseInt(lead_id);
  if (!resolvedLeadId) return res.status(400).json({ error: 'lead_id required' });

  if (!['accept', 'counter', 'reject'].includes(action_type)) {
    return res.status(400).json({ error: 'Invalid action_type' });
  }

  try {
    const actionId = db.saveProposalAction(
      proposal.id,
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
    }, proposal.id);

    const leadData = db.getLeadById(resolvedLeadId);
    const leadName = leadData ? leadData.name : `Lead #${resolvedLeadId}`;
    const company = leadData ? (leadData.company_name || '') : '';

    if (action_type === 'reject') {
      db.setProposalStatus(proposal.id, 'rejected');
      const motivo = comment ? comment.substring(0, 300) : '(sem motivo informado)';
      emailService.sendAdminNotification({
        subject: `❌ Proposta REJEITADA — ${leadName}`,
        body: `${leadName} (${company}) rejeitou a proposta.\n\nMotivo: ${motivo}\n\nAcesse o painel para ver detalhes.`
      }).catch(e => console.error('[Action] Admin notif err:', e));
    }

    if (action_type === 'accept') {
      emailService.sendAdminNotification({
        subject: `✅ Proposta ACEITA — ${leadName}`,
        body: `${leadName} (${company}) ACEITOU a proposta!\n\nAcesse o painel para dar andamento.`
      }).catch(e => console.error('[Action] Admin notif err:', e));
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
  const proposal = token ? db.getProposalByToken(token) : null;
  const resolvedLeadId = parseInt(lead_id) || null;
  try {
    const reqId = db.createProposalRequest(resolvedLeadId, proposal ? proposal.id : null, company_name, cargo || '', briefing);
    if (resolvedLeadId) {
      db.logEvent(resolvedLeadId, null, 'new_proposal_request', {
        company_name, cargo, briefing: briefing.substring(0, 200)
      }, proposal ? proposal.id : null);
    }
    const leadData = resolvedLeadId ? db.getLeadById(resolvedLeadId) : null;
    emailService.sendAdminNotification({
      subject: `🆕 Solicitação de Nova Proposta — ${company_name}`,
      body: `${leadData ? leadData.name : 'Lead'} solicitou uma nova proposta.\n\nEmpresa: ${company_name}\nCargo: ${cargo || ''}\n\nBriefing:\n${briefing}\n\nAcesse o painel para criar a proposta.`
    }).catch(e => console.error('[RequestNew] Email err:', e));
    return res.json({ success: true, requestId: reqId });
  } catch(err) {
    console.error('[RequestNew] Error:', err);
    return res.status(500).json({ error: 'Erro ao registrar solicitação' });
  }
});

// ── API: Salvar itens do builder sem enviar email ─────────────────────────────
// Chamado por abrirFinalizacao() quando o lead vai direto para /finalizar
router.post('/save-builder-items', (req, res) => {
  const { token, builder_items } = req.body;
  if (!token) return res.status(400).json({ error: 'Token obrigatório' });

  const proposal = db.getProposalByToken(token);
  if (!proposal) return res.status(404).json({ error: 'Proposta não encontrada' });

  try {
    const incoming = Array.isArray(builder_items) ? builder_items : [];
    if (incoming.length > 0) {
      const existingItems = db.getProposalItems(proposal.id);
      if (existingItems.length === 0) {
        db.saveProposalItems(proposal.id, incoming);
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[SaveBuilderItems]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── API: Enviar proposta por email (link para /finalizar) ─────────────────────
router.post('/send-plan-email', async (req, res) => {
  const { token, lead_id, builder_items } = req.body;

  if (!token) return res.status(400).json({ error: 'Token obrigatório' });

  const proposal = db.getProposalByToken(token);
  if (!proposal) return res.status(404).json({ error: 'Proposta não encontrada' });

  let resolvedLeadId = parseInt(lead_id) || null;
  let leadData = resolvedLeadId ? db.getLeadById(resolvedLeadId) : null;

  // Fallback: se lead_id não foi passado (modo proposta pronta / admin),
  // buscar o lead primário vinculado à proposta
  if (!leadData) {
    try {
      const proposalWithLeads = db.getProposalByTokenWithLeads(token);
      if (proposalWithLeads && proposalWithLeads.leads && proposalWithLeads.leads.length > 0) {
        // Preferir lead primário; se não houver flag, pegar o primeiro
        leadData = proposalWithLeads.leads.find(l => l.is_primary) || proposalWithLeads.leads[0];
        resolvedLeadId = leadData ? leadData.id : null;
      }
    } catch(e) { /* ignora erro de busca */ }
  }

  // Email do lead — obrigatório
  const toEmail = leadData ? leadData.email : null;
  if (!toEmail) return res.status(400).json({ error: 'Lead sem email cadastrado. Atualize o cadastro do lead no painel admin.' });

  const baseUrl = (process.env.BASE_URL || 'https://envox.com.br').replace(/\/$/, '');
  const finalizeLink = `${baseUrl}/proposta/${token}/finalizar`;

  try {
    // 1. Enviar email com link para /finalizar
    const result = await emailService.sendFinalizeEmail({
      to:          toEmail,
      leadName:    leadData.name || '',
      companyName: leadData.company_name || '',
      finalizeLink,
      whatsapp:    leadData.whatsapp || ''
    });

    if (!result.ok && !result.skipped) {
      console.error('[SendPlanEmail] Falha SMTP:', result.error);
      return res.status(500).json({ error: 'Erro ao enviar email: ' + (result.error || 'tente novamente') });
    }

    // 2. Registrar ação de interesse (sinal quente)
    try {
      db.saveProposalAction(proposal.id, resolvedLeadId, 'email_sent', 'Lead solicitou envio da proposta por email', null);
    } catch(e) { /* não bloquear se falhar */ }

    // 3. Log de evento detalhado
    if (resolvedLeadId) {
      db.logEvent(resolvedLeadId, null, 'plan_email_sent', {
        to: toEmail,
        finalize_link: finalizeLink,
        skipped: result.skipped || false
      }, proposal.id);
    }

    // 4. Bloquear slide para o lead (proposta travada após envio do email)
    try { db.setClientLocked(proposal.id, true); } catch(e) {}

    // 5. Marcar como criada pelo cliente (builder) + modo 'ready'
    try { db.markCreatedByClient(proposal.id); } catch(e) {}

    // 5b. Persistir itens do builder em proposal_items (se vieram no payload)
    //     Só salva se a proposta ainda não tem itens — evita sobrescrever itens
    //     que o admin já tenha configurado manualmente.
    try {
      const existingItems = db.getProposalItems(proposal.id);
      const incoming = Array.isArray(builder_items) ? builder_items : [];
      if (incoming.length > 0 && existingItems.length === 0) {
        db.saveProposalItems(proposal.id, incoming);
      }
    } catch(e) { console.error('[SendPlanEmail] Erro ao salvar itens do builder:', e.message); }

    // 6. Notificar admin (não bloqueante)
    const leadLabel = leadData.name + (leadData.company_name ? ` — ${leadData.company_name}` : '');
    emailService.sendAdminNotification({
      subject: `🔥 Lead aquecido: proposta enviada por email — ${leadLabel}`,
      body: `${leadLabel} solicitou o envio da proposta para o email ${toEmail}.\n\nIsso indica alto interesse! Acesse o painel para acompanhar.\n\nLink de finalização: ${finalizeLink}`
    }).catch(() => {});

    return res.json({ success: true, skipped: result.skipped || false });
  } catch(err) {
    console.error('[SendPlanEmail] Error:', err);
    return res.status(500).json({ error: 'Erro interno ao enviar email' });
  }
});

// ── GET: Página de finalização ────────────────────────────────────────────────
router.get('/:token/finalizar', (req, res) => {
  const { token } = req.params;

  // Verificar autenticação
  if (!req.session || !req.session.authenticatedTokens ||
      !req.session.authenticatedTokens.includes(token)) {
    return res.redirect(`/proposta/${token}`);
  }

  const proposal = db.getProposalByTokenWithLeads(token);
  if (!proposal) return res.redirect(`/proposta/${token}`);

  // Proposta já rejeitada não pode ser finalizada
  if (proposal.proposal_status === 'rejected') {
    return res.redirect(`/proposta/${token}/view`);
  }

  const viewerLead = getViewerLead(req, proposal);
  if (!viewerLead) return res.redirect(`/proposta/${token}`);

  // Marcar proposta como "awaiting" (aguardando decisão) se ainda ativa
  if (proposal.proposal_status === 'active') {
    try { db.setProposalStatus(proposal.id, 'awaiting'); } catch(e) {}
  }

  // Bloquear slide e marcar como criada pelo cliente ao abrir /finalizar
  try { db.setClientLocked(proposal.id, true); } catch(e) {}
  try { db.markCreatedByClient(proposal.id); } catch(e) {}

  // Registrar evento de alta intenção
  try {
    db.logEvent(viewerLead.id, null, 'finalize_page_opened', {
      proposal_status_before: proposal.proposal_status
    }, proposal.id);
  } catch(e) {}

  const proposalItems = db.getProposalItems(proposal.id);

  res.render('proposal/finalize', {
    proposal: { ...proposal, proposal_items: proposalItems.length > 0 ? proposalItems : null },
    lead: viewerLead,
    token,
    whatsappUrl: 'https://wa.me/554133000404'
  });
});

// ── POST: Aceitar proposta com dados cadastrais ───────────────────────────────
router.post('/finalizar-aceitar', async (req, res) => {
  const { token, lead_id, tipo_pessoa, ...formData } = req.body;

  if (!token || !tipo_pessoa) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
  }

  const proposal = db.getProposalByToken(token);
  if (!proposal) return res.status(404).json({ error: 'Proposta não encontrada' });

  const resolvedLeadId = parseInt(lead_id) || null;
  const leadData = resolvedLeadId ? db.getLeadById(resolvedLeadId) : null;
  const leadName  = leadData ? leadData.name : 'Lead';
  const company   = leadData ? (leadData.company_name || '') : (formData.razao_social || '');

  try {
    // Montar objeto limpo com todos os dados cadastrais do formulário
    const acceptData = { tipo_pessoa, ...formData };

    // Salvar ação de aceite — agora persiste os dados cadastrais na coluna accept_form_data
    const actionId = db.saveProposalAction(
      proposal.id,
      resolvedLeadId,
      'accept',
      `Aceite formal via formulário (${tipo_pessoa.toUpperCase()})`,
      null,
      acceptData   // ← salvo como JSON em accept_form_data
    );

    if (resolvedLeadId) {
      db.logEvent(resolvedLeadId, null, 'proposal_action', {
        action_type: 'accept',
        tipo_pessoa,
        form_data: JSON.stringify(formData).substring(0, 500)
      }, proposal.id);
    }

    // Montar corpo do email admin com todos os dados
    let bodyLines = [];
    bodyLines.push(`${leadName}${company ? ' — ' + company : ''} ACEITOU a proposta!`);
    bodyLines.push('');
    bodyLines.push(`Tipo: ${tipo_pessoa === 'pf' ? 'Pessoa Física (CPF)' : 'Pessoa Jurídica (CNPJ)'}`);
    bodyLines.push('');
    bodyLines.push('─── DADOS CADASTRAIS ───');

    if (tipo_pessoa === 'pf') {
      bodyLines.push(`Nome completo: ${formData.nome_completo || ''}`);
      bodyLines.push(`CPF: ${formData.cpf || ''}`);
      bodyLines.push(`RG: ${formData.rg || ''}`);
      bodyLines.push(`Data de Nascimento: ${formData.data_nascimento || ''}`);
      bodyLines.push(`Endereço residencial: ${formData.endereco_residencial || ''}`);
      bodyLines.push(`Email assinatura: ${formData.email_assinatura || ''}`);
      bodyLines.push(`Email financeiro: ${formData.email_financeiro || ''}`);
    } else {
      bodyLines.push(`CNPJ: ${formData.cnpj || ''}`);
      bodyLines.push(`Razão Social: ${formData.razao_social || ''}`);
      bodyLines.push(`Endereço da sede: ${formData.endereco_sede || ''}`);
      bodyLines.push(`Sócio representante legal: ${formData.nome_socio || ''}`);
      bodyLines.push(`CPF: ${formData.cpf_socio || ''}`);
      bodyLines.push(`RG: ${formData.rg_socio || ''}`);
      bodyLines.push(`Data de Nascimento: ${formData.data_nascimento_socio || ''}`);
      bodyLines.push(`Endereço residencial: ${formData.endereco_residencial_socio || ''}`);
      bodyLines.push(`Email assinatura: ${formData.email_assinatura || ''}`);
      bodyLines.push(`Email financeiro: ${formData.email_financeiro || ''}`);
    }

    bodyLines.push('');
    bodyLines.push('Acesse o painel para dar andamento.');

    await emailService.sendAdminNotification({
      subject: `✅ Proposta ACEITA (formal) — ${leadName}${company ? ' · ' + company : ''}`,
      body: bodyLines.join('\n')
    });

    return res.json({ success: true, actionId });
  } catch (err) {
    console.error('[FinalizarAceitar] Error:', err);
    return res.status(500).json({ error: 'Erro ao processar aceite' });
  }
});

// ── API: Share Proposal (encaminhar para novo lead) ───────────────────────────
router.post('/share', async (req, res) => {
  const { token, lead_id, name, whatsapp, email, cargo } = req.body;

  if (!token || !name || !whatsapp || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const proposal = db.getProposalByToken(token);
  if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

  const fromLeadId = parseInt(lead_id) || null;
  const cleanEmail = email.trim().toLowerCase();
  const cleanWhatsapp = whatsapp.replace(/\D/g, '');
  const cleanName = name.trim();
  const cleanCargo = (cargo || '').trim();

  // Obter company_name do lead origem
  const fromLead = fromLeadId ? db.getLeadById(fromLeadId) : null;
  const origCompany = fromLead ? (fromLead.company_name || '') : '';
  const fromName = fromLead ? fromLead.name : 'um colega';

  try {
    // 1. Criar ou encontrar o novo lead
    let newLead = db.getLeadByEmail(cleanEmail);
    if (!newLead) {
      try {
        const newLeadId = db.createLead(cleanName, cleanWhatsapp, cleanEmail, origCompany, cleanCargo);
        newLead = db.getLeadById(newLeadId);
        console.log(`[Share] Novo lead criado: ${cleanName} <${cleanEmail}>`);
      } catch (leadErr) {
        // Email já existe mas getLeadByEmail não retornou — tentar novamente
        newLead = db.getLeadByEmail(cleanEmail);
        if (!newLead) throw leadErr;
        console.log(`[Share] Lead já existe para ${cleanEmail}`);
      }
    } else {
      // Atualizar cargo se vier diferente
      if (cleanCargo && !newLead.cargo) {
        db.updateLeadCompany(newLead.id, newLead.company_name || origCompany, cleanCargo);
        newLead = db.getLeadById(newLead.id);
      }
    }

    // 2. Vincular novo lead à MESMA proposta
    db.linkLeadToProposal(proposal.id, newLead.id, false);

    // 3. Gerar shared token para acesso direto
    const sharedToken = uuidv4().replace(/-/g, '').substring(0, 16);
    db.addSharedLead(proposal.id, fromLeadId, newLead.id, sharedToken);

    // 4. Montar link de acesso
    const baseUrl = (process.env.BASE_URL || 'https://envox.com.br').replace(/\/$/, '');
    const shareLink = `${baseUrl}/proposta/s/${sharedToken}`;

    // 5. Enviar email com link (não-bloqueante)
    emailService.sendSharedProposalEmail({
      to: cleanEmail,
      toName: cleanName,
      fromName,
      shareLink,
      whatsapp: cleanWhatsapp,
    }).then(result => {
      if (result && result.ok) console.log(`[Share] Email enviado para ${cleanEmail}`);
      else if (result && !result.skipped) console.warn(`[Share] Falha email para ${cleanEmail}:`, result.error);
    }).catch(err => console.error('[Share] Email error:', err));

    // 6. Notificar admin
    emailService.sendAdminNotification({
      subject: `📤 Proposta compartilhada — ${fromName} → ${cleanName}`,
      body: `${fromName} compartilhou a proposta${origCompany ? ' de ' + origCompany : ''} com:\n\nNome: ${cleanName}\nCargo: ${cleanCargo || 'não informado'}\nWhatsApp: ${cleanWhatsapp}\nEmail: ${cleanEmail}\n\nLink de acesso: ${shareLink}`
    }).catch(e => console.error('[Share] Admin notif err:', e));

    if (fromLeadId) {
      db.logEvent(fromLeadId, null, 'proposal_shared', {
        shared_with: cleanEmail, name: cleanName, cargo: cleanCargo, new_lead_id: newLead.id
      }, proposal.id);
    }

    return res.json({ success: true, sharedToken, newLeadId: newLead.id });
  } catch (err) {
    console.error('[Share] Error:', err);
    return res.status(500).json({ error: 'Failed to share proposal' });
  }
});

// ── GET: Painel do cliente — /proposta/painel/:leadToken ──────────────────────
// O lead acessa via link autenticado com seu token de proposta.
// Mostra todas as propostas vinculadas a ele.
router.get('/painel/:token', (req, res) => {
  const { token } = req.params;

  // Verificar autenticação pelo token de qualquer proposta desse lead
  const proposal = db.getProposalByToken(token);
  if (!proposal) return res.redirect('/');

  // Verificar sessão autenticada
  const authed = req.session && req.session.authenticatedTokens &&
                 req.session.authenticatedTokens.includes(token);
  if (!authed) return res.redirect(`/proposta/${token}`);

  const viewerLead = getViewerLead(req, db.getProposalByTokenWithLeads(token));
  if (!viewerLead) return res.redirect(`/proposta/${token}`);

  // Buscar todas as propostas do lead
  const rawProposals = db.getProposalsByLead(viewerLead.id);

  // Enriquecer com itens
  const proposals = rawProposals.map(p => ({
    ...p,
    items: db.getProposalItems(p.id)
  }));

  res.render('client/dashboard', {
    lead: viewerLead,
    proposals,
    currentToken: token
  });
});

// ── GET: Detalhe de proposta no painel do cliente — /proposta/painel/:token/proposta/:pid ──
router.get('/painel/:token/proposta/:pid', (req, res) => {
  const { token, pid } = req.params;

  // Auth via session
  const proposal = db.getProposalByToken(token);
  if (!proposal) return res.redirect('/');

  const authed = req.session && req.session.authenticatedTokens &&
                 req.session.authenticatedTokens.includes(token);
  if (!authed) return res.redirect(`/proposta/${token}`);

  const viewerLead = getViewerLead(req, db.getProposalByTokenWithLeads(token));
  if (!viewerLead) return res.redirect(`/proposta/${token}`);

  // Carregar a proposta específica
  const targetProposal = db.getProposalByTokenWithLeads(
    // buscar pelo id — precisamos do token da proposta alvo
    (() => {
      const allProposals = db.getProposalsByLead(viewerLead.id);
      const found = allProposals.find(p => p.id === parseInt(pid));
      return found ? found.token : null;
    })()
  );

  if (!targetProposal) return res.redirect(`/proposta/painel/${token}`);

  // Verificar que a proposta pertence ao lead
  const allLeadProposals = db.getProposalsByLead(viewerLead.id);
  const belongs = allLeadProposals.some(p => p.id === parseInt(pid));
  if (!belongs) return res.redirect(`/proposta/painel/${token}`);

  const items = db.getProposalItems(parseInt(pid));
  const actions = db.getProposalActionsByProposal ? db.getProposalActionsByProposal(parseInt(pid)) : [];

  // Calcular totais
  let rawM = 0, rawO = 0;
  items.forEach(it => {
    const t = (parseFloat(it.price) || 0) * (parseInt(it.qty) || 1);
    if (it.category === 'onetime') rawO += t; else rawM += t;
  });
  const discM = parseFloat(targetProposal.admin_discount_monthly || 0);
  const discO = parseFloat(targetProposal.admin_discount_onetime || 0);
  const finM  = rawM * (1 - discM / 100);
  const finO  = rawO * (1 - discO / 100);

  res.render('client/proposal-detail', {
    lead: viewerLead,
    proposal: { ...targetProposal, items },
    actions,
    currentToken: token,
    panelUrl: `/proposta/painel/${token}`,
    totals: { rawM, rawO, discM, discO, finM, finO }
  });
});

// ── API: Solicitar Nova Proposta (pelo painel do cliente) ─────────────────────
router.post('/solicitar-nova', async (req, res) => {
  const { lead_id, servicos, contexto, budget } = req.body;

  if (!lead_id || !servicos || !servicos.trim()) {
    return res.status(400).json({ error: 'Informe os serviços de interesse.' });
  }

  const lead = db.getLeadById(parseInt(lead_id));
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado.' });

  const msg = [
    `Serviços de interesse: ${servicos.trim()}`,
    contexto && contexto.trim() ? `Objetivo/Contexto: ${contexto.trim()}` : null,
    budget   && budget.trim()   ? `Orçamento estimado: ${budget.trim()}` : null,
  ].filter(Boolean).join('\n');

  try {
    // Notify admin
    await emailService.sendAdminNotification({
      subject: `[Nova Solicitação] ${lead.name}${lead.company_name ? ' — ' + lead.company_name : ''}`,
      html: `
        <h2>Nova Solicitação de Proposta</h2>
        <p><strong>Lead:</strong> ${lead.name} (${lead.email || 'sem e-mail'})</p>
        ${lead.company_name ? `<p><strong>Empresa:</strong> ${lead.company_name}</p>` : ''}
        <hr>
        <pre style="background:#f8f9fa;padding:1rem;border-radius:6px;white-space:pre-wrap">${msg}</pre>
        <p style="margin-top:1rem">
          <a href="${process.env.BASE_URL || 'http://localhost:3000'}/admin/leads/${lead.id}/proposals"
             style="background:#E91E63;color:#fff;padding:0.6rem 1.2rem;border-radius:6px;text-decoration:none;font-weight:700">
            Ver Lead no Admin
          </a>
        </p>
      `
    });
  } catch (e) {
    console.error('[solicitar-nova] email error:', e.message);
    // non-fatal — still return success
  }

  return res.json({ success: true });
});

module.exports = router;
