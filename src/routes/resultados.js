/* ═══════════════════════════════════════════════════════════════
   routes/resultados.js
   Guarda y lee el historial de resultados de test. El contenido
   sensible (mediciones físicas/cognitivas y el resultado calculado)
   se cifra con AES-256-GCM antes de tocar la base de datos, y se
   descifra solo en memoria del backend al leerlo, para el usuario
   dueño del registro.
   ═══════════════════════════════════════════════════════════════ */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { cifrarJSON, descifrarJSON } from '../utils/crypto.js';

export const resultadosRouter = Router();

// Exige que el usuario ya haya dado su consentimiento antes de guardar nada.
async function tieneConsentimientoVigente(usuarioId) {
  const { data } = await supabaseAdmin
    .from('consentimientos')
    .select('id')
    .eq('usuario_id', usuarioId)
    .limit(1)
    .maybeSingle();
  return !!data;
}

resultadosRouter.post('/', requireAuth, async (req, res) => {
  const { participante, payload } = req.body || {};

  if (!participante?.nombre?.trim() || !participante?.edad) {
    return res.status(400).json({ error: 'Faltan datos del participante.' });
  }
  if (!payload) {
    return res.status(400).json({ error: 'Falta el contenido del resultado.' });
  }

  const consentido = await tieneConsentimientoVigente(req.usuario.id);
  if (!consentido) {
    return res.status(403).json({
      error: 'Debes aceptar la autorización de tratamiento de datos antes de guardar resultados.',
    });
  }

  const { datosCifrados, iv, authTag } = cifrarJSON(payload);

  const { data, error } = await supabaseAdmin
    .from('resultados_test')
    .insert({
      usuario_id: req.usuario.id,
      participante_nombre: participante.nombre.trim(),
      participante_edad: Number(participante.edad),
      es_menor_edad: Number(participante.edad) < 18,
      datos_cifrados: datosCifrados,
      iv,
      auth_tag: authTag,
    })
    .select('id, participante_nombre, participante_edad, es_menor_edad, creado_en')
    .single();

  if (error) return res.status(500).json({ error: 'No se pudo guardar el resultado.' });

  await supabaseAdmin.from('auditoria_accesos').insert({
    usuario_id: req.usuario.id,
    accion: 'guardar_resultado',
    detalle: { resultado_id: data.id },
    ip_origen: req.ip,
  });

  res.status(201).json({ ok: true, resultado: data });
});

resultadosRouter.get('/', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('resultados_test')
    .select('id, participante_nombre, participante_edad, es_menor_edad, datos_cifrados, iv, auth_tag, creado_en')
    .eq('usuario_id', req.usuario.id)
    .order('creado_en', { ascending: false });

  if (error) return res.status(500).json({ error: 'No se pudo leer el historial.' });

  const historial = data.map(fila => {
    try {
      const payload = descifrarJSON({
        datosCifrados: fila.datos_cifrados,
        iv: fila.iv,
        authTag: fila.auth_tag,
      });
      return {
        id: fila.id,
        participante: { nombre: fila.participante_nombre, edad: fila.participante_edad },
        esMenorEdad: fila.es_menor_edad,
        creadoEn: fila.creado_en,
        ...payload,
      };
    } catch {
      return null; // registro corrupto o clave rotada: se omite en vez de tumbar la respuesta
    }
  }).filter(Boolean);

  await supabaseAdmin.from('auditoria_accesos').insert({
    usuario_id: req.usuario.id,
    accion: 'leer_historial',
    ip_origen: req.ip,
  });

  res.json({ historial });
});

resultadosRouter.delete('/:id', requireAuth, async (req, res) => {
  const { error } = await supabaseAdmin
    .from('resultados_test')
    .delete()
    .eq('id', req.params.id)
    .eq('usuario_id', req.usuario.id); // nunca confiar solo en el id de la URL

  if (error) return res.status(500).json({ error: 'No se pudo borrar el resultado.' });
  res.json({ ok: true });
});
