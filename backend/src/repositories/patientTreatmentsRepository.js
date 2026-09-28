const { supabase } = require('../config/supabase');

const EMAGRECIMENTO_SLUG = 'emagrecimento-reducao-medidas';
const SLUG_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';

function randomSlug(length = 10) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += SLUG_CHARS[Math.floor(Math.random() * SLUG_CHARS.length)];
  }
  return out;
}

async function readExistingSlug({ instanceId, isEmagrecimento }) {
  const table = isEmagrecimento ? 'emagrecimento_report_links' : 'procedure_report_links';
  const { data } = await supabase
    .from(table)
    .select('slug')
    .eq('procedure_instance_id', instanceId)
    .maybeSingle();
  return data?.slug || null;
}

async function ensureReportSlug({ instanceId, isEmagrecimento }) {
  if (!supabase || !instanceId) return null;

  const existing = await readExistingSlug({ instanceId, isEmagrecimento });
  if (existing) return existing;

  const table = isEmagrecimento ? 'emagrecimento_report_links' : 'procedure_report_links';
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const slug = randomSlug(10);
    const { error } = await supabase.from(table).insert({
      procedure_instance_id: instanceId,
      slug,
    });
    if (!error) return slug;

    const retry = await readExistingSlug({ instanceId, isEmagrecimento });
    if (retry) return retry;
    if (!/duplicate|unique/i.test(error.message || '')) break;
  }

  return readExistingSlug({ instanceId, isEmagrecimento });
}

async function listActiveTreatmentsForPatient({ patientId, professionalId }) {
  if (!supabase || !patientId || !professionalId) return [];

  const { data, error } = await supabase
    .from('procedure_instances')
    .select(
      'id, data_inicio, status, procedures:procedure_id(id, name, slug), patients:patient_id(full_name)'
    )
    .eq('patient_id', patientId)
    .eq('professional_id', professionalId)
    .eq('status', 'em_andamento')
    .order('data_inicio', { ascending: false })
    .limit(20);

  if (error) {
    if (/procedure_instances|relation|column/i.test(error.message || '')) return [];
    throw new Error(error.message);
  }

  const treatments = [];
  for (const row of data || []) {
    const procedure = row.procedures || {};
    const slug = String(procedure.slug || '').trim();
    const isEmagrecimento = slug === EMAGRECIMENTO_SLUG;
    const reportSlug = await ensureReportSlug({ instanceId: row.id, isEmagrecimento });
    if (!reportSlug) continue;

    treatments.push({
      id: row.id,
      kind: isEmagrecimento ? 'emagrecimento' : 'procedure',
      procedureName: String(procedure.name || 'Tratamento').trim() || 'Tratamento',
      reportSlug,
      pathPrefix: isEmagrecimento ? '/re/' : '/rp/',
    });
  }

  const { data: botoxRows, error: botoxError } = await supabase
    .from('programas_botox')
    .select('id, dia_vencimento')
    .eq('paciente_id', patientId)
    .eq('professional_id', professionalId)
    .eq('status', 'ativo')
    .limit(5);

  if (!botoxError) {
    for (const row of botoxRows || []) {
      treatments.push({
        id: row.id,
        kind: 'botox',
        procedureName: 'Programa de Botox',
        reportSlug: null,
        pathPrefix: null,
        billingDay: row.dia_vencimento,
      });
    }
  }

  return treatments;
}

async function countActiveTreatmentsForPatient({ patientId, professionalId }) {
  const items = await listActiveTreatmentsForPatient({ patientId, professionalId });
  return items.length;
}

module.exports = {
  listActiveTreatmentsForPatient,
  countActiveTreatmentsForPatient,
  EMAGRECIMENTO_SLUG,
};
