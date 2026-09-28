# Novos tipos de procedimento e tabela no banco

## Automatização

Quando você **cadastra um novo tipo de procedimento** em **Tipos de Tratamento**:

1. **Não é necessário criar uma tabela nova no banco.**  
   O sistema usa uma **tabela genérica** `treatment_applications`, que serve para **qualquer** tipo de procedimento.

2. **Uma única migração** (já incluída no projeto) cria essa tabela:
   - Arquivo: `supabase/migrations/20260129230000_treatment_applications_table.sql`
   - Rode uma vez: `supabase db push` ou execute o SQL no **Supabase SQL Editor**.

3. **Depois disso**, qualquer novo tipo que você criar em Tipos de Tratamento já pode ter aplicações registradas nessa tabela (o app pode ser estendido para listar/criar aplicações por tipo na ficha do paciente).

## Opcional: tabela dedicada por procedimento

Se quiser uma **tabela dedicada** para um tipo (ex.: `limpeza_de_pele_applications`):

1. Em **Tipos de Tratamento**, na lista de tipos, clique no ícone **script/código** ao lado do tipo.
2. Será baixado um arquivo `.sql` com o `CREATE TABLE` e políticas RLS.
3. Abra o **Supabase** → **SQL Editor**, cole o conteúdo do arquivo e execute.
4. A tabela dedicada será criada. Depois, **edite o tipo** (ícone de lápis) e no campo **"Tabela dedicada (opcional)"** informe o nome da tabela (ex.: `limpeza_de_pele_applications`). O app passará a listar e gravar aplicações dessa tabela em vez da genérica.

**Migração necessária:** a coluna `applications_table` em `treatment_types` foi adicionada na migração `20260129235000_treatment_types_applications_table.sql`. Rode as migrações (`supabase db push`) para que o campo apareça no formulário.

## Resumo

| O que você faz | O que acontece |
|----------------|----------------|
| Cadastra novo tipo em Tipos de Tratamento | O tipo aparece na aba do paciente (e no gerador de script). |
| Roda a migração `treatment_applications` uma vez | A tabela genérica fica disponível para todos os tipos. |
| Clica em "Gerar script SQL" no tipo | Baixa um `.sql` para criar tabela dedicada (opcional). |
| Executa esse SQL no Supabase | Cria uma tabela só para aquele tipo (opcional). |
| Edita o tipo e preenche "Tabela dedicada" | O app usa essa tabela para listar e registrar aplicações desse tipo. |

Não é possível **rodar** o script automaticamente pelo app (criar tabela no banco ao clicar em "Novo tipo") porque o frontend não tem permissão para executar DDL no Supabase. A solução é: **tabela genérica** para todos os tipos (já prevista) + **gerador de script** para quem quiser tabela dedicada; após criar a tabela e informar o nome no tipo, o app usa a tabela dedicada.
