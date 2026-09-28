# Ideias de modificações do APK – alinhamento

Documento para alinhar suas ideias com o que já existe no banco/app e o que falta implementar.

---

## 1. Ficha de anamnese + termos + assinatura (mobile: paciente assina)

| O que você quer | Status no projeto | Próximo passo |
|-----------------|-------------------|---------------|
| Termos versionados (ex.: anamnese, consentimento) | ✅ Tabela `terms` (slug, version, title, body) | Cadastrar termos em Configurações ou seed; tela para exibir termo |
| Assinatura digital do paciente | ✅ Tabela `term_signatures` (patient_id, term_id, signature_data, signed_at, opcional: sessão) | Componente de **assinatura por toque** no mobile (canvas); salvar imagem/base64 em `signature_data` |
| Paciente assina no celular | 🔲 Não implementado | Na tela de termo (ou antes do procedimento), mostrar termo + área de desenho para assinar; botão "Assinar" grava em `term_signatures` |

**Sugestão de fluxo:** Profissional abre “Solicitar assinatura” para um paciente → escolhe o termo (ex. anamnese v1) → envia link ou abre no próprio app → paciente lê e assina com o dedo → fica salvo com paciente, data e versão do termo.

---

## 2. Botox: rosto com pontos de aplicação (+ opção foto do paciente)

| O que você quer | Status no projeto | Próximo passo |
|-----------------|-------------------|---------------|
| Rosto ilustrativo onde a profissional clica e aparecem os pontos de aplicação | 🔲 Não implementado | Componente: imagem/SVG de rosto frontal (e opcional perfil); ao clicar, marca ponto e persiste coordenadas (ex. em `procedure_sessions.data` ou `procedure_results`) |
| Opcional: usar foto real do paciente (tipo reconhecimento facial) | 🔲 Não implementado | Tela “Tirar foto do rosto” (enquadramento guia) → salvar foto → na mesma tela, sobrepor os pontos de aplicação sobre essa foto |

**Persistência:** Guardar no JSON da sessão (ex. `data.pontos_aplicacao = [{ x, y, area?: "testa" | "entrecelhas" | ... }]`) ou em `procedure_results` para o procedimento Botox.

---

## 3. Vários procedimentos na mesma sessão (profissional vai ticando)

| O que você quer | Status no projeto | Próximo passo |
|-----------------|-------------------|---------------|
| Ficha/sessão onde o profissional marca quais procedimentos estéticos foram feitos naquela sessão | ✅ Modelo no banco: `patient_sessions` + `procedure_sessions.patient_session_id` | UI: “Nova sessão do paciente” → data da sessão → **checklist de procedimentos** (ticando os realizados) → para cada um ticado, criar/vinculare `procedure_session` à mesma `patient_session` |
| Histórico íntegro | ✅ Cada sessão de procedimento continua ligada ao paciente e ao tipo de procedimento | Manter listagem por paciente e por procedimento; na ficha do paciente, mostrar “Sessões” com os procedimentos daquele dia |

**Fluxo sugerido:** Em “Pacientes” → [Paciente] → “Nova sessão” → Data + observação da sessão + “Procedimentos realizados hoje” (múltipla escolha) → Salvar uma `patient_session` e várias `procedure_sessions` (uma por procedimento ticado).

---

## 4. Notificação de reaplicação do Botox (prazo → notificação → agenda → WhatsApp)

| O que você quer | Status no projeto | Próximo passo |
|-----------------|-------------------|---------------|
| Profissional define período para reaplicação (ex. 120 dias) | ✅ Tabela `botox_reapplication_reminders` (patient_id, procedure_instance_id, due_date, professional_id) | Na tela do procedimento Botox (ou na sessão), campo “Próxima reaplicação em” (data ou “em X dias”) → gravar em `botox_reapplication_reminders` |
| Sistema avisa a profissional (notificação) | 🔲 Parcial (notificações in-app já existem para outras coisas) | Incluir lembretes de Botox no mesmo fluxo de notificações; filtrar por `due_date` próximo |
| Ao clicar na notificação: abre a agenda já com nome e procedimento | 🔲 Não implementado | Notificação com link/state: ex. `/agenda?patientId=...&procedureSlug=botox` (ou abrir modal de agendamento já com paciente e “Botox” preenchidos) |
| Ao agendar o horário: envia mensagem para o paciente (WhatsApp) | ✅ Agenda já tem fluxo de abrir WhatsApp com texto após agendar | Reaproveitar: ao confirmar o agendamento vindo da notificação, usar o mesmo “Abrir WhatsApp com lembrete” (nome, data, hora) |

---

## 5. Campo de observação da sessão

| O que você quer | Status no projeto | Próximo passo |
|-----------------|-------------------|---------------|
| Durante o procedimento, campo para o profissional anotar observações daquela sessão | ✅ Coluna `procedure_sessions.observacoes` e `patient_sessions.observacoes` | Na tela “Nova sessão” (e ao editar sessão), **campo de texto livre “Observações”**; ao salvar, gravar em `observacoes`; na listagem de sessões, exibir esse texto |

---

## 6. Ficha por paciente (não por procedimento)

| O que você quer | Status no projeto | Próximo passo |
|-----------------|-------------------|---------------|
| Uma única ficha por paciente; sessões e procedimentos dentro dela | ✅ Tabela `patient_sessions` (sessão do paciente na data X); procedimentos ligados por `procedure_sessions.patient_session_id` | **Navegação:** em “Pacientes” → [Paciente] → a tela principal passa a ser a **ficha do paciente** (dados pessoais + **timeline de sessões**). Cada sessão mostra: data, observação, procedimentos realizados naquele dia. Iniciar novo procedimento ou nova “sessão com vários procedimentos” a partir daí |

**Resumo:** Hoje a navegação é muito “por procedimento” (lista de procedimentos → escolhe paciente). A ideia é ter “por paciente” como eixo: abrir o paciente e ver tudo (sessões, procedimentos, termos, Botox, etc.) na mesma ficha.

---

## 7. Pré-cadastro para agendar (só nome + telefone e já mandar WhatsApp)

| O que você quer | Status no projeto | Próximo passo |
|-----------------|-------------------|---------------|
| Agendar só com nome completo | ✅ Implementado: `appointments.full_name`, `patient_id` opcional; campo “Ou pré-cadastro” na Agenda | - |
| Incluir telefone no pré-cadastro para já enviar WhatsApp | 🔲 Hoje o envio de WhatsApp usa o telefone do **paciente** (quando já cadastrado) | Adicionar campo **telefone** no pré-cadastro da agenda (opcional): ex. `appointments.pre_registration_phone`. Ao agendar com nome + telefone, mesmo sem paciente cadastrado, abrir WhatsApp com o número informado e mensagem padrão (nome, data, hora) |

**Banco:** Nova coluna em `appointments`, por exemplo `pre_registration_phone` (TEXT, opcional). Na UI do modal de agendamento: se estiver em “pré-cadastro” (só nome), mostrar também “Telefone (para enviar lembrete por WhatsApp)”.

---

## Ordem sugerida de implementação

1. **Observações da sessão** – rápido; usa coluna que já existe.
2. **Pré-cadastro com telefone** – uma coluna + ajuste no modal da agenda e no envio do WhatsApp.
3. **Ficha por paciente** – reorganizar PatientDetail para ser a “ficha única” e listar sessões (e depois procedimentos por sessão).
4. **Múltiplos procedimentos na sessão** – tela “Nova sessão” do paciente com checklist de procedimentos e uso de `patient_sessions` + `procedure_sessions`.
5. **Termos + assinatura** – telas de termo e componente de assinatura por toque; gravar em `term_signatures`.
6. **Botox: mapa de pontos** – componente rosto (SVG/foto) + pontos; opcional foto do paciente depois.
7. **Reaplicação Botox** – campo “Próxima reaplicação”, gravar em `botox_reapplication_reminders`, notificação e link para agenda com paciente + procedimento; reuso do envio WhatsApp ao agendar.

Se quiser, na próxima etapa podemos detalhar uma dessas (por exemplo: “pré-cadastro com telefone” ou “observações da sessão”) em tarefas de código passo a passo.
