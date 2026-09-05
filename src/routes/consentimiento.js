/*
   routes/consentimiento.js
   Registra la autorización de tratamiento de datos personales
   (Habeas Data) del usuario, con evidencia (versión de política,
   IP, user-agent, fecha). Es un registro que nunca se
   actualiza ni se borra directamente (solo cae en cascada si el
   usuario ejerce su derecho de supresión / elimina su cuenta).
 */
      // cambio
      // PhysicalPicking es exclusivo para adultos de 18 a 30 años
      // (impuesto por validarParticipante en cada analisis); no existe
      // autorizacion de terceros/acudientes. Este valor se mantiene en
      // `true` por compatibilidad con la columna NOT NULL existente en
      // Supabase ya que el prototio anterior contemplaba aplicación en menores de edad.

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

// Consultar si el usuario ya tiene un consentimiento vigente o actvo
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
