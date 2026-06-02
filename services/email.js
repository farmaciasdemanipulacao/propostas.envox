/**
 * email.js — Serviço de email com nodemailer
 *
 * Variáveis .env necessárias:
 *   EMAIL_HOST  — ex: smtp.hostinger.com
 *   EMAIL_PORT  — ex: 465 (SSL) ou 587 (STARTTLS)
 *   EMAIL_USER  — ex: gustavo@envox.com.br
 *   EMAIL_PASS  — senha ou token do app
 *   EMAIL_FROM  — ex: gustavo@envox.com.br  (pode ser só o email)
 */

const nodemailer = require('nodemailer');

// ── Configuração ─────────────────────────────────────────────────────────────

function isConfigured() {
  return !!(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

function buildTransportOptions() {
  const port   = parseInt(process.env.EMAIL_PORT) || 465;
  const secure = port === 465; // SSL direto; porta 587 usa STARTTLS

  return {
    host: process.env.EMAIL_HOST,
    port,
    secure,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      // Necessário em alguns ambientes de sandbox/VPS que não aceitam certs auto-assinados
      rejectUnauthorized: false,
    },
  };
}

function createTransport() {
  if (!isConfigured()) return null;
  return nodemailer.createTransport(buildTransportOptions());
}

// ── Remetente ─────────────────────────────────────────────────────────────────

function fromAddress() {
  const raw = (process.env.EMAIL_FROM || process.env.EMAIL_USER || '').trim();
  // Se já tem formato "Nome <email>", usa direto; caso contrário envolve com display
  if (raw.includes('<')) return raw;
  return `"Envox Agência" <${raw}>`;
}

// ── Verificação de conexão (útil para debug) ──────────────────────────────────

async function verifyConnection() {
  if (!isConfigured()) {
    console.warn('[Email] Credenciais não configuradas no .env');
    return { ok: false, error: 'Credenciais não configuradas (EMAIL_HOST / EMAIL_USER / EMAIL_PASS)' };
  }
  const t = createTransport();
  return new Promise(resolve => {
    t.verify(err => {
      if (err) {
        console.error('[Email] verify() falhou:', err.message);
        resolve({ ok: false, error: err.message, code: err.code });
      } else {
        console.log('[Email] verify() OK — SMTP pronto');
        resolve({ ok: true });
      }
    });
  });
}

// ── Envio genérico ────────────────────────────────────────────────────────────

async function sendMail({ to, subject, html, text }) {
  if (!isConfigured()) {
    console.warn(`[Email] Não configurado — pulando envio para ${to}`);
    return { ok: false, skipped: true };
  }

  const t = createTransport();
  try {
    const info = await t.sendMail({
      from:    fromAddress(),
      to,
      subject,
      html,
      text: text || subject,
    });
    console.log(`[Email] ✅ Enviado para ${to} | msgId: ${info.messageId}`);
    return { ok: true, messageId: info.messageId, response: info.response };
  } catch (err) {
    console.error(`[Email] ❌ Falha ao enviar para ${to}:`, err.message, '| code:', err.code);
    return { ok: false, error: err.message, code: err.code };
  }
}

// ── Template: Proposta criada ─────────────────────────────────────────────────

async function sendProposalNotification(lead) {
  const baseUrl  = (process.env.BASE_URL || 'https://envox.com.br').replace(/\/$/, '');
  const propLink = `${baseUrl}/proposta/${lead.token}`;

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
          Preparamos uma proposta personalizada especialmente para o seu negócio.
          Acesse agora para conferir todos os detalhes.
        </p>
        <div style="text-align:center;margin:28px 0">
          <a href="${propLink}"
             style="display:inline-block;padding:14px 36px;background:#E91E63;color:#ffffff;
                    text-decoration:none;border-radius:8px;font-weight:700;font-size:1rem;
                    font-family:Arial,sans-serif">
            📋 Acessar Proposta
          </a>
        </div>
        <p style="margin:24px 0 0;font-size:0.82rem;color:#aaa;word-break:break-all">
          Link direto: <a href="${propLink}" style="color:#E91E63">${propLink}</a>
        </p>
      </div>
      <div style="padding:16px 32px;background:#f8f9fa;text-align:center;font-size:0.75rem;color:#aaa">
        © ${new Date().getFullYear()} Envox Agência Digital · Curitiba, PR<br>
        Este email foi enviado automaticamente — não é necessário responder.
      </div>
    </div>
  `;

  return sendMail({
    to:      lead.email,
    subject: `📋 Sua proposta Envox está pronta, ${lead.name}`,
    html,
    text: `Olá ${lead.name},\n\nSua proposta está pronta!\n\nAcesse: ${propLink}\n\n— Envox Agência Digital`,
  });
}

// ── Template: Email de teste ──────────────────────────────────────────────────

async function sendTestEmail(toEmail) {
  return sendMail({
    to:      toEmail,
    subject: '✅ Teste de email — Envox Admin',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:32px">
        <h2 style="color:#1a1a2e">✅ Email de teste</h2>
        <p style="color:#555;line-height:1.6">
          Este email confirma que as configurações SMTP estão corretas e o sistema
          de notificações da <strong>Envox</strong> está funcionando.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
        <p style="font-size:0.8rem;color:#aaa">
          Enviado em: ${new Date().toLocaleString('pt-BR')}<br>
          Host: ${process.env.EMAIL_HOST} · Porta: ${process.env.EMAIL_PORT}
        </p>
      </div>
    `,
    text: `Email de teste Envox — ${new Date().toLocaleString('pt-BR')}`,
  });
}

module.exports = {
  isConfigured,
  verifyConnection,
  sendMail,
  sendProposalNotification,
  sendTestEmail,
};
