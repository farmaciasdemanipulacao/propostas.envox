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
  const { name, whatsapp, email } = req.body;
  if (!name || !whatsapp || !email) {
    return res.render('admin/new-lead', { error: 'Todos os campos são obrigatórios.', success: null });
  }
  const token = uuidv4().replace(/-/g, '').substring(0, 12);
  try {
    db.createLead(name, whatsapp.replace(/\D/g, ''), email, token);
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
