/* ═══════════════════════════════════════════════════════════════
   DermaAnalyzer Pro · App.jsx
   Raíz de la aplicación.
   Gestiona: sesión, modo invitado, pantalla activa (auth / análisis).
   ═══════════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback } from 'react';
import PantallaAuth          from './components/PantallaAuth';
import PantallaConsentimiento from './components/PantallaConsentimiento';
import AnalizadorWizard      from './components/AnalizadorWizard';
import Toast                 from './components/Toast';
import { obtenerSesionActual, logout, tieneConsentimientoVigente } from './auth/authService';

export default function App() {
  /* ── Sesión ── */
  const [usuarioActual, setUsuarioActual] = useState(null); // Object | null
  const [modoInvitado,  setModoInvitado]  = useState(false);
  const [sesionLista,   setSesionLista]   = useState(false); // evita flash de auth
  const [consentimientoOk, setConsentimientoOk] = useState(false);

  /* ── Toast global ── */
  const [toast, setToast] = useState({ msg: '', tipo: 'info', visible: false });

  const mostrarToast = useCallback((msg, tipo = 'info') => {
    setToast({ msg, tipo, visible: true });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
  }, []);

  /* ── Recuperar sesión al montar ── */
  useEffect(() => {
    (async () => {
      const sesion = await obtenerSesionActual();
      if (sesion) {
        setUsuarioActual(sesion);
        setConsentimientoOk(await tieneConsentimientoVigente());
      }
      setSesionLista(true);
    })();
  }, []);

  /* ── Handlers de auth ── */
  async function handleLoginExitoso(usuario) {
    setUsuarioActual(usuario);
    setModoInvitado(false);
    setConsentimientoOk(await tieneConsentimientoVigente());
    mostrarToast(`Bienvenido, ${usuario.nombre}.`, 'success');
  }

  function handleInvitado() {
    setModoInvitado(true);
    setUsuarioActual(null);
    mostrarToast('Modo invitado — los datos se guardan localmente en este navegador.', 'info');
  }

  async function handleLogout() {
    await logout();
    setUsuarioActual(null);
    setModoInvitado(false);
    setConsentimientoOk(false);
    mostrarToast('Sesion cerrada.', 'info');
  }

  /* ── Actualizar usuario tras guardar historial ── */
  function handleUsuarioActualizado(usuarioActualizado) {
    setUsuarioActual(usuarioActualizado);
  }

  if (!sesionLista) return null; // esperar hidratación inicial

  const estaAutenticado = !!usuarioActual || modoInvitado;

  return (
    <div className="app-root">
      {/* Toast global */}
      <Toast mensaje={toast.msg} tipo={toast.tipo} visible={toast.visible} />

      {!estaAutenticado ? (
        <PantallaAuth
          onLoginExitoso={handleLoginExitoso}
          onInvitado={handleInvitado}
          mostrarToast={mostrarToast}
        />
      ) : (usuarioActual && !consentimientoOk) ? (
        <PantallaConsentimiento
          mostrarToast={mostrarToast}
          onAceptado={() => setConsentimientoOk(true)}
        />
      ) : (
        <AnalizadorWizard
          usuarioActual={usuarioActual}
          modoInvitado={modoInvitado}
          mostrarToast={mostrarToast}
          onLogout={handleLogout}
          onUsuarioActualizado={handleUsuarioActualizado}
        />
      )}
    </div>
  );
}
