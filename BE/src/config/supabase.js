const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
// Use the Service Role Key to bypass Row Level Security (RLS) on the Backend
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (String(supabaseKey || "").startsWith("sb_publishable_")) {
  console.warn(
    "[Supabase] SUPABASE_SERVICE_ROLE_KEY contains a publishable key. " +
      "Backend-only writes protected by RLS will fail until an sb_secret_ or service_role key is configured.",
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
