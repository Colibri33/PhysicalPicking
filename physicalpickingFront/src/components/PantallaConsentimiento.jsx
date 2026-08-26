/* ═══════════════════════════════════════════════════════════════
   PantallaConsentimiento.jsx
   Se muestra una sola vez por usuario, antes de poder guardar
   ningún resultado de test. Registra la autorización de
   tratamiento de datos personales exigida por la Ley 1581/2012
   (Habeas Data) y, si el participante es menor de edad, los datos
   del padre/madre/acudiente que autoriza.
   ═══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { registrarConsentimiento } from '../auth/authService';

export default function PantallaConsentimiento({ onAceptado, mostrarToast }) {
  const [aceptoTratamiento, setAceptoTratamiento] = useState(false);
  const [aceptoSensibles, setAceptoSensibles] = useState(false);
  const [esMayorDeEdad, setEsMayorDeEdad] = useState(true);
  const [nombreAcudiente, setNombreAcudiente] = useState('');
  const [documentoAcudiente, setDocumentoAcudiente] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function handleContinuar() {
    if (!aceptoTratamiento || !aceptoSensibles) {
      mostrarToast('Debes aceptar ambas autorizaciones para continuar.', 'error');
      return;
    }
    if (!esMayorDeEdad && (!nombreAcudiente.trim() || !documentoAcudiente.trim())) {
      mostrarToast('Ingresa el nombre y documento del acudiente.', 'error');
      return;
    }

    setEnviando(true);
    const res = await registrarConsentimiento({
      esMayorDeEdad,
      nombreAcudiente: esMayorDeEdad ? null : nombreAcudiente.trim(),
      documentoAcudiente: esMayorDeEdad ? null : documentoAcudiente.trim(),
    });
    setEnviando(false);

    if (!res.ok) {
      mostrarToast(res.error || 'No se pudo registrar tu autorizacion.', 'error');
      return;
    }
    onAceptado();
  }

  return (
    <div className="auth-screen">
      <div className="auth-card" style={{ maxWidth: 560 }}>
        <h2 className="auth-title">Autorización de tratamiento de datos personales</h2>
        <p className="auth-subtitle">
          Antes de continuar, necesitamos tu autorización para tratar tus datos
          personales, incluyendo datos sensibles de condición física, conforme
          a la Ley 1581 de 2012 (Habeas Data). Puedes leer la política completa
          en el enlace al final.
        </p>

        <label className="field-label" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 16 }}>
          <input
            type="checkbox"
            checked={aceptoTratamiento}
            onChange={e => setAceptoTratamiento(e.target.checked)}
          />
          <span>
            Autorizo el tratamiento de mis datos personales de identificación
            (nombre, edad, género) para los fines de esta aplicación.
          </span>
        </label>

        <label className="field-label" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12 }}>
          <input
            type="checkbox"
            checked={aceptoSensibles}
            onChange={e => setAceptoSensibles(e.target.checked)}
          />
          <span>
            Autorizo el tratamiento de mis datos sensibles de condición física
            y cognitiva (resultados de los test) exclusivamente para generar
            mi informe y guardar mi historial.
          </span>
        </label>

        <label className="field-label" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12 }}>
          <input
            type="checkbox"
            checked={!esMayorDeEdad}
            onChange={e => setEsMayorDeEdad(!e.target.checked)}
          />
          <span>El participante es menor de edad</span>
        </label>

        {!esMayorDeEdad && (
          <div className="form-grid" style={{ marginTop: 8 }}>
            <label className="field-label">
              Nombre del padre/madre/acudiente
              <input
                className="field-input"
                type="text"
                value={nombreAcudiente}
                onChange={e => setNombreAcudiente(e.target.value)}
              />
            </label>
            <label className="field-label">
              Documento del acudiente
              <input
                className="field-input"
                type="text"
                value={documentoAcudiente}
                onChange={e => setDocumentoAcudiente(e.target.value)}
              />
            </label>
          </div>
        )}

        <button
          className="btn btn-primary btn-full mt-lg"
          onClick={handleContinuar}
          disabled={enviando}
        >
          {enviando ? 'Guardando...' : 'Acepto y continuar'}
        </button>

        <p className="auth-note" style={{ marginTop: 12 }}>
          Puedes ejercer tus derechos de acceso, rectificación, supresión u
          oposición en cualquier momento desde tu perfil.
        </p>
      </div>
    </div>
  );
}
