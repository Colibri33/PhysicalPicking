/* ─── StepCognitivas.jsx v5.1 ─── */
import { useState } from 'react';
import VariableInput from './VariableInput';
import { VARS_COGNITIVAS, validarFormularioVariables, normalizarValor } from '../logic/modelo';

export default function StepCognitivas({ analisis, updateAnalisis, onContinuar, mostrarToast }) {
  const [errores,      setErrores]      = useState({});
  const [advertencias, setAdvertencias] = useState([]);

  function handleChange(id, valor) {
    updateAnalisis({ realesC: { ...analisis.realesC, [id]: valor } });
    if (errores[id]) setErrores(e => { const c = { ...e }; delete c[id]; return c; });
    setAdvertencias(prev => prev.filter(a => !a.startsWith(VARS_COGNITIVAS.find(v => v.id === id)?.nombre)));
  }

  function handleContinuar() {
    const { ok, errores: lista, advertencias: warns } = validarFormularioVariables(VARS_COGNITIVAS, analisis.realesC);

    if (!ok) {
      const mapa = {};
      lista.forEach(msg => {
        const v = VARS_COGNITIVAS.find(v => msg.startsWith(v.nombre));
        if (v) mapa[v.id] = msg;
      });
      setErrores(mapa);
      mostrarToast(`${lista.length} campo(s) obligatorio(s) sin completar.`, 'error');
      return;
    }

    setAdvertencias(warns);

    const cognitivas = {};
    VARS_COGNITIVAS.forEach(v => {
      cognitivas[v.id] = normalizarValor(
        parseFloat(analisis.realesC[v.id]),
        v.minimo, v.maximo, v.direccion
      );
    });

    updateAnalisis({ cognitivas });

    if (warns.length > 0) {
      mostrarToast(`${warns.length} valor(es) fuera del rango de referencia — se aplicó clamp.`, 'info');
    } else {
      mostrarToast('Variables cognitivas registradas y normalizadas.', 'success');
    }
    onContinuar();
  }

  return (
    <div className="panel-card">
      <h2 className="panel-title">Capacidades cognitivo-motrices</h2>
      <p className="panel-desc">
        Ingresa los resultados de las evaluaciones cognitivas. Estos datos modulan
        el perfil funcional junto con las capacidades físicas. Todos los campos son obligatorios.
      </p>

      <div className="rango-note">
        <span className="rango-note-icon">ℹ</span>
        <span>
          Los rangos cubren población general activa. Valores fuera del rango
          se aceptan como advertencia y se normalizan al límite más cercano.
        </span>
      </div>

      <div className="norm-formulario">
        {VARS_COGNITIVAS.map(v => (
          <VariableInput
            key={v.id}
            variable={v}
            valor={analisis.realesC[v.id]}
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

