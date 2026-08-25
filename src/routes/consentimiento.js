/* ═══════════════════════════════════════════════════════════════
   routes/consentimiento.js
   Registra la autorización de tratamiento de datos personales
   (Habeas Data) del usuario, con evidencia (versión de política,
   IP, user-agent, fecha). Es un registro inmutable: nunca se
   actualiza ni se borra directamente (solo cae en cascada si el
   usuario ejerce su derecho de supresión / elimina su cuenta).
   ═══════════════════════════════════════════════════════════════ */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../supabaseAdmin.js';

export const consentimientoRouter = Router();

consentimientoRouter.post('/', requireAuth, async (req, res) => {
  const {
    aceptoTratamiento,
    aceptoDatosSensibles,
    esMayorDeEdad,
    nombreAcudiente,
    documentoAcudiente,
  } = req.body || {};

  if (aceptoTratamiento !== true || aceptoDatosSensibles !== true) {
    return res.status(400).json({
      error: 'Debes aceptar la autorización de tratamiento de datos y de datos sensibles para continuar.',
    });
  }

  if (esMayorDeEdad === false && (!nombreAcudiente?.trim() || !documentoAcudiente?.trim())) {
    return res.status(400).json({
      error: 'Para menores de edad se requiere el nombre y documento del padre, madre o acudiente.',
    });
  }

  const { data, error } = await supabaseAdmin
    .from('consentimientos')
    .insert({
      usuario_id: req.usuario.id,
      version_politica: process.env.POLITICA_VERSION || 'v1.0',
      acepto_tratamiento: true,
      acepto_datos_sensibles: true,
      es_mayor_de_edad: esMayorDeEdad !== false,
      nombre_acudiente: nombreAcudiente || null,
      documento_acudiente: documentoAcudiente || null,
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

// Consultar si el usuario ya tiene un consentimiento vigente
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
