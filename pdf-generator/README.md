# Gerador de PDF — Relatórios de Procedimentos

Módulo Node.js para gerar PDFs de relatórios de procedimentos (Botox, Preenchimento, etc.) com **Puppeteer** e **Handlebars**.

## Estrutura

```
pdf-generator/
├── pdfService.js          # generatePDF(data, type) → Buffer
├── package.json
├── example.js             # Exemplo de uso
├── README.md
└── templates/
    ├── layout.hbs         # Layout base (header + footer)
    ├── style.css          # Estilo Medical High-End
    └── partials/
        ├── botox.hbs      # Conteúdo Botox
        └── preenchimento.hbs
```

## Instalação

```bash
cd pdf-generator
npm install
```

## Uso

```js
import { generatePDF } from './pdfService.js';

const buffer = await generatePDF(
  {
    header: {
      patientName: 'Nome do Paciente',
      procedureDate: '10/03/2026',
      procedureName: 'Botox (Toxina Botulínica)',
      treatmentStartDate: '10/03/2026',
      logoUrl: 'https://...', // opcional
    },
    footer: {
      clinicName: 'CliniEvo',
      crm: '123456-SP',
      clinicContact: 'contato@clinievo.com.br',
    },
    // Campos do procedimento (conforme o partial)
    produtoUtilizado: 'Botox',
    regioesTratadas: ['testa', 'glabela'],
    // ...
  },
  'botox'
);

// buffer é um Buffer do PDF (salvar em arquivo ou enviar na resposta HTTP)
```

## Tipos suportados

- **botox** — Produto, aplicação, regiões tratadas, mapa, antes/depois, cuidados.
- **preenchimento** — Produto, lote, região, volume, cânula/agulha.

## Adicionar novo procedimento

1. Criar `templates/partials/nome-do-procedimento.hbs` com o HTML do conteúdo.
2. Em `pdfService.js`, adicionar `'nome-do-procedimento'` ao array `PDF_TYPES`.
3. Opcional: criar `normalizeNomeDoProcedimentoData(data)` se precisar de dados derivados (como checklist de regiões).

## Teste rápido

```bash
npm run test
```

Gera `exemplo-botox.pdf` e `exemplo-preenchimento.pdf` na pasta `pdf-generator`.

## Integração com o backend

O serviço retorna um `Buffer`. Em um endpoint Express ou Vercel:

```js
const pdf = await generatePDF(data, 'botox');
res.setHeader('Content-Type', 'application/pdf');
res.setHeader('Content-Disposition', 'attachment; filename="relatorio.pdf"');
res.send(pdf);
```
