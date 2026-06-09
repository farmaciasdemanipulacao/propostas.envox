const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');

// ── LIST ─────────────────────────────────────────────────────────────
router.get('/', requireAdmin, (req, res) => {
  const services   = db.getAllServices(true);
  const categories = db.getAllServiceCategories();
  const rules      = db.getAllDiscountRules(true);
  res.render('admin/services/index', {
    services, categories, rules,
    success: req.query.success,
    error:   req.query.error
  });
});

// ══ SERVICE CATEGORIES CRUD ═══════════════════════════════════════════

// POST /admin/services/categories/create
router.post('/categories/create', requireAdmin, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.redirect('/admin/services?error=Nome da categoria é obrigatório');
  try {
    db.createServiceCategory(name.trim());
    res.redirect('/admin/services?success=Categoria criada!');
  } catch (err) {
    res.redirect(`/admin/services?error=${encodeURIComponent(err.message)}`);
  }
});

// POST /admin/services/categories/:id/update
router.post('/categories/:id/update', requireAdmin, (req, res) => {
  const { name } = req.body;
  try {
    db.updateServiceCategory(parseInt(req.params.id), name);
    res.redirect('/admin/services?success=Categoria atualizada!');
  } catch (err) {
    res.redirect(`/admin/services?error=${encodeURIComponent(err.message)}`);
  }
});

// POST /admin/services/categories/:id/delete
router.post('/categories/:id/delete', requireAdmin, (req, res) => {
  try {
    db.deleteServiceCategory(parseInt(req.params.id));
    res.redirect('/admin/services?success=Categoria removida! Os serviços desta categoria foram desassociados.');
  } catch (err) {
    res.redirect(`/admin/services?error=${encodeURIComponent(err.message)}`);
  }
});

// ══ SERVICES CRUD ════════════════════════════════════════════════════

// POST /admin/services/create
router.post('/create', requireAdmin, (req, res) => {
  const { name, key, category, description, price, unit, category_id } = req.body;
  if (!name || !key || !price) {
    return res.redirect('/admin/services?error=Nome, chave e preço são obrigatórios');
  }
  const safeKey = key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  try {
    const services = db.getAllServices(true);
    const maxOrder = services.reduce((m, s) => Math.max(m, s.sort_order || 0), 0);
    db.createService(
      name.trim(), safeKey, category || 'monthly', description,
      parseFloat(price), unit || '/mês', maxOrder + 1,
      category_id ? parseInt(category_id) : null
    );
    res.redirect('/admin/services?success=Serviço criado com sucesso!');
  } catch (err) {
    console.error('Create service error:', err);
    res.redirect(`/admin/services?error=${encodeURIComponent(err.message)}`);
  }
});

// POST /admin/services/:id/update
router.post('/:id/update', requireAdmin, (req, res) => {
  const { name, category, description, price, unit, active, category_id } = req.body;
  try {
    db.updateService(
      parseInt(req.params.id), name, category,
      description, parseFloat(price), unit,
      active === '1',
      category_id ? parseInt(category_id) : null
    );
    res.redirect('/admin/services?success=Serviço atualizado!');
  } catch (err) {
    res.redirect(`/admin/services?error=${encodeURIComponent(err.message)}`);
  }
});

// POST /admin/services/:id/delete
router.post('/:id/delete', requireAdmin, (req, res) => {
  try {
    db.deleteService(parseInt(req.params.id));
    res.redirect('/admin/services?success=Serviço removido!');
  } catch (err) {
    res.redirect(`/admin/services?error=${encodeURIComponent(err.message)}`);
  }
});

// API: GET /admin/services/api/list — retorna JSON para o builder
router.get('/api/list', (req, res) => {
  try {
    const services   = db.getAllServices(false);
    const rules      = db.getAllDiscountRules(false);
    res.json({ services, rules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══ DISCOUNT RULES CRUD ══════════════════════════════════════════════

router.post('/rules/create', requireAdmin, (req, res) => {
  const { name, service_keys, discount_pct, description } = req.body;
  if (!name || !service_keys || !discount_pct) {
    return res.redirect('/admin/services?error=Nome, serviços e % desconto são obrigatórios');
  }
  const keys = Array.isArray(service_keys) ? service_keys : service_keys.split(',').map(k => k.trim()).filter(Boolean);
  if (keys.length < 2) {
    return res.redirect('/admin/services?error=Selecione pelo menos 2 serviços para a combinação');
  }
  try {
    db.createDiscountRule(name.trim(), keys, parseFloat(discount_pct), description);
    res.redirect('/admin/services?success=Regra de desconto criada!');
  } catch (err) {
    res.redirect(`/admin/services?error=${encodeURIComponent(err.message)}`);
  }
});

router.post('/rules/:id/update', requireAdmin, (req, res) => {
  const { name, service_keys, discount_pct, description, active } = req.body;
  const keys = Array.isArray(service_keys) ? service_keys : (service_keys || '').split(',').map(k => k.trim()).filter(Boolean);
  try {
    db.updateDiscountRule(parseInt(req.params.id), name, keys, parseFloat(discount_pct), description, active === '1');
    res.redirect('/admin/services?success=Regra atualizada!');
  } catch (err) {
    res.redirect(`/admin/services?error=${encodeURIComponent(err.message)}`);
  }
});

router.post('/rules/:id/delete', requireAdmin, (req, res) => {
  try {
    db.deleteDiscountRule(parseInt(req.params.id));
    res.redirect('/admin/services?success=Regra removida!');
  } catch (err) {
    res.redirect(`/admin/services?error=${encodeURIComponent(err.message)}`);
  }
});

module.exports = router;
