const express = require('express');
const router = express.Router();
const db = require('../database');
const { sendPlanejamentoAlert } = require('../services/whatsapp');

// ── GET /planejamento/:token — client review page ─────────────────
router.get('/:token', (req, res) => {
  const plan = db.getPlanejamentoByToken(req.params.token);
  if (!plan) {
    return res.render('proposal/auth', {
      token: req.params.token,
      error: 'Link de planejamento inválido ou expirado.',
      validToken: false
    });
  }

  // Verificar se já está autenticado
  if (req.session && req.session.planTokens && req.session.planTokens.includes(req.params.token)) {
    return res.redirect(`/planejamento/${req.params.token}/view`);
  }

  res.render('planejamento/auth', { plan, token: req.params.token, error: null });
});

// ── POST /planejamento/:token/auth ────────────────────────────────
router.post('/:token/auth', (req, res) => {
  const { token } = req.params;
  const plan = db.getPlanejamentoByToken(token);

  if (!plan) {
    return res.render('planejamento/auth', {
      plan: null, token,
      error: 'Link inválido. Entre em contato com a Envox.'
    });
  }

  const { whatsapp, email } = req.body;
  const inputWa = (whatsapp || '').replace(/\D/g, '');
  const storedWa = (plan.client_whatsapp || '').replace(/\D/g, '');
  const waMatch = inputWa === storedWa || (inputWa.length >= 8 && storedWa.endsWith(inputWa.slice(-8)));
  const emailMatch = (email || '').trim().toLowerCase() === (plan.client_email || '').trim().toLowerCase();

  if (!waMatch || !emailMatch) {
    return res.render('planejamento/auth', {
      plan, token,
      error: 'Dados não conferem. Entre em contato com a Envox.'
    });
  }

  if (!req.session.planTokens) req.session.planTokens = [];
  req.session.planTokens.push(token);

  return res.redirect(`/planejamento/${token}/view`);
});

// ── GET /planejamento/:token/view ─────────────────────────────────
router.get('/:token/view', (req, res) => {
  const { token } = req.params;
  const plan = db.getPlanejamentoByToken(token);

  if (!plan) return res.redirect(`/planejamento/${token}`);
  if (!req.session || !req.session.planTokens || !req.session.planTokens.includes(token)) {
    return res.redirect(`/planejamento/${token}`);
  }

  const slides = db.getPlanejamentoSlides(plan.id);

  // Criar sessão de revisão
  let sessionId = req.session[`planSession_${token}`];
  if (!sessionId) {
    sessionId = db.createPlanejamentoSession(plan.id, plan.client_name);
    req.session[`planSession_${token}`] = sessionId;
  }

  res.render('planejamento/viewer', { plan, slides, token, sessionId });
});

// ── POST /planejamento/:token/review — approve/request revision ────
router.post('/:token/review', async (req, res) => {
  const { token } = req.params;
  const plan = db.getPlanejamentoByToken(token);

  if (!plan || !req.session.planTokens || !req.session.planTokens.includes(token)) {
    return res.status(403).json({ error: 'Não autorizado' });
  }

  const { slideNumber, action, comment, sessionId } = req.body;

  try {
    if (action === 'approve') {
      db.approveSlide(plan.id, parseInt(slideNumber));
      db.recordPlanejamentoSlideEvent(
        sessionId ? parseInt(sessionId) : null,
        plan.id, parseInt(slideNumber), 'approved', 0, null
      );
    } else if (action === 'revision') {
      db.requestRevisionSlide(plan.id, parseInt(slideNumber), comment || '');
      db.recordPlanejamentoSlideEvent(
        sessionId ? parseInt(sessionId) : null,
        plan.id, parseInt(slideNumber), 'revision', 0, comment || ''
      );
    }

    // Verificar se todos os slides foram revisados
    const slides = db.getPlanejamentoSlides(plan.id);
    const allReviewed = slides.every(s => s.status === 'approved' || s.status === 'revision');

    if (allReviewed) {
      const approvedCount = slides.filter(s => s.status === 'approved').length;
      const revisionCount = slides.filter(s => s.status === 'revision').length;
      db.markPlanejamentoReviewed(plan.id);
      db.updatePlanejamentoStatus(plan.id, 'reviewed');
      db.logPlanejamentoEvent(plan.id, 'fully_reviewed', { approvedCount, revisionCount });

      // Fechar sessão
      if (sessionId) {
        db.closePlanejamentoSession(parseInt(sessionId), 0);
      }

      // Enviar alerta CallMeBot
      try {
        const ok = await sendPlanejamentoAlert(plan, approvedCount, revisionCount, slides.length);
        if (sessionId && ok) db.markPlanejamentoSessionAlertSent(parseInt(sessionId));
      } catch (e) { console.error('Planejamento alert error:', e); }

      return res.json({ success: true, allDone: true, approvedCount, revisionCount });
    }

    res.json({ success: true, allDone: false });
  } catch (err) {
    console.error('Review error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
