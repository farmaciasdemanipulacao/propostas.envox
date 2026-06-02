const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');
const { calculateInterestLevel, getInterestLabel } = require('../services/interest');
const { sendWhatsAppAlert, buildAlertData } = require('../services/whatsapp');
const { getInviteMessage, getFollowupMessage, buildWhatsAppLink } = require('../services/invites');

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

// ══ DASHBOARD ════════════════════════════════════════════
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
    // Contagens de convites
    const invites = db.getInvitesByLead(lead.id);
    const inviteCount = invites.filter(i => i.invite_type === 'invite').length;
    const followupCount = invites.filter(i => i.invite_type.startsWith('followup_')).length;
    return { ...lead, interestLevel, interestInfo, inviteCount, followupCount };
  });

  const planejamentos = db.getAllPlanejamentos();
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

  res.render('admin/dashboard', {
    leads: leadsWithInterest,
    planejamentos,
    baseUrl,
    success: req.query.success,
    error: req.query.error
  });
});

// ══ NOVO LEAD ═════════════════════════════════════════════
router.get('/leads/new', requireAdmin, (req, res) => {
  res.render('admin/new-lead', { error: null, success: null });
});

router.post('/leads', requireAdmin, (req, res) => {
  const { name, whatsapp, email, discount_monthly, discount_onetime, discount_expires } = req.body;
  if (!name || !whatsapp || !email) {
    return res.render('admin/new-lead', { error: 'Todos os campos são obrigatórios.', success: null });
  }
  const token = uuidv4().replace(/-/g, '').substring(0, 12);
  try {
    const leadId = db.createLead(name, whatsapp.replace(/\D/g, ''), email, token);
    // Aplicar desconto e prazo se informados
    if ((discount_monthly || discount_onetime || discount_expires) && leadId) {
      db.updateLeadDiscount(
        leadId,
        parseFloat(discount_monthly) || 0,
        parseFloat(discount_onetime) || 0,
        discount_expires || null
      );
    }
    return res.redirect(`/admin?success=Lead+${encodeURIComponent(name)}+cadastrado+com+sucesso!`);
  } catch (err) {
    console.error('Error creating lead:', err);
    return res.render('admin/new-lead', { error: 'Erro ao cadastrar lead. Tente novamente.', success: null });
  }
});

// ══ DETALHE DO LEAD ═══════════════════════════════════════
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

  // Histórico de convites e follow-ups
  const invites = db.getInvitesByLead(req.params.id);
  const inviteHistory = invites.filter(i => i.invite_type === 'invite');
  const followupHistory = invites.filter(i => i.invite_type.startsWith('followup_'));

  // Próximas mensagens para pré-visualização
  const nextInviteIdx = inviteHistory.length;
  const nextInviteMsg = getInviteMessage(stats.lead, baseUrl, nextInviteIdx);

  res.render('admin/lead-detail', {
    stats,
    interestLevel,
    interestInfo,
    slideLabels: JSON.stringify(slideLabels),
    slideDurations: JSON.stringify(slideDurations),
    slideColors: JSON.stringify(slideColors),
    baseUrl,
    eventLog,
    inviteHistory,
    followupHistory,
    nextInviteMsg,
    success: req.query.success,
    error: req.query.error
  });
});

// ══ ATUALIZAR DESCONTO DO LEAD ════════════════════════════
router.post('/leads/:id/discount', requireAdmin, (req, res) => {
  const { discount_monthly, discount_onetime, discount_expires } = req.body;
  try {
    db.updateLeadDiscount(
      parseInt(req.params.id),
      parseFloat(discount_monthly) || 0,
      parseFloat(discount_onetime) || 0,
      discount_expires || null
    );
    return res.redirect(`/admin/leads/${req.params.id}?success=Condições+especiais+atualizadas!`);
  } catch (err) {
    return res.redirect(`/admin/leads/${req.params.id}?error=Erro+ao+atualizar+desconto`);
  }
});

// ══ REENVIAR ALERTA WHATSAPP ══════════════════════════════
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

  if (sent) {
    return res.redirect(`/admin/leads/${req.params.id}?success=Alerta+WhatsApp+reenviado+com+sucesso!`);
  } else {
    return res.redirect(`/admin/leads/${req.params.id}?error=Falha+ao+enviar+alerta.+Verifique+as+configurações+do+CallMeBot.`);
  }
});

// ══ CONVITE VIA WHATSAPP (rota admin POST → redirect com link WA) ════
router.post('/leads/:id/invite', requireAdmin, (req, res) => {
  const lead = db.getLeadById(req.params.id);
  if (!lead) return res.redirect('/admin?error=Lead+não+encontrado');

  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  const invites = db.getInvitesByLead(lead.id);
  const inviteCount = invites.filter(i => i.invite_type === 'invite').length;

  const message = getInviteMessage(lead, baseUrl, inviteCount);
  db.saveInvite(lead.id, 'invite', inviteCount % 10, message);
  db.logEvent(lead.id, null, 'invite_sent', { message: message.substring(0, 100) });

  // Redirecionar para WhatsApp com a mensagem
  const waLink = buildWhatsAppLink(lead.whatsapp, message);
  res.redirect(waLink);
});

// ══ ADMIN PROPOSALS ══════════════════════════════════════

// GET /admin/proposals/new — render builder form
router.get('/proposals/new', requireAdmin, (req, res) => {
  const leads    = db.getAllLeads();
  const services = db.getAllServices(false); // active only
  const selectedLeadId = req.query.lead_id || null;
  res.render('admin/proposals/new', {
    leads,
    services,
    selectedLeadId,
    error:    req.query.error   || null,
    success:  req.query.success || null,
    formData: null
  });
});

// POST /admin/proposals — save proposal items + content
router.post('/proposals', requireAdmin, (req, res) => {
  const { lead_id, proposal_items, proposal_description, proposal_scope, proposal_timeline } = req.body;

  if (!lead_id) {
    const leads    = db.getAllLeads();
    const services = db.getAllServices(false);
    return res.render('admin/proposals/new', {
      leads, services, selectedLeadId: null,
      error: 'Selecione um lead.',
      success: null,
      formData: req.body
    });
  }

  const leadId = parseInt(lead_id);
  const lead   = db.getLeadById(leadId);
  if (!lead) {
    return res.redirect('/admin/proposals/new?error=Lead+não+encontrado');
  }

  // Parse items
  let items = [];
  try {
    items = proposal_items ? JSON.parse(proposal_items) : [];
  } catch (e) {
    items = [];
  }

  try {
    // Save items (replaces previous)
    db.saveProposalItems(leadId, items);

    // Save content fields
    db.updateLeadProposalContent(
      leadId,
      proposal_description || '',
      proposal_scope       || '',
      proposal_timeline    || ''
    );

    return res.redirect(`/admin/proposals/new?lead_id=${leadId}&success=Proposta+salva+com+sucesso!`);
  } catch (err) {
    console.error('[Proposals] Error saving proposal:', err);
    const leads    = db.getAllLeads();
    const services = db.getAllServices(false);
    return res.render('admin/proposals/new', {
      leads, services, selectedLeadId: leadId,
      error: 'Erro ao salvar proposta: ' + err.message,
      success: null,
      formData: req.body
    });
  }
});

// GET /admin/proposals/preview — redirect to lead's actual proposal view (admin shortcut)
router.get('/proposals/preview', requireAdmin, (req, res) => {
  const leadId = parseInt(req.query.lead_id);
  if (!leadId) return res.redirect('/admin/proposals/new?error=Lead+inválido');
  const lead = db.getLeadById(leadId);
  if (!lead || !lead.token) return res.redirect('/admin/proposals/new?error=Lead+ou+token+não+encontrado');
  // Authenticate admin as this lead temporarily
  if (!req.session.authenticatedTokens) req.session.authenticatedTokens = [];
  if (!req.session.authenticatedTokens.includes(lead.token)) {
    req.session.authenticatedTokens.push(lead.token);
  }
  res.redirect(`/proposta/${lead.token}/view`);
});

// ══ FOLLOW-UP VIA WHATSAPP ════════════════════════════════
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

  const waLink = buildWhatsAppLink(lead.whatsapp, message);
  res.redirect(waLink);
});

module.exports = router;
