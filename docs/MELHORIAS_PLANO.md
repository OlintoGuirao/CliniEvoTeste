# Plano de melhorias – evolução controlada

Objetivo: evoluir funcionalidades preservando arquitetura, dados e fluxos atuais.

## Ordem de implementação (incremental)

| # | Melhoria | Prioridade | Dependências | Status |
|---|----------|------------|--------------|--------|
| 1 | Estrutura por paciente (ficha única, sessões, procedimentos na sessão) | Alta | - | Migração criada |
| 2 | Termos versionados + assinatura digital (touch, armazenar com paciente/sessão/data/versão) | Alta | - | Migração criada |
| 3 | Procedimento Botox com mapa facial (pontos, persistência, opcional foto real) | Média | (1) | A implementar |
| 4 | Sessão com múltiplos procedimentos | Alta | (1) | Incluído em (1) |
| 5 | Notificação reaplicação Botox (prazo, agenda, mensagem ao paciente) | Média | (1) | Migração criada |
| 6 | Observações da sessão (texto livre, histórico) | Alta | (1) | Incluído em (1) |
| 7 | Pré-cadastro para agendamento (só nome, completar depois) | Alta | - | Migração criada |

---

## 1. Estrutura por paciente (refactor controlado)

- **Modelo atual:** `procedure_instances` (1 por paciente + procedimento) → `procedure_sessions` (sessões daquela instância).
- **Ajuste:** Introduzir **sessão por paciente** (`patient_sessions`): uma ficha única por paciente, cada paciente tem várias **sessões**; procedimentos pertencem à sessão.
- **Tabelas:**
  - `patient_sessions`: id, patient_id, professional_id, session_date, observacoes, created_at, updated_at.
  - `procedure_sessions`: ganha `patient_session_id` (nullable). Sessões antigas continuam com `patient_session_id` NULL (compatibilidade).
- **Compatibilidade:** Dados antigos seguem válidos; novas sessões podem ser criadas com `patient_session_id` e múltiplos procedimentos por sessão.

---

## 2. Termos e assinatura digital

- **Termos versionados:** tabela `terms` (id, slug, version, title, body, active, created_at).
- **Assinaturas:** tabela `term_signatures` (id, patient_id, session_id nullable, term_id, signature_data [imagem/base64], signed_at, created_at).
- **Mobile:** captura de assinatura via touch; armazenar imagem ou base64; vincular a paciente, sessão (quando houver), data e versão do termo.

---

## 3. Procedimento Botox – mapa facial

- Componente específico para procedimento Botox.
- Rosto ilustrativo (SVG) interativo com marcação de pontos.
- Persistir pontos (ex.: em `procedure_results.result_data` ou `procedure_sessions.data` para slug botox).
- Opcional: sobreposição em foto real do paciente.

---

## 4. Sessão com múltiplos procedimentos

- Permitir seleção de mais de um procedimento por sessão (via `patient_sessions` + várias `procedure_sessions` com mesmo `patient_session_id`).
- Histórico íntegro: cada `procedure_session` continua ligada a uma `procedure_instance` (paciente + tipo de procedimento).

---

## 5. Notificação de reaplicação de Botox

- Profissional define prazo (ex.: próxima reaplicação em 120 dias).
- Tabela `botox_reapplication_reminders`: patient_id, procedure_instance_id ou session_id, due_date, professional_id, notified_at.
- Sistema agenda notificação (app/local); ao clicar: abrir agenda com paciente e procedimento preenchidos.
- Ao confirmar agendamento: enviar mensagem automática ao paciente (ex.: WhatsApp).

---

## 6. Observações da sessão

- Campo de texto livre vinculado à sessão: coluna `observacoes` em `patient_sessions` (e/ou manter `procedure_sessions.data` para compatibilidade).
- Histórico preservado por versão de sessão (created_at/updated_at).

---

## 7. Pré-cadastro para agendamento

- Agendamento com apenas **nome completo**: `appointments.patient_id` nullable, `appointments.full_name` (texto).
- Completar cadastro depois: converter em paciente e atualizar `appointments.patient_id`.

---

## Segurança e compatibilidade

- RLS e políticas seguem o mesmo padrão (profissional dono dos dados).
- Migrações não removem colunas em uso; apenas adicionam colunas/tabelas e FKs nullable onde necessário.
- Usabilidade mobile em foco em todos os fluxos novos.
