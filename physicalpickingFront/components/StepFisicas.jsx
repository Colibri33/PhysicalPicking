/* ─── StepFisicas.jsx v5.1 ─── */
import { useState } from 'react';
import VariableInput from './VariableInput';
import { VARS_FISICAS, validarFormularioVariables, normalizarValor } from '../logic/modelo';

export default function StepFisicas({ analisis, updateAnalisis, onContinuar, mostrarToast }) {
  const [errores,       setErrores]       = useState({});
  const [advertencias,  setAdvertencias]  = useState([]);

  function handleChange(id, valor) {
    updateAnalisis({ realesF: { ...analisis.realesF, [id]: valor } });
    if (errores[id]) setErrores(e => { const c = { ...e }; delete c[id]; return c; });
    // Limpiar advertencia del campo al modificarlo
    setAdvertencias(prev => prev.filter(a => !a.startsWith(VARS_FISICAS.find(v => v.id === id)?.nombre)));
  }

  function handleContinuar() {
    const { ok, errores: lista, advertencias: warns } = validarFormularioVariables(VARS_FISICAS, analisis.realesF);

    if (!ok) {
      const mapa = {};
      lista.forEach(msg => {
        const v = VARS_FISICAS.find(v => msg.startsWith(v.nombre));
        if (v) mapa[v.id] = msg;
      });
      setErrores(mapa);
      mostrarToast(`${lista.length} campo(s) obligatorio(s) sin completar.`, 'error');
      return;
    }

    setAdvertencias(warns);

    // Normalizar y guardar porcentajes (clamp maneja valores fuera de rango)
    const fisicas = {};
    VARS_FISICAS.forEach(v => {
      fisicas[v.id] = normalizarValor(
        parseFloat(analisis.realesF[v.id]),
        v.minimo, v.maximo, v.direccion
      );
    });

    updateAnalisis({ fisicas });

    if (warns.length > 0) {
      mostrarToast(`${warns.length} valor(es) fuera del rango de referencia — se aplicó clamp.`, 'info');
    } else {
      mostrarToast('Variables fisicas registradas y normalizadas.', 'success');
    }
    onContinuar();
  }

  return (
    <div className="panel-card">
      <h2 className="panel-title">Capacidades fisicas</h2>
      <p className="panel-desc">
        Ingresa el resultado real de cada prueba. El sistema lo convierte automáticamente
        a una escala 0–100 para orientar el perfil funcional del evaluado.
        Todos los campos son obligatorios.
      </p>

      <div className="rango-note">
        <span className="rango-note-icon">ℹ</span>
        <span>
          Los rangos de referencia cubren el espectro de población general activa.
          Valores fuera del rango se aceptan como advertencia y se normalizan al límite más cercano.
        </span>
      </div>

      <div className="norm-formulario">
        {VARS_FISICAS.map(v => (
          <VariableInput
            key={v.id}
            variable={v}
            valor={analisis.realesF[v.id]}
            onChange={handleChange}
            error={errores[v.id]}
          />
        ))}
      </div>

      {advertencias.length > 0 && (
        <div className="warn-list">
          <strong>Advertencias (valores fuera de rango de referencia):</strong>
          <ul>
            {advertencias.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}

      <button className="btn btn-primary btn-full mt-lg" onClick={handleContinuar}>
        Continuar →
      </button>
    </div>
  );
}

