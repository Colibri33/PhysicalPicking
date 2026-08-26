/* ─── ResultadosCognitivo.jsx ─── */
import BarraVariable      from './BarraVariable';
import { VARS_COGNITIVAS } from '../logic/modelo';

export default function ResultadosCognitivo({ analisis, onContinuar }) {
  return (
    <div className="panel-card">
      <h2 className="panel-title">Perfil cognitivo</h2>
      <p className="panel-desc">
        Valores normalizados a escala 0-100. El ajuste cognitivo es específico
        por variable física (no es un promedio global).
      </p>

      <div className="bars-list">
        {VARS_COGNITIVAS.map(v => (
          <BarraVariable
            key={v.id}
            nombre={v.nombre}
            pct={analisis.cognitivas[v.id]}
            color={v.color}
            subtexto={
              analisis.realesC[v.id] !== ''
                ? `${analisis.realesC[v.id]} ${v.unidad}`
                : undefined
            }
          />
        ))}
      </div>

      {/* Tabla de coeficientes informativos */}
      <div className="info-block mt-lg">
        <p className="info-title">¿Cómo afecta cada cognitiva al perfil físico?</p>
        <p className="info-desc">
          Cada variable cognitiva modifica solo las capacidades físicas relacionadas
          mediante coeficientes específicos. Un valor por encima de 50 suma; por debajo resta.
        </p>
      </div>

      <button className="btn btn-primary btn-full mt-lg" onClick={onContinuar}>
        Ver ajustes corporales →
      </button>
    </div>
  );
}
