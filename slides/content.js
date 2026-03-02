const slides = [
  // SLIDE 1 — CAPA
  {
    number: 1,
    title: 'Capa',
    html: `
    <div class="slide-content slide-1">
      <div class="slide1-bg">
        <div class="slide1-left">
          <div class="slide1-brand">
            <span class="brand-env">env</span><span class="brand-ox">ox</span>
            <span class="brand-sub">MARKETING DIGITAL</span>
          </div>
          <h1 class="slide1-title">Proposta<br><span class="text-pink">Comercial</span></h1>
          <p class="slide1-subtitle">Impactar suas vendas positivamente<br>é o nosso único objetivo.</p>
          <div class="slide1-badges">
            <span class="badge-item"><i class="icon-star">★</i> Estratégia</span>
            <span class="badge-item"><i class="icon-rocket">🚀</i> Performance</span>
            <span class="badge-item"><i class="icon-graph">📈</i> Resultados</span>
          </div>
        </div>
        <div class="slide1-right">
          <div class="deco-circle c1"></div>
          <div class="deco-circle c2"></div>
          <div class="deco-circle c3"></div>
          <div class="deco-lines">
            <div class="deco-line"></div>
            <div class="deco-line"></div>
            <div class="deco-line"></div>
          </div>
          <div class="deco-icon-grid">
            <div class="deco-icon">📱</div>
            <div class="deco-icon">💡</div>
            <div class="deco-icon">🎯</div>
            <div class="deco-icon">📊</div>
            <div class="deco-icon">🔥</div>
            <div class="deco-icon">💬</div>
          </div>
        </div>
      </div>
    </div>`
  },

  // SLIDE 2 — O PROBLEMA
  {
    number: 2,
    title: 'O Problema',
    html: `
    <div class="slide-content slide-2">
      <div class="slide-header-light">
        <span class="slide-tag">DIAGNÓSTICO</span>
        <h2>Você se identifica com<br>algum desses <span class="text-pink">problemas?</span></h2>
        <p class="slide-desc">Muitas empresas enfrentam os mesmos desafios no marketing digital. Veja se algum desses cenários soa familiar:</p>
      </div>
      <div class="problem-grid">
        <div class="problem-card">
          <div class="problem-icon">💸</div>
          <h3>Sem resultado no tráfego pago</h3>
          <p>Investe em anúncios mas não vê retorno. Dinheiro indo embora sem gerar clientes reais.</p>
        </div>
        <div class="problem-card">
          <div class="problem-icon">😴</div>
          <h3>Redes sociais sem impacto</h3>
          <p>Publica sem consistência, sem estratégia. Perfil sem engajamento e seguidores sem conversão.</p>
        </div>
        <div class="problem-card">
          <div class="problem-icon">🚪</div>
          <h3>Leads sem atendimento</h3>
          <p>Campanhas geram interesse mas ninguém responde rápido o suficiente. Oportunidades perdidas todo dia.</p>
        </div>
        <div class="problem-card">
          <div class="problem-icon">🗣️</div>
          <h3>Respostas sem técnica</h3>
          <p>Time de vendas sem script, sem qualificação. Atendimento despadronizado que não converte.</p>
        </div>
      </div>
    </div>`
  },

  // SLIDE 3 — NOSSA SOLUÇÃO
  {
    number: 3,
    title: 'Nossa Solução',
    html: `
    <div class="slide-content slide-3">
      <div class="slide-header-dark">
        <span class="slide-tag-pink">SOLUÇÃO</span>
        <h2>Nossa Solução</h2>
        <p class="slide-desc-white">4 pilares para transformar seu marketing digital e gerar resultados reais</p>
      </div>
      <div class="solution-grid">
        <div class="solution-card card-pink">
          <div class="solution-number">01</div>
          <div class="solution-icon">📱</div>
          <h3>Social Media</h3>
          <p>Gestão completa das suas redes sociais com conteúdo estratégico, calendário editorial e design profissional.</p>
          <ul class="solution-list">
            <li>Posts estratégicos</li>
            <li>Stories e Reels</li>
            <li>Design profissional</li>
          </ul>
        </div>
        <div class="solution-card card-purple">
          <div class="solution-number">02</div>
          <div class="solution-icon">🎯</div>
          <h3>Tráfego Pago</h3>
          <p>Gestão de anúncios no Google e Meta com otimização contínua para maximizar seu ROI.</p>
          <ul class="solution-list">
            <li>Google Ads</li>
            <li>Meta Ads (FB/Insta)</li>
            <li>Relatórios mensais</li>
          </ul>
        </div>
        <div class="solution-card card-blue">
          <div class="solution-number">03</div>
          <div class="solution-icon">🎬</div>
          <h3>Captação de Conteúdo</h3>
          <p>Produção de vídeos e fotos profissionais na sua empresa para alimentar todas as plataformas.</p>
          <ul class="solution-list">
            <li>Visita presencial</li>
            <li>Vídeos curtos</li>
            <li>Fotos profissionais</li>
          </ul>
        </div>
        <div class="solution-card card-green">
          <div class="solution-number">04</div>
          <div class="solution-icon">💬</div>
          <h3>Atendimento SDR</h3>
          <p>Time de pré-vendas qualificado para atender, qualificar e converter seus leads em clientes.</p>
          <ul class="solution-list">
            <li>Atendimento inbox</li>
            <li>Qualificação de leads</li>
            <li>Scripts personalizados</li>
          </ul>
        </div>
      </div>
    </div>`
  },

  // SLIDE 4 — PLANO 1
  {
    number: 4,
    title: 'Plano 1 — Crescimento',
    html: `
    <div class="slide-content slide-4">
      <div class="plan-layout">
        <div class="plan-card-main">
          <div class="plan-header plan-header-dark">
            <div class="plan-badge">PLANO 1</div>
            <h2>CRESCIMENTO</h2>
            <p>Ideal para empresas que querem começar com estratégia</p>
          </div>
          <div class="plan-body">
            <div class="plan-section-title">O que está incluso:</div>
            <ul class="plan-list">
              <li class="plan-item included">
                <span class="check-pink">✓</span>
                <div>
                  <strong>Social Media</strong>
                  <span class="plan-detail">6 posts/mês + Stories + Legendas</span>
                </div>
              </li>
              <li class="plan-item included">
                <span class="check-pink">✓</span>
                <div>
                  <strong>Google Ads</strong>
                  <span class="plan-detail">Gestão completa de campanhas</span>
                </div>
              </li>
              <li class="plan-item included">
                <span class="check-pink">✓</span>
                <div>
                  <strong>Meta Ads</strong>
                  <span class="plan-detail">Facebook + Instagram Ads</span>
                </div>
              </li>
              <li class="plan-item optional">
                <span class="check-gray">+</span>
                <div>
                  <strong>Captação de Conteúdo</strong>
                  <span class="plan-detail">Opcional — sob consulta</span>
                </div>
              </li>
              <li class="plan-item optional">
                <span class="check-gray">+</span>
                <div>
                  <strong>Atendimento SDR</strong>
                  <span class="plan-detail">Opcional — sob consulta</span>
                </div>
              </li>
            </ul>
            <div class="plan-price-box">
              <span class="price-label">Investimento mensal</span>
              <div class="price-value">R$ 2.200<span class="price-period">/mês</span></div>
            </div>
          </div>
        </div>
        <div class="plan-card-side">
          <div class="side-title">✦ Ideal para você se:</div>
          <ul class="side-list">
            <li>Está começando no marketing digital</li>
            <li>Quer presença forte nas redes sociais</li>
            <li>Precisa de anúncios profissionais</li>
            <li>Quer resultados rápidos e mensuráveis</li>
          </ul>
          <div class="side-divider"></div>
          <div class="side-title">🎯 Você vai conquistar:</div>
          <ul class="side-list">
            <li>Mais visibilidade online</li>
            <li>Leads qualificados</li>
            <li>Presença profissional nas redes</li>
            <li>ROI mensurável nos anúncios</li>
          </ul>
        </div>
      </div>
    </div>`
  },

  // SLIDE 5 — PLANO 2
  {
    number: 5,
    title: 'Plano 2 — Presença Forte',
    html: `
    <div class="slide-content slide-5">
      <div class="plan-layout">
        <div class="plan-card-main">
          <div class="plan-header plan-header-purple">
            <div class="plan-badge popular-badge">⭐ MAIS POPULAR</div>
            <div class="plan-badge">PLANO 2</div>
            <h2>PRESENÇA FORTE</h2>
            <p>Para empresas que querem se destacar da concorrência</p>
          </div>
          <div class="plan-body">
            <div class="plan-section-title">O que está incluso:</div>
            <ul class="plan-list">
              <li class="plan-item included">
                <span class="check-pink">✓</span>
                <div>
                  <strong>Social Media</strong>
                  <span class="plan-detail">9 posts/mês + Stories + Reels</span>
                </div>
              </li>
              <li class="plan-item included">
                <span class="check-pink">✓</span>
                <div>
                  <strong>Google Ads</strong>
                  <span class="plan-detail">Gestão completa de campanhas</span>
                </div>
              </li>
              <li class="plan-item included">
                <span class="check-pink">✓</span>
                <div>
                  <strong>Meta Ads</strong>
                  <span class="plan-detail">Facebook + Instagram Ads</span>
                </div>
              </li>
              <li class="plan-item included">
                <span class="check-pink">✓</span>
                <div>
                  <strong>Captação de Conteúdo</strong>
                  <span class="plan-detail">1x por mês (sessão de 4h)</span>
                </div>
              </li>
              <li class="plan-item optional">
                <span class="check-gray">+</span>
                <div>
                  <strong>Atendimento SDR</strong>
                  <span class="plan-detail">Opcional — sob consulta</span>
                </div>
              </li>
            </ul>
            <div class="plan-price-box plan-price-purple">
              <span class="price-label">Investimento mensal</span>
              <div class="price-value">R$ 3.490<span class="price-period">/mês</span></div>
            </div>
          </div>
        </div>
        <div class="plan-card-side">
          <div class="side-title">✦ Ideal para você se:</div>
          <ul class="side-list">
            <li>Quer conteúdo original e profissional</li>
            <li>Precisa de mais frequência nas redes</li>
            <li>Quer vídeos reais da sua empresa</li>
            <li>Busca autoridade no mercado</li>
          </ul>
          <div class="side-divider"></div>
          <div class="side-title">🎯 Você vai conquistar:</div>
          <ul class="side-list">
            <li>Conteúdo autêntico e diferenciado</li>
            <li>Maior engajamento orgânico</li>
            <li>Autoridade na sua área</li>
            <li>Pipeline de vendas aquecido</li>
          </ul>
        </div>
      </div>
    </div>`
  },

  // SLIDE 6 — PLANO 3
  {
    number: 6,
    title: 'Plano 3 — Performance + Atendimento',
    html: `
    <div class="slide-content slide-6">
      <div class="plan-layout">
        <div class="plan-card-main">
          <div class="plan-header plan-header-pink">
            <div class="plan-badge complete-badge">🏆 COMPLETO</div>
            <div class="plan-badge">PLANO 3</div>
            <h2>PERFORMANCE +<br>ATENDIMENTO</h2>
            <p>A solução completa para escalar suas vendas</p>
          </div>
          <div class="plan-body">
            <div class="plan-section-title">O que está incluso:</div>
            <ul class="plan-list">
              <li class="plan-item included">
                <span class="check-pink">✓</span>
                <div>
                  <strong>Social Media</strong>
                  <span class="plan-detail">12 posts/mês + Stories + Reels</span>
                </div>
              </li>
              <li class="plan-item included">
                <span class="check-pink">✓</span>
                <div>
                  <strong>Google Ads + Meta Ads</strong>
                  <span class="plan-detail">Gestão completa multi-plataforma</span>
                </div>
              </li>
              <li class="plan-item included">
                <span class="check-pink">✓</span>
                <div>
                  <strong>Captação de Conteúdo</strong>
                  <span class="plan-detail">1x por mês (sessão de 4h)</span>
                </div>
              </li>
              <li class="plan-item included">
                <span class="check-pink">✓</span>
                <div>
                  <strong>SDR 6h/dia</strong>
                  <span class="plan-detail">Atendimento inbox + respostas padronizadas</span>
                </div>
              </li>
              <li class="plan-item included">
                <span class="check-pink">✓</span>
                <div>
                  <strong>Organização de Contatos</strong>
                  <span class="plan-detail">CRM básico e qualificação de leads</span>
                </div>
              </li>
            </ul>
            <div class="plan-price-box plan-price-pink">
              <span class="price-label">Investimento mensal</span>
              <div class="price-value">R$ 5.990<span class="price-period">/mês</span></div>
            </div>
          </div>
        </div>
        <div class="plan-card-side plan-card-side-dark">
          <div class="side-title-white">✦ Ideal para você se:</div>
          <ul class="side-list-white">
            <li>Quer escalar vendas com estrutura completa</li>
            <li>Precisa de atendimento profissional constante</li>
            <li>Quer um time de marketing dedicado</li>
            <li>Busca crescimento acelerado</li>
          </ul>
          <div class="side-divider-white"></div>
          <div class="side-title-white">🏆 O que você conquista:</div>
          <ul class="side-list-white">
            <li>Estrutura completa de marketing</li>
            <li>Leads atendidos em tempo real</li>
            <li>Funil de vendas otimizado</li>
            <li>Máxima performance e escala</li>
          </ul>
        </div>
      </div>
    </div>`
  },

  // SLIDE 7 — COMPARATIVO
  {
    number: 7,
    title: 'Comparativo de Planos',
    html: `
    <div class="slide-content slide-7">
      <div class="slide-header-dark">
        <span class="slide-tag-pink">COMPARATIVO</span>
        <h2>Compare os <span class="text-pink">Planos</span></h2>
      </div>
      <div class="compare-table-wrap">
        <table class="compare-table">
          <thead>
            <tr>
              <th class="col-service">Serviço / Recurso</th>
              <th class="col-plan plan-1-head">
                <div>Plano 1</div>
                <div class="plan-name-small">CRESCIMENTO</div>
                <div class="plan-price-small">R$ 2.200</div>
              </th>
              <th class="col-plan plan-2-head">
                <div>Plano 2</div>
                <div class="plan-name-small">PRESENÇA FORTE</div>
                <div class="plan-price-small">R$ 3.490</div>
                <div class="popular-tag">⭐ POPULAR</div>
              </th>
              <th class="col-plan plan-3-head">
                <div>Plano 3</div>
                <div class="plan-name-small">PERFORMANCE+</div>
                <div class="plan-price-small">R$ 5.990</div>
                <div class="complete-tag">🏆 COMPLETO</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Social Media</td>
              <td class="check-cell"><span class="check-mark">✓</span><br><small>6 posts</small></td>
              <td class="check-cell"><span class="check-mark">✓</span><br><small>9 posts</small></td>
              <td class="check-cell"><span class="check-mark">✓</span><br><small>12 posts</small></td>
            </tr>
            <tr class="row-alt">
              <td>Google Ads</td>
              <td class="check-cell"><span class="check-mark">✓</span></td>
              <td class="check-cell"><span class="check-mark">✓</span></td>
              <td class="check-cell"><span class="check-mark">✓</span></td>
            </tr>
            <tr>
              <td>Meta Ads (FB + Insta)</td>
              <td class="check-cell"><span class="check-mark">✓</span></td>
              <td class="check-cell"><span class="check-mark">✓</span></td>
              <td class="check-cell"><span class="check-mark">✓</span></td>
            </tr>
            <tr class="row-alt">
              <td>Captação de Conteúdo</td>
              <td class="opt-cell"><span class="opt-mark">Opcional</span></td>
              <td class="check-cell"><span class="check-mark">✓</span><br><small>1x/mês 4h</small></td>
              <td class="check-cell"><span class="check-mark">✓</span><br><small>1x/mês 4h</small></td>
            </tr>
            <tr>
              <td>Atendimento SDR</td>
              <td class="opt-cell"><span class="opt-mark">Opcional</span></td>
              <td class="opt-cell"><span class="opt-mark">Opcional</span></td>
              <td class="check-cell"><span class="check-mark">✓</span><br><small>6h/dia</small></td>
            </tr>
            <tr class="row-alt">
              <td>Scripts de Atendimento</td>
              <td class="x-cell">—</td>
              <td class="opt-cell"><span class="opt-mark">Opcional</span></td>
              <td class="check-cell"><span class="check-mark">✓</span></td>
            </tr>
            <tr>
              <td>Organização de Contatos</td>
              <td class="x-cell">—</td>
              <td class="x-cell">—</td>
              <td class="check-cell"><span class="check-mark">✓</span></td>
            </tr>
            <tr class="row-alt">
              <td>Relatórios Mensais</td>
              <td class="check-cell"><span class="check-mark">✓</span></td>
              <td class="check-cell"><span class="check-mark">✓</span></td>
              <td class="check-cell"><span class="check-mark">✓</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>`
  },

  // SLIDE 8 — MONTE SEU PLANO (CUSTOMIZADOR INTERATIVO)
  {
    number: 8,
    title: 'Monte seu Plano',
    html: `
    <div class="slide-content slide-builder">
      <div class="builder-layout">
        <div class="builder-main">
          <div class="builder-header">
            <span class="slide-tag">PERSONALIZADO</span>
            <h2>Monte seu <span class="text-pink">plano ideal</span></h2>
            <p class="slide-desc">Selecione os serviços e quantidades que fazem sentido para o seu negócio</p>
          </div>

          <!-- SOCIAL MEDIA -->
          <div class="builder-section" id="bs-social">
            <div class="bs-title-row">
              <div class="bs-icon">📱</div>
              <div class="bs-label">Social Media</div>
              <label class="toggle-switch">
                <input type="checkbox" id="tog-social" onchange="builderUpdate()">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="bs-options" id="opts-social" style="display:none">
              <label class="opt-card" data-val="1170" data-key="social_6">
                <input type="radio" name="social_posts" value="6"> <span class="opt-name">6 posts/mês</span><span class="opt-price">R$ 1.170</span>
              </label>
              <label class="opt-card" data-val="1470" data-key="social_9">
                <input type="radio" name="social_posts" value="9"> <span class="opt-name">9 posts/mês</span><span class="opt-price">R$ 1.470</span>
              </label>
              <label class="opt-card" data-val="1970" data-key="social_12">
                <input type="radio" name="social_posts" value="12"> <span class="opt-name">12 posts/mês</span><span class="opt-price">R$ 1.970</span>
              </label>
            </div>
          </div>

          <!-- TRÁFEGO PAGO -->
          <div class="builder-section">
            <div class="bs-title-row">
              <div class="bs-icon">🎯</div>
              <div class="bs-label">Tráfego Pago</div>
            </div>
            <div class="bs-toggles-row">
              <div class="bs-toggle-item">
                <label class="toggle-switch">
                  <input type="checkbox" id="tog-google" onchange="builderUpdate()">
                  <span class="toggle-slider"></span>
                </label>
                <span>Google Ads <strong>R$ 1.490/mês</strong></span>
              </div>
              <div class="bs-toggle-item">
                <label class="toggle-switch">
                  <input type="checkbox" id="tog-meta" onchange="builderUpdate()">
                  <span class="toggle-slider"></span>
                </label>
                <span>Meta Ads <strong>R$ 1.490/mês</strong></span>
              </div>
            </div>
          </div>

          <!-- CAPTAÇÃO -->
          <div class="builder-section" id="bs-captacao">
            <div class="bs-title-row">
              <div class="bs-icon">🎬</div>
              <div class="bs-label">Captação de Conteúdo</div>
              <label class="toggle-switch">
                <input type="checkbox" id="tog-captacao" onchange="builderUpdate()">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="bs-options bs-options-row" id="opts-captacao" style="display:none">
              <span class="bs-qty-label">Sessões/mês:</span>
              <div class="bs-qty-btns">
                <button type="button" class="qty-btn" onclick="setQty('captacao',-1)">−</button>
                <span id="qty-captacao" class="qty-val">1</span>
                <button type="button" class="qty-btn" onclick="setQty('captacao',1)">+</button>
              </div>
              <span class="bs-qty-note">R$ 1.200 × <span id="qty-captacao-x">1</span> = <strong id="captacao-total">R$ 1.200</strong></span>
            </div>
          </div>

          <!-- SDR -->
          <div class="builder-section" id="bs-sdr">
            <div class="bs-title-row">
              <div class="bs-icon">💬</div>
              <div class="bs-label">Atendimento SDR</div>
              <label class="toggle-switch">
                <input type="checkbox" id="tog-sdr" onchange="builderUpdate()">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="bs-options" id="opts-sdr" style="display:none">
              <label class="opt-card" data-val="990" data-key="sdr1">
                <input type="radio" name="sdr_plan" value="sdr1"> <span class="opt-name">SDR 1 — 6h/dia seg-sex</span><span class="opt-price">R$ 990</span>
              </label>
              <label class="opt-card" data-val="1770" data-key="sdr2">
                <input type="radio" name="sdr_plan" value="sdr2"> <span class="opt-name">SDR 2 — 8h/dia seg-sex</span><span class="opt-price">R$ 1.770</span>
              </label>
              <label class="opt-card" data-val="2180" data-key="sdr3">
                <input type="radio" name="sdr_plan" value="sdr3"> <span class="opt-name">SDR 3 — 11h às 20h seg-sex</span><span class="opt-price">R$ 2.180</span>
              </label>
              <div class="bs-toggle-item" style="margin-top:0.5rem">
                <label class="toggle-switch">
                  <input type="checkbox" id="tog-fds" onchange="builderUpdate()">
                  <span class="toggle-slider"></span>
                </label>
                <span>Adicionar Sáb/Dom <strong>(+30%)</strong></span>
              </div>
            </div>
          </div>

          <!-- WEBSITE -->
          <div class="builder-section">
            <div class="bs-title-row">
              <div class="bs-icon">🌐</div>
              <div class="bs-label">Website <small style="color:#999">(valor único)</small></div>
            </div>
            <div class="bs-toggles-row">
              <div class="bs-toggle-item">
                <label class="toggle-switch">
                  <input type="checkbox" id="tog-web5" onchange="builderUpdate()">
                  <span class="toggle-slider"></span>
                </label>
                <span>Até 5 páginas <strong>R$ 3.999</strong></span>
              </div>
              <div class="bs-toggle-item">
                <label class="toggle-switch">
                  <input type="checkbox" id="tog-web7" onchange="builderUpdate()">
                  <span class="toggle-slider"></span>
                </label>
                <span>Até 7 páginas <strong>R$ 4.999</strong></span>
              </div>
            </div>
          </div>
        </div>

        <!-- RESUMO SIDEBAR -->
        <div class="builder-summary" id="builder-summary">
          <div class="summary-title">✦ Seu Plano Personalizado</div>
          <div id="summary-items" class="summary-items">
            <p class="summary-empty">Selecione pelo menos um serviço para montar seu plano</p>
          </div>
          <div id="summary-monthly" class="summary-total" style="display:none">
            <span>Investimento Mensal</span>
            <div class="summary-price" id="summary-monthly-val">R$ 0</div>
          </div>
          <div id="summary-onetime" class="summary-total summary-onetime" style="display:none">
            <span>Investimento Único (website)</span>
            <div class="summary-price-small" id="summary-onetime-val">R$ 0</div>
          </div>
          <button id="btn-send-plan" class="btn-whatsapp-builder" style="display:none" onclick="sendPlanWhatsApp()">
            💬 Gostei assim! Enviar pelo WhatsApp
          </button>
        </div>
      </div>
    </div>`
  },

  // SLIDE 9 — SERVIÇOS ADICIONAIS
  {
    number: 9,
    title: 'Serviços Adicionais',
    html: `
    <div class="slide-content slide-8">
      <div class="slide-header-light">
        <span class="slide-tag">ADICIONAL</span>
        <h2>Serviços <span class="text-pink">Adicionais</span></h2>
        <p class="slide-desc">Potencialize seus resultados com serviços complementares</p>
      </div>
      <div class="additional-grid">
        <div class="additional-card">
          <div class="additional-icon">💬</div>
          <h3>Atendimento SDR</h3>
          <div class="additional-subtitle">Planos de atendimento ao inbox</div>
          <table class="price-table">
            <tr>
              <td>SDR 1 (4h/dia)</td>
              <td class="price-col">R$ 990<span>/mês</span></td>
            </tr>
            <tr>
              <td>SDR 2 (6h/dia)</td>
              <td class="price-col">R$ 1.770<span>/mês</span></td>
            </tr>
            <tr>
              <td>SDR 3 (8h/dia)</td>
              <td class="price-col">R$ 2.180<span>/mês</span></td>
            </tr>
          </table>
          <div class="additional-note">
            <span class="note-badge">+30%</span> para Sábado e Domingo
          </div>
        </div>
        <div class="additional-card">
          <div class="additional-icon">🌐</div>
          <h3>Outros Serviços</h3>
          <div class="additional-subtitle">Soluções digitais completas</div>
          <table class="price-table">
            <tr>
              <td>Website (5 páginas)</td>
              <td class="price-col">R$ 3.999</td>
            </tr>
            <tr>
              <td>Website (7 páginas)</td>
              <td class="price-col">R$ 4.999</td>
            </tr>
            <tr>
              <td>Captação de Conteúdo</td>
              <td class="price-col">R$ 1.200</td>
            </tr>
            <tr>
              <td>Blog / Email Mkt / E-commerce</td>
              <td class="price-col consult">Consultar</td>
            </tr>
          </table>
          <div class="additional-note">
            Todos os projetos incluem suporte pós-entrega
          </div>
        </div>
      </div>
    </div>`
  },

  // SLIDE 10 — SERVIÇOS SEPARADOS
  {
    number: 10,
    title: 'Serviços Separados',
    html: `
    <div class="slide-content slide-9">
      <div class="slide-header-dark">
        <span class="slide-tag-pink">AVULSO</span>
        <h2>Serviços <span class="text-pink">Separados</span></h2>
        <p class="slide-desc-white">Contrate apenas o que você precisa</p>
      </div>
      <div class="separate-grid">
        <div class="separate-card">
          <div class="separate-icon">📱</div>
          <h3>Social Media</h3>
          <div class="separate-plans">
            <div class="sep-plan">
              <div class="sep-plan-name">Plano Premium</div>
              <div class="sep-plan-detail">12 posts/mês</div>
              <div class="sep-plan-price">R$ 1.970<span>/mês</span></div>
            </div>
            <div class="sep-divider"></div>
            <div class="sep-plan">
              <div class="sep-plan-name">Plano Médio</div>
              <div class="sep-plan-detail">9 posts/mês</div>
              <div class="sep-plan-price">R$ 1.470<span>/mês</span></div>
            </div>
            <div class="sep-divider"></div>
            <div class="sep-plan">
              <div class="sep-plan-name">Plano Start</div>
              <div class="sep-plan-detail">6 posts/mês</div>
              <div class="sep-plan-price">R$ 1.170<span>/mês</span></div>
            </div>
          </div>
        </div>
        <div class="separate-card">
          <div class="separate-icon">🎯</div>
          <h3>Tráfego Pago</h3>
          <div class="separate-plans">
            <div class="sep-plan">
              <div class="sep-plan-name">Google Ads</div>
              <div class="sep-plan-detail">Gestão completa de campanhas</div>
              <div class="sep-plan-price">R$ 1.490<span>/mês</span></div>
            </div>
            <div class="sep-divider"></div>
            <div class="sep-plan">
              <div class="sep-plan-name">Meta Ads</div>
              <div class="sep-plan-detail">Facebook + Instagram Ads</div>
              <div class="sep-plan-price">R$ 1.490<span>/mês</span></div>
            </div>
            <div class="sep-note">
              ✦ Combine os dois e economize!
            </div>
          </div>
        </div>
        <div class="separate-card">
          <div class="separate-icon">🎬</div>
          <h3>Captação de Conteúdo</h3>
          <div class="separate-plans">
            <div class="sep-plan">
              <div class="sep-plan-name">Sessão Padrão</div>
              <div class="sep-plan-detail">4h de captação + 6 vídeos editados</div>
              <div class="sep-plan-price">R$ 1.200<span>/sessão</span></div>
            </div>
            <div class="sep-divider"></div>
            <div class="sep-note">
              📍 Deslocamento incluso na região de Curitiba/PR<br>
              🎞️ Entrega em até 7 dias úteis
            </div>
          </div>
        </div>
      </div>
    </div>`
  },

  // SLIDE 11 — POR QUE A ENVOX
  {
    number: 11,
    title: 'Por que a Envox?',
    html: `
    <div class="slide-content slide-10">
      <div class="slide-header-light">
        <span class="slide-tag">DIFERENCIAIS</span>
        <h2>Por que escolher a <span class="text-pink">Envox</span>?</h2>
        <p class="slide-desc">Mais de uma década transformando empresas com marketing digital de resultado</p>
      </div>
      <div class="why-grid">
        <div class="why-card">
          <div class="why-icon">🏆</div>
          <h3>Premiada</h3>
          <p>Agência reconhecida com prêmios regionais de excelência em marketing digital.</p>
        </div>
        <div class="why-card">
          <div class="why-icon">📅</div>
          <h3>Desde 2014</h3>
          <p>Mais de 10 anos de experiência e centenas de projetos entregues com sucesso.</p>
        </div>
        <div class="why-card">
          <div class="why-icon">📊</div>
          <h3>Foco em Resultado</h3>
          <p>Trabalhamos com métricas claras. Cada ação é orientada a gerar retorno real para o cliente.</p>
        </div>
        <div class="why-card">
          <div class="why-icon">🤝</div>
          <h3>Atendimento Dedicado</h3>
          <p>Você tem um gestor de conta exclusivo. Nada de atendimento terceirizado ou burocrático.</p>
        </div>
        <div class="why-card">
          <div class="why-icon">🧠</div>
          <h3>Estratégia Completa</h3>
          <p>Do planejamento à execução, cuidamos de todo o ecossistema do seu marketing digital.</p>
        </div>
        <div class="why-card">
          <div class="why-icon">👥</div>
          <h3>Time Especialista</h3>
          <p>Profissionais certificados em Google, Meta e as principais plataformas digitais do mercado.</p>
        </div>
      </div>
    </div>`
  },

  // SLIDE 12 — ENCERRAMENTO
  {
    number: 12,
    title: 'Vamos Conversar?',
    html: `
    <div class="slide-content slide-11">
      <div class="slide11-bg">
        <div class="slide11-content">
          <div class="slide11-brand">
            <span class="brand-env">env</span><span class="brand-ox">ox</span>
          </div>
          <h2 class="slide11-title">E aí, <span class="text-pink">bora?</span></h2>
          <p class="slide11-subtitle">Vamos conquistar este desafio juntos!</p>
          
          <div class="slide11-contact">
            <div class="contact-item">
              <span class="contact-icon">👤</span>
              <span>Gustavo Braga</span>
            </div>
            <div class="contact-item">
              <a href="https://wa.me/5541992369292" target="_blank" class="contact-link">
                <span class="contact-icon">📱</span>
                <span>(41) 9 9236-9292</span>
              </a>
            </div>
            <div class="contact-item">
              <a href="https://www.envox.com.br" target="_blank" class="contact-link">
                <span class="contact-icon">🌐</span>
                <span>www.envox.com.br</span>
              </a>
            </div>
          </div>

          <div class="slide11-verse">
            <div class="verse-text">"Confie ao Senhor o que você faz, e os seus planos serão bem-sucedidos."</div>
            <div class="verse-ref">— Provérbios 16:3</div>
          </div>

          <div class="slide11-validity">
            <span>⏳ PROPOSTA VÁLIDA POR 7 DIAS</span>
          </div>

          <a href="https://wa.me/5541992369292?text=Olá!%20Acabei%20de%20visualizar%20a%20proposta%20da%20Envox%20e%20tenho%20interesse.%20Podemos%20conversar?" 
             target="_blank" 
             class="btn-whatsapp-final">
            <span>💬</span>
            Quero conversar no WhatsApp!
          </a>
        </div>
      </div>
    </div>`
  }
];

module.exports = slides;
