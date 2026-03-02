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

// IMPORTANTE: rotas mais específicas antes das genéricas
app.use('/admin/planejamentos', planejamentosRouter);
app.use('/admin', adminRouter);
app.use('/proposta', proposalRouter);
app.use('/planejamento', planejamentoClientRouter);
app.use('/api/track', apiRouter);
app.use('/api', apiRouter);

// Rota raiz
app.get('/', (req, res) => {
  res.redirect('/admin');
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
