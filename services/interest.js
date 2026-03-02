/**
 * Calcula o nível de interesse do lead (1-10)
 * Baseado em tempo total, slides vistos, revisitados e slides de preço
 */
function calculateInterestLevel(stats) {
  let score = 0;

  // 1. Tempo total de visualização (0-3 pontos)
  const totalSec = stats.totalDuration || 0;
  if (totalSec >= 300) {       // 5+ minutos
    score += 3;
  } else if (totalSec >= 120) { // 2-5 minutos
    score += 2;
  } else if (totalSec >= 30) {  // 30s-2min
    score += 1;
  }
  // < 30s = 0

  // 2. Quantidade de slides vistos (0-3 pontos)
  const slidesCount = stats.totalSlidesSeen || 0;
  if (slidesCount === 11) {
    score += 3;
  } else if (slidesCount >= 8) {
    score += 2;
  } else if (slidesCount >= 4) {
    score += 1;
  }
  // 0-3 = 0

  // 3. Slides revisitados (0-2 pontos)
  const revisitedSlides = stats.slideStats
    ? stats.slideStats.filter(s => s.revisit_count > 0).length
    : 0;
  if (revisitedSlides >= 3) {
    score += 2;
  } else if (revisitedSlides >= 1) {
    score += 1;
  }

  // 4. Visualizou slides de preço (4, 5, 6) — 0-2 pontos
  const seenSlides = stats.slideStats
    ? stats.slideStats.map(s => s.slide_number)
    : [];
  const priceSlides = [4, 5, 6].filter(n => seenSlides.includes(n));
  if (priceSlides.length >= 2) {
    score += 2;
  } else if (priceSlides.length === 1) {
    score += 1;
  }

  // Total máximo = 10, mínimo = 0
  // Se acessou mas não viu nada, mínimo 1
  if (score === 0 && (stats.totalAccesses || 0) > 0) {
    score = 1;
  }

  return Math.min(10, Math.max(1, score));
}

/**
 * Retorna label descritivo do nível de interesse
 */
function getInterestLabel(level) {
  if (level >= 8) return { label: 'Muito Alto', color: 'success' };
  if (level >= 6) return { label: 'Alto', color: 'info' };
  if (level >= 4) return { label: 'Médio', color: 'warning' };
  if (level >= 2) return { label: 'Baixo', color: 'danger' };
  return { label: 'Muito Baixo', color: 'secondary' };
}

module.exports = { calculateInterestLevel, getInterestLabel };
