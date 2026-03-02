const express = require('express');
const router = express.Router();
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
  
  res.render('proposal/viewer', { 
    lead, 
    slides,
    token
  });
});

module.exports = router;
