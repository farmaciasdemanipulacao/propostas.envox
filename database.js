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

  // Tabela de leads
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

  // Tabela de sessões de acesso
  database.exec(`
    CREATE TABLE IF NOT EXISTS access_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      total_duration_seconds INTEGER DEFAULT 0,
      FOREIGN KEY (lead_id) REFERENCES leads(id)
    )
  `);

  // Tabela de eventos de slides
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

  // Tabela de log de eventos
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

  console.log('✅ Banco de dados inicializado com sucesso');
}

// ============ LEADS ============

function createLead(name, whatsapp, email, token) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO leads (name, whatsapp, email, token)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(name, whatsapp, email, token);
  return result.lastInsertRowid;
}

function getLeadById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
}

function getLeadByToken(token) {
  const db = getDb();
  return db.prepare('SELECT * FROM leads WHERE token = ?').get(token);
}

function getAllLeads() {
  const db = getDb();
  return db.prepare(`
    SELECT 
      l.*,
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
    GROUP BY l.id
    ORDER BY l.created_at DESC
  `).all();
}

function getLeadStats(leadId) {
  const db = getDb();
  
  const lead = getLeadById(leadId);
  if (!lead) return null;

  const sessions = db.prepare(`
    SELECT * FROM access_sessions WHERE lead_id = ? ORDER BY started_at DESC
  `).all(leadId);

  const slideStats = db.prepare(`
    SELECT 
      slide_number,
      COUNT(*) as view_count,
      SUM(duration_seconds) as total_duration,
      MAX(duration_seconds) as max_duration,
      SUM(CASE WHEN event_type = 'revisited' THEN 1 ELSE 0 END) as revisit_count
    FROM slide_events
    WHERE lead_id = ?
    GROUP BY slide_number
    ORDER BY slide_number
  `).all(leadId);

  const totalSlidesSeen = db.prepare(`
    SELECT COUNT(DISTINCT slide_number) as count FROM slide_events WHERE lead_id = ?
  `).get(leadId);

  const eventLog = db.prepare(`
    SELECT * FROM event_log WHERE lead_id = ? ORDER BY timestamp DESC LIMIT 100
  `).all(leadId);

  const totalDuration = sessions.reduce((sum, s) => sum + (s.total_duration_seconds || 0), 0);
  const totalAccesses = sessions.length;

  return {
    lead,
    sessions,
    slideStats,
    totalSlidesSeen: totalSlidesSeen ? totalSlidesSeen.count : 0,
    eventLog,
    totalDuration,
    totalAccesses
  };
}

// ============ SESSÕES ============

function createSession(leadId) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO access_sessions (lead_id) VALUES (?)
  `);
  const result = stmt.run(leadId);
  return result.lastInsertRowid;
}

function closeSession(sessionId, totalDuration) {
  const db = getDb();
  db.prepare(`
    UPDATE access_sessions 
    SET ended_at = CURRENT_TIMESTAMP, total_duration_seconds = ?
    WHERE id = ?
  `).run(totalDuration, sessionId);
}

function getSessionById(sessionId) {
  const db = getDb();
  return db.prepare('SELECT * FROM access_sessions WHERE id = ?').get(sessionId);
}

// ============ SLIDE EVENTS ============

function recordSlideEvent(sessionId, leadId, slideNumber, eventType, durationSeconds) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO slide_events (session_id, lead_id, slide_number, event_type, duration_seconds)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(sessionId, leadId, slideNumber, eventType, durationSeconds || 0);
  return result.lastInsertRowid;
}

function getSlideStats(leadId) {
  const db = getDb();
  return db.prepare(`
    SELECT 
      slide_number,
      COUNT(*) as view_count,
      COALESCE(SUM(duration_seconds), 0) as total_duration,
      COALESCE(MAX(duration_seconds), 0) as max_duration,
      SUM(CASE WHEN event_type = 'revisited' THEN 1 ELSE 0 END) as revisit_count
    FROM slide_events
    WHERE lead_id = ?
    GROUP BY slide_number
    ORDER BY slide_number
  `).all(leadId);
}

function getSeenSlides(leadId) {
  const db = getDb();
  return db.prepare(`
    SELECT DISTINCT slide_number FROM slide_events WHERE lead_id = ?
  `).all(leadId).map(r => r.slide_number);
}

function getRevisitedSlides(leadId) {
  const db = getDb();
  return db.prepare(`
    SELECT DISTINCT slide_number FROM slide_events 
    WHERE lead_id = ? AND event_type = 'revisited'
  `).all(leadId).map(r => r.slide_number);
}

// ============ EVENT LOG ============

function logEvent(leadId, sessionId, eventType, details) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO event_log (lead_id, session_id, event_type, details)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(leadId, sessionId || null, eventType, details ? JSON.stringify(details) : null);
}

function getEventLog(leadId) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM event_log WHERE lead_id = ? ORDER BY timestamp ASC
  `).all(leadId);
}

module.exports = {
  getDb,
  // Leads
  createLead,
  getLeadById,
  getLeadByToken,
  getAllLeads,
  getLeadStats,
  // Sessions
  createSession,
  closeSession,
  getSessionById,
  // Slide Events
  recordSlideEvent,
  getSlideStats,
  getSeenSlides,
  getRevisitedSlides,
  // Event Log
  logEvent,
  getEventLog
};
