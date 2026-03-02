const express = require('express');
const router = express.Router();
const db = require('../database');
const { openProposal, trackSlide, closeProposal } = require('../services/tracking');
const { calculateInterestLevel, getInterestLabel } = require('../services/interest');

// Middleware para validar lead e sessão
function validateLead(req, res, next) {
  const token = req.body.token || req.query.token;
  if (!token) return res.status(400).json({ error: 'Token obrigatório' });
  
  const lead = db.getLeadByToken(token);
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
  
  req.lead = lead;
  next();
}

// POST /api/track/open — abertura da proposta
router.post('/open', validateLead, (req, res) => {
  try {
    const sessionId = openProposal(req.lead.id);
    res.json({ success: true, sessionId });
  } catch (err) {
    console.error('Track open error:', err);
    res.status(500).json({ error: 'Erro ao registrar abertura' });
  }
});

// POST /api/track/slide — visualização de slide
router.post('/slide', (req, res) => {
  const { token, sessionId, slideNumber, duration, isRevisit } = req.body;
  
  if (!token || !sessionId || !slideNumber) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }
  
  const lead = db.getLeadByToken(token);
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
  
  try {
    trackSlide(
      parseInt(sessionId), 
      lead.id, 
      parseInt(slideNumber), 
      parseFloat(duration) || 0,
      !!isRevisit
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Track slide error:', err);
    res.status(500).json({ error: 'Erro ao registrar slide' });
  }
});

// POST /api/track/close — fechamento da proposta
router.post('/close', async (req, res) => {
  const { token, sessionId, totalDuration } = req.body;
  
  if (!token || !sessionId) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }
  
  const lead = db.getLeadByToken(token);
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
  
  try {
    await closeProposal(
      parseInt(sessionId), 
      lead.id, 
      parseInt(totalDuration) || 0
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Track close error:', err);
    res.status(500).json({ error: 'Erro ao registrar fechamento' });
  }
});

// GET /api/admin/leads — lista todos os leads
router.get('/admin/leads', (req, res) => {
  try {
    const leads = db.getAllLeads();
    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/leads/:id — detalhes de um lead
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/leads — cadastra novo lead
router.post('/admin/leads', (req, res) => {
  const { name, whatsapp, email } = req.body;
  if (!name || !whatsapp || !email) {
    return res.status(400).json({ error: 'Campos obrigatórios: name, whatsapp, email' });
  }
  
  const { v4: uuidv4 } = require('uuid');
  const token = uuidv4().replace(/-/g, '').substring(0, 12);
  
  try {
    const id = db.createLead(name, whatsapp.replace(/\D/g, ''), email, token);
    const lead = db.getLeadById(id);
    res.json({ success: true, lead });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/leads/:id/events — log de eventos
router.get('/admin/leads/:id/events', (req, res) => {
  try {
    const events = db.getEventLog(req.params.id);
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
