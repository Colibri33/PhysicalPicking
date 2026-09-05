/* 
   routes/resultados.js
   Guarda y lee el historial de resultados de test. El contenido
   sensible (mediciones físicas/cognitivas y el resultado calculado)
   se cifra con AES-256-GCM antes de tocar la base de datos, y se
   descifra solo en memoria del backend al leerlo, para el usuario
   dueño del registro.
*/

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { cifrarJSON, descifrarJSON } from '../utils/crypto.js';
import { validarParticipante, validarPayloadAnalisis, validarValoresAnalisis } from '../utils/validacion.js';
import { generarPdfInforme } from '../utils/pdf.js';

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
  //Aqui el programa realiza:
  // Proteccion contra guardado duplicado a nivel de servidor: no
  // confiar solo en el estado del frontend. Si en los ultimos 5
  // segundos este mismo usuario ya guardo un resultado para el
  // mismo participante (nombre + edad), se asume que es un reenvio
  // (doble clic, reintento de red) y se devuelve el registro ya
  // existente en vez de crear uno nuevo. esto para evitarr que se guarde varias veces un resultado.
  //
  // Nota de diseño: esto es un ataja o estrategia por ventana de tiempo, no
  // una deduplicacion por contenido exacto (que requeriria guardar un
  // hash del payload en una columna nueva.... una migracion de esquema
  // que no se aplico aqui para no forzar un cambio de base de datos
  // como parte de esta tarea). Cubre el caso real que queremos evitar
  // (clics repetidos accidentales), pero dos analisis genuinamente
  // identicos guardados con mas de 5s de diferencia SI se guardan
  // como registros separados, a proposito.
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

  const { datosCifrados, iv, authTag } = cifrarJSON(payload);

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
    .select('id, participante_nombre, participante_edad, datos_cifrados, iv, auth_tag, creado_en')
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

resultadosRouter.put('/:id', requireAuth, async (req, res) => {
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

  const { datosCifrados, iv, authTag } = cifrarJSON(payload);

  // El WHERE con usuario_id es lo que impide que un usuario edite el
  // registro de otro: si el id pertenece a otra cuenta, ninguna fila
  // hace conexión y Supabase devuelve data vacio (nunca un error 200
  // silencioso sobre datos ajenos). a ique no se puede registrar en usuario ajeno.
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
    // O no existe, o no pertenece a este usuario — mismo mensaje en
    // ambos casos para no revelar la existencia de registros ajenos.
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
    .eq('usuario_id', req.usuario.id); // nunca confiar solo en el id de la URL

  if (error) return res.status(500).json({ error: 'No se pudo borrar el resultado.' });
  res.json({ ok: true });
});

/**
 * GET /resultados/:id/pdf, descarga profesional en PDF de un
 * resultado ya guardado (usuario autenticado). Sigue la arquitectura
 * establecida que es base de datos (cifrada) -> backend autorizado -> descifrado
 * controlado en memoria -> generación del PDF -> respuesta al usuario.
 * Nunca se expone la clave, el IV, el authTag ni ningun detalle
 * tecnico de Supabase en el documento.
 */
resultadosRouter.get('/:id/pdf', requireAuth, async (req, res) => {
  const { data: fila, error } = await supabaseAdmin
    .from('resultados_test')
    .select('id, participante_nombre, datos_cifrados, iv, auth_tag')
    .eq('id', req.params.id)
    .eq('usuario_id', req.usuario.id) // mismo control de propiedad que en GET/PUT/DELETE
    .maybeSingle();

  if (error) {
    console.error('Error al leer resultado para PDF:', error);
    return res.status(500).json({ error: 'No se pudo generar el documento.' });
  }
  if (!fila) return res.status(404).json({ error: 'Registro no encontrado.' });

  let payload;
  try {
    payload = descifrarJSON({ datosCifrados: fila.datos_cifrados, iv: fila.iv, authTag: fila.auth_tag });
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

/**
 * POST /resultados/pdf: genera el mismo PDF profesional pero a
 * partir de un payload enviado directamente en la petición, sin
 * pasar por la base de datos. Es la ruta que usa el MODO INVITADO
 * (nunca tuvo un registro cifrado en Supabase, porque sus datos
 * viven solo en el navegador) para tener la misma descarga en PDF
 * que un usuario autenticado. No requiere sesión, validado y
 * limitado por el rate limiter global para evitar abuso.
 */
resultadosRouter.post('/pdf', async (req, res) => {
  const { participante, payload } = req.body || {};

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
