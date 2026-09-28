const { createClient } = require('@supabase/supabase-js');
const { logger } = require('../utils/logger');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) logger.warn('SUPABASE_URL não definida no .env');
if (!SUPABASE_SERVICE_ROLE_KEY) logger.warn('SUPABASE_SERVICE_ROLE_KEY não definida no .env');

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
  : null;

module.exports = { supabase };
