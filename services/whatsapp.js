const fetch = require('node-fetch');

/**
 * Envia alerta WhatsApp via CallMeBot
 */
async function sendWhatsAppAlert(leadData) {
  const phone = process.env.CALLMEBOT_PHONE;
  const apiKey = process.env.CALLMEBOT_APIKEY;

  if (!phone || !apiKey) {
    console.log('⚠️  WhatsApp alert skipped: CALLMEBOT_PHONE or CALLMEBOT_APIKEY not configured');
    return false;
  }

  const { lead, totalDuration, totalSlidesSeen, mostViewedSlide, interestLevel } = leadData;

  const slideNames = [
    '', 'Capa', 'O Problema', 'Nossa Solução',
    'Plano 1 - Crescimento', 'Plano 2 - Presença Forte', 'Plano 3 - Performance+',
    'Comparativo', 'Serviços Adicionais', 'Serviços Separados',
    'Por que a Envox?', 'Encerramento'
  ];

  const minutes = Math.floor(totalDuration / 60);
  const seconds = totalDuration % 60;
  const durationText = minutes > 0 
    ? `${minutes}min ${seconds}s` 
    : `${seconds}s`;

  const mostViewedName = mostViewedSlide ? (slideNames[mostViewedSlide] || `Slide ${mostViewedSlide}`) : 'N/A';

  const message = `🔔 PROPOSTA VISUALIZADA!

Lead: ${lead.name}
WhatsApp: ${lead.whatsapp}
Email: ${lead.email}

📊 Resumo:
- Tempo total: ${durationText}
- Slides visualizados: ${totalSlidesSeen} de 11
- Slide mais visto: Slide ${mostViewedSlide || 'N/A'} (${mostViewedName})
- Nível de interesse: ${interestLevel}/10

⚡ Entre em contato AGORA!`;

  const encodedMessage = encodeURIComponent(message);
  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodedMessage}&apikey=${apiKey}`;

  try {
    const response = await fetch(url, { timeout: 10000 });
    const text = await response.text();
    console.log(`✅ WhatsApp alert sent to ${phone}:`, text.substring(0, 100));
    return true;
  } catch (err) {
    console.error('❌ Error sending WhatsApp alert:', err.message);
    return false;
  }
}

/**
 * Formata dados do lead para o alerta
 */
function buildAlertData(lead, slideStats, totalDuration, totalSlidesSeen, interestLevel) {
  // Slide mais visto (maior tempo)
  let mostViewedSlide = null;
  if (slideStats && slideStats.length > 0) {
    const sorted = [...slideStats].sort((a, b) => b.total_duration - a.total_duration);
    mostViewedSlide = sorted[0].slide_number;
  }

  return {
    lead,
    totalDuration,
    totalSlidesSeen,
    mostViewedSlide,
    interestLevel
  };
}

module.exports = { sendWhatsAppAlert, buildAlertData };
