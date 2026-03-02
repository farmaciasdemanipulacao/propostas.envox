// ── MENSAGENS DE CONVITE ──────────────────────────────────────────────
const INVITE_MESSAGES = [
  'Olá {nome}! 👋 Preparamos uma proposta exclusiva para você. Dá uma olhada: {link}',
  'Oi {nome}! 🚀 Temos algo especial esperando por você. Acesse agora: {link}',
  'Olá {nome}! 🎯 Sua proposta personalizada da Envox está pronta. Confira: {link}',
  '{nome}, preparamos uma proposta sob medida para o seu negócio! Veja aqui: {link}',
  'Oi {nome}! 💡 Criamos uma solução de marketing digital especialmente para você: {link}',
  'Olá {nome}! ✨ Sua proposta exclusiva Envox está aguardando. Acesse: {link}',
  '{nome}, não perca essa oportunidade! Veja nossa proposta para você: {link}',
  'Oi {nome}! 📈 Preparamos estratégias para crescer o seu negócio. Confira: {link}',
  'Olá {nome}! 🎁 Temos uma proposta especial para impulsionar seus resultados: {link}',
  '{nome}, sua proposta de marketing digital está pronta! Acesse agora: {link}'
];

// ── MENSAGENS DE FOLLOW-UP: ARTIGO ───────────────────────────────────
const FOLLOWUP_ARTICLE = [
  'Oi {nome}! 📰 Vi esse artigo sobre marketing digital e pensei em você: "{artigo}" — Lembrando que nossa proposta ainda está disponível: {link}',
  'Olá {nome}! 💡 Compartilhando um conteúdo valioso para o seu negócio. E a proposta que preparamos para você está aqui: {link}',
  '{nome}, encontrei esse material incrível sobre crescimento digital. Acho que vai te interessar — assim como nossa proposta: {link}',
  'Oi {nome}! 📚 Todo dia aprendemos algo novo em marketing. Por falar nisso, você chegou a ver nossa proposta? {link}',
  'Olá {nome}! 🌟 Negócios que investem em marketing crescem 3x mais rápido. Que tal dar o próximo passo? {link}',
  '{nome}, compartilhando uma dica valiosa: empresas com presença digital forte vendem mais. Nossa proposta pode te ajudar nisso: {link}'
];

// ── MENSAGENS DE FOLLOW-UP: RESULTADO ────────────────────────────────
const FOLLOWUP_RESULT = [
  'Oi {nome}! 🏆 Acabamos de fechar um projeto incrível com resultados extraordinários. Imagina fazer o mesmo com o seu negócio? Veja nossa proposta: {link}',
  'Olá {nome}! 📊 Nosso cliente do setor {setor} teve +{resultado}% de crescimento com nossas estratégias. Quer saber como? {link}',
  '{nome}, case de sucesso: cliente aumentou vendas em 40% em 3 meses com a Envox! Que tal a gente fazer isso juntos? {link}',
  'Oi {nome}! ✅ Mais um cliente satisfeito com nossos resultados. A sua vez pode ser agora — confira nossa proposta: {link}',
  'Olá {nome}! 🚀 Resultados reais: +250 leads/mês, +180% de engajamento. Nossa proposta tem isso para você também: {link}',
  '{nome}, nossos clientes estão crescendo. Não fica de fora — veja o que preparamos especialmente para você: {link}'
];

// ── MENSAGENS DE FOLLOW-UP: URGÊNCIA ────────────────────────────────
const FOLLOWUP_URGENCY = [
  'Oi {nome}! ⏰ Nossa capacidade para novos projetos este mês está quase esgotando. Garanta sua vaga: {link}',
  'Olá {nome}! 🔥 Últimos dias para aproveitar as condições especiais da nossa proposta. Não deixa para depois: {link}',
  '{nome}, aviso importante: estamos com vagas limitadas para novos clientes em {mes}. Reserve a sua agora: {link}',
  'Oi {nome}! ⚡ Decisões rápidas fazem a diferença. Cada dia sem marketing digital é uma oportunidade perdida. Nossa proposta: {link}',
  'Olá {nome}! 📅 Essa semana é a última para iniciar com as condições que preparamos para você. Veja: {link}',
  '{nome}, enquanto você hesita, seus concorrentes estão investindo em marketing. Não fique para trás: {link}'
];

// ── MENSAGENS DE CONVITE PARA PLANEJAMENTO ───────────────────────────
const PLANEJAMENTO_INVITE_MESSAGES = [
  'Oi {nome}! 📋 Seu planejamento de marketing digital está pronto para revisão. Acesse e aprove: {link}',
  'Olá {nome}! ✨ Finalizamos seu planejamento estratégico personalizado. Confira e dê seu feedback: {link}',
  '{nome}, seu planejamento de marketing está aguardando sua aprovação. Acesse aqui: {link}',
  'Oi {nome}! 🚀 Grande notícia! Seu plano de marketing digital está pronto. Revise e aprove: {link}',
  'Olá {nome}! 🎯 Criamos um planejamento completo para o crescimento do seu negócio. Veja aqui: {link}'
];

const mes = new Date().toLocaleDateString('pt-BR', { month: 'long' });

function getInviteMessage(lead, baseUrl, index) {
  const idx = index % INVITE_MESSAGES.length;
  const link = `${baseUrl}/proposta/${lead.token}`;
  return INVITE_MESSAGES[idx]
    .replace(/{nome}/g, lead.name.split(' ')[0])
    .replace(/{link}/g, link);
}

function getFollowupMessage(lead, baseUrl, category, index) {
  let messages;
  switch (category) {
    case 'article':  messages = FOLLOWUP_ARTICLE;  break;
    case 'result':   messages = FOLLOWUP_RESULT;   break;
    case 'urgency':  messages = FOLLOWUP_URGENCY;  break;
    default:         messages = FOLLOWUP_ARTICLE;
  }
  const idx = index % messages.length;
  const link = `${baseUrl}/proposta/${lead.token}`;
  const firstName = lead.name.split(' ')[0];
  return messages[idx]
    .replace(/{nome}/g, firstName)
    .replace(/{link}/g, link)
    .replace(/{artigo}/g, 'Como dobrar vendas com marketing digital')
    .replace(/{setor}/g, 'varejo')
    .replace(/{resultado}/g, '150')
    .replace(/{mes}/g, mes);
}

function getPlanejamentoInviteMessage(plan, baseUrl, index) {
  const idx = index % PLANEJAMENTO_INVITE_MESSAGES.length;
  const link = `${baseUrl}/planejamento/${plan.token}`;
  return PLANEJAMENTO_INVITE_MESSAGES[idx]
    .replace(/{nome}/g, (plan.client_name || 'Cliente').split(' ')[0])
    .replace(/{link}/g, link);
}

function buildWhatsAppLink(phone, message) {
  const clean = phone.replace(/\D/g, '');
  const num = clean.startsWith('55') ? clean : `55${clean}`;
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

module.exports = {
  getInviteMessage,
  getFollowupMessage,
  getPlanejamentoInviteMessage,
  buildWhatsAppLink,
  INVITE_MESSAGES_COUNT: INVITE_MESSAGES.length,
  FOLLOWUP_ARTICLE_COUNT: FOLLOWUP_ARTICLE.length,
  FOLLOWUP_RESULT_COUNT: FOLLOWUP_RESULT.length,
  FOLLOWUP_URGENCY_COUNT: FOLLOWUP_URGENCY.length,
  PLANEJAMENTO_INVITE_COUNT: PLANEJAMENTO_INVITE_MESSAGES.length
};
