/* ═══════════════════════════════════════════════════════════════
   middleware/auth.js
   Verifica el JWT que Supabase Auth emitió al usuario en el
   frontend (enviado como "Authorization: Bearer <token>") y
   adjunta req.usuario = { id, email } si es válido.
   ═══════════════════════════════════════════════════════════════ */

import { supabaseAdmin } from '../supabaseAdmin.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Falta el token de autenticación.' });
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: 'Sesión inválida o expirada.' });
  }

  req.usuario = { id: data.user.id, email: data.user.email };
  next();
}
