const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initDatabase();
  }
  return db;
}

function initDatabase() {
  const database = db;

  // ══════════════════════════════════════════════════════════════════════
  // LEADS — apenas dados pessoais do contato (sem campos de proposta)
  // ══════════════════════════════════════════════════════════════════════
  database.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      company_name TEXT DEFAULT '',
      cargo TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ══════════════════════════════════════════════════════════════════════
  // PROPOSALS — a proposta em si (desacoplada do lead)
  // ══════════════════════════════════════════════════════════════════════
  database.exec(`
    CREATE TABLE IF NOT EXISTS proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      proposal_description TEXT,
      proposal_scope TEXT,
      proposal_timeline TEXT,
      proposal_mode TEXT DEFAULT 'both',
      proposal_status TEXT DEFAULT 'active',
      proposal_sent_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ══════════════════════════════════════════════════════════════════════
  // PROPOSAL_LEADS — junction N:N
  // ══════════════════════════════════════════════════════════════════════
  database.exec(`
    CREATE TABLE IF NOT EXISTS proposal_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      is_primary INTEGER DEFAULT 0,
      linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(proposal_id, lead_id)
    )
  `);

  // ══════════════════════════════════════════════════════════════════════
  // PROPOSAL_ITEMS — itens da proposta (referencia proposal_id)
  // ══════════════════════════════════════════════════════════════════════
  database.exec(`
    CREATE TABLE IF NOT EXISTS proposal_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
      service_id INTEGER,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price REAL NOT NULL DEFAULT 0,
      qty INTEGER NOT NULL DEFAULT 1,
      unit TEXT DEFAULT '/mês',
      category TEXT DEFAULT 'monthly',
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ══════════════════════════════════════════════════════════════════════
  // ACCESS_SESSIONS — sessões de acesso (lead_id quem acessou,
  //                   proposal_id para agregar por proposta)
  // ══════════════════════════════════════════════════════════════════════
  database.exec(`
    CREATE TABLE IF NOT EXISTS access_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id),
      proposal_id INTEGER REFERENCES proposals(id),
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      total_duration_seconds INTEGER DEFAULT 0,
      alert_sent INTEGER DEFAULT 0
    )
  `);

  // ══════════════════════════════════════════════════════════════════════
  // SLIDE_EVENTS — eventos por slide (lead_id = quem gerou;
  //                proposal_id = para agregação)
  // ══════════════════════════════════════════════════════════════════════
  database.exec(`
    CREATE TABLE IF NOT EXISTS slide_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER REFERENCES access_sessions(id),
      lead_id INTEGER NOT NULL REFERENCES leads(id),
      proposal_id INTEGER REFERENCES proposals(id),
      slide_number INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      duration_seconds REAL DEFAULT 0
    )
  `);

  // ══════════════════════════════════════════════════════════════════════
  // EVENT_LOG — log genérico de eventos
  // ══════════════════════════════════════════════════════════════════════
  database.exec(`
    CREATE TABLE IF NOT EXISTS event_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id),
      proposal_id INTEGER REFERENCES proposals(id),
      session_id INTEGER,
      event_type TEXT NOT NULL,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ══════════════════════════════════════════════════════════════════════
  // PROPOSAL_ACTIONS — Accept / Counter / Reject
  // ══════════════════════════════════════════════════════════════════════
  database.exec(`
    CREATE TABLE IF NOT EXISTS proposal_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
      lead_id INTEGER NOT NULL REFERENCES leads(id),
      action_type TEXT NOT NULL,
      comment TEXT,
      counter_value REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ══════════════════════════════════════════════════════════════════════
  // PROPOSAL_SHARED_LEADS — rastrea encaminhamentos do share widget
  // ══════════════════════════════════════════════════════════════════════
  database.exec(`
    CREATE TABLE IF NOT EXISTS proposal_shared_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
      shared_from_lead_id INTEGER REFERENCES leads(id),
      new_lead_id INTEGER REFERENCES leads(id),
      shared_token TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ══════════════════════════════════════════════════════════════════════
  // CUSTOM_PLANS — planos customizados montados pelo lead
  // ══════════════════════════════════════════════════════════════════════
  database.exec(`
    CREATE TABLE IF NOT EXISTS custom_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id),
      proposal_id INTEGER REFERENCES proposals(id),
      session_id INTEGER,
      selections TEXT NOT NULL,
      monthly_total REAL DEFAULT 0,
      onetime_total REAL DEFAULT 0,
      sent_via_whatsapp INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ══════════════════════════════════════════════════════════════════════
  // LEAD_INVITES — convites e follow-ups
  // ══════════════════════════════════════════════════════════════════════
  database.exec(`
    CREATE TABLE IF NOT EXISTS lead_invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id),
      invite_type TEXT NOT NULL,
      message_index INTEGER NOT NULL,
      message_text TEXT NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ══════════════════════════════════════════════════════════════════════
  // PROPOSAL_NEW_REQUESTS — solicitações de nova proposta (após rejeição)
  // ══════════════════════════════════════════════════════════════════════
  database.exec(`
    CREATE TABLE IF NOT EXISTS proposal_new_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER REFERENCES leads(id),
      proposal_id INTEGER REFERENCES proposals(id),
      company_name TEXT NOT NULL,
      cargo TEXT,
      briefing TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ══════════════════════════════════════════════════════════════════════
  // SERVICES & DISCOUNT RULES
  // ══════════════════════════════════════════════════════════════════════
  database.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      key TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL DEFAULT 'monthly',
      description TEXT,
      price REAL NOT NULL DEFAULT 0,
      unit TEXT DEFAULT '/mês',
      active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS discount_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      service_keys TEXT NOT NULL,
      discount_pct REAL NOT NULL,
      description TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed serviços padrão se tabela vazia
  const svcCount = database.prepare('SELECT COUNT(*) as c FROM services').get();
  if (svcCount.c === 0) {
    const ins = database.prepare(`INSERT INTO services (name, key, category, description, price, unit, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    ins.run('Social Media — 6 posts/mês',  'social_6',   'monthly', 'Gestão de redes sociais com 6 posts mensais', 1170, '/mês', 1);
    ins.run('Social Media — 9 posts/mês',  'social_9',   'monthly', 'Gestão de redes sociais com 9 posts mensais', 1470, '/mês', 2);
    ins.run('Social Media — 12 posts/mês', 'social_12',  'monthly', 'Gestão de redes sociais com 12 posts mensais', 1970, '/mês', 3);
    ins.run('Google Ads',                  'google_ads', 'monthly', 'Gestão completa de campanhas Google Ads', 1490, '/mês', 4);
    ins.run('Meta Ads',                    'meta_ads',   'monthly', 'Facebook + Instagram Ads', 1490, '/mês', 5);
    ins.run('Captação de Conteúdo',        'captacao',   'monthly', 'Sessão de captação presencial (4h)', 1200, '/sessão', 6);
    ins.run('SDR 1 — 6h/dia seg-sex',      'sdr_1',      'monthly', 'Atendimento inbox 6h/dia, seg a sex', 990, '/mês', 7);
    ins.run('SDR 2 — 8h/dia seg-sex',      'sdr_2',      'monthly', 'Atendimento inbox 8h/dia, seg a sex', 1770, '/mês', 8);
    ins.run('SDR 3 — 11h às 20h seg-sex',  'sdr_3',      'monthly', 'Atendimento inbox 11h às 20h, seg a sex', 2180, '/mês', 9);
    ins.run('Website até 5 páginas',       'web_5',      'onetime', 'Site profissional com até 5 páginas', 3999, 'único', 10);
    ins.run('Website até 7 páginas',       'web_7',      'onetime', 'Site profissional com até 7 páginas', 4999, 'único', 11);
  }

  // ══════════════════════════════════════════════════════════════════════
  // PLANEJAMENTOS (mantidos intactos)
  // ══════════════════════════════════════════════════════════════════════
  database.exec(`
    CREATE TABLE IF NOT EXISTS planejamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      client_name TEXT,
      client_whatsapp TEXT,
      client_email TEXT,
      token TEXT UNIQUE,
      status TEXT DEFAULT 'draft',
      original_filename TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sent_at DATETIME,
      reviewed_at DATETIME
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS planejamento_slides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      planejamento_id INTEGER NOT NULL,
      slide_number INTEGER NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      client_comment TEXT,
      reviewed_at DATETIME,
      FOREIGN KEY (planejamento_id) REFERENCES planejamentos(id)
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS planejamento_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      planejamento_id INTEGER NOT NULL,
      client_name TEXT,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      total_duration INTEGER DEFAULT 0,
      alert_sent INTEGER DEFAULT 0,
      FOREIGN KEY (planejamento_id) REFERENCES planejamentos(id)
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS planejamento_slide_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      planejamento_id INTEGER NOT NULL,
      slide_number INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      duration_seconds INTEGER DEFAULT 0,
      comment TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS planejamento_event_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      planejamento_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('✅ Banco de dados N:N inicializado com sucesso');
}

// ══════════════════════════════════════════════════════════
// LEADS
// ══════════════════════════════════════════════════════════

function createLead(name, whatsapp, email, companyName, cargo) {
  const result = getDb().prepare(`
    INSERT INTO leads (name, whatsapp, email, company_name, cargo)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, whatsapp.replace(/\D/g, ''), email.trim().toLowerCase(), companyName || '', cargo || '');
  return result.lastInsertRowid;
}

function getLeadById(id) {
  return getDb().prepare('SELECT * FROM leads WHERE id = ?').get(id);
}

function getLeadByEmail(email) {
  return getDb().prepare('SELECT * FROM leads WHERE LOWER(email) = LOWER(?)').get(email);
}

function updateLead(id, name, whatsapp, email) {
  getDb().prepare(`UPDATE leads SET name=?, whatsapp=?, email=? WHERE id=?`)
    .run(name, whatsapp.replace(/\D/g, ''), email.trim().toLowerCase(), id);
}

function updateLeadCompany(id, companyName, cargo) {
  getDb().prepare(`UPDATE leads SET company_name=?, cargo=? WHERE id=?`)
    .run(companyName || '', cargo || '', id);
}

function deleteLead(id) {
  const database = getDb();
  // Cascade via FK. Remover de proposal_leads (shared leads + junction)
  database.prepare(`DELETE FROM proposal_shared_leads WHERE shared_from_lead_id=? OR new_lead_id=?`).run(id, id);
  database.prepare(`DELETE FROM proposal_leads WHERE lead_id=?`).run(id);
  // Sessões e eventos ficam (orphans aceitáveis — lead pode ter sido deletado)
  database.prepare(`DELETE FROM lead_invites WHERE lead_id=?`).run(id);
  database.prepare(`DELETE FROM leads WHERE id=?`).run(id);
}

function getAllLeads() {
  return getDb().prepare(`
    SELECT l.*,
      COUNT(DISTINCT s.id) as total_accesses,
      MAX(s.started_at) as last_access,
      COALESCE(SUM(s.total_duration_seconds), 0) as total_duration,
      CASE
        WHEN COUNT(DISTINCT s.id) = 0 THEN 'not_viewed'
        WHEN EXISTS (
          SELECT 1 FROM access_sessions s2
          WHERE s2.lead_id = l.id AND s2.ended_at IS NULL
        ) THEN 'viewing'
        ELSE 'viewed'
      END as status
    FROM leads l
    LEFT JOIN access_sessions s ON s.lead_id = l.id
    GROUP BY l.id ORDER BY l.created_at DESC
  `).all();
}

// Estatísticas de engajamento de um LEAD individual
function getLeadStats(leadId) {
  const database = getDb();
  const lead = getLeadById(leadId);
  if (!lead) return null;
  const sessions = database.prepare(`
    SELECT * FROM access_sessions WHERE lead_id = ? ORDER BY started_at DESC
  `).all(leadId);
  const slideStats = database.prepare(`
    SELECT slide_number,
      COUNT(*) as view_count,
      COALESCE(SUM(duration_seconds), 0) as total_duration,
      COALESCE(MAX(duration_seconds), 0) as max_duration,
      SUM(CASE WHEN event_type = 'revisited' THEN 1 ELSE 0 END) as revisit_count
    FROM slide_events WHERE lead_id = ?
    GROUP BY slide_number ORDER BY slide_number
  `).all(leadId);
  const totalSlidesSeen = database.prepare(`
    SELECT COUNT(DISTINCT slide_number) as count FROM slide_events WHERE lead_id = ?
  `).get(leadId);
  const eventLog = database.prepare(`
    SELECT * FROM event_log WHERE lead_id = ? ORDER BY timestamp DESC LIMIT 100
  `).all(leadId);
  const customPlans = database.prepare(`
    SELECT * FROM custom_plans WHERE lead_id = ? ORDER BY created_at DESC
  `).all(leadId);
  const invites = database.prepare(`
    SELECT * FROM lead_invites WHERE lead_id = ? ORDER BY sent_at DESC
  `).all(leadId);
  const totalDuration = sessions.reduce((s, x) => s + (x.total_duration_seconds || 0), 0);

  // Proposta vinculada principal deste lead
  const linkedProposal = database.prepare(`
    SELECT p.*, pl.is_primary FROM proposals p
    JOIN proposal_leads pl ON pl.proposal_id = p.id
    WHERE pl.lead_id = ?
    ORDER BY pl.is_primary DESC, p.created_at DESC LIMIT 1
  `).get(leadId);

  return {
    lead, sessions, slideStats,
    totalSlidesSeen: totalSlidesSeen ? totalSlidesSeen.count : 0,
    eventLog, customPlans, invites,
    totalDuration, totalAccesses: sessions.length,
    linkedProposal,
  };
}

// ══════════════════════════════════════════════════════════
// PROPOSALS
// ══════════════════════════════════════════════════════════

function createProposal(token) {
  const result = getDb().prepare(`
    INSERT INTO proposals (token) VALUES (?)
  `).run(token);
  return result.lastInsertRowid;
}

function getProposalById(id) {
  return getDb().prepare('SELECT * FROM proposals WHERE id = ?').get(id);
}

function getProposalByToken(token) {
  return getDb().prepare('SELECT * FROM proposals WHERE token = ?').get(token);
}

function updateProposalContent(proposalId, description, scope, timeline) {
  getDb().prepare(`
    UPDATE proposals SET
      proposal_description = ?,
      proposal_scope = ?,
      proposal_timeline = ?
    WHERE id = ?
  `).run(description || null, scope || null, timeline || null, proposalId);
}

function updateProposalMode(proposalId, mode) {
  getDb().prepare(`UPDATE proposals SET proposal_mode = ? WHERE id = ?`)
    .run(mode || 'both', proposalId);
}

function markProposalSent(proposalId) {
  getDb().prepare(`UPDATE proposals SET proposal_sent_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(proposalId);
}

function setProposalStatus(proposalId, status) {
  getDb().prepare(`UPDATE proposals SET proposal_status = ? WHERE id = ?`)
    .run(status, proposalId);
}

function deleteProposal(proposalId) {
  // ON DELETE CASCADE cuida de proposal_leads, proposal_items, proposal_actions, proposal_shared_leads
  getDb().prepare(`DELETE FROM proposals WHERE id = ?`).run(proposalId);
}

function archiveProposal(proposalId, archived) {
  // Usa proposal_status como archived flag: 'archived' | 'active'
  getDb().prepare(`UPDATE proposals SET proposal_status = ? WHERE id = ?`)
    .run(archived ? 'archived' : 'active', proposalId);
}

function getAllProposals() {
  return getDb().prepare(`
    SELECT p.*,
      COUNT(DISTINCT pl.lead_id) as leads_count,
      GROUP_CONCAT(l.name, ', ') as lead_names,
      GROUP_CONCAT(l.company_name, ', ') as company_names,
      (SELECT l2.company_name FROM leads l2
       JOIN proposal_leads pl2 ON pl2.lead_id = l2.id
       WHERE pl2.proposal_id = p.id AND pl2.is_primary = 1 LIMIT 1) as primary_company,
      (SELECT l3.name FROM leads l3
       JOIN proposal_leads pl3 ON pl3.lead_id = l3.id
       WHERE pl3.proposal_id = p.id AND pl3.is_primary = 1 LIMIT 1) as primary_lead_name
    FROM proposals p
    LEFT JOIN proposal_leads pl ON pl.proposal_id = p.id
    LEFT JOIN leads l ON l.id = pl.lead_id
    GROUP BY p.id ORDER BY p.created_at DESC
  `).all();
}

// Proposta com todos os leads vinculados
function getProposalWithLeads(proposalId) {
  const proposal = getProposalById(proposalId);
  if (!proposal) return null;
  const leads = getDb().prepare(`
    SELECT l.*, pl.is_primary, pl.linked_at
    FROM leads l
    JOIN proposal_leads pl ON pl.lead_id = l.id
    WHERE pl.proposal_id = ?
    ORDER BY pl.is_primary DESC, pl.linked_at ASC
  `).all(proposalId);
  return { ...proposal, leads };
}

// Proposta pelo token com leads (usado no viewer)
function getProposalByTokenWithLeads(token) {
  const proposal = getProposalByToken(token);
  if (!proposal) return null;
  const leads = getDb().prepare(`
    SELECT l.*, pl.is_primary, pl.linked_at
    FROM leads l
    JOIN proposal_leads pl ON pl.lead_id = l.id
    WHERE pl.proposal_id = ?
    ORDER BY pl.is_primary DESC, pl.linked_at ASC
  `).all(proposal.id);
  return { ...proposal, leads };
}

// ══════════════════════════════════════════════════════════
// PROPOSAL_LEADS — Junction
// ══════════════════════════════════════════════════════════

function linkLeadToProposal(proposalId, leadId, isPrimary) {
  try {
    getDb().prepare(`
      INSERT INTO proposal_leads (proposal_id, lead_id, is_primary)
      VALUES (?, ?, ?)
    `).run(proposalId, leadId, isPrimary ? 1 : 0);
    return true;
  } catch (e) {
    // UNIQUE constraint — link já existe, ok
    return false;
  }
}

function unlinkLeadFromProposal(proposalId, leadId) {
  getDb().prepare(`DELETE FROM proposal_leads WHERE proposal_id=? AND lead_id=?`)
    .run(proposalId, leadId);
}

function getLeadsByProposal(proposalId) {
  return getDb().prepare(`
    SELECT l.*, pl.is_primary, pl.linked_at
    FROM leads l
    JOIN proposal_leads pl ON pl.lead_id = l.id
    WHERE pl.proposal_id = ?
    ORDER BY pl.is_primary DESC, pl.linked_at ASC
  `).all(proposalId);
}

function getProposalsByLead(leadId) {
  return getDb().prepare(`
    SELECT p.*, pl.is_primary, pl.linked_at,
      (SELECT COUNT(*) FROM proposal_leads pl2 WHERE pl2.proposal_id = p.id) as leads_count,
      (SELECT COUNT(*) FROM proposal_items pi WHERE pi.proposal_id = p.id) as items_count
    FROM proposals p
    JOIN proposal_leads pl ON pl.proposal_id = p.id
    WHERE pl.lead_id = ?
    ORDER BY pl.linked_at DESC
  `).all(leadId);
}

// ══════════════════════════════════════════════════════════
// PROPOSAL_ITEMS
// ══════════════════════════════════════════════════════════

function saveProposalItems(proposalId, items) {
  const database = getDb();
  database.prepare(`DELETE FROM proposal_items WHERE proposal_id = ?`).run(proposalId);
  if (!items || items.length === 0) return;
  const ins = database.prepare(`
    INSERT INTO proposal_items
      (proposal_id, service_id, name, description, price, qty, unit, category, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMany = database.transaction((rows) => {
    rows.forEach((item, idx) => {
      ins.run(
        proposalId,
        item.service_id || null,
        item.name || '',
        item.description || '',
        parseFloat(item.price) || 0,
        parseInt(item.qty) || 1,
        item.unit || '/mês',
        item.category || 'monthly',
        item.sort_order != null ? item.sort_order : idx
      );
    });
  });
  insertMany(items);
}

function getProposalItems(proposalId) {
  return getDb().prepare(`
    SELECT * FROM proposal_items WHERE proposal_id = ? ORDER BY sort_order, id
  `).all(proposalId);
}

// ══════════════════════════════════════════════════════════
// SESSIONS
// ══════════════════════════════════════════════════════════

function createSession(leadId, proposalId) {
  const result = getDb().prepare(`
    INSERT INTO access_sessions (lead_id, proposal_id) VALUES (?, ?)
  `).run(leadId, proposalId || null);
  return result.lastInsertRowid;
}

function closeSession(sessionId, totalDuration) {
  getDb().prepare(`
    UPDATE access_sessions SET ended_at = CURRENT_TIMESTAMP, total_duration_seconds = ?
    WHERE id = ?
  `).run(totalDuration, sessionId);
}

function markSessionAlertSent(sessionId) {
  getDb().prepare(`UPDATE access_sessions SET alert_sent = 1 WHERE id = ?`).run(sessionId);
}

function getSessionById(sessionId) {
  return getDb().prepare('SELECT * FROM access_sessions WHERE id = ?').get(sessionId);
}

// ══════════════════════════════════════════════════════════
// SLIDE EVENTS
// ══════════════════════════════════════════════════════════

function recordSlideEvent(sessionId, leadId, proposalId, slideNumber, eventType, durationSeconds) {
  const result = getDb().prepare(`
    INSERT INTO slide_events (session_id, lead_id, proposal_id, slide_number, event_type, duration_seconds)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(sessionId, leadId, proposalId || null, slideNumber, eventType, durationSeconds || 0);
  return result.lastInsertRowid;
}

function getSlideStats(leadId) {
  return getDb().prepare(`
    SELECT slide_number, COUNT(*) as view_count,
      COALESCE(SUM(duration_seconds), 0) as total_duration
    FROM slide_events WHERE lead_id = ?
    GROUP BY slide_number ORDER BY slide_number
  `).all(leadId);
}

function getSeenSlides(leadId) {
  return getDb().prepare(`
    SELECT DISTINCT slide_number FROM slide_events WHERE lead_id = ? ORDER BY slide_number
  `).all(leadId).map(r => r.slide_number);
}

function getRevisitedSlides(leadId) {
  return getDb().prepare(`
    SELECT DISTINCT slide_number FROM slide_events
    WHERE lead_id = ? AND event_type = 'revisited' ORDER BY slide_number
  `).all(leadId).map(r => r.slide_number);
}

// ══════════════════════════════════════════════════════════
// PROPOSTA STATS — AGREGADO POR PROPOSAL (SUM de todos os leads)
// ══════════════════════════════════════════════════════════

function getProposalStats(proposalId) {
  const database = getDb();
  const proposal = getProposalWithLeads(proposalId);
  if (!proposal) return null;

  // Todos os leads vinculados
  const leadIds = proposal.leads.map(l => l.id);
  if (leadIds.length === 0) return { proposal, leads: [], slideStats: [], totalDuration: 0, totalAccesses: 0, totalSlidesSeen: 0, sessions: [], eventLog: [] };

  const placeholders = leadIds.map(() => '?').join(',');

  // Sessões de todos os leads — filtra por proposal_id se existir, senão fallback por lead_id
  const sessions = database.prepare(`
    SELECT s.*, l.name as lead_name FROM access_sessions s
    JOIN leads l ON l.id = s.lead_id
    WHERE (s.proposal_id = ? OR (s.proposal_id IS NULL AND s.lead_id IN (${placeholders})))
    ORDER BY s.started_at DESC
  `).all(proposalId, ...leadIds);

  // Slide stats AGREGADO (SUM) por slide_number — filtra por proposal_id se existir
  const slideStats = database.prepare(`
    SELECT slide_number,
      COUNT(*) as view_count,
      COALESCE(SUM(duration_seconds), 0) as total_duration,
      COALESCE(MAX(duration_seconds), 0) as max_duration,
      SUM(CASE WHEN event_type = 'revisited' THEN 1 ELSE 0 END) as revisit_count
    FROM slide_events
    WHERE (proposal_id = ? OR (proposal_id IS NULL AND lead_id IN (${placeholders})))
    GROUP BY slide_number ORDER BY slide_number
  `).all(proposalId, ...leadIds);

  const totalSlidesSeen = database.prepare(`
    SELECT COUNT(DISTINCT slide_number) as count FROM slide_events
    WHERE (proposal_id = ? OR (proposal_id IS NULL AND lead_id IN (${placeholders})))
  `).get(proposalId, ...leadIds);

  const eventLog = database.prepare(`
    SELECT e.*, l.name as lead_name FROM event_log e
    JOIN leads l ON l.id = e.lead_id
    WHERE (e.proposal_id = ? OR (e.proposal_id IS NULL AND e.lead_id IN (${placeholders})))
    ORDER BY e.timestamp DESC LIMIT 200
  `).all(proposalId, ...leadIds);

  const customPlans = database.prepare(`
    SELECT cp.*, l.name as lead_name FROM custom_plans cp
    JOIN leads l ON l.id = cp.lead_id
    WHERE cp.lead_id IN (${placeholders})
    ORDER BY cp.created_at DESC
  `).all(...leadIds);

  const proposalActions = database.prepare(`
    SELECT pa.*, l.name as lead_name FROM proposal_actions pa
    JOIN leads l ON l.id = pa.lead_id
    WHERE pa.proposal_id = ?
    ORDER BY pa.created_at DESC
  `).all(proposalId);

  const totalDuration = sessions.reduce((s, x) => s + (x.total_duration_seconds || 0), 0);

  return {
    proposal,
    leads: proposal.leads,
    sessions,
    slideStats,
    totalSlidesSeen: totalSlidesSeen ? totalSlidesSeen.count : 0,
    totalDuration,
    totalAccesses: sessions.length,
    eventLog,
    customPlans,
    proposalActions,
  };
}

// Slide stats de UM lead específico (para filtro individual no relatório)
function getLeadSlideStatsForProposal(leadId, proposalId) {
  if (proposalId) {
    return getDb().prepare(`
      SELECT slide_number,
        COUNT(*) as view_count,
        COALESCE(SUM(duration_seconds), 0) as total_duration,
        COALESCE(MAX(duration_seconds), 0) as max_duration,
        SUM(CASE WHEN event_type = 'revisited' THEN 1 ELSE 0 END) as revisit_count
      FROM slide_events
      WHERE lead_id = ? AND (proposal_id = ? OR proposal_id IS NULL)
      GROUP BY slide_number ORDER BY slide_number
    `).all(leadId, proposalId);
  }
  return getDb().prepare(`
    SELECT slide_number,
      COUNT(*) as view_count,
      COALESCE(SUM(duration_seconds), 0) as total_duration,
      COALESCE(MAX(duration_seconds), 0) as max_duration,
      SUM(CASE WHEN event_type = 'revisited' THEN 1 ELSE 0 END) as revisit_count
    FROM slide_events WHERE lead_id = ?
    GROUP BY slide_number ORDER BY slide_number
  `).all(leadId);
}

// ══════════════════════════════════════════════════════════
// EVENT LOG
// ══════════════════════════════════════════════════════════

function logEvent(leadId, sessionId, eventType, details, proposalId) {
  getDb().prepare(`
    INSERT INTO event_log (lead_id, proposal_id, session_id, event_type, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(leadId, proposalId || null, sessionId || null, eventType, details ? JSON.stringify(details) : null);
}

function getEventLog(leadId) {
  return getDb().prepare(`
    SELECT * FROM event_log WHERE lead_id = ? ORDER BY timestamp ASC
  `).all(leadId);
}

// ══════════════════════════════════════════════════════════
// CUSTOM PLANS
// ══════════════════════════════════════════════════════════

function saveCustomPlan(leadId, sessionId, selections, monthlyTotal, onetimeTotal, proposalId) {
  const result = getDb().prepare(`
    INSERT INTO custom_plans (lead_id, proposal_id, session_id, selections, monthly_total, onetime_total)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(leadId, proposalId || null, sessionId || null, JSON.stringify(selections), monthlyTotal || 0, onetimeTotal || 0);
  return result.lastInsertRowid;
}

function markCustomPlanSent(planId) {
  getDb().prepare(`UPDATE custom_plans SET sent_via_whatsapp = 1 WHERE id = ?`).run(planId);
}

function getCustomPlansByLead(leadId) {
  return getDb().prepare(`
    SELECT * FROM custom_plans WHERE lead_id = ? ORDER BY created_at DESC
  `).all(leadId);
}

// ══════════════════════════════════════════════════════════
// LEAD INVITES
// ══════════════════════════════════════════════════════════

function saveInvite(leadId, inviteType, messageIndex, messageText) {
  const result = getDb().prepare(`
    INSERT INTO lead_invites (lead_id, invite_type, message_index, message_text)
    VALUES (?, ?, ?, ?)
  `).run(leadId, inviteType, messageIndex, messageText);
  return result.lastInsertRowid;
}

function getInvitesByLead(leadId) {
  return getDb().prepare(`
    SELECT * FROM lead_invites WHERE lead_id = ? ORDER BY sent_at DESC
  `).all(leadId);
}

function countInvitesByType(leadId, inviteType) {
  const r = getDb().prepare(`
    SELECT COUNT(*) as cnt FROM lead_invites WHERE lead_id = ? AND invite_type = ?
  `).get(leadId, inviteType);
  return r ? r.cnt : 0;
}

// ══════════════════════════════════════════════════════════
// PROPOSAL ACTIONS (Accept / Counter / Reject)
// ══════════════════════════════════════════════════════════

function saveProposalAction(proposalId, leadId, actionType, comment, counterValue) {
  const r = getDb().prepare(`
    INSERT INTO proposal_actions (proposal_id, lead_id, action_type, comment, counter_value)
    VALUES (?, ?, ?, ?, ?)
  `).run(proposalId, leadId, actionType, comment || null, counterValue || null);
  return r.lastInsertRowid;
}

function getProposalActionsByProposal(proposalId) {
  return getDb().prepare(`
    SELECT pa.*, l.name as lead_name FROM proposal_actions pa
    JOIN leads l ON l.id = pa.lead_id
    WHERE pa.proposal_id = ? ORDER BY pa.created_at DESC
  `).all(proposalId);
}

function getLatestProposalAction(proposalId) {
  return getDb().prepare(`
    SELECT * FROM proposal_actions WHERE proposal_id = ? ORDER BY created_at DESC LIMIT 1
  `).get(proposalId);
}

// ══════════════════════════════════════════════════════════
// PROPOSAL SHARED LEADS (share widget)
// ══════════════════════════════════════════════════════════

function addSharedLead(proposalId, fromLeadId, newLeadId, sharedToken) {
  const r = getDb().prepare(`
    INSERT INTO proposal_shared_leads (proposal_id, shared_from_lead_id, new_lead_id, shared_token)
    VALUES (?, ?, ?, ?)
  `).run(proposalId, fromLeadId || null, newLeadId || null, sharedToken);
  return r.lastInsertRowid;
}

function getSharedLeadByToken(token) {
  return getDb().prepare(`
    SELECT psl.*, l.name as lead_name, l.whatsapp, l.email, l.company_name, l.cargo,
           p.token as proposal_token
    FROM proposal_shared_leads psl
    JOIN proposals p ON p.id = psl.proposal_id
    LEFT JOIN leads l ON l.id = psl.new_lead_id
    WHERE psl.shared_token = ?
  `).get(token);
}

// ══════════════════════════════════════════════════════════
// PROPOSAL NEW REQUESTS
// ══════════════════════════════════════════════════════════

function createProposalRequest(leadId, proposalId, companyName, cargo, briefing) {
  const r = getDb().prepare(`
    INSERT INTO proposal_new_requests (lead_id, proposal_id, company_name, cargo, briefing)
    VALUES (?, ?, ?, ?, ?)
  `).run(leadId || null, proposalId || null, companyName, cargo || '', briefing);
  return r.lastInsertRowid;
}

function getAllProposalRequests() {
  return getDb().prepare(`
    SELECT pnr.*, l.name as lead_name FROM proposal_new_requests pnr
    LEFT JOIN leads l ON l.id = pnr.lead_id
    ORDER BY pnr.created_at DESC
  `).all();
}

function updateProposalRequestStatus(id, status) {
  getDb().prepare(`UPDATE proposal_new_requests SET status=? WHERE id=?`).run(status, id);
}

// ══════════════════════════════════════════════════════════
// SERVICES
// ══════════════════════════════════════════════════════════

function getAllServices(includeInactive) {
  const q = includeInactive
    ? 'SELECT * FROM services ORDER BY sort_order, id'
    : 'SELECT * FROM services WHERE active=1 ORDER BY sort_order, id';
  return getDb().prepare(q).all();
}
function getServiceById(id) { return getDb().prepare('SELECT * FROM services WHERE id=?').get(id); }
function createService(name, key, category, description, price, unit, sortOrder) {
  const r = getDb().prepare(`
    INSERT INTO services (name, key, category, description, price, unit, sort_order)
    VALUES (?,?,?,?,?,?,?)
  `).run(name, key, category, description || '', price, unit || '/mês', sortOrder || 0);
  return r.lastInsertRowid;
}
function updateService(id, name, category, description, price, unit, active) {
  getDb().prepare(`
    UPDATE services SET name=?, category=?, description=?, price=?, unit=?, active=? WHERE id=?
  `).run(name, category, description || '', price, unit || '/mês', active ? 1 : 0, id);
}
function deleteService(id) { getDb().prepare('DELETE FROM services WHERE id=?').run(id); }

// ══════════════════════════════════════════════════════════
// DISCOUNT RULES
// ══════════════════════════════════════════════════════════

function getAllDiscountRules(includeInactive) {
  const q = includeInactive
    ? 'SELECT * FROM discount_rules ORDER BY id'
    : 'SELECT * FROM discount_rules WHERE active=1 ORDER BY id';
  return getDb().prepare(q).all();
}
function getDiscountRuleById(id) { return getDb().prepare('SELECT * FROM discount_rules WHERE id=?').get(id); }
function createDiscountRule(name, serviceKeys, discountPct, description) {
  const keysStr = Array.isArray(serviceKeys) ? serviceKeys.join(',') : serviceKeys;
  const r = getDb().prepare(`
    INSERT INTO discount_rules (name, service_keys, discount_pct, description)
    VALUES (?,?,?,?)
  `).run(name, keysStr, discountPct, description || '');
  return r.lastInsertRowid;
}
function updateDiscountRule(id, name, serviceKeys, discountPct, description, active) {
  const keysStr = Array.isArray(serviceKeys) ? serviceKeys.join(',') : serviceKeys;
  getDb().prepare(`
    UPDATE discount_rules SET name=?, service_keys=?, discount_pct=?, description=?, active=? WHERE id=?
  `).run(name, keysStr, discountPct, description || '', active ? 1 : 0, id);
}
function deleteDiscountRule(id) { getDb().prepare('DELETE FROM discount_rules WHERE id=?').run(id); }

// ══════════════════════════════════════════════════════════
// PLANEJAMENTOS (inalterados)
// ══════════════════════════════════════════════════════════

function createPlanejamento(title, filename) {
  const result = getDb().prepare(`
    INSERT INTO planejamentos (title, original_filename) VALUES (?, ?)
  `).run(title, filename);
  return result.lastInsertRowid;
}
function getPlanejamentoById(id) { return getDb().prepare('SELECT * FROM planejamentos WHERE id = ?').get(id); }
function getPlanejamentoByToken(token) { return getDb().prepare('SELECT * FROM planejamentos WHERE token = ?').get(token); }
function getAllPlanejamentos() {
  return getDb().prepare(`
    SELECT p.*,
      COUNT(ps.id) as total_slides,
      SUM(CASE WHEN ps.status='approved' THEN 1 ELSE 0 END) as approved_slides,
      SUM(CASE WHEN ps.status='revision' THEN 1 ELSE 0 END) as revision_slides
    FROM planejamentos p
    LEFT JOIN planejamento_slides ps ON ps.planejamento_id = p.id
    GROUP BY p.id ORDER BY p.created_at DESC
  `).all();
}
function approvePlanejamento(id, clientName, clientWhatsapp, clientEmail, token) {
  getDb().prepare(`
    UPDATE planejamentos SET client_name=?, client_whatsapp=?, client_email=?, token=?,
    status='sent', sent_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(clientName, clientWhatsapp, clientEmail, token, id);
}
function updatePlanejamentoStatus(id, status) {
  getDb().prepare(`UPDATE planejamentos SET status=? WHERE id=?`).run(status, id);
}
function markPlanejamentoReviewed(id) {
  getDb().prepare(`UPDATE planejamentos SET reviewed_at=CURRENT_TIMESTAMP WHERE id=?`).run(id);
}
function addPlanejamentoSlide(planejamentoId, slideNumber, title, content) {
  const result = getDb().prepare(`
    INSERT INTO planejamento_slides (planejamento_id, slide_number, title, content)
    VALUES (?, ?, ?, ?)
  `).run(planejamentoId, slideNumber, title, content);
  return result.lastInsertRowid;
}
function getPlanejamentoSlides(planejamentoId) {
  return getDb().prepare(`
    SELECT * FROM planejamento_slides WHERE planejamento_id = ? ORDER BY slide_number
  `).all(planejamentoId);
}
function updatePlanejamentoSlide(id, title, content) {
  getDb().prepare(`UPDATE planejamento_slides SET title=?, content=? WHERE id=?`).run(title, content, id);
}
function deletePlanejamentoSlide(id) {
  getDb().prepare(`DELETE FROM planejamento_slides WHERE id=?`).run(id);
}
function approveSlide(planejamentoId, slideNumber) {
  getDb().prepare(`
    UPDATE planejamento_slides SET status='approved', reviewed_at=CURRENT_TIMESTAMP
    WHERE planejamento_id=? AND slide_number=?
  `).run(planejamentoId, slideNumber);
}
function requestRevisionSlide(planejamentoId, slideNumber, comment) {
  getDb().prepare(`
    UPDATE planejamento_slides SET status='revision', client_comment=?, reviewed_at=CURRENT_TIMESTAMP
    WHERE planejamento_id=? AND slide_number=?
  `).run(comment, planejamentoId, slideNumber);
}
function reorderPlanejamentoSlides(planejamentoId) {
  const slides = getDb().prepare(`
    SELECT id FROM planejamento_slides WHERE planejamento_id=? ORDER BY slide_number
  `).all(planejamentoId);
  const update = getDb().prepare(`UPDATE planejamento_slides SET slide_number=? WHERE id=?`);
  slides.forEach((s, i) => update.run(i + 1, s.id));
}
function createPlanejamentoSession(planejamentoId, clientName) {
  const result = getDb().prepare(`
    INSERT INTO planejamento_sessions (planejamento_id, client_name) VALUES (?, ?)
  `).run(planejamentoId, clientName);
  return result.lastInsertRowid;
}
function closePlanejamentoSession(sessionId, totalDuration) {
  getDb().prepare(`
    UPDATE planejamento_sessions SET ended_at=CURRENT_TIMESTAMP, total_duration=? WHERE id=?
  `).run(totalDuration, sessionId);
}
function markPlanejamentoSessionAlertSent(sessionId) {
  getDb().prepare(`UPDATE planejamento_sessions SET alert_sent=1 WHERE id=?`).run(sessionId);
}
function recordPlanejamentoSlideEvent(sessionId, planejamentoId, slideNumber, eventType, duration, comment) {
  getDb().prepare(`
    INSERT INTO planejamento_slide_events
      (session_id, planejamento_id, slide_number, event_type, duration_seconds, comment)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(sessionId || null, planejamentoId, slideNumber, eventType, duration || 0, comment || null);
}
function logPlanejamentoEvent(planejamentoId, eventType, details) {
  getDb().prepare(`
    INSERT INTO planejamento_event_log (planejamento_id, event_type, details)
    VALUES (?, ?, ?)
  `).run(planejamentoId, eventType, details ? JSON.stringify(details) : null);
}
function getPlanejamentoEventLog(planejamentoId) {
  return getDb().prepare(`
    SELECT * FROM planejamento_event_log WHERE planejamento_id=? ORDER BY timestamp ASC
  `).all(planejamentoId);
}
function getPlanejamentoStats(planejamentoId) {
  const db = getDb();
  const plan = getPlanejamentoById(planejamentoId);
  if (!plan) return null;
  const slides = getPlanejamentoSlides(planejamentoId);
  const sessions = db.prepare(`
    SELECT * FROM planejamento_sessions WHERE planejamento_id=? ORDER BY started_at DESC
  `).all(planejamentoId);
  const slideEvents = db.prepare(`
    SELECT slide_number, COUNT(*) as view_count, COALESCE(SUM(duration_seconds),0) as total_duration,
      SUM(CASE WHEN event_type='approved' THEN 1 ELSE 0 END) as approved_count,
      SUM(CASE WHEN event_type='revision' THEN 1 ELSE 0 END) as revision_count
    FROM planejamento_slide_events WHERE planejamento_id=? GROUP BY slide_number ORDER BY slide_number
  `).all(planejamentoId);
  const eventLog = getPlanejamentoEventLog(planejamentoId);
  const totalDuration = sessions.reduce((s, x) => s + (x.total_duration || 0), 0);
  return { plan, slides, sessions, slideEvents, eventLog, totalDuration, totalAccesses: sessions.length };
}

// ══════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════

module.exports = {
  getDb,
  // Leads
  createLead, getLeadById, getLeadByEmail, getAllLeads, getLeadStats,
  updateLead, updateLeadCompany, deleteLead,
  getLeadSlideStatsForProposal,
  // Proposals
  createProposal, getProposalById, getProposalByToken, getProposalByTokenWithLeads,
  getProposalWithLeads, getAllProposals,
  updateProposalContent, updateProposalMode, markProposalSent,
  setProposalStatus, deleteProposal, archiveProposal,
  // Junction
  linkLeadToProposal, unlinkLeadFromProposal, getLeadsByProposal, getProposalsByLead,
  // Proposal Items
  saveProposalItems, getProposalItems,
  // Stats
  getProposalStats,
  // Sessions
  createSession, closeSession, getSessionById, markSessionAlertSent,
  // Slide Events
  recordSlideEvent, getSlideStats, getSeenSlides, getRevisitedSlides,
  // Event Log
  logEvent, getEventLog,
  // Custom Plans
  saveCustomPlan, markCustomPlanSent, getCustomPlansByLead,
  // Invites
  saveInvite, getInvitesByLead, countInvitesByType,
  // Proposal Actions
  saveProposalAction, getProposalActionsByProposal, getLatestProposalAction,
  // Shared Leads
  addSharedLead, getSharedLeadByToken,
  // Proposal Requests
  createProposalRequest, getAllProposalRequests, updateProposalRequestStatus,
  // Services
  getAllServices, getServiceById, createService, updateService, deleteService,
  // Discount Rules
  getAllDiscountRules, getDiscountRuleById, createDiscountRule, updateDiscountRule, deleteDiscountRule,
  // Planejamentos
  createPlanejamento, getPlanejamentoById, getPlanejamentoByToken,
  getAllPlanejamentos, approvePlanejamento, updatePlanejamentoStatus, markPlanejamentoReviewed,
  addPlanejamentoSlide, getPlanejamentoSlides, updatePlanejamentoSlide,
  deletePlanejamentoSlide, approveSlide, requestRevisionSlide, reorderPlanejamentoSlides,
  createPlanejamentoSession, closePlanejamentoSession, markPlanejamentoSessionAlertSent,
  recordPlanejamentoSlideEvent, logPlanejamentoEvent, getPlanejamentoEventLog, getPlanejamentoStats,
};
