require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const BetterSqlite3Store = require('better-sqlite3-session-store')(session);
const Database = require('better-sqlite3');

// Inicializa banco de dados antes de tudo
const db = require('./database');
db.getDb(); // Força inicialização

const app = express();
const PORT = process.env.PORT || 3000;

// ============ MIDDLEWARES ============

// Webhook Resend precisa do raw body para verificar assinatura HMAC — DEVE vir ANTES do express.json()
app.use('/api/webhooks/resend', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Session store usando SQLite (sem MemoryStore)
const sessionDb = new Database(path.join(__dirname, 'sessions.db'));

app.use(session({
  store: new BetterSqlite3Store({ client: sessionDb }),
  secret: process.env.SESSION_SECRET || 'envox_secret_2025',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    maxAge: 24 * 60 * 60 * 1000 // 24h
  }
}));

// ============ VIEW ENGINE ============
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ============ ROTAS ============
const adminRouter = require('./routes/admin');
const proposalRouter = require('./routes/proposal');
const apiRouter = require('./routes/api');
const planejamentosRouter = require('./routes/planejamentos');
const planejamentoClientRouter = require('./routes/planejamento-client');
const servicesRouter = require('./routes/services');

// IMPORTANTE: rotas mais específicas antes das genéricas
app.use('/admin/planejamentos', planejamentosRouter);
app.use('/admin/services', servicesRouter);
app.use('/admin', adminRouter);
app.use('/proposta', proposalRouter);
app.use('/planejamento', planejamentoClientRouter);
app.use('/api/track', apiRouter);
app.use('/api', apiRouter);

// ── Pixel de abertura de email ───────────────────────────────────────────────
app.get('/track/email-open/:token', (req, res) => {
  try {
    const { token } = req.params;
    db.markEmailOpened(token);
    console.log(`[EmailTrack] 👁️ Aberto | token: ${token}`);
  } catch (e) {
    console.error('[EmailTrack] open error:', e.message);
  }
  // Retorna GIF 1x1 transparente
  const pixel = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
  );
  res.set({ 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' });
  res.end(pixel);
});

// ── Link rastreado (clique) — redireciona para a proposta ────────────────────
app.get('/track/email-click/:token', (req, res) => {
  try {
    const { token } = req.params;
    const { url } = req.query;
    db.markEmailClicked(token);
    console.log(`[EmailTrack] 🖱️ Clicado | token: ${token} → ${url}`);
    return res.redirect(url || '/');
  } catch (e) {
    console.error('[EmailTrack] click error:', e.message);
    return res.redirect('/');
  }
});

// ── Webhook Resend (entrega, spam, bounce) ────────────────────────────────────
app.post('/api/webhooks/resend', (req, res) => {
  try {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (secret) {
      const crypto = require('crypto');
      const signature = req.headers['svix-signature'] || '';
      const msgId    = req.headers['svix-id'] || '';
      const msgTs    = req.headers['svix-timestamp'] || '';
      const body     = req.body; // Buffer (raw)

      // Resend usa Svix para assinar — verificação HMAC-SHA256
      const toSign = `${msgId}.${msgTs}.${body.toString()}`;
      // secret no formato whsec_BASE64 — decodifica
      const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
      const expectedSig = crypto.createHmac('sha256', secretBytes).update(toSign).digest('base64');
      const sigs = signature.split(' ').map(s => s.replace(/^v1,/, ''));
      if (!sigs.includes(expectedSig)) {
        console.warn('[Webhook] Assinatura inválida — ignorando');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const payload = JSON.parse(req.body.toString());
    const { type, data } = payload;
    const resendId = data?.email_id;

    console.log(`[Webhook] Resend evento: ${type} | id: ${resendId}`);

    if (!resendId) return res.json({ ok: true });

    const now = new Date().toISOString();
    if (type === 'email.delivered') {
      db.updateEmailEventByResendId(resendId, { status: 'delivered', delivered_at: now });
    } else if (type === 'email.bounced') {
      db.updateEmailEventByResendId(resendId, { status: 'bounced', bounced_at: now, bounce_reason: JSON.stringify(data) });
    } else if (type === 'email.complained') {
      db.updateEmailEventByResendId(resendId, { status: 'spam', complained_at: now });
    } else if (type === 'email.opened') {
      // Resend também notifica abertura via webhook (complementa o pixel)
      db.updateEmailEventByResendId(resendId, { opened_at: now });
    } else if (type === 'email.clicked') {
      db.updateEmailEventByResendId(resendId, { clicked_at: now });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[Webhook] Erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Rota raiz — página inicial para clientes
app.get('/', (req, res) => {
  res.render('home', { error: null, success: null, formError: null, formSuccess: null, activeTab: 'acessar' });
});

// Busca proposta pelo email + whatsapp do cliente
app.post('/buscar-proposta', async (req, res) => {
  const { email, whatsapp } = req.body;

  if (!email || !whatsapp) {
    return res.render('home', {
      error: 'Preencha o e-mail e o WhatsApp para continuar.',
      success: null, formError: null, formSuccess: null, activeTab: 'acessar'
    });
  }

  try {
    // Normaliza WhatsApp (só dígitos)
    const waClean = (whatsapp || '').replace(/\D/g, '');

    // Busca lead pelo email
    const lead = db.getLeadByEmail(email.trim().toLowerCase());

    if (!lead) {
      return res.render('home', {
        error: 'Nenhuma proposta encontrada com esse e-mail. Verifique os dados ou solicite acesso.',
        success: null, formError: null, formSuccess: null, activeTab: 'acessar'
      });
    }

    // Verifica WhatsApp
    const storedWa = (lead.whatsapp || '').replace(/\D/g, '');
    if (waClean !== storedWa) {
      return res.render('home', {
        error: 'E-mail e WhatsApp não conferem. Verifique os dados informados.',
        success: null, formError: null, formSuccess: null, activeTab: 'acessar'
      });
    }

    // Busca propostas do lead
    const proposals = db.getProposalsByLead(lead.id);

    if (!proposals || proposals.length === 0) {
      return res.render('home', {
        error: 'Nenhuma proposta disponível para este cadastro ainda. Em breve a equipe Envox entrará em contato.',
        success: null, formError: null, formSuccess: null, activeTab: 'acessar'
      });
    }

    // Autentica a sessão para todas as propostas do lead (mesma lógica das rotas de proposta)
    if (!req.session.authenticatedTokens) req.session.authenticatedTokens = [];
    if (!req.session.sharedAccess) req.session.sharedAccess = {};

    for (const p of proposals) {
      if (!req.session.authenticatedTokens.includes(p.token)) {
        req.session.authenticatedTokens.push(p.token);
      }
      // Guarda contexto do lead para que a view consiga identificá-lo
      req.session.sharedAccess[p.token] = { lead_id: lead.id, name: lead.name };
    }

    // Redireciona para a proposta mais recente
    const latest = proposals[0];
    return res.redirect(`/proposta/${latest.token}/view`);

  } catch (err) {
    console.error('[buscar-proposta]', err);
    return res.render('home', {
      error: 'Ocorreu um erro ao buscar sua proposta. Tente novamente.',
      success: null, formError: null, formSuccess: null, activeTab: 'acessar'
    });
  }
});

// Solicitação de acesso — formulário público da home
app.post('/solicitar-acesso', async (req, res) => {
  const { name, whatsapp, email, company, cargo } = req.body;

  if (!name || !whatsapp || !email || !company) {
    return res.render('home', {
      error: null,
      success: null,
      formError: 'Preencha todos os campos obrigatórios: Nome, WhatsApp, E-mail e Empresa.',
      activeTab: 'solicitar'
    });
  }

  try {
    // Verifica se já existe solicitação pendente com mesmo email
    const existing = db.getAllAccessRequests().find(
      r => r.email === email.trim().toLowerCase() && r.status === 'pending'
    );
    if (existing) {
      return res.render('home', {
        error: null,
        success: null,
        formError: 'Já existe uma solicitação pendente com esse e-mail. Em breve nossa equipe entrará em contato!',
        activeTab: 'solicitar'
      });
    }

    const id = db.createAccessRequest(name, whatsapp, email, company, cargo);

    // Alerta WhatsApp para o admin
    const { sendWhatsApp } = require('./services/whatsapp');
    const waClean = (whatsapp || '').replace(/\D/g, '');
    const msg =
`🆕 NOVA SOLICITAÇÃO DE ACESSO!

👤 Nome: ${name}
🏢 Empresa: ${company}
💼 Cargo: ${cargo || 'Não informado'}
📱 WhatsApp: ${whatsapp}
📧 Email: ${email}

⚡ Acesse o painel para aprovar ou rejeitar:
${process.env.BASE_URL || 'https://proposta.envox.com.br'}/admin/solicitacoes

📲 Falar direto: https://wa.me/${waClean}`;

    sendWhatsApp(msg).catch(err => console.error('[solicitar-acesso] WhatsApp error:', err));

    return res.render('home', {
      error: null,
      success: null,
      formSuccess: `Solicitação enviada com sucesso, ${name.split(' ')[0]}! Nossa equipe vai analisar e aprovar o acesso. Fique de olho no seu WhatsApp.`,
      activeTab: 'solicitar'
    });
  } catch (err) {
    console.error('[solicitar-acesso]', err);
    return res.render('home', {
      error: null,
      success: null,
      formError: 'Erro ao enviar solicitação. Tente novamente.',
      activeTab: 'solicitar'
    });
  }
});

// 404
app.use((req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>404 - Página não encontrada</title>
      <style>
        body { font-family: 'Poppins', sans-serif; background: #1A1A2E; color: #fff; 
               display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .box { text-align: center; }
        .brand { font-size: 2rem; font-weight: 800; }
        .brand .ox { color: #E91E63; }
        h1 { font-size: 5rem; margin: 0; color: #E91E63; }
        p { color: #aaa; }
        a { color: #E91E63; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="box">
        <div class="brand">env<span class="ox">ox</span></div>
        <h1>404</h1>
        <p>Página não encontrada</p>
        <a href="/">← Voltar ao início</a>
      </div>
    </body>
    </html>
  `);
});

// ============ START ============
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Envox Proposta rodando em http://0.0.0.0:${PORT}`);
  console.log(`📊 Admin: http://localhost:${PORT}/admin`);
  console.log(`🔑 Login: admin / ${process.env.ADMIN_PASSWORD || 'envox2025'}\n`);
});

module.exports = app;
