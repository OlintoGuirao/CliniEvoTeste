require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key, { auth: { persistSession: false } });

(async () => {
  const pid = 'be0bdc72-9c92-47bd-b853-4235641d1c9e';
  const p = await sb.from('profiles').select('id, full_name, email, disabled_modules, notifications_cleared_at').eq('id', pid).maybeSingle();
  console.log('PROFILE', JSON.stringify(p.data || p.error, null, 2));
  const c = await sb
    .from('whatsapp_conversations')
    .select('id, professional_id, patient_name, patient_phone, status, last_message_at')
    .eq('status', 'open');
  console.log('OPEN_CONVS', JSON.stringify(c.data || c.error, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
