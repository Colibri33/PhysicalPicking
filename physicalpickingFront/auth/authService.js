/* ═══════════════════════════════════════════════════════════════
   DermaAnalyzer Pro · auth/authService.js  (v7 — backend real)
   Autenticación con Supabase Auth (contraseñas con hash bcrypt,
   gestionadas por Supabase — nunca en texto plano) + API propia
   para consentimiento Habeas Data, resultados cifrados y derechos
   ARCO.

   Se conserva la misma interfaz pública que usaba la versión de
   prototipo (registrar, login, logout, obtenerSesionActual,
   guardarRegistroHistorial, leerHistorial, limpiarHistorialInvitado)
   para no tener que reescribir todos los componentes — pero ahora
   son funciones ASÍNCRONAS (devuelven promesas), porque hablan con
   una red real. Los componentes que las llaman deben usar
   await / then (ver PantallaAuth.jsx, App.jsx, AnalizadorWizard.jsx).
   ═══════════════════════════════════════════════════════════════ */

import { supabase, API_URL } from '../supabaseClient';

const STORAGE_HISTORIAL_INVITADO = 'derma_historial_invitado';

/* ─── helper: llamadas autenticadas al backend propio ─── */
async function apiFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Error de red.');
  return body;
}

/* ─── API pública ─── */

/**
 * registrar — crea una cuenta nueva en Supabase Auth.
 * El consentimiento de Habeas Data se registra por separado con
 * `registrarConsentimiento`, normalmente justo después de esto,
 * antes de dejar entrar al usuario al wizard.
 */
export async function registrar(nombre, email, password) {
  if (!nombre.trim() || !email.trim() || !password.trim()) {
    return { ok: false, error: 'Todos los campos son obligatorios.' };
  }
  if (password.length < 6) {
    return { ok: false, error: 'La contrasena debe tener al menos 6 caracteres.' };
  }

  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { nombre: nombre.trim() } },
  });

  if (error) return { ok: false, error: traducirErrorSupabase(error) };
  return { ok: true, usuario: mapearUsuario(data.user, nombre) };
}

/**
 * login — autentica con email + password contra Supabase Auth.
 */
export async function login(email, password) {
  if (!email.trim() || !password.trim()) {
    return { ok: false, error: 'Ingresa email y contrasena.' };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) return { ok: false, error: traducirErrorSupabase(error) };
  const nombre = data.user.user_metadata?.nombre || data.user.email;
  return { ok: true, usuario: mapearUsuario(data.user, nombre) };
}

/**
 * logout — cierra la sesión activa.
 */
export async function logout() {
  await supabase.auth.signOut();
}

/**
 * obtenerSesionActual — recupera el usuario de la sesión guardada
 * (Supabase persiste el refresh token de forma segura en el propio
 * navegador y lo renueva automáticamente).
 */
export async function obtenerSesionActual() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  const nombre = session.user.user_metadata?.nombre || session.user.email;
  return mapearUsuario(session.user, nombre);
}

/**
 * registrarConsentimiento — guarda la autorización de tratamiento
 * de datos personales (obligatorio antes de poder guardar resultados).
 */
export async function registrarConsentimiento({
  esMayorDeEdad,
  nombreAcudiente,
  documentoAcudiente,
}) {
  try {
    await apiFetch('/consentimiento', {
      method: 'POST',
      body: JSON.stringify({
        aceptoTratamiento: true,
        aceptoDatosSensibles: true,
        esMayorDeEdad,
        nombreAcudiente,
        documentoAcudiente,
      }),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function tieneConsentimientoVigente() {
  try {
    const { consentimiento } = await apiFetch('/consentimiento/vigente');
    return !!consentimiento;
  } catch {
    return false;
  }
}

/**
 * guardarRegistroHistorial — agrega un registro al historial del
 * usuario. Si usuarioId es null (invitado), lo guarda solo en este
 * navegador, tal como en el prototipo original — el modo invitado
 * nunca toca el backend ni la base de datos.
 */
export async function guardarRegistroHistorial(usuarioId, registro) {
  if (usuarioId === null) {
    try {
      const prev = JSON.parse(localStorage.getItem(STORAGE_HISTORIAL_INVITADO) || '[]');
      prev.unshift(registro);
      localStorage.setItem(STORAGE_HISTORIAL_INVITADO, JSON.stringify(prev));
    } catch { /* sin acceso a storage — ignorar */ }
    return { ok: true };
  }

  try {
    const { resultado } = await apiFetch('/resultados', {
      method: 'POST',
      body: JSON.stringify({
        participante: registro.participante,
        payload: registro,
      }),
    });
    return { ok: true, resultado };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * leerHistorial — devuelve el historial según modo.
 */
export async function leerHistorial(usuarioId) {
  if (usuarioId === null) {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_HISTORIAL_INVITADO) || '[]');
    } catch {
      return [];
    }
  }

  try {
    const { historial } = await apiFetch('/resultados');
    return historial;
  } catch {
    return [];
  }
}

/**
 * limpiarHistorialInvitado — borra el historial temporal del modo invitado.
 */
export function limpiarHistorialInvitado() {
  localStorage.removeItem(STORAGE_HISTORIAL_INVITADO);
}

/**
 * exportarMisDatos — derecho de ACCESO (ARCO): descarga todo lo
 * que tenemos del usuario en un JSON.
 */
export async function exportarMisDatos() {
  return apiFetch('/arco/exportar');
}

/**
 * eliminarCuenta — derecho de SUPRESIÓN (ARCO): borra la cuenta y
 * todos los datos asociados, sin posibilidad de recuperación.
 */
export async function eliminarCuenta() {
  await apiFetch('/arco/cuenta', { method: 'DELETE' });
  await logout();
}

/* ─── helpers internos ─── */

function mapearUsuario(usuarioSupabase, nombre) {
  return { id: usuarioSupabase.id, nombre, email: usuarioSupabase.email };
}

function traducirErrorSupabase(error) {
  const msg = error.message || '';
  if (msg.includes('already registered')) return 'Ya existe una cuenta con ese email.';
  if (msg.includes('Invalid login credentials')) return 'Email o contrasena incorrectos.';
  if (msg.includes('Password should be')) return 'La contrasena no cumple los requisitos minimos.';
  return msg || 'Ocurrio un error inesperado.';
}
