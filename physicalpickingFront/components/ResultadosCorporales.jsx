/* ─── ResultadosCorporales.jsx ─── */
import {
  VARS_FISICAS,
  REGLAS_AJUSTE_CORPORAL,
  calcularAjustesCorporales,
  clamp,
} from '../logic/modelo';

function signo(d) {
  const r = Math.round(d * 10) / 10;
  return r > 0 ? `+${r}` : `${r}`;
}


export default function ResultadosCorporales({ analisis, onContinuar }) {
  const c    = analisis.corporales;
  const corp = {
    grasa:      parseFloat(c.grasa)     || null,
    muscular:   parseFloat(c.muscular)  || null,
    grasaVisc:  parseFloat(c.grasaVisc) || null,
    imc:        c.imc,
  };

  const ajCorp = calcularAjustesCorporales(corp);

  const reglasActivas = REGLAS_AJUSTE_CORPORAL.filter(r => {
    try { return r.condicion(corp); } catch { return false; }
  });

  const etiquetas = {
    peso:       'Peso (kg)',
    talla:      'Talla (cm)',
    grasa:      '% Grasa corporal',
    muscular:   '% Masa muscular',
    grasaVisc:  'Grasa visceral (nivel)',
    imc:        'IMC calculado',
  };

  return (
    <div className="panel-card">
      <h2 className="panel-title">Ajustes corporales</h2>

      {/* Grid de datos ingresados */}
      <div className="corp-grid">
        {Object.entries(etiquetas).map(([k, lbl]) => {
          const val = c[k];
          const display = (val !== null && val !== '' && val !== undefined)
            ? val
            : '—';
          return (
            <div key={k} className="cdg-item">
              <div className="cdg-lbl">{lbl}</div>
              <div className="cdg-val">{display}</div>
            </div>
          );
        })}
      </div>

      {/* Reglas activas */}
      <h3 className="section-subtitle mt-lg">Reglas de ajuste activadas</h3>
      {reglasActivas.length === 0 ? (
        <p className="empty-text">
          No se activaron reglas de ajuste. Los datos corporales están en rangos normales
          o no fueron completados.
        </p>
      ) : (
        <div className="ajuste-table-wrap">
          <table className="ajuste-table">
            <thead>
              <tr>
                <th>Variable afectada</th>
                <th>Ajuste</th>
                <th>Condicion</th>
              </tr>
            </thead>
            <tbody>
              {reglasActivas.map((r, i) => {
                const vF  = VARS_FISICAS.find(v => v.id === r.variable);
                const cls = r.delta > 0 ? 'td-pos' : r.delta < 0 ? 'td-neg' : 'td-neu';
                return (
                  <tr key={i}>
                    <td className="td-var">{vF?.nombre ?? r.variable}</td>
                    <td className={cls}>{signo(r.delta)} pts</td>
                    <td>{r.descripcion}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Comparación base → ajustado corporalmente */}
      <h3 className="section-subtitle mt-lg">Base normalizada → tras ajuste corporal</h3>
      <div className="compare-list">
        {VARS_FISICAS.map(v => {
          const base = analisis.fisicas[v.id];
          const adj  = Math.round(clamp(base + (ajCorp[v.id] || 0), 0, 100));
          const diff = adj - base;
          return (
            <div key={v.id} className="compare-row">
              <div className="compare-meta">
                <span className="compare-lbl">{v.nombre}</span>
                <div className="compare-vals">
                  <span className="compare-base">Base: {base}%</span>
                  <span className="compare-arrow">→</span>
                  <span className="compare-adj">{adj}%</span>
                  {diff !== 0 && (
                    <span className={`compare-delta ${diff > 0 ? 'delta-pos' : 'delta-neg'}`}>
                      {signo(diff)}
                    </span>
                  )}
                </div>
              </div>
              <div className="compare-bars-track">
                <div
                  className="compare-bar"
                  style={{ width: `${base}%`, background: v.color, opacity: 0.4 }}
                />
                <div
                  className="compare-bar compare-bar--adj"
                  style={{ width: `${adj}%`, background: v.color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <button className="btn btn-primary btn-full mt-lg" onClick={onContinuar}>
        Ver perfil consolidado →
      </button>
    </div>
  );
}
