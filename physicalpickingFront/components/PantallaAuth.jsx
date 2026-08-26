/* ═══════════════════════════════════════════════════════════════
   DermaAnalyzer Pro · components/PantallaAuth.jsx
   Pantalla inicial: Login / Registro / Invitado
   ═══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { login, registrar } from '../auth/authService';

export default function PantallaAuth({ onLoginExitoso, onInvitado, mostrarToast }) {
  const [vista, setVista] = useState('inicio'); // 'inicio' | 'login' | 'registro'

  /* ── Login state ── */
  const [loginEmail, setLoginEmail]       = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  /* ── Registro state ── */
  const [regNombre,   setRegNombre]   = useState('');
  const [regEmail,    setRegEmail]    = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [enviando, setEnviando] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setEnviando(true);
    const res = await login(loginEmail, loginPassword);
    setEnviando(false);
    if (!res.ok) return mostrarToast(res.error, 'error');
    onLoginExitoso(res.usuario);
  }

  async function handleRegistro(e) {
    e.preventDefault();
    setEnviando(true);
    const res = await registrar(regNombre, regEmail, regPassword);
    setEnviando(false);
    if (!res.ok) return mostrarToast(res.error, 'error');
    mostrarToast('Cuenta creada. Revisa tu correo si se requiere confirmacion, y luego inicia sesion.', 'success');
    setVista('login');
    setLoginEmail(regEmail);
    setLoginPassword('');
  }

  /* ────────────────────────────────── PANTALLA INICIAL ── */
  if (vista === 'inicio') return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-icon">◎</span>
          <span className="auth-logo-text">DermaAnalyzer Pro</span>
        </div>
        <p className="auth-subtitle">Sistema de evaluacion multivariable del rendimiento deportivo</p>

        <div className="auth-btns">
          <button className="btn btn-primary" onClick={() => setVista('login')}>
            Iniciar sesion
          </button>
          <button className="btn btn-outline" onClick={() => setVista('registro')}>
            Crear cuenta
          </button>
          <button className="btn btn-ghost" onClick={onInvitado}>
            Continuar como invitado
          </button>
        </div>

        <p className="auth-note">
          El modo invitado guarda los datos solo en este navegador.
        </p>
      </div>
    </div>
  );

  /* ────────────────────────────────── LOGIN ── */
  if (vista === 'login') return (
    <div className="auth-screen">
      <div className="auth-card">
        <button className="auth-back" onClick={() => setVista('inicio')}>← Volver</button>
        <h2 className="auth-title">Iniciar sesion</h2>

        <form onSubmit={handleLogin} className="auth-form">
          <label className="auth-label">
            Email
            <input
              className="auth-input"
              type="email"
              value={loginEmail}
              onChange={e => setLoginEmail(e.target.value)}
              placeholder="tu@email.com"
              autoComplete="email"
            />
          </label>

          <label className="auth-label">
            Contrasena
            <input
              className="auth-input"
              type="password"
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              placeholder="••••••"
              autoComplete="current-password"
            />
          </label>

          <button className="btn btn-primary" type="submit" disabled={enviando}>
            {enviando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="auth-switch">
          ¿No tienes cuenta?{' '}
          <button className="link-btn" onClick={() => setVista('registro')}>Registrate</button>
        </p>
      </div>
    </div>
  );

  /* ────────────────────────────────── REGISTRO ── */
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <button className="auth-back" onClick={() => setVista('inicio')}>← Volver</button>
        <h2 className="auth-title">Crear cuenta</h2>

        <form onSubmit={handleRegistro} className="auth-form">
          <label className="auth-label">
            Nombre
            <input
              className="auth-input"
              type="text"
              value={regNombre}
              onChange={e => setRegNombre(e.target.value)}
              placeholder="Tu nombre"
            />
          </label>

          <label className="auth-label">
            Email
            <input
              className="auth-input"
              type="email"
              value={regEmail}
              onChange={e => setRegEmail(e.target.value)}
              placeholder="tu@email.com"
              autoComplete="email"
            />
          </label>

          <label className="auth-label">
            Contrasena <span className="auth-hint">(min. 6 caracteres)</span>
            <input
              className="auth-input"
              type="password"
              value={regPassword}
              onChange={e => setRegPassword(e.target.value)}
              placeholder="••••••"
              autoComplete="new-password"
            />
          </label>

          <button className="btn btn-primary" type="submit" disabled={enviando}>
            {enviando ? 'Creando...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="auth-switch">
          ¿Ya tienes cuenta?{' '}
          <button className="link-btn" onClick={() => setVista('login')}>Inicia sesion</button>
        </p>
      </div>
    </div>
  );
}
