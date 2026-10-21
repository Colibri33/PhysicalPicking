/**
 * @module src/routes/derechosArco
 * @description Router de derechos ARCO (Ley 1581/2012, Decreto 1377/2013): exportación y supresión de datos del titular.
 *
 * Principios SOLID aplicados:
 *  - S (Responsabilidad única): única razón de cambio es el ejercicio de derechos ARCO.
 *  - D (Inversión de dependencias): usa requireAuth, supabaseAdmin y descifrarJSON importados.
 * Notas: GET /arco/exportar cubre ACCESO; DELETE /arco/cuenta cubre CANCELACIÓN y OPOSICIÓN (cierre de la cuenta).
 * La RECTIFICACIÓN se cubre con los endpoints de edición de resultados.
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { descifrarJSON } from '../utils/crypto.js';
import { migrarRegistroLegado } from '../utils/registroLegado.js';

export const arcoRouter = Router();

arcoRouter.get('/exportar', requireAuth, async (req, res) => {
  const usuarioId = req.usuario.id;

  const [{ data: perfil }, { data: consentimientos }, { data: resultados }] = await Promise.all([
    supabaseAdmin.from('perfiles').select('*').eq('id', usuarioId).maybeSingle(),
    supabaseAdmin.from('consentimientos').select('*').eq('usuario_id', usuarioId),
    supabaseAdmin
      .from('resultados_test')
      .select('id, participante_nombre, participante_edad, datos_cifrados, iv, auth_tag, creado_en')
      .eq('usuario_id', usuarioId),
  ]);

  const resultadosLegibles = (resultados || []).map(fila => {
    try {
      const payload = migrarRegistroLegado(descifrarJSON({ datosCifrados: fila.datos_cifrados, iv: fila.iv, authTag: fila.auth_tag }));
      return {
        id: fila.id,
        participante: { nombre: fila.participante_nombre, edad: fila.participante_edad },
        creadoEn: fila.creado_en,
        ...payload,
      };
    } catch {
      return { id: fila.id, error: 'No se pudo descifrar este registro.' };
    }
  });

  await supabaseAdmin.from('auditoria_accesos').insert({
    usuario_id: usuarioId,
    accion: 'exportar_datos_arco',
    ip_origen: req.ip,
  });

  res.setHeader('Content-Disposition', 'attachment; filename="mis-datos-physicalpicking.json"');
  res.json({
    generadoEn: new Date().toISOString(),
    perfil,
    consentimientos,
    resultados: resultadosLegibles,
  });
});

arcoRouter.delete('/cuenta', requireAuth, async (req, res) => {
  const usuarioId = req.usuario.id;

  // La auditoría se registra antes de borrar: después ya no existiría usuario_id al que enlazarla.
  await supabaseAdmin.from('auditoria_accesos').insert({
    usuario_id: usuarioId,
    accion: 'eliminar_cuenta',
    ip_origen: req.ip,
  });

  // Borra el usuario de auth.users; perfiles, consentimientos y resultados_test
  // caen en cascada por las claves foráneas definidas en schema.sql.
  const { error } = await supabaseAdmin.auth.admin.deleteUser(usuarioId);
  if (error) return res.status(500).json({ error: 'No se pudo eliminar la cuenta.' });

  res.json({ ok: true, mensaje: 'Cuenta y todos los datos asociados fueron eliminados.' });
});
