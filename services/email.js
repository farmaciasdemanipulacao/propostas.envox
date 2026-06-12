/**
 * email.js — Serviço de email via Resend API
 *
 * Variáveis .env necessárias:
 *   RESEND_API_KEY       — chave da API Resend (re_...)
 *   RESEND_FROM          — remetente verificado (ex: gustavo@envox.com.br)
 *   RESEND_WEBHOOK_SECRET — segredo do webhook Resend (whsec_...)
 *   BASE_URL             — ex: https://proposta.envox.com.br
 */

const { Resend } = require('resend');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// ── Configuração ─────────────────────────────────────────────────────────────

function getClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY não configurada no .env');
  return new Resend(key);
}

function fromAddress() {
  const raw = (process.env.RESEND_FROM || process.env.EMAIL_FROM || process.env.EMAIL_USER || '').trim();
  if (raw.includes('<')) return raw;
  return `"Envox Agência" <${raw}>`;
}

function baseUrl() {
  return (process.env.BASE_URL || 'https://proposta.envox.com.br').replace(/\/$/, '');
}

function isConfigured() {
  return !!process.env.RESEND_API_KEY;
}

// ── Helpers de rastreamento ───────────────────────────────────────────────────

/**
 * Gera token de rastreamento único, cria registro na DB e retorna:
 * - pixelUrl: URL do pixel de abertura (img 1x1)
 * - trackedLink: URL do link rastreado (redireciona para proposalLink)
 * - trackToken: token bruto
 */
function buildTrackingAssets({ leadId, proposalId, emailSubject, template, emailTo, proposalLink }) {
  const trackToken = uuidv4();
  const base = baseUrl();
  const pixelUrl  = `${base}/track/email-open/${trackToken}`;
  const trackedLink = proposalLink
    ? `${base}/track/email-click/${trackToken}?url=${encodeURIComponent(proposalLink)}`
    : null;

  // Registra na DB (resend_id ainda não existe — será atualizado após envio)
  db.createEmailEvent({
    leadId,
    proposalId,
    resendId: null,
    trackToken,
    emailTo,
    emailSubject,
    template,
  });

  return { trackToken, pixelUrl, trackedLink };
}

// ── Envio genérico ────────────────────────────────────────────────────────────

async function sendMail({ to, subject, html, text, leadId, proposalId, template }) {
  if (!isConfigured()) {
    console.warn(`[Email] RESEND_API_KEY não configurada — pulando envio para ${to}`);
    return { ok: false, skipped: true };
  }

  // Token de rastreamento para pixel (sem link rastreado neste modo genérico)
  const { trackToken, pixelUrl } = buildTrackingAssets({
    leadId, proposalId, emailSubject: subject, template: template || 'generic', emailTo: to,
    proposalLink: null,
  });

  // Injeta pixel de abertura no HTML (antes de </body> ou no final)
  const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="">`;
  const htmlWithPixel = html.includes('</body>')
    ? html.replace('</body>', `${pixel}</body>`)
    : html + pixel;

  try {
    const resend = getClient();
    const { data, error } = await resend.emails.send({
      from:    fromAddress(),
      to:      [to],
      subject,
      html:    htmlWithPixel,
      text:    text || subject,
    });

    if (error) {
      console.error(`[Email] ❌ Resend erro para ${to}:`, error);
      return { ok: false, error: error.message };
    }

    // Atualiza resend_id no registro criado
    if (data?.id) {
      db.updateEmailEventResendId(trackToken, data.id);
    }

    console.log(`[Email] ✅ Enviado para ${to} | resend_id: ${data?.id} | track: ${trackToken}`);
    return { ok: true, messageId: data?.id, trackToken };
  } catch (err) {
    console.error(`[Email] ❌ Exceção ao enviar para ${to}:`, err.message);
    return { ok: false, error: err.message };
  }
}

// ── Template: Proposta criada — enviada para 1 lead ──────────────────────────

async function sendProposalToLead(lead, propLink) {
  const { trackToken, pixelUrl, trackedLink } = buildTrackingAssets({
    leadId: lead.id,
    proposalId: lead.proposal_id || null,
    emailSubject: `📋 Sua proposta Envox está pronta, ${lead.name}`,
    template: 'proposal',
    emailTo: lead.email,
    proposalLink: propLink,
  });

  const ctaLink = trackedLink || propLink;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #eee;border-radius:8px;overflow:hidden">
      <div style="background:#1a1a2e;padding:24px 32px;text-align:center">
        <span style="font-size:1.8rem;font-weight:900;color:#fff;letter-spacing:-1px">env<span style="color:#E91E63">ox</span></span>
      </div>
      <div style="padding:32px;background:#ffffff">
        <h1 style="font-size:1.35rem;color:#1a1a2e;margin:0 0 14px;font-family:Arial,sans-serif">
          Sua proposta está pronta, ${lead.name}! 🎉
        </h1>
        <p style="color:#555;font-size:0.95rem;line-height:1.65;margin:0 0 24px">
          Preparamos uma proposta personalizada especialmente para
          ${lead.company_name ? '<strong>' + lead.company_name + '</strong>' : 'o seu negócio'}.
          Acesse agora para conferir todos os detalhes.
        </p>
        <div style="text-align:center;margin:28px 0">
          <a href="${ctaLink}"
             style="display:inline-block;padding:14px 36px;background:#E91E63;color:#ffffff;
                    text-decoration:none;border-radius:8px;font-weight:700;font-size:1rem;
                    font-family:Arial,sans-serif">
            📋 Acessar Proposta
          </a>
        </div>
        <div style="background:#f8f9fa;border-radius:8px;padding:16px 20px;margin-top:16px">
          <p style="margin:0;font-size:0.82rem;color:#666;font-family:Arial,sans-serif">
            <strong>Seus dados de acesso:</strong><br>
            • WhatsApp: <strong>${lead.whatsapp}</strong><br>
            • E-mail: <strong>${lead.email}</strong>
          </p>
        </div>
        <p style="margin:20px 0 0;font-size:0.82rem;color:#aaa;word-break:break-all">
          Link direto: <a href="${ctaLink}" style="color:#E91E63">${propLink}</a>
        </p>
      </div>
      <div style="padding:16px 32px;background:#f8f9fa;text-align:center;font-size:0.75rem;color:#aaa">
        © ${new Date().getFullYear()} Envox Agência Digital · Curitiba, PR<br>
        Este email foi enviado automaticamente — não é necessário responder.
      </div>
    </div>
    <img src="${pixelUrl}" width="1" height="1" style="display:none" alt="">
  `;

  try {
    const resend = getClient();
    const { data, error } = await resend.emails.send({
      from:    fromAddress(),
      to:      [lead.email],
      subject: `📋 Sua proposta Envox está pronta, ${lead.name}`,
      html,
      text: `Olá ${lead.name},\n\nSua proposta está pronta!\n\nAcesse: ${propLink}\n\nSeus dados de acesso:\n- WhatsApp: ${lead.whatsapp}\n- E-mail: ${lead.email}\n\n— Envox Agência Digital`,
    });

    if (error) {
      console.error('[Email] ❌ sendProposalToLead Resend erro:', error);
      return { ok: false, error: error.message };
    }
    if (data?.id) db.updateEmailEventResendId(trackToken, data.id);
    console.log(`[Email] ✅ Proposta enviada para ${lead.email} | resend_id: ${data?.id}`);
    return { ok: true, messageId: data?.id, trackToken };
  } catch (err) {
    console.error('[Email] ❌ Exceção sendProposalToLead:', err.message);
    return { ok: false, error: err.message };
  }
}

// Compatibilidade legada
async function sendProposalNotification(lead) {
  const propLink = `${baseUrl()}/proposta/${lead.token || ''}`;
  return sendProposalToLead(lead, propLink);
}

// ── Template: Proposta compartilhada ─────────────────────────────────────────

async function sendSharedProposalEmail({ to, toName, fromName, shareLink, whatsapp, leadId, proposalId }) {
  const { trackToken, pixelUrl, trackedLink } = buildTrackingAssets({
    leadId: leadId || null,
    proposalId: proposalId || null,
    emailSubject: `📋 ${fromName} compartilhou uma proposta Envox com você`,
    template: 'shared',
    emailTo: to,
    proposalLink: shareLink,
  });

  const ctaLink = trackedLink || shareLink;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #eee;border-radius:8px;overflow:hidden">
      <div style="background:#1a1a2e;padding:24px 32px;text-align:center">
        <span style="font-size:1.8rem;font-weight:900;color:#fff;letter-spacing:-1px">env<span style="color:#E91E63">ox</span></span>
      </div>
      <div style="padding:32px;background:#ffffff">
        <h1 style="font-size:1.25rem;color:#1a1a2e;margin:0 0 12px;font-family:Arial,sans-serif">
          Olá, ${toName}! 👋
        </h1>
        <p style="color:#555;font-size:0.95rem;line-height:1.65;margin:0 0 16px">
          <strong>${fromName}</strong> compartilhou uma proposta da <strong>Envox Agência Digital</strong> com você para análise.
        </p>
        <div style="text-align:center;margin:28px 0">
          <a href="${ctaLink}"
             style="display:inline-block;padding:14px 36px;background:#E91E63;color:#ffffff;
                    text-decoration:none;border-radius:8px;font-weight:700;font-size:1rem;
                    font-family:Arial,sans-serif">
            📋 Visualizar Proposta
          </a>
        </div>
        <div style="background:#f8f9fa;border-radius:8px;padding:16px 20px;margin-top:16px">
          <p style="margin:0;font-size:0.82rem;color:#666;font-family:Arial,sans-serif">
            <strong>Seus dados de acesso:</strong><br>
            • WhatsApp: <strong>${whatsapp}</strong><br>
            • E-mail: <strong>${to}</strong>
          </p>
        </div>
        <p style="margin:20px 0 0;font-size:0.82rem;color:#aaa;word-break:break-all">
          Link direto: <a href="${ctaLink}" style="color:#E91E63">${shareLink}</a>
        </p>
      </div>
      <div style="padding:16px 32px;background:#f8f9fa;text-align:center;font-size:0.75rem;color:#aaa">
        © ${new Date().getFullYear()} Envox Agência Digital · Curitiba, PR<br>
        Este email foi enviado automaticamente — não é necessário responder.
      </div>
    </div>
    <img src="${pixelUrl}" width="1" height="1" style="display:none" alt="">
  `;

  try {
    const resend = getClient();
    const { data, error } = await resend.emails.send({
      from:    fromAddress(),
      to:      [to],
      subject: `📋 ${fromName} compartilhou uma proposta Envox com você`,
      html,
      text: `Olá ${toName},\n\n${fromName} compartilhou uma proposta da Envox com você.\n\nAcesse: ${shareLink}\n\nDados de acesso:\n- WhatsApp: ${whatsapp}\n- E-mail: ${to}\n\n— Envox Agência Digital`,
    });
    if (error) return { ok: false, error: error.message };
    if (data?.id) db.updateEmailEventResendId(trackToken, data.id);
    return { ok: true, messageId: data?.id, trackToken };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ── Template: Email de finalização ───────────────────────────────────────────

async function sendFinalizeEmail({ to, leadName, companyName, finalizeLink, whatsapp, leadId, proposalId }) {
  const displayName = companyName || leadName || 'você';
  const subject = `📋 Sua proposta Envox está pronta${companyName ? ' — ' + companyName : ''}, ${leadName || ''}`.trim();

  const { trackToken, pixelUrl, trackedLink } = buildTrackingAssets({
    leadId: leadId || null,
    proposalId: proposalId || null,
    emailSubject: subject,
    template: 'finalize',
    emailTo: to,
    proposalLink: finalizeLink,
  });

  const ctaLink = trackedLink || finalizeLink;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e8e8e8">
      <div style="background:#1a1a2e;padding:28px 36px;text-align:center">
        <span style="font-size:2rem;font-weight:900;color:#fff;letter-spacing:-1px">env<span style="color:#E91E63">ox</span></span>
      </div>
      <div style="padding:36px 36px 24px">
        <h1 style="font-size:1.4rem;color:#1a1a2e;margin:0 0 12px;font-family:Arial,sans-serif;line-height:1.3">
          Olá${leadName ? ', <strong>' + leadName + '</strong>' : ''}! Sua proposta está pronta 🎉
        </h1>
        <p style="color:#555;font-size:0.95rem;line-height:1.7;margin:0 0 28px">
          Preparamos uma proposta personalizada para
          <strong>${displayName}</strong>. Revise os serviços selecionados e
          escolha como deseja prosseguir — tudo em uma única tela.
        </p>
        <div style="text-align:center;margin:32px 0">
          <a href="${ctaLink}"
             style="display:inline-block;padding:16px 44px;background:#10b981;color:#ffffff;
                    text-decoration:none;border-radius:10px;font-weight:800;font-size:1.05rem;
                    font-family:Arial,sans-serif;letter-spacing:0.01em">
            ✅ Ver minha Proposta
          </a>
        </div>
        <div style="background:#f8fafc;border-radius:10px;padding:20px 24px;margin:24px 0">
          <p style="margin:0 0 12px;font-size:0.82rem;font-weight:700;color:#1a1a2e;text-transform:uppercase;letter-spacing:0.05em">
            O que você encontrará na página:
          </p>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:5px 0;font-size:0.88rem;color:#444">✅ &nbsp;Aceitar a proposta</td></tr>
            <tr><td style="padding:5px 0;font-size:0.88rem;color:#444">🔄 &nbsp;Enviar uma contraproposta</td></tr>
            <tr><td style="padding:5px 0;font-size:0.88rem;color:#444">💬 &nbsp;Falar com um especialista</td></tr>
            <tr><td style="padding:5px 0;font-size:0.88rem;color:#444">❌ &nbsp;Recusar a proposta</td></tr>
          </table>
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin-top:8px">
          <p style="margin:0 0 8px;font-size:0.8rem;font-weight:700;color:#1a1a2e">Seus dados de acesso:</p>
          <p style="margin:0;font-size:0.85rem;color:#555;line-height:1.8">
            📱 &nbsp;WhatsApp: <strong>${whatsapp || 'não cadastrado'}</strong><br>
            📧 &nbsp;E-mail: <strong>${to}</strong>
          </p>
        </div>
      </div>
      <div style="padding:18px 36px;background:#f8fafc;border-top:1px solid #e8e8e8;text-align:center;font-size:0.75rem;color:#aaa">
        © ${new Date().getFullYear()} Envox Agência Digital · Curitiba, PR<br>
        Dúvidas? Acesse: <a href="${ctaLink}" style="color:#E91E63">${finalizeLink}</a>
      </div>
    </div>
    <img src="${pixelUrl}" width="1" height="1" style="display:none" alt="">
  `;

  try {
    const resend = getClient();
    const { data, error } = await resend.emails.send({
      from: fromAddress(), to: [to], subject, html,
      text: `Olá ${leadName || ''}!\n\nSua proposta Envox está pronta.\nAcesse: ${finalizeLink}\n\nDados de acesso:\n- WhatsApp: ${whatsapp || ''}\n- E-mail: ${to}\n\n— Envox Agência Digital`,
    });
    if (error) return { ok: false, error: error.message };
    if (data?.id) db.updateEmailEventResendId(trackToken, data.id);
    return { ok: true, messageId: data?.id, trackToken };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ── Template: Email de teste ──────────────────────────────────────────────────

async function sendTestEmail(toEmail) {
  return sendMail({
    to:      toEmail,
    subject: '✅ Teste de email — Envox Admin (via Resend)',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:32px">
        <h2 style="color:#1a1a2e">✅ Email de teste — Resend</h2>
        <p style="color:#555;line-height:1.6">
          Este email confirma que o sistema de notificações da <strong>Envox</strong>
          está funcionando corretamente via <strong>Resend API</strong>.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
        <p style="font-size:0.8rem;color:#aaa">
          Enviado em: ${new Date().toLocaleString('pt-BR')}<br>
          Provedor: Resend · From: ${process.env.RESEND_FROM || process.env.EMAIL_FROM}
        </p>
      </div>
    `,
    text: `Email de teste Envox (Resend) — ${new Date().toLocaleString('pt-BR')}`,
    template: 'test',
  });
}

// ── Notificação para o administrador ─────────────────────────────────────────

async function sendAdminNotification({ subject, body }) {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
  if (!adminEmail) return { skipped: true };
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h2 style="color:#1a1a2e;margin-bottom:16px">${subject}</h2>
      <div style="color:#444;line-height:1.7;white-space:pre-line">${body}</div>
      <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
      <p style="font-size:0.75rem;color:#aaa">Enviado automaticamente pelo sistema Envox Proposta · ${new Date().toLocaleString('pt-BR')}</p>
    </div>`;
  // Notificações admin não precisam de pixel (são internas)
  return sendMail({ to: adminEmail, subject, html, text: body, template: 'admin_notification' });
}

// ── Envio do plano personalizado ──────────────────────────────────────────────

async function sendPlanEmail({ to, leadName, companyName, planHtml, leadId }) {
  const subj = `📋 Seu Plano Personalizado Envox${companyName ? ' — ' + companyName : ''}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:24px">
      <h2 style="color:#E91E63">Seu Plano Personalizado</h2>
      <p style="color:#555">Olá${leadName ? ' ' + leadName : ''}! Segue abaixo o plano que você montou:</p>
      <div style="margin:24px 0;padding:16px;background:#f9f9f9;border-radius:8px">
        ${planHtml || '<p>Plano enviado via Envox Proposta.</p>'}
      </div>
      <p style="color:#555">Entre em contato pelo WhatsApp para finalizar: <strong>(41) 3300-0404</strong></p>
      <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
      <p style="font-size:0.75rem;color:#aaa">Envox Marketing Digital · envox.com.br</p>
    </div>`;
  return sendMail({ to, subject: subj, html, text: `Seu plano personalizado Envox — Entre em contato: (41) 3300-0404`, leadId, template: 'plan' });
}

// ── Verificação de conexão (compatibilidade) ──────────────────────────────────

async function verifyConnection() {
  if (!isConfigured()) {
    return { ok: false, error: 'RESEND_API_KEY não configurada no .env' };
  }
  try {
    const resend = getClient();
    // Testa listando os domínios (chamada leve)
    const { data, error } = await resend.domains.list();
    if (error) return { ok: false, error: error.message };
    return { ok: true, domains: data?.data?.map(d => d.name) || [] };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  isConfigured,
  verifyConnection,
  sendMail,
  sendProposalToLead,
  sendProposalNotification,
  sendSharedProposalEmail,
  sendAdminNotification,
  sendPlanEmail,
  sendFinalizeEmail,
  sendTestEmail,
};
