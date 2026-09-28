-- Permite que o n8n leia agendamentos por telefone (usa service_role, bypassa RLS)
-- Política documentada para auditoria
COMMENT ON TABLE appointments IS 'Canal whatsapp gerenciado pelo n8n via service_role key';
COMMENT ON TABLE patients IS 'Pré-cadastros via whatsapp gerenciados pelo n8n via service_role key';

