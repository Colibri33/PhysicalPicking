/**
 * @module src/middleware/auth
 * @description Middleware Express que valida el JWT de Supabase Auth y adjunta req.usuario.
 *
 * Principios SOLID aplicados:
 *  - S (Responsabilidad única): única razón de cambio es la forma de autenticar una solicitud.
 *  - D (Inversión de dependencias): depende del cliente abstracto supabaseAdmin, no de HTTP directo.
 */

import { supabaseAdmin } from '../supabaseAdmin.js';

/** Verifica el token "Authorization: Bearer" y adjunta req.usuario = { id, email }.
 * @param {import('express').Request} req - solicitud entrante.
 * @param {import('express').Response} res - respuesta; recibe 401 si el token falta o es inválido.
 * @param {import('express').NextFunction} next - continúa la cadena si la sesión es válida.
 * @returns {Promise<void>} sin valor; responde o invoca next. */
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
