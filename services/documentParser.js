const path = require('path');

/**
 * Parse um arquivo .pdf, .docx ou .txt e retorna texto puro
 */
async function parseFile(filePath, mimetype) {
  const ext = path.extname(filePath).toLowerCase();

  // PDF
  if (ext === '.pdf' || mimetype === 'application/pdf') {
    try {
      const pdfParse = require('pdf-parse');
      const fs = require('fs');
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return data.text;
    } catch (err) {
      console.error('PDF parse error:', err.message);
      throw new Error('Não foi possível processar o arquivo PDF.');
    }
  }

  // DOCX
  if (ext === '.docx' || mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    try {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } catch (err) {
      console.error('DOCX parse error:', err.message);
      throw new Error('Não foi possível processar o arquivo DOCX.');
    }
  }

  // TXT
  if (ext === '.txt' || mimetype === 'text/plain') {
    const fs = require('fs');
    return fs.readFileSync(filePath, 'utf-8');
  }

  throw new Error('Formato não suportado. Use PDF, DOCX ou TXT.');
}

/**
 * Converte texto bruto em array de slides
 * Lógica: headings (linhas em maiúsculas ou com # no início) → novo slide
 *         ou a cada ~300 palavras
 */
function textToSlides(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const slides = [];
  let current = { title: '', lines: [] };
  let wordCount = 0;
  const WORDS_PER_SLIDE = 300;

  function flushSlide() {
    const content = current.lines.join('\n').trim();
    if (content.length > 0) {
      slides.push({ title: current.title, content });
    }
    current = { title: '', lines: [] };
    wordCount = 0;
  }

  for (const line of lines) {
    const isHeading =
      line.startsWith('#') ||
      /^[A-Z0-9\s\-–—:]{5,}$/.test(line) ||
      line.endsWith(':') ||
      (line.length < 80 && /^[\d]+[\.\)]\s/.test(line));

    if (isHeading && current.lines.length > 0) {
      flushSlide();
      current.title = line.replace(/^#+\s*/, '').replace(/:$/, '').trim();
    } else if (isHeading) {
      current.title = line.replace(/^#+\s*/, '').replace(/:$/, '').trim();
    } else {
      current.lines.push(line);
      wordCount += line.split(/\s+/).length;

      if (wordCount >= WORDS_PER_SLIDE) {
        flushSlide();
      }
    }
  }

  if (current.lines.length > 0 || current.title) {
    flushSlide();
  }

  // Se não gerou nenhum slide, criar um único slide com tudo
  if (slides.length === 0 && text.trim().length > 0) {
    slides.push({ title: 'Planejamento', content: text.trim() });
  }

  return slides;
}

module.exports = { parseFile, textToSlides };
