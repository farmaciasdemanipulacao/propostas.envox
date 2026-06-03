const express = require('express');
const router = express.Router();
const db = require('../database');
const { openProposal, trackSlide, closeProposal } = require('../services/tracking');
const { calculateInterestLevel, getInterestLabel } = require('../services/interest');
const { getInviteMessage, getFollowupMessage, buildWhatsAppLink, countInvitesByType } = require('../services/invites');
const { sendCustomPlanAlert } = require('../services/whatsapp');

// ══════════════════════════════════════════════════════════
// TRACKING
// ══════════════════════════════════════════════════════════

// POST /api/track/open
// Aceita { token, lead_id } — token é da proposta, lead_id é o lead que está acessando
router.post('/open', (req, res) => {
  const { token, lead_id } = req.body;
  if (!token) return res.status(400).json({ error: 'Token obrigatório' });

  // Resolver lead: por lead_id (novo padrão) ou fallback getLeadByToken (legado)
  let lead = null;
  if (lead_id) {
    lead = db.getLeadById(parseInt(lead_id));
  }
  if (!lead) {
    // Fallback legado: token era do lead em versões antigas
    lead = db.getLeadByToken(token);
  }
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

  // Resolver proposta pelo token
  const proposal = db.getProposalByToken(token);

  try {
    const sessionId = db.createSession(lead.id, proposal ? proposal.id : null);
    db.logEvent(lead.id, sessionId, 'proposal_opened', { message: 'Abriu a proposta' }, proposal ? proposal.id : null);
    res.json({ success: true, sessionId });
  } catch (err) {
    console.error('Track open error:', err);
    res.status(500).json({ error: 'Erro ao registrar abertura' });
  }
});

// POST /api/track/slide
// Aceita { token, lead_id, sessionId, slideNumber, duration, isRevisit }
router.post('/slide', (req, res) => {
  const { token, lead_id, sessionId, slideNumber, duration, isRevisit } = req.body;
  if (!token || !sessionId || !slideNumber) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  // Resolver lead
  let lead = null;
  if (lead_id) {
    lead = db.getLeadById(parseInt(lead_id));
  }
  if (!lead) {
    lead = db.getLeadByToken(token);
  }
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

  try {
    trackSlide(parseInt(sessionId), lead.id, parseInt(slideNumber), parseFloat(duration) || 0, !!isRevisit);
    res.json({ success: true });
  } catch (err) {
    console.error('Track slide error:', err);
    res.status(500).json({ error: 'Erro ao registrar slide' });
  }
});

// POST /api/track/close
// Aceita { token, lead_id, sessionId, totalDuration }
router.post('/close', async (req, res) => {
  const { token, lead_id, sessionId, totalDuration } = req.body;
  if (!token || !sessionId) return res.status(400).json({ error: 'Dados incompletos' });

  // Resolver lead
  let lead = null;
  if (lead_id) {
    lead = db.getLeadById(parseInt(lead_id));
  }
  if (!lead) {
    lead = db.getLeadByToken(token);
  }
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

  try {
    await closeProposal(parseInt(sessionId), lead.id, parseInt(totalDuration) || 0);
    res.json({ success: true });
  } catch (err) {
    console.error('Track close error:', err);
    res.status(500).json({ error: 'Erro ao registrar fechamento' });
  }
});

// ══════════════════════════════════════════════════════════
// ADMIN LEADS
// ══════════════════════════════════════════════════════════

router.get('/admin/leads', (req, res) => {
  try { res.json(db.getAllLeads()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/admin/leads/:id', (req, res) => {
  try {
    const stats = db.getLeadStats(req.params.id);
    if (!stats) return res.status(404).json({ error: 'Lead não encontrado' });
    const interestLevel = calculateInterestLevel({
      totalDuration: stats.totalDuration,
      totalSlidesSeen: stats.totalSlidesSeen,
      totalAccesses: stats.totalAccesses,
      slideStats: stats.slideStats
    });
    res.json({ ...stats, interestLevel });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/leads', (req, res) => {
  const { name, whatsapp, email } = req.body;
  if (!name || !whatsapp || !email)
    return res.status(400).json({ error: 'Campos obrigatórios: name, whatsapp, email' });
  const { v4: uuidv4 } = require('uuid');
  const token = uuidv4().replace(/-/g, '').substring(0, 12);
  try {
    const id = db.createLead(name, whatsapp.replace(/\D/g, ''), email, token);
    res.json({ success: true, lead: db.getLeadById(id) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/admin/leads/:id/events', (req, res) => {
  try { res.json(db.getEventLog(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════
// CONVITES E FOLLOW-UPS
// ══════════════════════════════════════════════════════════

// GET /api/admin/leads/:id/invite — gerar link de convite
router.get('/admin/leads/:id/invite', (req, res) => {
  try {
    const lead = db.getLeadById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const invites = db.getInvitesByLead(lead.id);
    const inviteCount = invites.filter(i => i.invite_type === 'invite').length;

    const message = getInviteMessage(lead, baseUrl, inviteCount);
    const waLink = buildWhatsAppLink(lead.whatsapp, message);

    // Log do convite
    db.saveInvite(lead.id, 'invite', inviteCount % 10, message);

    res.json({ success: true, message, waLink, inviteCount: inviteCount + 1 });
  } catch (err) {
    console.error('Invite error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/leads/:id/followup/:category — gerar link de follow-up
router.get('/admin/leads/:id/followup/:category', (req, res) => {
  try {
    const lead = db.getLeadById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
    const { category } = req.params;
    if (!['article', 'result', 'urgency'].includes(category))
      return res.status(400).json({ error: 'Categoria inválida' });

    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const invites = db.getInvitesByLead(lead.id);
    const count = invites.filter(i => i.invite_type === `followup_${category}`).length;

    const message = getFollowupMessage(lead, baseUrl, category, count);
    const waLink = buildWhatsAppLink(lead.whatsapp, message);

    db.saveInvite(lead.id, `followup_${category}`, count % 6, message);

    res.json({ success: true, message, waLink, count: count + 1 });
  } catch (err) {
    console.error('Followup error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/leads/:id/invites — histórico
router.get('/admin/leads/:id/invites', (req, res) => {
  try {
    const invites = db.getInvitesByLead(req.params.id);
    res.json(invites);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════
// PLANOS CUSTOMIZADOS
// ══════════════════════════════════════════════════════════

// POST /api/custom-plan/save — salvar plano montado pelo lead
router.post('/custom-plan/save', async (req, res) => {
  const { token, sessionId, selections, monthlyTotal, onetimeTotal } = req.body;
  if (!token) return res.status(400).json({ error: 'Token obrigatório' });

  const lead = db.getLeadByToken(token);
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

  try {
    const planId = db.saveCustomPlan(lead.id, sessionId || null, selections || [], monthlyTotal || 0, onetimeTotal || 0);
    db.logEvent(lead.id, sessionId || null, 'custom_plan_saved', {
      message: 'Montou plano customizado',
      monthly: monthlyTotal,
      onetime: onetimeTotal,
      itemCount: Array.isArray(selections) ? selections.length : 0
    });
    res.json({ success: true, planId });
  } catch (err) {
    console.error('Save custom plan error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/custom-plan/send — enviar plano via WhatsApp (confirmar envio)
router.post('/custom-plan/send', async (req, res) => {
  const { token, planId, selections, monthlyTotal, onetimeTotal } = req.body;
  if (!token) return res.status(400).json({ error: 'Token obrigatório' });

  const lead = db.getLeadByToken(token);
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

  try {
    if (planId) db.markCustomPlanSent(parseInt(planId));

    db.logEvent(lead.id, null, 'custom_plan_sent', {
      message: 'Enviou plano customizado pelo WhatsApp',
      monthly: monthlyTotal,
      onetime: onetimeTotal
    });

    // Alerta CallMeBot
    const selArr = Array.isArray(selections) ? selections : [];
    sendCustomPlanAlert(lead, selArr, monthlyTotal || 0, onetimeTotal || 0)
      .catch(err => console.error('Custom plan alert error:', err));

    res.json({ success: true });
  } catch (err) {
    console.error('Send custom plan error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/leads/:id/custom-plans — planos do lead
router.get('/admin/leads/:id/custom-plans', (req, res) => {
  try { res.json(db.getCustomPlansByLead(req.params.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
