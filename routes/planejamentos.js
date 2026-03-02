const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');
const { parseFile, textToSlides } = require('../services/documentParser');
const { sendPlanejamentoAlert, sendWhatsApp } = require('../services/whatsapp');
const { getPlanejamentoInviteMessage, buildWhatsAppLink } = require('../services/invites');

// Configurar Multer
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Formato inválido. Use PDF, DOCX ou TXT.'));
  }
});

// ── LIST PLANEJAMENTOS ──────────────────────────────────────────────
router.get('/', requireAdmin, (req, res) => {
  const planejamentos = db.getAllPlanejamentos();
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  res.render('admin/planejamentos/index', {
    planejamentos,
    baseUrl,
    success: req.query.success,
    error: req.query.error
  });
});

// ── NEW PLANEJAMENTO FORM ───────────────────────────────────────────
router.get('/new', requireAdmin, (req, res) => {
  res.render('admin/planejamentos/new', { error: null });
});

// ── UPLOAD + CREATE ─────────────────────────────────────────────────
router.post('/', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.render('admin/planejamentos/new', { error: 'Selecione um arquivo PDF, DOCX ou TXT.' });
    }
    const { title } = req.body;
    if (!title || !title.trim()) {
      return res.render('admin/planejamentos/new', { error: 'Título é obrigatório.' });
    }

    // Parse arquivo
    const text = await parseFile(req.file.path, req.file.mimetype);
    const slides = textToSlides(text);

    if (slides.length === 0) {
      return res.render('admin/planejamentos/new', { error: 'Não foi possível extrair conteúdo do arquivo.' });
    }

    // Criar planejamento no banco
    const planId = db.createPlanejamento(title.trim(), req.file.originalname);

    // Salvar slides
    slides.forEach((slide, idx) => {
      db.addPlanejamentoSlide(planId, idx + 1, slide.title || `Slide ${idx + 1}`, slide.content);
    });

    db.logPlanejamentoEvent(planId, 'created', { slideCount: slides.length, filename: req.file.originalname });

    // Limpar arquivo temporário
    try { fs.unlinkSync(req.file.path); } catch(e) {}

    res.redirect(`/admin/planejamentos/${planId}?success=Planejamento criado com ${slides.length} slides!`);
  } catch (err) {
    console.error('Upload error:', err);
    res.render('admin/planejamentos/new', { error: err.message || 'Erro ao processar arquivo.' });
  }
});

// ── VIEW/EDIT PLANEJAMENTO ──────────────────────────────────────────
router.get('/:id', requireAdmin, (req, res) => {
  const stats = db.getPlanejamentoStats(req.params.id);
  if (!stats) return res.redirect('/admin/planejamentos?error=Planejamento+não+encontrado');
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  res.render('admin/planejamentos/detail', {
    stats,
    baseUrl,
    success: req.query.success,
    error: req.query.error
  });
});

// ── UPDATE SLIDE ────────────────────────────────────────────────────
router.post('/:id/slides/:slideId', requireAdmin, (req, res) => {
  const { id, slideId } = req.params;
  const { title, content } = req.body;
  try {
    db.updatePlanejamentoSlide(parseInt(slideId), title || '', content || '');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE SLIDE ────────────────────────────────────────────────────
router.delete('/:id/slides/:slideId', requireAdmin, (req, res) => {
  const { id, slideId } = req.params;
  try {
    db.deletePlanejamentoSlide(parseInt(slideId));
    db.reorderPlanejamentoSlides(parseInt(id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ADD SLIDE ───────────────────────────────────────────────────────
router.post('/:id/slides', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;
  try {
    const slides = db.getPlanejamentoSlides(parseInt(id));
    const nextNum = slides.length + 1;
    db.addPlanejamentoSlide(parseInt(id), nextNum, title || `Slide ${nextNum}`, content || '');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SEND TO CLIENT (gerar token + enviar link) ──────────────────────
router.post('/:id/send', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { client_name, client_whatsapp, client_email } = req.body;

  if (!client_name || !client_whatsapp || !client_email) {
    return res.redirect(`/admin/planejamentos/${id}?error=Preencha+nome,+WhatsApp+e+email+do+cliente`);
  }

  try {
    const token = uuidv4().replace(/-/g, '').substring(0, 14);
    db.approvePlanejamento(parseInt(id), client_name, client_whatsapp, client_email, token);
    db.logPlanejamentoEvent(parseInt(id), 'sent', { client_name, client_whatsapp });

    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const planData = db.getPlanejamentoById(parseInt(id));

    // Mensagem de convite
    const msg = getPlanejamentoInviteMessage(
      { ...planData, token, client_name },
      baseUrl,
      0
    );

    res.redirect(`/admin/planejamentos/${id}?success=Planejamento+enviado!+Token:+${token}`);
  } catch (err) {
    console.error('Send plan error:', err);
    res.redirect(`/admin/planejamentos/${id}?error=Erro+ao+enviar:+${encodeURIComponent(err.message)}`);
  }
});

// ── RESEND WHATSAPP INVITE ──────────────────────────────────────────
router.post('/:id/invite', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const plan = db.getPlanejamentoById(parseInt(id));
  if (!plan || !plan.token) {
    return res.redirect(`/admin/planejamentos/${id}?error=Envie+o+planejamento+para+o+cliente+primeiro`);
  }

  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const inviteCount = db.getInvitesByLead ? 0 : 0; // planejamento invites
  const msg = getPlanejamentoInviteMessage(plan, baseUrl, inviteCount);

  db.logPlanejamentoEvent(parseInt(id), 'invite_sent', { message: msg });

  // Tentar CallMeBot
  try {
    await sendWhatsApp(`📋 CONVITE PLANEJAMENTO\n\n${msg}`);
  } catch(e) {}

  res.redirect(`/admin/planejamentos/${id}?success=Convite+enviado!`);
});

// ── DELETE PLANEJAMENTO ─────────────────────────────────────────────
router.post('/:id/delete', requireAdmin, (req, res) => {
  const { id } = req.params;
  try {
    const dbConn = db.getDb();
    dbConn.prepare('DELETE FROM planejamento_slide_events WHERE planejamento_id=?').run(parseInt(id));
    dbConn.prepare('DELETE FROM planejamento_event_log WHERE planejamento_id=?').run(parseInt(id));
    dbConn.prepare('DELETE FROM planejamento_sessions WHERE planejamento_id=?').run(parseInt(id));
    dbConn.prepare('DELETE FROM planejamento_slides WHERE planejamento_id=?').run(parseInt(id));
    dbConn.prepare('DELETE FROM planejamentos WHERE id=?').run(parseInt(id));
    res.redirect('/admin/planejamentos?success=Planejamento+excluído');
  } catch (err) {
    res.redirect(`/admin/planejamentos?error=${encodeURIComponent(err.message)}`);
  }
});

module.exports = router;
