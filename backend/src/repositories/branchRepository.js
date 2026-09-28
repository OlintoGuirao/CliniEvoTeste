const { supabase } = require('../config/supabase');

async function findBranchByWhatsappInstance(instanceId) {
  if (!supabase || !instanceId) return null;

  const { data, error } = await supabase
    .from('organization_branches')
    .select('id, organization_id, name, whatsapp_instance_id, is_active')
    .eq('whatsapp_instance_id', instanceId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data || null;
}

module.exports = {
  findBranchByWhatsappInstance,
};
