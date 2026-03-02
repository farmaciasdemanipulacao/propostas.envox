const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');
const { calculateInterestLevel, getInterestLabel } = require('../services/interest');
const { sendWhatsAppAlert, buildAlertData } = require('../services/whatsapp');

// GET /admin/login
router.get('/login', (req, res) => {
  if (req.session && req.session.isAdmin) return res.redirect('/admin');
  res.render('admin/login', { error: null });
});

// POST /admin/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'envox2025';
  
  if (username === 'admin' && password === adminPassword) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  res.render('admin/login', { error: 'Usuário ou senha incorretos.' });
});

// GET /admin/logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// GET /admin (dashboard)
router.get('/', requireAdmin, (req, res) => {
  const leads = db.getAllLeads();
  
  // Adicionar nível de interesse para cada lead
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
    
    return { ...lead, interestLevel, interestInfo };
  });
  
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  
  res.render('admin/dashboard', { 
    leads: leadsWithInterest, 
    baseUrl,
    success: req.query.success,
    error: req.query.error
  });
});

// GET /admin/leads/new
router.get('/leads/new', requireAdmin, (req, res) => {
  res.render('admin/new-lead', { error: null, success: null });
});

// POST /admin/leads (criar novo lead)
router.post('/leads', requireAdmin, (req, res) => {
  const { name, whatsapp, email } = req.body;
  
  if (!name || !whatsapp || !email) {
    return res.render('admin/new-lead', { 
      error: 'Todos os campos são obrigatórios.', 
      success: null 
    });
  }
  
  const token = uuidv4().replace(/-/g, '').substring(0, 12);
  
  try {
    const id = db.createLead(name, whatsapp.replace(/\D/g, ''), email, token);
    return res.redirect(`/admin?success=Lead+${encodeURIComponent(name)}+cadastrado+com+sucesso!`);
  } catch (err) {
    console.error('Error creating lead:', err);
    return res.render('admin/new-lead', { 
      error: 'Erro ao cadastrar lead. Tente novamente.',
      success: null
    });
  }
});

// GET /admin/leads/:id (detalhes do lead)
router.get('/leads/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const stats = db.getLeadStats(id);
  
  if (!stats) {
    return res.redirect('/admin?error=Lead+não+encontrado');
  }
  
  const interestLevel = stats.totalAccesses > 0
    ? calculateInterestLevel({
        totalDuration: stats.totalDuration,
        totalSlidesSeen: stats.totalSlidesSeen,
        totalAccesses: stats.totalAccesses,
        slideStats: stats.slideStats
      })
    : 0;
    
  const interestInfo = getInterestLabel(interestLevel);
  
  // Preparar dados para o gráfico de slides
  const slideLabels = [];
  const slideDurations = [];
  const slideColors = [];
  
  for (let i = 1; i <= 11; i++) {
    const slideStat = stats.slideStats.find(s => s.slide_number === i);
    const dur = slideStat ? Math.round(slideStat.total_duration || 0) : 0;
    slideLabels.push(`Slide ${i}`);
    slideDurations.push(dur);
    
    // Cores baseadas no tempo (mapa de calor)
    if (dur === 0) slideColors.push('#e0e0e0');
    else if (dur < 20) slideColors.push('#66bb6a');   // verde
    else if (dur < 60) slideColors.push('#ffa726');   // amarelo
    else slideColors.push('#e91e63');                  // rosa/vermelho
  }
  
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  
  // Formatar event log
  const eventLog = stats.eventLog.map(ev => {
    let details = {};
    try { details = ev.details ? JSON.parse(ev.details) : {}; } catch(e) {}
    return { ...ev, parsedDetails: details };
  });
  
  res.render('admin/lead-detail', { 
    stats, 
    interestLevel, 
    interestInfo,
    slideLabels: JSON.stringify(slideLabels),
    slideDurations: JSON.stringify(slideDurations),
    slideColors: JSON.stringify(slideColors),
    baseUrl,
    eventLog,
    success: req.query.success,
    error: req.query.error
  });
});

// POST /admin/leads/:id/resend-alert (reenviar alerta WhatsApp)
router.post('/leads/:id/resend-alert', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const stats = db.getLeadStats(id);
  
  if (!stats) {
    return res.redirect(`/admin?error=Lead+não+encontrado`);
  }
  
  const interestLevel = calculateInterestLevel({
    totalDuration: stats.totalDuration,
    totalSlidesSeen: stats.totalSlidesSeen,
    totalAccesses: stats.totalAccesses,
    slideStats: stats.slideStats
  });
  
  const alertData = buildAlertData(
    stats.lead,
    stats.slideStats,
    stats.totalDuration,
    stats.totalSlidesSeen,
    interestLevel
  );
  
  const sent = await sendWhatsAppAlert(alertData);
  
  if (sent) {
    return res.redirect(`/admin/leads/${id}?success=Alerta+WhatsApp+reenviado+com+sucesso!`);
  } else {
    return res.redirect(`/admin/leads/${id}?error=Falha+ao+enviar+alerta.+Verifique+as+configurações+do+CallMeBot.`);
  }
});

module.exports = router;
