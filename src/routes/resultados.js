/**
 * @module src/routes/resultados
 * @description Router de historial de resultados: guarda, lee, edita, borra y exporta a PDF registros cifrados.
 *
 * Principios SOLID aplicados:
 *  - S (Responsabilidad única): única razón de cambio es la gestión HTTP del historial de resultados.
 *  - D (Inversión de dependencias): delega cifrado, validación, migración y PDF en módulos de utils.
 * Notas: el contenido sensible se cifra con AES-256-GCM antes de tocar la base y se descifra solo en memoria,
 * para el usuario dueño del registro.
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { cifrarJSON, descifrarJSON } from '../utils/crypto.js';
import { validarParticipante, validarPayloadAnalisis, validarValoresAnalisis } from '../utils/validacion.js';
import { generarPdfInforme } from '../utils/pdf.js';
import { migrarRegistroLegado } from '../utils/registroLegado.js';

export const resultadosRouter = Router();

/** Indica si el usuario registró consentimiento; es requisito antes de guardar resultados.
 * @param {string} usuarioId - id del usuario autenticado.
 * @returns {Promise<boolean>} true si existe un consentimiento. */
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
  const { participante, payload: payloadRecibido } = req.body || {};
  // Los registros anteriores a v6 (cognitivo/"corporales") se adaptan antes de validar.
  const payload = migrarRegistroLegado(payloadRecibido);

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
  // Protección contra guardado duplicado en el servidor: si en los últimos 5 s el mismo usuario guardó
  // un resultado para el mismo participante (nombre + edad), se asume reenvío (doble clic, reintento de red)
  // y se devuelve el registro existente. Es una ventana de tiempo, no deduplicación por contenido (que exigiría
  // un hash en una columna nueva): dos análisis idénticos separados por más de 5 s se guardan por separado.
  const haceCincoSegundos = new Date(Date.now() - 5000).toISOString();
  const { data: recientes } = await supabaseAdmin
    .from('resultados_test')
    .select('id, participante_nombre, participante_edad, creado_en')
    .eq('usuario_id', req.usuario.id)
    .eq('participante_nombre', nombre)
    .eq('participante_edad', edad)
    .gte('creado_en', haceCincoSegundos)
    .order('creado_en', { ascending: false })
    .limit(1);

  if (recientes && recientes.length > 0) {
    return res.status(200).json({ ok: true, resultado: recientes[0], duplicado: true });
  }

  let datosCifrados;
  let iv;
  let authTag;
  try {
    ({ datosCifrados, iv, authTag } = cifrarJSON(payload));
  } catch (e) {
    // Error de configuracion o de cifrado: se registra el motivo y se responde error generico; nunca se exponen datos.
    console.error('Error al cifrar el resultado antes de guardar:', e.message);
    return res.status(500).json({ error: 'No se pudo guardar el resultado.' });
  }

  const { data, error } = await supabaseAdmin
    .from('resultados_test')
    .insert({
      usuario_id: req.usuario.id,
      participante_nombre: nombre,
      participante_edad: edad,
      datos_cifrados: datosCifrados,
      iv,
      auth_tag: authTag,
    })
    .select('id, participante_nombre, participante_edad, creado_en')
    .single();

  if (error) {
    // El motivo real se registra en el servidor; al cliente solo se le da un mensaje genérico.
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
    .select('id, participante_nombre, participante_edad, datos_cifrados, iv, auth_tag, creado_en')
    .eq('usuario_id', req.usuario.id)
    .order('creado_en', { ascending: false });

  if (error) {
    console.error('Error al leer resultados de Supabase:', error);
    return res.status(500).json({ error: 'No se pudo leer el historial.' });
  }

  const historial = data.map(fila => {
    try {
      const payload = migrarRegistroLegado(descifrarJSON({
        datosCifrados: fila.datos_cifrados,
        iv: fila.iv,
        authTag: fila.auth_tag,
      }));
      return {
        id: fila.id,
        participante: { nombre: fila.participante_nombre, edad: fila.participante_edad },
        creadoEn: fila.creado_en,
        ...payload,
      };
    } catch (e) {
      // Se registra con el id de la fila para diagnosticar registros corruptos o con clave rotada;
      // al usuario se le omite el registro en vez de fallar toda la respuesta.
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

resultadosRouter.put('/:id', requireAuth, async (req, res) => {
  const { participante, payload: payloadRecibido } = req.body || {};
  // Los registros anteriores a v6 (cognitivo/"corporales") se adaptan antes de validar.
  const payload = migrarRegistroLegado(payloadRecibido);

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

  let datosCifrados;
  let iv;
  let authTag;
  try {
    ({ datosCifrados, iv, authTag } = cifrarJSON(payload));
  } catch (e) {
    // Error de configuracion o de cifrado: se registra el motivo y se responde error generico; nunca se exponen datos.
    console.error('Error al cifrar el resultado antes de actualizar:', e.message);
    return res.status(500).json({ error: 'No se pudo actualizar el resultado.' });
  }

  // El filtro por usuario_id impide editar registros ajenos: si el id pertenece a otra cuenta,
  // ninguna fila coincide y Supabase devuelve data vacío.
  const { data, error } = await supabaseAdmin
    .from('resultados_test')
    .update({
      participante_nombre: nombre,
      participante_edad: edad,
      datos_cifrados: datosCifrados,
      iv,
      auth_tag: authTag,
    })
    .eq('id', req.params.id)
    .eq('usuario_id', req.usuario.id)
    .select('id, participante_nombre, participante_edad, creado_en')
    .maybeSingle();

  if (error) {
    console.error('Error al actualizar resultado en Supabase:', error);
    return res.status(500).json({ error: 'No se pudo actualizar el resultado.' });
  }
  if (!data) {
    // Mismo mensaje si no existe o es ajeno, para no revelar registros de otros usuarios.
    return res.status(404).json({ error: 'Registro no encontrado.' });
  }

  await supabaseAdmin.from('auditoria_accesos').insert({
    usuario_id: req.usuario.id,
    accion: 'editar_resultado',
    detalle: { resultado_id: data.id },
    ip_origen: req.ip,
  });

  res.json({ ok: true, resultado: data });
});

resultadosRouter.delete('/:id', requireAuth, async (req, res) => {
  const { error } = await supabaseAdmin
    .from('resultados_test')
    .delete()
    .eq('id', req.params.id)
    .eq('usuario_id', req.usuario.id); // Nunca se confía solo en el id de la URL.

  if (error) return res.status(500).json({ error: 'No se pudo borrar el resultado.' });
  res.json({ ok: true });
});

// GET /resultados/:id/pdf: PDF de un resultado guardado. Flujo: base cifrada -> backend autorizado ->
// descifrado en memoria -> PDF. Nunca se expone clave, IV, authTag ni detalles técnicos de Supabase.
resultadosRouter.get('/:id/pdf', requireAuth, async (req, res) => {
  const { data: fila, error } = await supabaseAdmin
    .from('resultados_test')
    .select('id, participante_nombre, datos_cifrados, iv, auth_tag')
    .eq('id', req.params.id)
    .eq('usuario_id', req.usuario.id) // Mismo control de propiedad que en GET/PUT/DELETE.
    .maybeSingle();

  if (error) {
    console.error('Error al leer resultado para PDF:', error);
    return res.status(500).json({ error: 'No se pudo generar el documento.' });
  }
  if (!fila) return res.status(404).json({ error: 'Registro no encontrado.' });

  let payload;
  try {
    payload = migrarRegistroLegado(descifrarJSON({ datosCifrados: fila.datos_cifrados, iv: fila.iv, authTag: fila.auth_tag }));
  } catch (e) {
    console.error(`No se pudo descifrar el resultado ${fila.id} para PDF:`, e.message);
    return res.status(500).json({ error: 'No se pudo leer este registro.' });
  }

  await supabaseAdmin.from('auditoria_accesos').insert({
    usuario_id: req.usuario.id,
    accion: 'descargar_pdf',
    detalle: { resultado_id: fila.id },
    ip_origen: req.ip,
  });

  const nombreArchivo = `physicalpicking-informe-${(fila.participante_nombre || 'resultado').replace(/[^a-z0-9]+/gi, '_')}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
  generarPdfInforme(payload, res);
});

// POST /resultados/pdf: PDF a partir de un payload enviado en la petición, sin pasar por la base.
// Lo usa el modo invitado (sus datos viven solo en el navegador). No requiere sesión; el payload se valida
// y el limitador global de la API evita abusos.
resultadosRouter.post('/pdf', async (req, res) => {
  const { participante, payload: payloadRecibido } = req.body || {};
  // Los registros anteriores a v6 (cognitivo/"corporales") se adaptan antes de validar.
  const payload = migrarRegistroLegado(payloadRecibido);

  const validacionParticipante = validarParticipante(participante);
  if (!validacionParticipante.ok) {
    return res.status(400).json({ error: validacionParticipante.error });
  }
  const validacionEstructura = validarPayloadAnalisis(payload);
  if (!validacionEstructura.ok) {
    return res.status(400).json({ error: validacionEstructura.error });
  }
  const validacionValores = validarValoresAnalisis(payload);
  if (!validacionValores.ok) {
    return res.status(400).json({ error: validacionValores.error });
  }

  const nombreArchivo = `physicalpicking-informe-${(validacionParticipante.nombre || 'resultado').replace(/[^a-z0-9]+/gi, '_')}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
  generarPdfInforme(payload, res);
});
