/* ─── VariableInput.jsx ───
   Fila de ingreso de un valor real con previsualización en vivo del % normalizado.
   Usada tanto en StepFisicas como en StepCognitivas.
*/
import { normalizarValor } from '../logic/modelo';

export default function VariableInput({ variable: v, valor, onChange, error }) {
  /* Calcular preview en tiempo real sin mutar el estado */
  let pct = null;
  if (valor !== '' && valor !== null && !isNaN(parseFloat(valor))) {
    pct = normalizarValor(parseFloat(valor), v.minimo, v.maximo, v.direccion);
  }

  return (
    <div className={`norm-row${error ? ' norm-row--error' : ''}`}>
      <div className="norm-meta">
        <span className="norm-name">{v.nombre}</span>
        <span className="norm-rango">
          Rango: {v.minimo} – {v.maximo} {v.unidad}
          &nbsp;·&nbsp;
          <span className="norm-dir">
            {v.direccion === 'mayor_mejor' ? '↑ mayor = mejor' : '↓ menor = mejor'}
          </span>
        </span>
      </div>

      <div className="norm-input-row">
        <input
          type="number"
          className="norm-input"
          value={valor ?? ''}
          placeholder={`ej. ${Math.round((v.minimo + v.maximo) / 2)}`}
          step="any"
          onChange={e => onChange(v.id, e.target.value)}
          style={{ borderColor: error ? '#ef4444' : undefined }}
        />
        <span className="norm-unit">{v.unidad}</span>
        <span className="norm-arrow">→</span>
        <span className="norm-preview" style={{ color: pct !== null ? v.color : '#8792a8' }}>
          {pct !== null ? `${pct}%` : '—%'}
        </span>
      </div>

      {/* Barra de progreso */}
      <div className="norm-bar-track">
        <div
          className="norm-bar-fill"
          style={{ width: `${pct ?? 0}%`, background: v.color }}
        />
      </div>

      {error && <p className="norm-error">{error}</p>}
    </div>
  );
}
