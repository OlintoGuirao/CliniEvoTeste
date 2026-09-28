/**
 * Serviço modular de geração de PDF para relatórios de procedimentos.
 * Usa Handlebars para templates e Puppeteer para renderização.
 *
 * Uso: generatePDF(data, type) → Promise<Buffer>
 * type: 'botox' | 'preenchimento' | ...
 */

import Handlebars from 'handlebars';
import puppeteer from 'puppeteer';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEMPLATES_DIR = join(__dirname, 'templates');
const PARTIALS_DIR = join(TEMPLATES_DIR, 'partials');

/** Tipos com partial dedicado (.hbs). Qualquer outro usa o partial "default". */
export const PDF_TYPES = ['botox', 'preenchimento'];
const PARTIAL_DEFAULT = 'default';

/** Helper: valor padrão quando vazio */
Handlebars.registerHelper('default', function (value, defaultValue) {
  return value != null && String(value).trim() !== '' ? value : defaultValue;
});

/**
 * Carrega e registra todos os partials da pasta partials/ (incluindo default).
 */
function registerPartials() {
  const toLoad = [...PDF_TYPES, PARTIAL_DEFAULT];
  for (const type of toLoad) {
    const path = join(PARTIALS_DIR, `${type}.hbs`);
    try {
      const source = readFileSync(path, 'utf-8');
      Handlebars.registerPartial(type, source);
    } catch (err) {
      if (type !== PARTIAL_DEFAULT) console.warn(`[pdfService] Partial não encontrado: ${type}.hbs`);
    }
  }
}

/**
 * Retorna o CSS embutido para injetar no HTML.
 */
function getEmbeddedStyles() {
  const path = join(TEMPLATES_DIR, 'style.css');
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return '';
  }
}

/** Lista fixa de regiões para Botox (key + label) */
const BOTOX_REGIOES = [
  { key: 'testa', label: 'Testa' },
  { key: 'glabela', label: 'Glabela' },
  { key: 'pes_de_galinha', label: 'Pés de Galinha' },
  { key: 'sobrancelha', label: 'Sobrancelha' },
  { key: 'bunny_lines', label: 'Bunny Lines' },
  { key: 'masseter', label: 'Masseter' },
  { key: 'queixo', label: 'Queixo' },
  { key: 'depressor_angulo_boca', label: 'Depressor do ângulo da boca' },
  { key: 'pescoco', label: 'Pescoço' },
];

/**
 * Normaliza dados do Botox: monta regioesList a partir de regioesTratadas (array de keys).
 */
const BOTOX_CARE_DEFAULT =
  'Evitar manipulação da região nas primeiras 24h; não deitar por 4h; evitar exercícios intensos no dia. Em caso de dúvidas, entre em contato com a clínica.';

function normalizeBotoxData(data) {
  const tratadas = new Set(
    (data.regioesTratadas || []).map((k) => String(k).toLowerCase().replace(/\s/g, '_'))
  );
  const regioesList = BOTOX_REGIOES.map((r) => ({
    ...r,
    checked: tratadas.has(r.key) || tratadas.has(r.key.replace(/_/g, '')),
  }));
  return {
    ...data,
    regioesList,
    careText: data.careText != null && String(data.careText).trim() !== '' ? data.careText : BOTOX_CARE_DEFAULT,
  };
}

/**
 * Compila o layout principal e gera o HTML completo.
 * Se type não tiver partial dedicado, usa "default" e normaliza contentFields.
 */
function renderHtml(data, type) {
  const layoutPath = join(TEMPLATES_DIR, 'layout.hbs');
  const layoutSource = readFileSync(layoutPath, 'utf-8');
  const template = Handlebars.compile(layoutSource);

  const hasDedicated = PDF_TYPES.includes(type);
  const partialName = hasDedicated ? type : PARTIAL_DEFAULT;
  let payload = { ...data, partialName, embeddedStyles: getEmbeddedStyles() };

  if (partialName === 'botox') payload = normalizeBotoxData(payload);
  else if (partialName === PARTIAL_DEFAULT) payload = normalizeDefaultData(payload);

  return template(payload);
}

/**
 * Gera o PDF a partir do HTML usando Puppeteer.
 * @param {string} html - HTML completo (com estilos embutidos)
 * @returns {Promise<Buffer>}
 */
async function htmlToPdf(html) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 15000,
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '18mm',
        bottom: '22mm',
        left: '18mm',
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/**
 * Gera o PDF do relatório do procedimento.
 *
 * @param {Object} data - Dados do relatório. Estrutura mínima:
 *   - header: { logoUrl?, patientName, procedureDate, procedureName?, treatmentStartDate? }
 *   - footer: { clinicName, crm?, clinicContact? }
 *   - ...campos específicos do procedimento (ver partials)
 * @param {string} type - Tipo do procedimento: 'botox' | 'preenchimento'
 * @returns {Promise<Buffer>} Buffer do PDF
 *
 * @example
 * const pdf = await generatePDF({
 *   header: { patientName: 'Maria Silva', procedureDate: '10/03/2026', procedureName: 'Botox' },
 *   footer: { clinicName: 'CliniEvo', crm: '12345-SP' },
 *   produtoUtilizado: 'Botox',
 *   marcaToxina: 'Botox',
 *   regioesTratadas: ['testa', 'glabela'],
 *   ...
 * }, 'botox');
 */
/**
 * Normaliza dados para o partial default: se data.contentFields não existir,
 * monta a partir de data.fields (array de { key, value }) ou objeto plano.
 */
function normalizeDefaultData(data) {
  if (data.contentFields && Array.isArray(data.contentFields)) return data;
  const contentFields = [];
  if (data.fields && Array.isArray(data.fields)) {
    data.fields.forEach((f) => contentFields.push({ label: f.label ?? f.key ?? '', value: f.value ?? '' }));
  } else if (typeof data === 'object') {
    const skip = new Set(['header', 'footer', 'partialName', 'embeddedStyles', 'contentFields', 'fields']);
    for (const [key, value] of Object.entries(data)) {
      if (skip.has(key) || value == null) continue;
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      contentFields.push({ label, value: String(value) });
    }
  }
  return { ...data, contentFields };
}

export async function generatePDF(data, type) {
  const normalizedType = String(type).toLowerCase().trim();
  registerPartials();
  const html = renderHtml(data, normalizedType);
  return htmlToPdf(html);
}

export default generatePDF;
