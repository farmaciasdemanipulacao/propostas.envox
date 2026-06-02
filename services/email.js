/**
 * email.js — Email notification service
 * Uses nodemailer if SMTP credentials are configured in .env.
 * Falls back to a safe no-op if credentials are missing.
 *
 * Required .env variables:
 *   EMAIL_HOST      — SMTP host (e.g. smtp.gmail.com)
 *   EMAIL_PORT      — SMTP port (e.g. 587)
 *   EMAIL_USER      — SMTP username / sender address
 *   EMAIL_PASS      — SMTP password or app token
 *   EMAIL_FROM      — "From" display (e.g. "Envox Agência <contato@envox.com.br>")
 */

let nodemailer;
try { nodemailer = require('nodemailer'); } catch(e) { nodemailer = null; }

function isConfigured() {
  return !!(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

function createTransport() {
  if (!nodemailer || !isConfigured()) return null;
  return nodemailer.createTransport({
    host:   process.env.EMAIL_HOST,
    port:   parseInt(process.env.EMAIL_PORT) || 587,
    secure: parseInt(process.env.EMAIL_PORT) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

/**
 * Send proposal creation notification to the lead.
 * @param {Object} lead — lead row from DB (must have .name, .email, .token, .whatsapp)
 */
async function sendProposalNotification(lead) {
  if (!isConfigured()) {
    console.log(`[Email] Not configured — skipping notification for ${lead.email}`);
    return false;
  }

  const transporter = createTransport();
  if (!transporter) return false;

  const baseUrl   = process.env.BASE_URL || 'https://envox.com.br';
  const propLink  = `${baseUrl}/proposta/${lead.token}`;
  const fromAddr  = process.env.EMAIL_FROM || `"Envox Agência" <${process.env.EMAIL_USER}>`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1a1a2e;padding:24px 32px;text-align:center">
        <span style="font-size:1.6rem;font-weight:900;color:#fff">env<span style="color:#E91E63">ox</span></span>
      </div>
      <div style="padding:32px;background:#fff">
        <h1 style="font-size:1.4rem;color:#1a1a2e;margin:0 0 12px">
          Sua proposta está pronta, ${lead.name}! 🎉
        </h1>
        <p style="color:#555;font-size:0.95rem;line-height:1.6;margin:0 0 24px">
          Preparamos uma proposta personalizada especialmente para o seu negócio.
          Clique no botão abaixo para acessar.
        </p>
        <a href="${propLink}"
           style="display:inline-block;padding:14px 32px;background:#E91E63;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:1rem">
          📋 Ver Minha Proposta
        </a>
        <p style="margin:24px 0 0;font-size:0.82rem;color:#999">
          Ou acesse diretamente: <a href="${propLink}" style="color:#E91E63">${propLink}</a>
        </p>
      </div>
      <div style="padding:16px 32px;background:#f8f9fa;text-align:center;font-size:0.75rem;color:#999">
        © ${new Date().getFullYear()} Envox Agência Digital · Curitiba, PR
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from:    fromAddr,
      to:      lead.email,
      subject: `Sua proposta Envox está pronta — ${lead.name}`,
      html,
      text: `Olá ${lead.name},\n\nSua proposta está pronta!\nAcesse: ${propLink}\n\nEnvox Agência Digital`
    });
    console.log(`[Email] Sent proposal notification to ${lead.email}`);
    return true;
  } catch (err) {
    console.error(`[Email] Failed to send to ${lead.email}:`, err.message);
    return false;
  }
}

module.exports = { sendProposalNotification, isConfigured };
