/**
 * @module src/utils/auditoria
 * @description Registra accesos sensibles en auditoria_accesos y deja constancia si el insert falla.
 */
import { supabaseAdmin } from '../supabaseAdmin.js';

/** Inserta un registro de auditoría verificando el error de Supabase.
 * @param {{usuario_id: string, accion: string, detalle?: Object, ip_origen?: string}} registro - datos del evento.
 * @returns {Promise<boolean>} true si se registró; false si falló (el fallo se escribe en el log). */
export async function registrarAuditoria(registro) {
  try {
    const { error } = await supabaseAdmin.from('auditoria_accesos').insert(registro);
    if (error) {
      console.error(`Auditoría no registrada [${registro.accion}]:`, error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`Auditoría no registrada [${registro.accion}]:`, e?.message);
    return false;
  }
}
