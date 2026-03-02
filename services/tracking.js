const db = require('../database');
const { calculateInterestLevel } = require('./interest');
const { sendWhatsAppAlert, buildAlertData } = require('./whatsapp');

/**
 * Registra abertura de proposta e cria sessão
 */
function openProposal(leadId) {
  const sessionId = db.createSession(leadId);
  db.logEvent(leadId, sessionId, 'proposal_opened', { message: 'Abriu a proposta' });
  return sessionId;
}

/**
 * Registra visualização de slide
 */
function trackSlide(sessionId, leadId, slideNumber, duration, isRevisit) {
  const eventType = isRevisit ? 'revisited' : 'viewed';
  db.recordSlideEvent(sessionId, leadId, slideNumber, eventType, duration);
  
  const slideNames = [
    '', 'Capa', 'O Problema', 'Nossa Solução',
    'Plano 1 - Crescimento', 'Plano 2 - Presença Forte', 'Plano 3 - Performance+',
    'Comparativo', 'Serviços Adicionais', 'Serviços Separados',
    'Por que a Envox?', 'Encerramento'
  ];
  
  const slideName = slideNames[slideNumber] || `Slide ${slideNumber}`;
  const message = isRevisit 
    ? `Voltou ao slide ${slideNumber} (${slideName})`
    : `Visualizou slide ${slideNumber} (${slideName})`;
  
  db.logEvent(leadId, sessionId, isRevisit ? 'slide_revisited' : 'slide_viewed', {
    slide_number: slideNumber,
    slide_name: slideName,
    duration_seconds: duration,
    message
  });
}

/**
 * Registra fechamento da proposta e dispara alerta WhatsApp
 */
async function closeProposal(sessionId, leadId, totalDuration) {
  db.closeSession(sessionId, totalDuration);
  db.logEvent(leadId, sessionId, 'proposal_closed', {
    total_duration: totalDuration,
    message: 'Fechou a proposta'
  });

  // Disparar alerta WhatsApp de forma assíncrona
  try {
    const stats = db.getLeadStats(leadId);
    if (stats) {
      const interestLevel = calculateInterestLevel({
        totalDuration: stats.totalDuration,
        totalSlidesSeen: stats.totalSlidesSeen,
        totalAccesses: stats.totalAccesses,
        slideStats: stats.slideStats
      });

      const alertData = buildAlertData(
        stats.lead,
        stats.slideStats,
        stats.totalDuration,
        stats.totalSlidesSeen,
        interestLevel
      );

      // Disparar sem aguardar
      sendWhatsAppAlert(alertData).catch(err => {
        console.error('WhatsApp alert error:', err);
      });
    }
  } catch (err) {
    console.error('Error preparing WhatsApp alert:', err);
  }
}

module.exports = { openProposal, trackSlide, closeProposal };
