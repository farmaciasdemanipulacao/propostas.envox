const db = require('../database');
const { calculateInterestLevel } = require('./interest');
const { sendWhatsAppAlert, buildAlertData } = require('./whatsapp');

function openProposal(leadId) {
  const sessionId = db.createSession(leadId);
  db.logEvent(leadId, sessionId, 'proposal_opened', { message: 'Abriu a proposta' });
  return sessionId;
}

function trackSlide(sessionId, leadId, slideNumber, duration, isRevisit) {
  const eventType = isRevisit ? 'revisited' : 'viewed';
  db.recordSlideEvent(sessionId, leadId, slideNumber, eventType, duration);
  const SLIDE_NAMES = ['','Capa','O Problema','Nossa Solução','Plano 1 - Crescimento','Plano 2 - Presença Forte','Plano 3 - Performance+','Comparativo','Monte seu Plano','Adicionais','Separados','Por que a Envox?','Encerramento'];
  const slideName = SLIDE_NAMES[slideNumber] || `Slide ${slideNumber}`;
  const msg = isRevisit ? `Voltou ao slide ${slideNumber} (${slideName})` : `Visualizou slide ${slideNumber} (${slideName})`;
  db.logEvent(leadId, sessionId, isRevisit ? 'slide_revisited' : 'slide_viewed', { slide_number: slideNumber, slide_name: slideName, duration_seconds: duration, message: msg });
}

async function closeProposal(sessionId, leadId, totalDuration) {
  db.closeSession(sessionId, totalDuration);
  db.logEvent(leadId, sessionId, 'proposal_closed', { total_duration: totalDuration, message: 'Fechou a proposta' });

  // Disparar alerta CallMeBot imediatamente
  try {
    const sess = db.getSessionById(sessionId);
    if (sess && sess.alert_sent) return; // já enviou

    const stats = db.getLeadStats(leadId);
    if (stats) {
      const interestLevel = calculateInterestLevel({
        totalDuration: stats.totalDuration,
        totalSlidesSeen: stats.totalSlidesSeen,
        totalAccesses: stats.totalAccesses,
        slideStats: stats.slideStats
      });
      const alertData = buildAlertData(stats.lead, stats.slideStats, stats.totalDuration, stats.totalSlidesSeen, interestLevel);
      sendWhatsAppAlert(alertData)
        .then(ok => { if (ok) db.markSessionAlertSent(sessionId); })
        .catch(err => console.error('WhatsApp alert error:', err));
    }
  } catch (err) {
    console.error('Error preparing WhatsApp alert:', err);
  }
}

module.exports = { openProposal, trackSlide, closeProposal };
