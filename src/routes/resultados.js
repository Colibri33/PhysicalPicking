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
import { validarParticipante, validarPayloadAnalisis, validarValoresAnalisis } from '../utils/validacion.js';

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

  const validacionParticipante = validarParticipante(participante);
  if (!validacionParticipante.ok) {
    return res.status(400).json({ error: validacionParticipante.error });
  }
  const { nombre, edad } = validacionParticipante;

  const validacionEstructura = validarPayloadAnalisis(payload);
  if (!validacionEstructura.ok) {
    return res.status(400).json({ error: validacionEstructura.error });
  }

  const validacionValores = validarValoresAnalisis(payload);
  if (!validacionValores.ok) {
    return res.status(400).json({ error: validacionValores.error });
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
      participante_nombre: nombre,
      participante_edad: edad,
      es_menor_edad: edad < 18,
      datos_cifrados: datosCifrados,
      iv,
      auth_tag: authTag,
    })
    .select('id, participante_nombre, participante_edad, es_menor_edad, creado_en')
    .single();

  if (error) {
    // No ocultar el motivo real en los logs del servidor (aunque al
    // cliente se le de un mensaje generico por seguridad).
    console.error('Error al insertar resultado en Supabase:', error);
    return res.status(500).json({ error: 'No se pudo guardar el resultado.' });
  }

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

  if (error) {
    console.error('Error al leer resultados de Supabase:', error);
    return res.status(500).json({ error: 'No se pudo leer el historial.' });
  }

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
    } catch (e) {
      // Error NO silencioso a nivel de servidor: se registra en los
      // logs de Render con el id de la fila afectada para poder
      // diagnosticar registros corruptos o con clave rotada, aunque
      // de cara al usuario se omite en vez de tumbar toda la respuesta.
      console.error(`No se pudo descifrar el resultado ${fila.id}:`, e.message);
      return null;
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
