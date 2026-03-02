# Envox Proposta — Sistema Completo de Propostas e Planejamentos

## 🚀 Status
✅ Em operação em: https://3000-iyuuldnnkju3nvuabpkyc-ea026bf9.sandbox.novita.ai

## 🔑 Acesso Admin
- **URL:** /admin/login
- **Usuário:** admin
- **Senha:** envox2025 (ou `ADMIN_PASSWORD` env var)

## 📋 Módulos Implementados

### 1. Painel Admin
- Dashboard com métricas (leads, visualizações, planejamentos)
- Cadastro de leads (nome, WhatsApp, email → token único)
- Lista de leads com status badge, interesse, botões de ação rápida
- Detalhe do lead: nível de interesse 1-10, gráfico Chart.js, mapa de calor, log de eventos

### 2. Proposta Hotsite (/proposta/:token)
- Autenticação por WhatsApp + email
- 12 slides full-screen com navegação (botões, dots, teclado, swipe, wheel)
- Slide 8: Montador de Plano Interativo (toggles + seletores de serviços)
- Tracking: opens, slide_viewed, slide_revisited, proposal_closed
- Design premium: #E91E63, #1A1A2E, #FFFFFF, fonte Poppins

### 3. CallMeBot WhatsApp Alerts
- **Telefone:** +554133000404 | **API Key:** 8951394
- Disparo automático ao fechar proposta (`proposal_closed`)
- Alerta ao concluir revisão de planejamento
- Alerta ao lead enviar plano customizado pelo WhatsApp
- Botão "Reenviar Alerta" no painel admin
- Vars de ambiente: `CALLMEBOT_PHONE`, `CALLMEBOT_APIKEY`

### 4. Convites e Follow-ups
- **Convidar**: para leads que não visualizaram → 10 mensagens rotativas → abre WA
- **Follow-up Artigo**: 6 mensagens com conteúdo educativo
- **Follow-up Resultado**: 6 mensagens com cases de sucesso
- **Follow-up Urgência**: 6 mensagens com escassez/deadline
- Histórico completo com data/hora por lead
- Contadores de convites e follow-ups no dashboard

### 5. Montador de Plano (Slide 8 da Proposta)
- Toggles para Social Media, Tráfego Pago, Captura de Conteúdo, SDR, Extras
- Cálculo de totais mensais e únicos em tempo real
- Sidebar com resumo do plano
- Botão "Gostei assim! Enviar pelo WhatsApp" → abre WA com mensagem formatada
- Alerta CallMeBot ao admin quando lead envia plano

### 6. Sistema de Planejamentos
- **Upload**: .pdf (pdf-parse), .docx (mammoth), .txt — máx 10 MB
- **Conversão automática**: headings → slides, ~300 palavras/slide
- **Admin**: preview/edição inline, adição de slides, reordenação, exclusão
- **Envio ao cliente**: gera token único, WhatsApp + email auth
- **Revisão pelo cliente**: `/planejamento/:token/view`
  - Aprovação ou pedido de ajuste slide-a-slide
  - Navegação desbloqueada em sequência (não pode pular)
  - Tela final de conclusão
- **Alerta CallMeBot** ao concluir revisão com resumo aprovados/ajustes

## 🗃️ Banco de Dados (SQLite)
| Tabela | Descrição |
|--------|-----------|
| leads | Nome, WhatsApp, email, token |
| access_sessions | Sessões de acesso à proposta |
| slide_events | Eventos de slides (viewed/revisited) |
| event_log | Log cronológico de eventos |
| custom_plans | Planos montados pelos leads |
| lead_invites | Histórico de convites e follow-ups |
| planejamentos | Documentos de planejamento |
| planejamento_slides | Slides dos planejamentos |
| planejamento_sessions | Sessões de revisão de planejamento |
| planejamento_slide_events | Eventos de aprovação/revisão |
| planejamento_event_log | Log de eventos de planejamento |

## 🌐 Endpoints Principais

### Admin (autenticado)
- `GET/POST /admin/login` — Login
- `GET /admin` — Dashboard
- `GET /admin/leads/new` | `POST /admin/leads` — Criar lead
- `GET /admin/leads/:id` — Detalhe do lead
- `POST /admin/leads/:id/resend-alert` — Reenviar alerta WA
- `POST /admin/leads/:id/invite` — Enviar convite → redireciona ao WA
- `POST /admin/leads/:id/followup` — Follow-up → redireciona ao WA
- `GET /admin/planejamentos` — Lista planejamentos
- `GET /admin/planejamentos/new` | `POST /admin/planejamentos` — Upload
- `GET /admin/planejamentos/:id` — Detalhe + edição
- `POST /admin/planejamentos/:id/send` — Enviar para cliente

### Tracking API
- `POST /api/track/open` — Abertura da proposta
- `POST /api/track/slide` — Visualização de slide
- `POST /api/track/close` — Fechamento da proposta
- `GET /api/admin/leads/:id/invite` — Gerar link de convite
- `GET /api/admin/leads/:id/followup/:category` — Gerar follow-up
- `POST /api/custom-plan/save` — Salvar plano customizado
- `POST /api/custom-plan/send` — Confirmar envio do plano

### Proposta (cliente)
- `GET /proposta/:token` — Auth do lead
- `POST /proposta/:token/auth` — Autenticar
- `GET /proposta/:token/view` — Visualizador de slides

### Planejamento (cliente)
- `GET /planejamento/:token` — Auth do cliente
- `POST /planejamento/:token/auth` — Autenticar
- `GET /planejamento/:token/view` — Revisor de slides
- `POST /planejamento/:token/review` — Aprovar ou pedir ajuste

## ⚙️ Variáveis de Ambiente (Deploy no Replit)
```
ADMIN_PASSWORD=envox2025
SESSION_SECRET=string_aleatoria_segura
CALLMEBOT_PHONE=+554133000404
CALLMEBOT_APIKEY=8951394
BASE_URL=https://seuapp.replit.app
PORT=3000
```

## 🚀 Deploy no Replit
1. Copie todos os arquivos
2. Configure as variáveis de ambiente acima
3. Execute: `npm install && npm start`
4. O banco SQLite é criado automaticamente na primeira execução

## 📦 Stack Tecnológica
- **Backend**: Node.js + Express + EJS
- **Banco**: SQLite via better-sqlite3
- **Sessões**: better-sqlite3-session-store
- **Upload**: Multer (máx 10 MB)
- **Parse PDF**: pdf-parse
- **Parse DOCX**: mammoth
- **Frontend**: HTML/CSS vanilla + Chart.js
- **Alertas WA**: CallMeBot HTTP API

## 📅 Última Atualização
2026-03-02
