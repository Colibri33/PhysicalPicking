/* ═══════════════════════════════════════════════════════════════
   supabaseClient.js
   Cliente de Supabase para el navegador. Usa la ANON KEY (pública
   por diseño, protegida por Row Level Security en Postgres) — NUNCA
   la service role key, que solo vive en el backend.
   ═══════════════════════════════════════════════════════════════ */

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error(
    'Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copia .env.example a .env y complétalo.'
  );
}

export const supabase = createClient(url, anonKey);

// URL del backend propio (Render), para las rutas que cifran/leen
// datos sensibles y para los derechos ARCO.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
