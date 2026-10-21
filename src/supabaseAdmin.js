/**
 * @module src/supabaseAdmin
 * @description Instancia única del cliente Supabase con SERVICE ROLE KEY para el backend.
 *
 * Principios SOLID aplicados:
 *  - S (Responsabilidad única): única razón de cambio es la configuración del cliente Supabase.
 *  - D (Inversión de dependencias): las rutas dependen de este cliente, configurado por entorno.
 * Notas: la clave omite RLS; nunca debe exponerse al navegador. Cada endpoint valida que el
 * usuario autenticado solo acceda a sus propios datos.
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.');
}

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
