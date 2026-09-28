# Padrões de páginas de detalhe de tratamento

Este documento descreve os padrões de UX e componentes reutilizáveis para **páginas de detalhe de tratamento** (ex.: Programa de Emagrecimento, Aplicação de Botox) e para **novos tratamentos** que forem criados.

---

## 1. Header da página

- **Componente:** `TreatmentDetailHeader` (`@/components/TreatmentDetailHeader`)
- **Uso:** Toda página de detalhe de tratamento deve usar este header.
- **Comportamento:**
  - **Mobile:** Botão voltar fica **dentro** do card do título (canto esquerdo), para não ocupar uma coluna à parte.
  - **Desktop (sm+):** Botão voltar ao lado do card do título.
- **Props:** `backHref`, `title`, `subtitle?`, `showBackLink?`, `rightAction?` (ex.: botão Editar ou Nova sessão).

**Exemplo:**
```tsx
<TreatmentDetailHeader
  backHref="/weight-loss"
  title="Programa de Emagrecimento"
  subtitle={patientName}
  showBackLink={showBackLink}
/>
```

---

## 2. Gráficos de linha (Recharts Line)

Quando a página tiver gráficos de evolução (peso, medidas, etc.):

- **Hook:** `useChartMobileBehavior` (`@/hooks/use-chart-mobile-behavior`)
- **Comportamento no mobile:**
  - Pontos maiores (`chartDotRadius`: 12px no mobile, 4px no desktop) para facilitar toque.
  - Tooltip com **trigger `"click"`** no mobile (toque abre o tooltip; no desktop mantém `"hover"`).
  - Dot customizado com **`pointer-events: none`** no mobile para o toque passar ao gráfico e ativar o tooltip ao tocar no ponto.
- **Eixo X:** Se houver várias sessões na mesma data, usar rótulos únicos (ex.: `02/02`, `02/02 (2ª)`, `02/02 (3ª)`).
- **Subtítulo do gráfico:** Usar texto descritivo do conteúdo (ex.: "Peso inicial e por sessão"), não "Antes x Depois por sessão" em gráficos de peso/medidas.

**Exemplo:**
```tsx
const { chartDotRadius, tooltipTrigger, renderChartDot } = useChartMobileBehavior();

<LineChart data={chartData} ...>
  <Tooltip trigger={tooltipTrigger} content={...} />
  <Line
    dot={isMobile ? renderChartDot : { r: chartDotRadius }}
    activeDot={{ r: chartDotRadius + 4 }}
  />
</LineChart>
```

---

## 3. Registro de sessões (quando houver sessões)

- **Posição:** Card "Registro de sessões" deve ficar **acima** dos gráficos de evolução.
- **Ações por sessão:**
  - Botão **Editar** (ícone lápis).
  - Botão **Excluir** (ícone lixeira), com **AlertDialog** de confirmação ("Excluir sessão?", "Esta ação não pode ser desfeita..."). Ao confirmar: excluir fotos vinculadas à sessão e depois a sessão; atualizar lista e mostrar toast.
- **Medidas por sessão no mobile:** Esconder medidas (Cintura, Abdômen, etc.) por padrão e mostrar um botão **"Ver medidas"** com seta (ChevronDown). Ao clicar, expandir e trocar para **"Ocultar medidas"** (ChevronUp). Em telas sm+ as medidas ficam sempre visíveis.

---

## 4. Comparação Antes x Depois (fotos)

Quando houver fotos iniciais do paciente e fotos por sessão:

- **Antes:** Priorizar **fotos iniciais** (sem `weight_loss_session_id` / sem vínculo com sessão). Se não houver fotos iniciais, usar fotos da **primeira sessão** que tiver fotos.
- **Depois:** Sempre fotos da **última sessão** que tiver fotos.

Assim, ao adicionar foto numa nova sessão, a coluna "Antes" não é sobrescrita.

---

## 5. Novos tratamentos

Ao criar uma nova página de detalhe de tratamento:

1. Usar **`TreatmentDetailHeader`** para o cabeçalho (back, título, subtítulo, ação à direita se houver).
2. Se houver **gráficos de linha**, usar **`useChartMobileBehavior`** e seguir os itens da seção 2.
3. Se houver **lista de sessões**, colocar o card de registro de sessões **acima** dos gráficos; incluir botão Excluir com AlertDialog e medidas recolhíveis no mobile (seção 3).
4. Se houver **comparação de fotos Antes/Depois**, seguir a lógica da seção 4 (iniciais = Antes, última sessão = Depois).

---

## Resumo de arquivos

| Recurso | Arquivo |
|--------|---------|
| Header padronizado | `src/components/TreatmentDetailHeader.tsx` |
| Comportamento de gráficos no mobile | `src/hooks/use-chart-mobile-behavior.ts` |
| Exemplo completo (sessões + gráficos + fotos) | `src/pages/WeightLossProgramDetail.tsx` |
| Exemplo (detalhe único, sem sessões) | `src/pages/BotoxApplicationDetail.tsx` |
