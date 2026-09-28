const { supabase } = require('../config/supabase');

/** Avaliação aparece primeiro no menu de serviços do WhatsApp. */
function sortProceduresForBotListing(procedures) {
  const avaliacaoIndex = procedures.findIndex(
    (p) => p.slug === 'avaliacao' || p.name === 'Avaliação'
  );
  if (avaliacaoIndex <= 0) return procedures;
  const sorted = [...procedures];
  const [avaliacao] = sorted.splice(avaliacaoIndex, 1);
  return [avaliacao, ...sorted];
}

async function listProceduresForProfessional(professionalId) {
  if (!supabase || !professionalId) return [];

  const { data: rpcData, error: rpcError } = await supabase.rpc('get_procedures_for_profile', {
    p_profile_id: professionalId,
  });
  if (rpcError) throw new Error(rpcError.message);

  const procedures = (rpcData || []).map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    category: p.category,
  }));

  const { data: prefs, error: prefsError } = await supabase
    .from('user_procedures')
    .select('procedure_id, is_active, show_in_appointments')
    .eq('user_id', professionalId);

  if (prefsError) throw new Error(prefsError.message);

  const prefsMap = new Map((prefs || []).map((row) => [row.procedure_id, row]));

  const filtered = procedures.filter((p) => {
    const pref = prefsMap.get(p.id);
    if (!pref) return true;
    if (pref.is_active === false) return false;
    if (pref.show_in_appointments === false) return false;
    return true;
  });

  return sortProceduresForBotListing(filtered);
}

async function getProcedureNameById(procedureId) {
  if (!supabase || !procedureId) return null;
  const { data, error } = await supabase
    .from('procedures')
    .select('id, name')
    .eq('id', procedureId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.name ? String(data.name).trim() : null;
}

module.exports = { listProceduresForProfessional, getProcedureNameById };
