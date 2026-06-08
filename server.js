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

// Rota raiz — página inicial para clientes
app.get('/', (req, res) => {
  res.render('home', { error: null, success: null });
});

// Busca proposta pelo email + whatsapp do cliente
app.post('/buscar-proposta', async (req, res) => {
  const { email, whatsapp } = req.body;

  if (!email || !whatsapp) {
    return res.render('home', {
      error: 'Preencha o e-mail e o WhatsApp para continuar.',
      success: null
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
        success: null
      });
    }

    // Verifica WhatsApp
    const storedWa = (lead.whatsapp || '').replace(/\D/g, '');
    if (waClean !== storedWa) {
      return res.render('home', {
        error: 'E-mail e WhatsApp não conferem. Verifique os dados informados.',
        success: null
      });
    }

    // Busca propostas do lead
    const proposals = db.getProposalsByLead(lead.id);

    if (!proposals || proposals.length === 0) {
      return res.render('home', {
        error: 'Nenhuma proposta disponível para este cadastro ainda. Em breve a equipe Envox entrará em contato.',
        success: null
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
      success: null
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
