const https = require('https');

// ── CREDENCIAIS HARDCODED (+ fallback via .env) ──────────────────────
const CALLMEBOT_PHONE  = process.env.CALLMEBOT_PHONE  || '+554133000404';
const CALLMEBOT_APIKEY = process.env.CALLMEBOT_APIKEY || '8951394';

const SLIDE_NAMES = {
  1:'Capa', 2:'Problema', 3:'Solucao', 4:'Plano Crescimento',
  5:'Plano Presenca Forte', 6:'Plano Performance', 7:'Comparativo',
  8:'Monte seu Plano', 9:'Adicionais', 10:'Separados',
  11:'Por que Envox', 12:'Encerramento'
};

/**
 * Envia mensagem WhatsApp via CallMeBot (GET request)
 */
function sendWhatsApp(text) {
  return new Promise((resolve) => {
    const encoded = encodeURIComponent(text);
    const phone   = encodeURIComponent(CALLMEBOT_PHONE);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encoded}&apikey=${CALLMEBOT_APIKEY}`;

    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        console.log(`✅ WhatsApp enviado [${res.statusCode}]:`, data.substring(0, 80));
        resolve(true);
      });
    });
    req.on('error', (err) => {
      console.error('❌ CallMeBot error:', err.message);
      resolve(false);
    });
    req.setTimeout(12000, () => { req.destroy(); console.error('❌ CallMeBot timeout'); resolve(false); });
  });
}

// ── ALERTA: PROPOSTA FECHADA ─────────────────────────────────────────
async function sendWhatsAppAlert(alertData) {
  const { lead, totalDuration, totalSlidesSeen, mostViewedSlide, interestLevel, revisitedCount } = alertData;

  const mins = Math.floor(totalDuration / 60);
  const secs = totalDuration % 60;
  const durTxt = mins > 0 ? `${mins}min ${secs}s` : `${secs}s`;
  const slideName = mostViewedSlide ? (SLIDE_NAMES[mostViewedSlide] || `Slide ${mostViewedSlide}`) : 'N/A';
  const waClean = (lead.whatsapp || '').replace(/\D/g,'');

  const msg =
`🔔 PROPOSTA VISUALIZADA!

👤 Lead: ${lead.name}
📱 WhatsApp: ${lead.whatsapp}
📧 Email: ${lead.email}

📊 Resumo da visualizacao:
⏱ Tempo total: ${durTxt}
📑 Slides visualizados: ${totalSlidesSeen} de 11
🔄 Slides revisitados: ${revisitedCount || 0}
🏆 Slide mais visto: Slide ${mostViewedSlide || 'N/A'} - ${slideName}
🎯 Nivel de interesse: ${interestLevel}/10

⚡ ENTRE EM CONTATO AGORA!
📲 Link direto: https://wa.me/${waClean}`;

  return sendWhatsApp(msg);
}

// ── ALERTA: PLANO CUSTOMIZADO ────────────────────────────────────────
async function sendCustomPlanAlert(lead, selections, monthlyTotal, onetimeTotal) {
  const lines = selections.map(s => `• ${s.name}: R$ ${s.value.toLocaleString('pt-BR')}`).join('\n');

  const msg =
`🎯 PLANO CUSTOMIZADO MONTADO!

👤 Lead: ${lead.name}
📱 WhatsApp: ${lead.whatsapp}

📋 Itens selecionados:
${lines}

💰 Mensal: R$ ${monthlyTotal.toLocaleString('pt-BR')}
${onetimeTotal > 0 ? `💰 Unico: R$ ${onetimeTotal.toLocaleString('pt-BR')}` : ''}

✅ O lead clicou em "Gostei assim!" e enviou pelo WhatsApp!
⚡ RESPONDA IMEDIATAMENTE!`;

  return sendWhatsApp(msg);
}

// ── ALERTA: PLANEJAMENTO REVISADO ────────────────────────────────────
async function sendPlanejamentoAlert(planejamento, approvedCount, revisionCount, totalSlides) {
  const waClean = (planejamento.client_whatsapp || '').replace(/\D/g,'');
  const allApproved = revisionCount === 0 && approvedCount === totalSlides;

  const msg =
`📋 PLANEJAMENTO REVISADO!

👤 Cliente: ${planejamento.client_name}
📱 WhatsApp: ${planejamento.client_whatsapp}
📄 Planejamento: ${planejamento.title}

📊 Resultado:
✅ Slides aprovados: ${approvedCount} de ${totalSlides}
💬 Slides com ajuste: ${revisionCount} de ${totalSlides}

${allApproved ? '🎉 PLANEJAMENTO 100% APROVADO!' : '⚠️ Ajustes solicitados - ver detalhes no painel'}

⚡ Acesse o painel para ver os detalhes!`;

  return sendWhatsApp(msg);
}

// ── HELPER: montar alertData da proposta ────────────────────────────
function buildAlertData(lead, slideStats, totalDuration, totalSlidesSeen, interestLevel) {
  let mostViewedSlide = null;
  let revisitedCount  = 0;
  if (slideStats && slideStats.length > 0) {
    const sorted = [...slideStats].sort((a, b) => b.total_duration - a.total_duration);
    mostViewedSlide = sorted[0].slide_number;
    revisitedCount  = slideStats.filter(s => s.revisit_count > 0).length;
  }
  return { lead, totalDuration, totalSlidesSeen, mostViewedSlide, interestLevel, revisitedCount };
}

module.exports = { sendWhatsApp, sendWhatsAppAlert, sendCustomPlanAlert, sendPlanejamentoAlert, buildAlertData };
