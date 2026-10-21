/**
 * @module src/routes/consentimiento
 * @description Router que registra y consulta la autorización de tratamiento de datos personales (Habeas Data).
 *
 * Principios SOLID aplicados:
 *  - S (Responsabilidad única): única razón de cambio es el ciclo de vida del consentimiento.
 *  - D (Inversión de dependencias): usa el middleware requireAuth y el cliente supabaseAdmin importados.
 * Notas: guarda evidencia (versión de política, IP, user-agent, fecha). El registro nunca se actualiza ni se borra
 * directamente; solo cae en cascada si el usuario ejerce su derecho de supresión.
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../supabaseAdmin.js';

export const consentimientoRouter = Router();

consentimientoRouter.post('/', requireAuth, async (req, res) => {
  const { aceptoTratamiento, aceptoDatosSensibles } = req.body || {};

  if (aceptoTratamiento !== true || aceptoDatosSensibles !== true) {
    return res.status(400).json({
      error: 'Debes aceptar la autorización de tratamiento de datos y de datos sensibles para continuar.',
    });
  }

  const { data, error } = await supabaseAdmin
    .from('consentimientos')
    .insert({
      usuario_id: req.usuario.id,
      version_politica: process.env.POLITICA_VERSION || 'v1.0',
      acepto_tratamiento: true,
      acepto_datos_sensibles: true,
      // Se mantiene en `true` por compatibilidad con la columna NOT NULL existente: la aplicación es solo para
      // adultos de 18 a 30 años (validarParticipante) y no existe autorización de terceros ni acudientes.
      es_mayor_de_edad: true,
      ip_origen: req.ip,
      user_agent: req.headers['user-agent'] || null,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: 'No se pudo registrar el consentimiento.' });

  await supabaseAdmin.from('auditoria_accesos').insert({
    usuario_id: req.usuario.id,
    accion: 'registrar_consentimiento',
    ip_origen: req.ip,
  });

  res.status(201).json({ ok: true, consentimiento: data });
});

consentimientoRouter.get('/vigente', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('consentimientos')
    .select('*')
    .eq('usuario_id', req.usuario.id)
    .order('creado_en', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return res.status(500).json({ error: 'No se pudo consultar el consentimiento.' });
  res.json({ consentimiento: data || null });
});
