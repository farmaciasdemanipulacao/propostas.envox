const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const slides = require('../slides/content');

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
router.post('/action', (req, res) => {
  const { token, lead_id, action_type, comment, counter_value, current_page } = req.body;

  if (!token || !action_type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Verify token belongs to a real lead
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
    return res.json({ success: true, actionId });
  } catch (err) {
    console.error('[ProposalAction] Error:', err);
    return res.status(500).json({ error: 'Failed to save action' });
  }
});

// ── API: Share Proposal (add secondary viewer) ───────────────────────────────
router.post('/share', (req, res) => {
  const { token, lead_id, name, whatsapp, email } = req.body;

  if (!token || !name || !whatsapp || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const lead = db.getLeadByToken(token);
  const resolvedLeadId = lead ? lead.id : parseInt(lead_id);

  if (!resolvedLeadId) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  try {
    const sharedToken = uuidv4().replace(/-/g, '').substring(0, 16);
    const sharedId = db.addSharedLead(
      resolvedLeadId,
      name,
      whatsapp.replace(/\D/g, ''),
      email.trim().toLowerCase(),
      sharedToken
    );
    db.logEvent(resolvedLeadId, null, 'proposal_shared', { shared_with: email, name });

    return res.json({ success: true, sharedId, sharedToken });
  } catch (err) {
    console.error('[ProposalShare] Error:', err);
    return res.status(500).json({ error: 'Failed to share proposal' });
  }
});

module.exports = router;
