const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

const supabase = createClient(config.supabaseUrl, config.supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { 'X-Client-Info': 'shipping-website-server' } },
});

module.exports = supabase;
