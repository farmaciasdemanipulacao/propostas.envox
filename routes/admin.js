const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');
const { calculateInterestLevel, getInterestLabel } = require('../services/interest');
const { sendWhatsAppAlert, buildAlertData } = require('../services/whatsapp');
const { getInviteMessage, getFollowupMessage, buildWhatsAppLink } = require('../services/invites');
const emailService = require('../services/email');

// ══ LOGIN ════════════════════════════════════════════════
router.get('/login', (req, res) => {
  if (req.session && req.session.isAdmin) return res.redirect('/admin');
  res.render('admin/login', { error: null });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'envox2025';
  if (username === 'admin' && password === adminPassword) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  res.render('admin/login', { error: 'Usuário ou senha incorretos.' });
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// ══ EMAIL TEST ════════════════════════════════════════════
router.get('/email-test', requireAdmin, async (req, res) => {
  const verify = await emailService.verifyConnection();
  return res.json({
    configured: emailService.isConfigured(),
    smtp_verify: verify,
    config: {
      host: process.env.EMAIL_HOST || '(não definido)',
      port: process.env.EMAIL_PORT || '(não definido)',
      user: process.env.EMAIL_USER || '(não definido)',
      pass: process.env.EMAIL_PASS ? '✓ definido' : '✗ não definido',
      from: process.env.EMAIL_FROM || '(não definido)',
    }
  });
});

router.post('/email-test', requireAdmin, async (req, res) => {
  const to = (req.body.to || '').trim();
  if (!to || !to.includes('@')) return res.json({ ok: false, error: 'Email inválido' });
  const result = await emailService.sendTestEmail(to);
  return res.json(result);
});

// ══ DASHBOARD ═════════════════════════════════════════════
router.get('/', requireAdmin, (req, res) => {
  const leads = db.getAllLeads();
  const leadsWithInterest = leads.map(lead => {
    const stats = db.getLeadStats(lead.id);
    let interestLevel = 0;
    let interestInfo = { label: 'N/A', color: 'secondary' };
    if (stats && lead.total_accesses > 0) {
      interestLevel = calculateInterestLevel({
        totalDuration: stats.totalDuration,
        totalSlidesSeen: stats.totalSlidesSeen,
        totalAccesses: stats.totalAccesses,
        slideStats: stats.slideStats
      });
      interestInfo = getInterestLabel(interestLevel);
    }
    const invites = db.getInvitesByLead(lead.id);
    const inviteCount = invites.filter(i => i.invite_type === 'invite').length;
    const followupCount = invites.filter(i => i.invite_type.startsWith('followup_')).length;
    return { ...lead, interestLevel, interestInfo, inviteCount, followupCount };
  });
  const planejamentos = db.getAllPlanejamentos();
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  res.render('admin/dashboard', {
    leads: leadsWithInterest, planejamentos, baseUrl,
    success: req.query.success, error: req.query.error
  });
});

// ══ NOVO LEAD ══════════════════════════════════════════════
router.get('/leads/new', requireAdmin, (req, res) => {
  res.render('admin/new-lead', { error: null, success: null });
});

router.post('/leads', requireAdmin, (req, res) => {
  const { name, whatsapp, email, company_name, cargo } = req.body;
  if (!name || !whatsapp || !email || !company_name) {
    return res.render('admin/new-lead', {
      error: 'Nome, empresa, WhatsApp e email são obrigatórios.', success: null
    });
  }
  try {
    const leadId = db.createLead(name, whatsapp, email, company_name.trim(), (cargo || '').trim());
    return res.redirect(`/admin/proposals/new?lead_id=${leadId}&success=Lead+${encodeURIComponent(name)}+cadastrado!`);
  } catch (err) {
    console.error('Error creating lead:', err);
    return res.render('admin/new-lead', { error: 'Erro ao cadastrar lead. Email já existe?', success: null });
  }
});

// ══ DETALHE DO LEAD ════════════════════════════════════════
router.get('/leads/:id', requireAdmin, (req, res) => {
  const stats = db.getLeadStats(req.params.id);
  if (!stats) return res.redirect('/admin?error=Lead+não+encontrado');

  const interestLevel = stats.totalAccesses > 0
    ? calculateInterestLevel({
        totalDuration: stats.totalDuration,
        totalSlidesSeen: stats.totalSlidesSeen,
        totalAccesses: stats.totalAccesses,
        slideStats: stats.slideStats
      })
    : 0;
  const interestInfo = getInterestLabel(interestLevel);

  // Para chart individual deste lead
  const slideLabels = [];
  const slideDurations = [];
  const slideColors = [];
  for (let i = 1; i <= 12; i++) {
    const slideStat = stats.slideStats.find(s => s.slide_number === i);
    const dur = slideStat ? Math.round(slideStat.total_duration || 0) : 0;
    slideLabels.push(`Slide ${i}`);
    slideDurations.push(dur);
    if (dur === 0) slideColors.push('#e0e0e0');
    else if (dur < 20) slideColors.push('#66bb6a');
    else if (dur < 60) slideColors.push('#ffa726');
    else slideColors.push('#e91e63');
  }

  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  const eventLog = stats.eventLog.map(ev => {
    let details = {};
    try { details = ev.details ? JSON.parse(ev.details) : {}; } catch(e) {}
    return { ...ev, parsedDetails: details };
  });
  const invites = db.getInvitesByLead(req.params.id);
  const inviteHistory = invites.filter(i => i.invite_type === 'invite');
  const followupHistory = invites.filter(i => i.invite_type.startsWith('followup_'));
  const nextInviteIdx = inviteHistory.length;
  const nextInviteMsg = getInviteMessage(stats.lead, baseUrl, nextInviteIdx);

  // Propostas vinculadas
  const linkedProposals = db.getProposalsByLead(req.params.id);

  res.render('admin/lead-detail', {
    stats, interestLevel, interestInfo,
    slideLabels: JSON.stringify(slideLabels),
    slideDurations: JSON.stringify(slideDurations),
    slideColors: JSON.stringify(slideColors),
    baseUrl, eventLog, inviteHistory, followupHistory, nextInviteMsg,
    linkedProposals,
    success: req.query.success, error: req.query.error
  });
});

// ══ ATUALIZAR LEAD ═════════════════════════════════════════
router.get('/leads/:id/edit', requireAdmin, (req, res) => {
  const lead = db.getLeadById(req.params.id);
  if (!lead) return res.redirect('/admin/leads?error=Lead+não+encontrado');
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  res.render('admin/leads/edit', { lead, baseUrl, error: null, success: null });
});

router.post('/leads/:id/edit', requireAdmin, (req, res) => {
  const { name, whatsapp, email } = req.body;
  if (!name || !whatsapp || !email) {
    const lead = db.getLeadById(req.params.id);
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    return res.render('admin/leads/edit', { lead, baseUrl, error: 'Todos os campos são obrigatórios.', success: null });
  }
  try {
    db.updateLead(parseInt(req.params.id), name, whatsapp, email);
    return res.redirect(`/admin/leads/${req.params.id}/edit?success=Lead+atualizado!`);
  } catch (err) {
    const lead = db.getLeadById(req.params.id);
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    return res.render('admin/leads/edit', { lead, baseUrl, error: 'Erro: ' + err.message, success: null });
  }
});

router.post('/leads/:id/company', requireAdmin, (req, res) => {
  const { company_name, cargo } = req.body;
  db.updateLeadCompany(req.params.id, company_name || '', cargo || '');
  return res.redirect(`/admin/leads/${req.params.id}?success=Empresa+atualizada`);
});

router.post('/leads/:id/delete', requireAdmin, (req, res) => {
  try {
    db.deleteLead(parseInt(req.params.id));
    return res.redirect('/admin/leads?success=Lead+excluído.');
  } catch (err) {
    return res.redirect(`/admin/leads?error=Erro:+${encodeURIComponent(err.message)}`);
  }
});

// ══ LISTA DE LEADS ═════════════════════════════════════════
router.get('/leads', requireAdmin, (req, res) => {
  const leads = db.getAllLeads();
  res.render('admin/leads/index', {
    leads, success: req.query.success || null, error: req.query.error || null
  });
});

// ══ REENVIAR ALERTA WHATSAPP ═══════════════════════════════
router.post('/leads/:id/resend-alert', requireAdmin, async (req, res) => {
  const stats = db.getLeadStats(req.params.id);
  if (!stats) return res.redirect(`/admin?error=Lead+não+encontrado`);
  const interestLevel = calculateInterestLevel({
    totalDuration: stats.totalDuration,
    totalSlidesSeen: stats.totalSlidesSeen,
    totalAccesses: stats.totalAccesses,
    slideStats: stats.slideStats
  });
  const alertData = buildAlertData(stats.lead, stats.slideStats, stats.totalDuration, stats.totalSlidesSeen, interestLevel);
  const sent = await sendWhatsAppAlert(alertData);
  if (sent) return res.redirect(`/admin/leads/${req.params.id}?success=Alerta+reenviado!`);
  return res.redirect(`/admin/leads/${req.params.id}?error=Falha+ao+enviar+alerta.`);
});

// ══ CONVITE VIA WHATSAPP ═══════════════════════════════════
router.post('/leads/:id/invite', requireAdmin, (req, res) => {
  const lead = db.getLeadById(req.params.id);
  if (!lead) return res.redirect('/admin?error=Lead+não+encontrado');
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  const invites = db.getInvitesByLead(lead.id);
  const inviteCount = invites.filter(i => i.invite_type === 'invite').length;
  const message = getInviteMessage(lead, baseUrl, inviteCount);
  db.saveInvite(lead.id, 'invite', inviteCount % 10, message);
  db.logEvent(lead.id, null, 'invite_sent', { message: message.substring(0, 100) });
  res.redirect(buildWhatsAppLink(lead.whatsapp, message));
});

// ══ FOLLOW-UP VIA WHATSAPP ═════════════════════════════════
router.post('/leads/:id/followup', requireAdmin, (req, res) => {
  const lead = db.getLeadById(req.params.id);
  if (!lead) return res.redirect('/admin?error=Lead+não+encontrado');
  const { category } = req.body;
  if (!['article', 'result', 'urgency'].includes(category)) {
    return res.redirect(`/admin/leads/${req.params.id}?error=Categoria+inválida`);
  }
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  const invites = db.getInvitesByLead(lead.id);
  const count = invites.filter(i => i.invite_type === `followup_${category}`).length;
  const message = getFollowupMessage(lead, baseUrl, category, count);
  db.saveInvite(lead.id, `followup_${category}`, count % 6, message);
  db.logEvent(lead.id, null, 'followup_sent', { category, message: message.substring(0, 100) });
  res.redirect(buildWhatsAppLink(lead.whatsapp, message));
});

// ══════════════════════════════════════════════════════════
// PROPOSALS — N:N
// ══════════════════════════════════════════════════════════

// GET /admin/proposals — lista de propostas
router.get('/proposals', requireAdmin, (req, res) => {
  const proposals = db.getAllProposals();
  const enriched = proposals.map(p => {
    const latestAction = db.getLatestProposalAction(p.id);
    const items = db.getProposalItems(p.id);
    return {
      ...p,
      items_count: items.length,
      latest_action: latestAction ? latestAction.action_type : null
    };
  });
  res.render('admin/proposals/index', {
    proposals: enriched,
    success: req.query.success || null,
    error: req.query.error || null
  });
});

// GET /admin/proposals/new — formulário de criação
router.get('/proposals/new', requireAdmin, (req, res) => {
  const leads = db.getAllLeads();
  const services = db.getAllServices(false);
  const selectedLeadId = req.query.lead_id ? parseInt(req.query.lead_id) : null;
  res.render('admin/proposals/new', {
    leads, services, selectedLeadId,
    error: req.query.error || null,
    success: req.query.success || null,
    formData: null
  });
});

// POST /admin/proposals — criar proposta + vincular lead(s)
router.post('/proposals', requireAdmin, async (req, res) => {
  const { lead_ids, proposal_items, proposal_description, proposal_scope, proposal_timeline, proposal_mode } = req.body;
  const leads = db.getAllLeads();
  const services = db.getAllServices(false);

  // Normalizar lead_ids (pode vir como string ou array)
  const rawIds = Array.isArray(lead_ids) ? lead_ids : (lead_ids ? [lead_ids] : []);
  const leadIdList = rawIds.map(id => parseInt(id)).filter(id => !isNaN(id) && id > 0);

  if (leadIdList.length === 0) {
    return res.render('admin/proposals/new', {
      leads, services, selectedLeadId: null,
      error: 'Selecione pelo menos 1 lead.', success: null, formData: req.body
    });
  }

  // Verificar que todos os leads existem
  const validLeads = leadIdList.map(id => db.getLeadById(id)).filter(Boolean);
  if (validLeads.length === 0) {
    return res.render('admin/proposals/new', {
      leads, services, selectedLeadId: null,
      error: 'Lead(s) não encontrados.', success: null, formData: req.body
    });
  }

  let items = [];
  try { items = proposal_items ? JSON.parse(proposal_items) : []; } catch(e) { items = []; }

  try {
    // 1. Gerar token e criar proposta
    const token = uuidv4().replace(/-/g, '').substring(0, 12);
    const proposalId = db.createProposal(token);

    // 2. Vincular leads (primeiro = primário)
    validLeads.forEach((lead, idx) => {
      db.linkLeadToProposal(proposalId, lead.id, idx === 0);
    });

    // 3. Salvar itens e conteúdo
    db.saveProposalItems(proposalId, items);
    db.updateProposalContent(proposalId, proposal_description || '', proposal_scope || '', proposal_timeline || '');
    const mode = ['ready', 'build', 'both'].includes(proposal_mode) ? proposal_mode : 'both';
    db.updateProposalMode(proposalId, mode);

    // 4. Marcar como enviada e enviar email para CADA lead vinculado
    db.markProposalSent(proposalId);
    const baseUrl = (process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const propLink = `${baseUrl}/proposta/${token}`;

    for (const lead of validLeads) {
      emailService.sendProposalToLead(lead, propLink).then(result => {
        if (result.ok) console.log(`[Proposals] Email enviado para ${lead.email}`);
        else if (!result.skipped) console.warn(`[Proposals] Email falhou para ${lead.email}:`, result.error);
      }).catch(e => console.warn('[Proposals] Email exception:', e.message));
    }

    db.logEvent(validLeads[0].id, null, 'proposal_created', {
      proposal_id: proposalId, mode, items_count: items.length,
      leads: validLeads.map(l => l.id)
    }, proposalId);

    return res.redirect(`/admin/proposals/${proposalId}/edit?success=Proposta+criada+com+sucesso!`);
  } catch (err) {
    console.error('[Proposals] Error:', err);
    return res.render('admin/proposals/new', {
      leads, services, selectedLeadId: leadIdList[0] || null,
      error: 'Erro ao salvar: ' + err.message, success: null, formData: req.body
    });
  }
});

// GET /admin/proposals/:proposalId/edit — editar proposta + relatório
router.get('/proposals/:proposalId/edit', requireAdmin, (req, res) => {
  const proposalId = parseInt(req.params.proposalId);
  const proposal = db.getProposalWithLeads(proposalId);
  if (!proposal) return res.redirect('/admin/proposals?error=Proposta+não+encontrada');

  const services = db.getAllServices(false);
  const proposalItems = db.getProposalItems(proposalId);
  const allLeads = db.getAllLeads();
  const proposalActions = db.getProposalActionsByProposal(proposalId);

  // Stats agregados (todos os leads vinculados)
  const stats = db.getProposalStats(proposalId);

  // Preparar dados de chart para o "Todos" (agregado)
  const slideLabels = [];
  const slideDurationsAll = [];
  const slideColorsAll = [];
  for (let i = 1; i <= 12; i++) {
    const slideStat = stats.slideStats.find(s => s.slide_number === i);
    const dur = slideStat ? Math.round(slideStat.total_duration || 0) : 0;
    slideLabels.push(`Slide ${i}`);
    slideDurationsAll.push(dur);
    if (dur === 0) slideColorsAll.push('#e0e0e0');
    else if (dur < 20) slideColorsAll.push('#66bb6a');
    else if (dur < 60) slideColorsAll.push('#ffa726');
    else slideColorsAll.push('#e91e63');
  }

  // Stats individuais por lead (para o seletor — inclui viewCounts e métricas)
  const perLeadStats = proposal.leads.map(lead => {
    const individualSlideStats = db.getLeadSlideStatsForProposal(lead.id, proposalId);
    const durations = [], colors = [], viewCounts = [];
    let totalDur = 0, slidesSeen = 0, revisits = 0;
    for (let i = 1; i <= 12; i++) {
      const ss = individualSlideStats.find(s => s.slide_number === i);
      const dur = ss ? Math.round(ss.total_duration || 0) : 0;
      durations.push(dur);
      viewCounts.push(ss ? (ss.view_count || 0) : 0);
      if (dur === 0) colors.push('#e0e0e0');
      else if (dur < 20) colors.push('#66bb6a');
      else if (dur < 60) colors.push('#ffa726');
      else colors.push('#e91e63');
      if (dur > 0) slidesSeen++;
      totalDur += dur;
      if (ss && ss.revisit_count > 0) revisits++;
    }
    // Acessos individuais: contar sessões do lead para esta proposta
    const leadSessions = (stats.sessions || []).filter(s => s.lead_id === lead.id);
    const accesses = leadSessions.length;
    return { lead_id: lead.id, lead_name: lead.name, durations, colors, viewCounts, accesses, totalDur, slidesSeen, revisits };
  });

  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  const eventLog = (stats.eventLog || []).map(ev => {
    let details = {};
    try { details = ev.details ? JSON.parse(ev.details) : {}; } catch(e) {}
    return { ...ev, parsedDetails: details };
  });

  res.render('admin/proposals/edit', {
    proposal, services, proposalItems, allLeads,
    proposalActions,
    stats,
    slideLabels: JSON.stringify(slideLabels),
    slideDurationsAll: JSON.stringify(slideDurationsAll),
    slideColorsAll: JSON.stringify(slideColorsAll),
    perLeadStats: JSON.stringify(perLeadStats),
    baseUrl,
    eventLog,
    success: req.query.success || null,
    error: req.query.error || null
  });
});

// GET /admin/proposals/:proposalId/heat — página de relatório de calor/engajamento
router.get('/proposals/:proposalId/heat', requireAdmin, (req, res) => {
  const proposalId = parseInt(req.params.proposalId);
  const proposal = db.getProposalWithLeads(proposalId);
  if (!proposal) return res.redirect('/admin/proposals?error=Proposta+não+encontrada');

  // Stats agregados (todos os leads vinculados)
  const stats = db.getProposalStats(proposalId);

  // Preparar dados de chart para o "Todos" (agregado)
  const slideLabels = [];
  const slideDurationsAll = [];
  const slideColorsAll = [];
  for (let i = 1; i <= 12; i++) {
    const slideStat = stats.slideStats.find(s => s.slide_number === i);
    const dur = slideStat ? Math.round(slideStat.total_duration || 0) : 0;
    slideLabels.push(`Slide ${i}`);
    slideDurationsAll.push(dur);
    if (dur === 0) slideColorsAll.push('#e0e0e0');
    else if (dur < 20) slideColorsAll.push('#66bb6a');
    else if (dur < 60) slideColorsAll.push('#ffa726');
    else slideColorsAll.push('#e91e63');
  }

  // Stats individuais por lead
  const perLeadStats = proposal.leads.map(lead => {
    const individualSlideStats = db.getLeadSlideStatsForProposal(lead.id, proposalId);
    const durations = [], colors = [], viewCounts = [];
    let totalDur = 0, slidesSeen = 0, revisits = 0;
    for (let i = 1; i <= 12; i++) {
      const ss = individualSlideStats.find(s => s.slide_number === i);
      const dur = ss ? Math.round(ss.total_duration || 0) : 0;
      durations.push(dur);
      viewCounts.push(ss ? (ss.view_count || 0) : 0);
      if (dur === 0) colors.push('#e0e0e0');
      else if (dur < 20) colors.push('#66bb6a');
      else if (dur < 60) colors.push('#ffa726');
      else colors.push('#e91e63');
      if (dur > 0) slidesSeen++;
      totalDur += dur;
      if (ss && ss.revisit_count > 0) revisits++;
    }
    const leadSessions = (stats.sessions || []).filter(s => s.lead_id === lead.id);
    const accesses = leadSessions.length;
    return { lead_id: lead.id, lead_name: lead.name, durations, colors, viewCounts, accesses, totalDur, slidesSeen, revisits };
  });

  const eventLog = (stats.eventLog || []).map(ev => {
    let details = {};
    try { details = ev.details ? JSON.parse(ev.details) : {}; } catch(e) {}
    return { ...ev, parsedDetails: details };
  });

  res.render('admin/proposals/heat', {
    proposal,
    stats,
    slideLabels: JSON.stringify(slideLabels),
    slideDurationsAll: JSON.stringify(slideDurationsAll),
    slideColorsAll: JSON.stringify(slideColorsAll),
    perLeadStats: JSON.stringify(perLeadStats),
    eventLog
  });
});

// POST /admin/proposals/:proposalId/edit — salvar edições
router.post('/proposals/:proposalId/edit', requireAdmin, (req, res) => {
  const proposalId = parseInt(req.params.proposalId);
  const { proposal_items, proposal_description, proposal_scope, proposal_timeline, proposal_mode } = req.body;
  let items = [];
  try { items = proposal_items ? JSON.parse(proposal_items) : []; } catch(e) {}
  try {
    db.saveProposalItems(proposalId, items);
    db.updateProposalContent(proposalId, proposal_description || '', proposal_scope || '', proposal_timeline || '');
    const mode = ['ready', 'build', 'both'].includes(proposal_mode) ? proposal_mode : 'both';
    db.updateProposalMode(proposalId, mode);
    return res.redirect(`/admin/proposals/${proposalId}/edit?success=Proposta+atualizada!`);
  } catch (err) {
    return res.redirect(`/admin/proposals/${proposalId}/edit?error=Erro:+${encodeURIComponent(err.message)}`);
  }
});

// POST /admin/proposals/:proposalId/link-lead — vincular lead adicional
router.post('/proposals/:proposalId/link-lead', requireAdmin, (req, res) => {
  const proposalId = parseInt(req.params.proposalId);
  const leadId = parseInt(req.body.lead_id);
  if (!leadId) return res.redirect(`/admin/proposals/${proposalId}/edit?error=Lead+inválido`);
  const lead = db.getLeadById(leadId);
  if (!lead) return res.redirect(`/admin/proposals/${proposalId}/edit?error=Lead+não+encontrado`);
  db.linkLeadToProposal(proposalId, leadId, false);
  return res.redirect(`/admin/proposals/${proposalId}/edit?success=Lead+${encodeURIComponent(lead.name)}+vinculado!`);
});

// POST /admin/proposals/:proposalId/unlink-lead — desvincular lead
router.post('/proposals/:proposalId/unlink-lead', requireAdmin, (req, res) => {
  const proposalId = parseInt(req.params.proposalId);
  const leadId = parseInt(req.body.lead_id);
  // Garantir que pelo menos 1 lead fica vinculado
  const linked = db.getLeadsByProposal(proposalId);
  if (linked.length <= 1) {
    return res.redirect(`/admin/proposals/${proposalId}/edit?error=A+proposta+precisa+de+pelo+menos+1+lead.`);
  }
  db.unlinkLeadFromProposal(proposalId, leadId);
  return res.redirect(`/admin/proposals/${proposalId}/edit?success=Lead+desvinculado.`);
});

// POST /admin/proposals/:proposalId/resend-emails — reenviar email para todos os leads
router.post('/proposals/:proposalId/resend-emails', requireAdmin, async (req, res) => {
  const proposalId = parseInt(req.params.proposalId);
  const proposal = db.getProposalWithLeads(proposalId);
  if (!proposal) return res.redirect(`/admin/proposals?error=Proposta+não+encontrada`);
  const baseUrl = (process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const propLink = `${baseUrl}/proposta/${proposal.token}`;
  for (const lead of proposal.leads) {
    await emailService.sendProposalToLead(lead, propLink).catch(e => console.error('[ResendEmail]', e.message));
  }
  return res.redirect(`/admin/proposals/${proposalId}/edit?success=Emails+reenviados+para+${proposal.leads.length}+lead(s)!`);
});

// GET /admin/proposals/preview — preview da proposta (admin view)
router.get('/proposals/preview', requireAdmin, (req, res) => {
  const proposalId = parseInt(req.query.proposal_id);
  if (!proposalId) return res.redirect('/admin/proposals/new?error=Proposta+inválida');
  const proposal = db.getProposalByTokenWithLeads
    ? null
    : db.getProposalWithLeads(proposalId);
  const p = db.getProposalById(proposalId);
  if (!p || !p.token) return res.redirect('/admin/proposals/new?error=Proposta+não+encontrada');
  if (!req.session.authenticatedTokens) req.session.authenticatedTokens = [];
  if (!req.session.authenticatedTokens.includes(p.token)) {
    req.session.authenticatedTokens.push(p.token);
  }
  // Admin preview: usa o primeiro lead como "viewer"
  const leads = db.getLeadsByProposal(proposalId);
  if (leads.length > 0 && !req.session.proposalLeadOverride) {
    req.session.proposalLeadOverride = req.session.proposalLeadOverride || {};
    req.session.proposalLeadOverride[p.token] = leads[0].id;
  }
  res.redirect(`/proposta/${p.token}/view`);
});

// GET /admin/proposals/:proposalId/view — visualizador embedded no painel admin
router.get('/proposals/:proposalId/view', requireAdmin, (req, res) => {
  const proposalId = parseInt(req.params.proposalId);
  const proposal = db.getProposalWithLeads(proposalId);
  if (!proposal) return res.redirect('/admin/proposals?error=Proposta+não+encontrada');

  const leads = proposal.leads || [];
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

  // Autenticar token na sessão do admin para que o iframe não peça login
  if (!req.session.authenticatedTokens) req.session.authenticatedTokens = [];
  if (!req.session.authenticatedTokens.includes(proposal.token)) {
    req.session.authenticatedTokens.push(proposal.token);
  }

  // Lead selecionado para visualizar (query param ou primário)
  const selectedLeadId = req.query.lead_id ? parseInt(req.query.lead_id) : null;
  const viewerLead = selectedLeadId
    ? leads.find(l => l.id === selectedLeadId)
    : (leads.find(l => l.is_primary) || leads[0]);

  if (viewerLead) {
    req.session.proposalLeadOverride = req.session.proposalLeadOverride || {};
    req.session.proposalLeadOverride[proposal.token] = viewerLead.id;
  }

  // Stats resumidos para o painel lateral
  const stats = db.getProposalStats(proposalId);

  res.render('admin/proposals/view', {
    proposal,
    leads,
    viewerLead: viewerLead || null,
    stats,
    baseUrl,
    selectedLeadId: viewerLead ? viewerLead.id : null,
    success: req.query.success || null,
    error: req.query.error || null
  });
});

// POST /admin/proposals/:proposalId/archive
router.post('/proposals/:proposalId/archive', requireAdmin, (req, res) => {
  const archived = parseInt(req.body.archived) || 0;
  try {
    db.archiveProposal(parseInt(req.params.proposalId), archived === 1);
    const msg = archived ? 'Proposta+arquivada.' : 'Proposta+reativada.';
    return res.redirect(`/admin/proposals?success=${msg}`);
  } catch (err) {
    return res.redirect(`/admin/proposals?error=Erro+ao+arquivar`);
  }
});

// ══ PROPOSAL REQUESTS ══════════════════════════════════════
router.get('/proposal-requests', requireAdmin, (req, res) => {
  const requests = db.getAllProposalRequests ? db.getAllProposalRequests() : [];
  res.render('admin/proposal-requests', {
    requests, success: req.query.success, error: req.query.error
  });
});

router.post('/proposal-requests/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  db.updateProposalRequestStatus(req.params.id, status);
  return res.redirect('/admin/proposal-requests?success=Status+atualizado');
});

module.exports = router;
