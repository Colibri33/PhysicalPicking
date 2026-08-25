/* ═══════════════════════════════════════════════════════════════
   supabaseAdmin.js
   Cliente de Supabase con la SERVICE ROLE KEY. Este cliente puede
   saltarse RLS, por lo que SOLO se usa dentro del backend, nunca
   se expone al navegador. Cada endpoint valida manualmente que el
   usuario autenticado solo pueda tocar sus propios datos.
   ═══════════════════════════════════════════════════════════════ */

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.');
}

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
