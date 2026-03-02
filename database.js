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

  // ── TABELAS EXISTENTES ──────────────────────────────────────────────
  database.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      email TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS access_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      total_duration_seconds INTEGER DEFAULT 0,
      alert_sent INTEGER DEFAULT 0,
      FOREIGN KEY (lead_id) REFERENCES leads(id)
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS slide_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      lead_id INTEGER NOT NULL,
      slide_number INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      duration_seconds REAL DEFAULT 0,
      FOREIGN KEY (session_id) REFERENCES access_sessions(id),
      FOREIGN KEY (lead_id) REFERENCES leads(id)
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS event_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      session_id INTEGER,
      event_type TEXT NOT NULL,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id) REFERENCES leads(id)
    )
  `);

  // ── NOVAS TABELAS ──────────────────────────────────────────────────

  // Planos customizados montados pelo lead
  database.exec(`
    CREATE TABLE IF NOT EXISTS custom_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      session_id INTEGER,
      selections TEXT NOT NULL,
      monthly_total REAL DEFAULT 0,
      onetime_total REAL DEFAULT 0,
      sent_via_whatsapp INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id) REFERENCES leads(id)
    )
  `);

  // Convites e follow-ups enviados para leads
  database.exec(`
    CREATE TABLE IF NOT EXISTS lead_invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      invite_type TEXT NOT NULL,
      message_index INTEGER NOT NULL,
      message_text TEXT NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id) REFERENCES leads(id)
    )
  `);

  // Planejamentos de marketing
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

  // Slides dos planejamentos
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

  // Sessões de revisão de planejamento
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

  // Eventos de slides de planejamento
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

  // Log de eventos de planejamento
  database.exec(`
    CREATE TABLE IF NOT EXISTS planejamento_event_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      planejamento_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migração: adicionar alert_sent à access_sessions se não existir
  try {
    database.exec(`ALTER TABLE access_sessions ADD COLUMN alert_sent INTEGER DEFAULT 0`);
  } catch(e) { /* já existe */ }

  console.log('✅ Banco de dados inicializado com sucesso');
}

// ══════════════════════════════════════════════════════════
// LEADS
// ══════════════════════════════════════════════════════════
function createLead(name, whatsapp, email, token) {
  const db = getDb();
  const result = db.prepare(`INSERT INTO leads (name, whatsapp, email, token) VALUES (?, ?, ?, ?)`).run(name, whatsapp, email, token);
  return result.lastInsertRowid;
}
function getLeadById(id) { return getDb().prepare('SELECT * FROM leads WHERE id = ?').get(id); }
function getLeadByToken(token) { return getDb().prepare('SELECT * FROM leads WHERE token = ?').get(token); }

function getAllLeads() {
  return getDb().prepare(`
    SELECT l.*,
      COUNT(DISTINCT s.id) as total_accesses,
      MAX(s.started_at) as last_access,
      COALESCE(SUM(s.total_duration_seconds), 0) as total_duration,
      CASE 
        WHEN COUNT(DISTINCT s.id) = 0 THEN 'not_viewed'
        WHEN EXISTS (SELECT 1 FROM access_sessions s2 WHERE s2.lead_id = l.id AND s2.ended_at IS NULL) THEN 'viewing'
        ELSE 'viewed'
      END as status
    FROM leads l
    LEFT JOIN access_sessions s ON s.lead_id = l.id
    GROUP BY l.id ORDER BY l.created_at DESC
  `).all();
}

function getLeadStats(leadId) {
  const db = getDb();
  const lead = getLeadById(leadId);
  if (!lead) return null;
  const sessions = db.prepare(`SELECT * FROM access_sessions WHERE lead_id = ? ORDER BY started_at DESC`).all(leadId);
  const slideStats = db.prepare(`
    SELECT slide_number,
      COUNT(*) as view_count,
      COALESCE(SUM(duration_seconds), 0) as total_duration,
      COALESCE(MAX(duration_seconds), 0) as max_duration,
      SUM(CASE WHEN event_type = 'revisited' THEN 1 ELSE 0 END) as revisit_count
    FROM slide_events WHERE lead_id = ? GROUP BY slide_number ORDER BY slide_number
  `).all(leadId);
  const totalSlidesSeen = db.prepare(`SELECT COUNT(DISTINCT slide_number) as count FROM slide_events WHERE lead_id = ?`).get(leadId);
  const eventLog = db.prepare(`SELECT * FROM event_log WHERE lead_id = ? ORDER BY timestamp DESC LIMIT 100`).all(leadId);
  const customPlans = db.prepare(`SELECT * FROM custom_plans WHERE lead_id = ? ORDER BY created_at DESC`).all(leadId);
  const invites = db.prepare(`SELECT * FROM lead_invites WHERE lead_id = ? ORDER BY sent_at DESC`).all(leadId);
  const totalDuration = sessions.reduce((s, x) => s + (x.total_duration_seconds || 0), 0);
  return { lead, sessions, slideStats, totalSlidesSeen: totalSlidesSeen ? totalSlidesSeen.count : 0, eventLog, customPlans, invites, totalDuration, totalAccesses: sessions.length };
}

// ══════════════════════════════════════════════════════════
// SESSIONS
// ══════════════════════════════════════════════════════════
function createSession(leadId) {
  const result = getDb().prepare(`INSERT INTO access_sessions (lead_id) VALUES (?)`).run(leadId);
  return result.lastInsertRowid;
}
function closeSession(sessionId, totalDuration) {
  getDb().prepare(`UPDATE access_sessions SET ended_at = CURRENT_TIMESTAMP, total_duration_seconds = ? WHERE id = ?`).run(totalDuration, sessionId);
}
function markSessionAlertSent(sessionId) {
  getDb().prepare(`UPDATE access_sessions SET alert_sent = 1 WHERE id = ?`).run(sessionId);
}
function getSessionById(sessionId) { return getDb().prepare('SELECT * FROM access_sessions WHERE id = ?').get(sessionId); }

// ══════════════════════════════════════════════════════════
// SLIDE EVENTS
// ══════════════════════════════════════════════════════════
function recordSlideEvent(sessionId, leadId, slideNumber, eventType, durationSeconds) {
  const result = getDb().prepare(`INSERT INTO slide_events (session_id, lead_id, slide_number, event_type, duration_seconds) VALUES (?, ?, ?, ?, ?)`).run(sessionId, leadId, slideNumber, eventType, durationSeconds || 0);
  return result.lastInsertRowid;
}
function getSlideStats(leadId) {
  return getDb().prepare(`
    SELECT slide_number, COUNT(*) as view_count,
      COALESCE(SUM(duration_seconds),0) as total_duration,
      COALESCE(MAX(duration_seconds),0) as max_duration,
      SUM(CASE WHEN event_type='revisited' THEN 1 ELSE 0 END) as revisit_count
    FROM slide_events WHERE lead_id = ? GROUP BY slide_number ORDER BY slide_number
  `).all(leadId);
}
function getSeenSlides(leadId) {
  return getDb().prepare(`SELECT DISTINCT slide_number FROM slide_events WHERE lead_id = ?`).all(leadId).map(r => r.slide_number);
}
function getRevisitedSlides(leadId) {
  return getDb().prepare(`SELECT DISTINCT slide_number FROM slide_events WHERE lead_id = ? AND event_type = 'revisited'`).all(leadId).map(r => r.slide_number);
}

// ══════════════════════════════════════════════════════════
// EVENT LOG
// ══════════════════════════════════════════════════════════
function logEvent(leadId, sessionId, eventType, details) {
  getDb().prepare(`INSERT INTO event_log (lead_id, session_id, event_type, details) VALUES (?, ?, ?, ?)`).run(leadId, sessionId || null, eventType, details ? JSON.stringify(details) : null);
}
function getEventLog(leadId) {
  return getDb().prepare(`SELECT * FROM event_log WHERE lead_id = ? ORDER BY timestamp ASC`).all(leadId);
}

// ══════════════════════════════════════════════════════════
// CUSTOM PLANS
// ══════════════════════════════════════════════════════════
function saveCustomPlan(leadId, sessionId, selections, monthlyTotal, onetimeTotal) {
  const result = getDb().prepare(`INSERT INTO custom_plans (lead_id, session_id, selections, monthly_total, onetime_total) VALUES (?, ?, ?, ?, ?)`).run(leadId, sessionId || null, JSON.stringify(selections), monthlyTotal || 0, onetimeTotal || 0);
  return result.lastInsertRowid;
}
function markCustomPlanSent(planId) {
  getDb().prepare(`UPDATE custom_plans SET sent_via_whatsapp = 1 WHERE id = ?`).run(planId);
}
function getCustomPlansByLead(leadId) {
  return getDb().prepare(`SELECT * FROM custom_plans WHERE lead_id = ? ORDER BY created_at DESC`).all(leadId);
}

// ══════════════════════════════════════════════════════════
// LEAD INVITES
// ══════════════════════════════════════════════════════════
function saveInvite(leadId, inviteType, messageIndex, messageText) {
  const result = getDb().prepare(`INSERT INTO lead_invites (lead_id, invite_type, message_index, message_text) VALUES (?, ?, ?, ?)`).run(leadId, inviteType, messageIndex, messageText);
  return result.lastInsertRowid;
}
function getInvitesByLead(leadId) {
  return getDb().prepare(`SELECT * FROM lead_invites WHERE lead_id = ? ORDER BY sent_at DESC`).all(leadId);
}
function countInvitesByType(leadId, inviteType) {
  const r = getDb().prepare(`SELECT COUNT(*) as cnt FROM lead_invites WHERE lead_id = ? AND invite_type = ?`).get(leadId, inviteType);
  return r ? r.cnt : 0;
}

// ══════════════════════════════════════════════════════════
// PLANEJAMENTOS
// ══════════════════════════════════════════════════════════
function createPlanejamento(title, filename) {
  const result = getDb().prepare(`INSERT INTO planejamentos (title, original_filename) VALUES (?, ?)`).run(title, filename);
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
  getDb().prepare(`UPDATE planejamentos SET client_name=?, client_whatsapp=?, client_email=?, token=?, status='sent', sent_at=CURRENT_TIMESTAMP WHERE id=?`).run(clientName, clientWhatsapp, clientEmail, token, id);
}
function updatePlanejamentoStatus(id, status) {
  getDb().prepare(`UPDATE planejamentos SET status=? WHERE id=?`).run(status, id);
}
function markPlanejamentoReviewed(id) {
  getDb().prepare(`UPDATE planejamentos SET reviewed_at=CURRENT_TIMESTAMP WHERE id=?`).run(id);
}

// Slides de planejamento
function addPlanejamentoSlide(planejamentoId, slideNumber, title, content) {
  const result = getDb().prepare(`INSERT INTO planejamento_slides (planejamento_id, slide_number, title, content) VALUES (?, ?, ?, ?)`).run(planejamentoId, slideNumber, title, content);
  return result.lastInsertRowid;
}
function getPlanejamentoSlides(planejamentoId) {
  return getDb().prepare(`SELECT * FROM planejamento_slides WHERE planejamento_id = ? ORDER BY slide_number`).all(planejamentoId);
}
function updatePlanejamentoSlide(id, title, content) {
  getDb().prepare(`UPDATE planejamento_slides SET title=?, content=? WHERE id=?`).run(title, content, id);
}
function deletePlanejamentoSlide(id) {
  getDb().prepare(`DELETE FROM planejamento_slides WHERE id=?`).run(id);
}
function approveSlide(planejamentoId, slideNumber) {
  getDb().prepare(`UPDATE planejamento_slides SET status='approved', reviewed_at=CURRENT_TIMESTAMP WHERE planejamento_id=? AND slide_number=?`).run(planejamentoId, slideNumber);
}
function requestRevisionSlide(planejamentoId, slideNumber, comment) {
  getDb().prepare(`UPDATE planejamento_slides SET status='revision', client_comment=?, reviewed_at=CURRENT_TIMESTAMP WHERE planejamento_id=? AND slide_number=?`).run(comment, planejamentoId, slideNumber);
}
function reorderPlanejamentoSlides(planejamentoId) {
  const slides = getDb().prepare(`SELECT id FROM planejamento_slides WHERE planejamento_id=? ORDER BY slide_number`).all(planejamentoId);
  const update = getDb().prepare(`UPDATE planejamento_slides SET slide_number=? WHERE id=?`);
  slides.forEach((s, i) => update.run(i + 1, s.id));
}

// Sessions de planejamento
function createPlanejamentoSession(planejamentoId, clientName) {
  const result = getDb().prepare(`INSERT INTO planejamento_sessions (planejamento_id, client_name) VALUES (?, ?)`).run(planejamentoId, clientName);
  return result.lastInsertRowid;
}
function closePlanejamentoSession(sessionId, totalDuration) {
  getDb().prepare(`UPDATE planejamento_sessions SET ended_at=CURRENT_TIMESTAMP, total_duration=? WHERE id=?`).run(totalDuration, sessionId);
}
function markPlanejamentoSessionAlertSent(sessionId) {
  getDb().prepare(`UPDATE planejamento_sessions SET alert_sent=1 WHERE id=?`).run(sessionId);
}

// Slide events de planejamento
function recordPlanejamentoSlideEvent(sessionId, planejamentoId, slideNumber, eventType, duration, comment) {
  getDb().prepare(`INSERT INTO planejamento_slide_events (session_id, planejamento_id, slide_number, event_type, duration_seconds, comment) VALUES (?, ?, ?, ?, ?, ?)`).run(sessionId || null, planejamentoId, slideNumber, eventType, duration || 0, comment || null);
}

// Event log de planejamento
function logPlanejamentoEvent(planejamentoId, eventType, details) {
  getDb().prepare(`INSERT INTO planejamento_event_log (planejamento_id, event_type, details) VALUES (?, ?, ?)`).run(planejamentoId, eventType, details ? JSON.stringify(details) : null);
}
function getPlanejamentoEventLog(planejamentoId) {
  return getDb().prepare(`SELECT * FROM planejamento_event_log WHERE planejamento_id=? ORDER BY timestamp ASC`).all(planejamentoId);
}

// Stats de planejamento
function getPlanejamentoStats(planejamentoId) {
  const db = getDb();
  const plan = getPlanejamentoById(planejamentoId);
  if (!plan) return null;
  const slides = getPlanejamentoSlides(planejamentoId);
  const sessions = db.prepare(`SELECT * FROM planejamento_sessions WHERE planejamento_id=? ORDER BY started_at DESC`).all(planejamentoId);
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

module.exports = {
  getDb,
  // Leads
  createLead, getLeadById, getLeadByToken, getAllLeads, getLeadStats,
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
  // Planejamentos
  createPlanejamento, getPlanejamentoById, getPlanejamentoByToken,
  getAllPlanejamentos, approvePlanejamento, updatePlanejamentoStatus, markPlanejamentoReviewed,
  addPlanejamentoSlide, getPlanejamentoSlides, updatePlanejamentoSlide,
  deletePlanejamentoSlide, approveSlide, requestRevisionSlide, reorderPlanejamentoSlides,
  createPlanejamentoSession, closePlanejamentoSession, markPlanejamentoSessionAlertSent,
  recordPlanejamentoSlideEvent, logPlanejamentoEvent, getPlanejamentoEventLog, getPlanejamentoStats
};
