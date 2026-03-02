# 🚀 Envox — Sistema de Visualização de Propostas Comerciais

Sistema completo de propostas comerciais com rastreamento avançado de engajamento.

## 📋 Funcionalidades Implementadas

### Painel Admin (`/admin`)
- ✅ Login seguro (admin / envox2025)
- ✅ Dashboard com lista de leads e métricas
- ✅ Cadastro de leads com geração automática de link único
- ✅ Tela de detalhes com análise completa de engajamento
- ✅ Gráfico de barras: tempo por slide
- ✅ Mapa de calor: visualização por slide (verde/amarelo/vermelho)
- ✅ Nível de interesse calculado (1-10)
- ✅ Log de eventos cronológico
- ✅ Copiar link com 1 clique
- ✅ Botão "Reenviar Alerta" WhatsApp

### Hotsite da Proposta (`/proposta/:token`)
- ✅ Tela de autenticação (WhatsApp + Email)
- ✅ 11 slides com design premium Envox
- ✅ Navegação: botões, dots, teclado, swipe, scroll
- ✅ Progress bar no topo
- ✅ Transição suave entre slides
- ✅ 100% responsivo

### Sistema de Tracking
- ✅ Registro de abertura, slides, revisitas, fechamento
- ✅ `navigator.sendBeacon` para garantir envio ao fechar
- ✅ Detecção de inatividade (2 min)
- ✅ Cálculo de nível de interesse automático

### Alerta WhatsApp (CallMeBot)
- ✅ Disparo automático ao fechar proposta
- ✅ Mensagem com resumo completo
- ✅ Configurável via variáveis de ambiente

## 🌐 URLs

| Rota | Descrição |
|------|-----------|
| `/admin` | Dashboard admin |
| `/admin/login` | Login admin |
| `/admin/leads/new` | Cadastrar lead |
| `/admin/leads/:id` | Detalhes do lead |
| `/proposta/:token` | Autenticação do lead |
| `/proposta/:token/view` | Visualizador de slides |
| `POST /api/track/open` | Registrar abertura |
| `POST /api/track/slide` | Registrar slide |
| `POST /api/track/close` | Registrar fechamento |

## 📊 Cálculo de Nível de Interesse (1-10)

| Critério | Pontos |
|---------|--------|
| Tempo total (0-30s/30s-2min/2-5min/5+min) | 0-3 |
| Slides vistos (1-3/4-7/8-10/11) | 0-3 |
| Slides revisitados (0/1-2/3+) | 0-2 |
| Viu slides de preço (4,5,6) | 0-2 |

## 🗄️ Banco de Dados (SQLite)

- **leads** — cadastro de leads
- **access_sessions** — sessões de acesso
- **slide_events** — eventos por slide
- **event_log** — log cronológico

## ⚙️ Variáveis de Ambiente

```env
PORT=3000
ADMIN_PASSWORD=envox2025
SESSION_SECRET=envox_secret_key_2025_xpto
CALLMEBOT_PHONE=5541992369292
CALLMEBOT_APIKEY=sua_api_key_aqui
BASE_URL=https://seuapp.replit.app
```

## 🚀 Como Rodar no Replit

1. Faça upload de todos os arquivos
2. Configure as variáveis de ambiente no painel do Replit
3. O comando de start é: `node server.js`
4. Acesse `/admin` e faça login com `admin / envox2025`

## 🎨 Identidade Visual

- **Rosa**: `#E91E63`
- **Preto**: `#1A1A2E`
- **Branco**: `#FFFFFF`
- **Fonte**: Poppins (Google Fonts)

## 🏗️ Stack Tecnológica

- **Backend**: Node.js + Express 4
- **Templates**: EJS
- **Banco**: better-sqlite3
- **Sessões**: better-sqlite3-session-store
- **Charts**: Chart.js (CDN)
- **WhatsApp**: CallMeBot API

## 📱 Slides da Proposta

1. Capa
2. O Problema (4 cards de pain points)
3. Nossa Solução (4 pilares)
4. Plano 1 — Crescimento (R$ 2.200/mês)
5. Plano 2 — Presença Forte (R$ 3.490/mês) ⭐ Mais Popular
6. Plano 3 — Performance + Atendimento (R$ 5.990/mês) 🏆 Completo
7. Comparativo de Planos
8. Serviços Adicionais
9. Serviços Separados
10. Por que a Envox?
11. Encerramento + CTA WhatsApp

---
*Envox Marketing Digital © 2024 — Desde 2014*
