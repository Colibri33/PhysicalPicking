/* ═══════════════════════════════════════════════════════════════
   routes/derechosArco.js
   Implementa los derechos ARCO (Acceso, Rectificación, Cancelación
   -supresión-, Oposición) exigidos por la Ley 1581/2012 y su
   Decreto reglamentario 1377/2013:
     - GET /arco/exportar  → derecho de ACCESO: descarga todos los
       datos que tenemos del titular, en un JSON legible.
     - DELETE /arco/cuenta → derecho de CANCELACIÓN/SUPRESIÓN:
       borra la cuenta y, en cascada, todos sus datos.
   La RECTIFICACIÓN se cubre con los endpoints normales de edición
   de perfil/resultados; la OPOSICIÓN se cubre dejando de tratar
   datos del usuario (cerrando/anonimizando la cuenta) — mismo
   endpoint de cancelación.
   ═══════════════════════════════════════════════════════════════ */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { descifrarJSON } from '../utils/crypto.js';

export const arcoRouter = Router();

arcoRouter.get('/exportar', requireAuth, async (req, res) => {
  const usuarioId = req.usuario.id;

  const [{ data: perfil }, { data: consentimientos }, { data: resultados }] = await Promise.all([
    supabaseAdmin.from('perfiles').select('*').eq('id', usuarioId).maybeSingle(),
    supabaseAdmin.from('consentimientos').select('*').eq('usuario_id', usuarioId),
    supabaseAdmin
      .from('resultados_test')
      .select('id, participante_nombre, participante_edad, es_menor_edad, datos_cifrados, iv, auth_tag, creado_en')
      .eq('usuario_id', usuarioId),
  ]);

  const resultadosLegibles = (resultados || []).map(fila => {
    try {
      const payload = descifrarJSON({ datosCifrados: fila.datos_cifrados, iv: fila.iv, authTag: fila.auth_tag });
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

  // Auditoría ANTES de borrar (después ya no habrá usuario_id que enlazar)
  await supabaseAdmin.from('auditoria_accesos').insert({
    usuario_id: usuarioId,
    accion: 'eliminar_cuenta',
    ip_origen: req.ip,
  });

  // Borra el usuario de auth.users; perfiles, consentimientos y
  // resultados_test caen en cascada por las FK definidas en schema.sql.
  const { error } = await supabaseAdmin.auth.admin.deleteUser(usuarioId);
  if (error) return res.status(500).json({ error: 'No se pudo eliminar la cuenta.' });

  res.json({ ok: true, mensaje: 'Cuenta y todos los datos asociados fueron eliminados.' });
});
