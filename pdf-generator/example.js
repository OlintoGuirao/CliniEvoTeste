/**
 * Exemplo de uso do gerador de PDF.
 * Execute: npm install && node example.js
 * O PDF será salvo em exemplo-botox.pdf e exemplo-preenchimento.pdf
 */

import { writeFileSync } from 'fs';
import { generatePDF } from './pdfService.js';

async function run() {
  const header = {
    patientName: 'Maria da Silva',
    procedureDate: '10/03/2026',
    procedureName: 'Botox (Toxina Botulínica)',
    treatmentStartDate: '10/03/2026',
  };

  const footer = {
    clinicName: 'CliniEvo',
    crm: '123456-SP',
    clinicContact: 'contato@clinievo.com.br',
  };

  // Exemplo Botox
  const pdfBotox = await generatePDF(
    {
      header,
      footer,
      produtoUtilizado: 'Botox',
      marcaToxina: 'Botox',
      lote: '12463',
      dataValidade: '13/01/2027',
      diluicaoUtilizada: '2,5 ml soro',
      quantidadeUnidade: '50 U',
      numeroPontos: '4',
      regioesTratadas: ['testa', 'glabela', 'pes_de_galinha'],
      // mapaAplicacaoUrl, fotoAntesUrl, fotoDepoisUrl: opcionais (URLs de imagem)
    },
    'botox'
  );
  writeFileSync('exemplo-botox.pdf', pdfBotox);
  console.log('✓ exemplo-botox.pdf gerado');

  // Exemplo Preenchimento
  const pdfPreenchimento = await generatePDF(
    {
      header: { ...header, procedureName: 'Preenchimento' },
      footer,
      produto: 'Ácido Hialurônico',
      lote: 'Lote 2026-001',
      regiao: 'Malar, Labial',
      volume: '2 ml',
      canulaAgulha: 'Cânula 25G',
      observacoes: 'Paciente orientada sobre cuidados pós-procedimento.',
    },
    'preenchimento'
  );
  writeFileSync('exemplo-preenchimento.pdf', pdfPreenchimento);
  console.log('✓ exemplo-preenchimento.pdf gerado');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
