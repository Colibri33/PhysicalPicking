/* ResultadosConsolidado.jsx v5
   Informe final completo:
   1. Tabla desglosada base/ajCog/ajCorp/total
   2. Radar chart variables fisicas
   3. Perfiles deportivos (resistencia, potencia, velocidad, coordinacion)
   4. Ranking de deportes
   5. Interpretacion automatica
*/
import ParticipantStrip from './ParticipantStrip';
import RadarChart       from './RadarChart';
import BarraVariable    from './BarraVariable';
import {
  VARS_FISICAS, VARS_COGNITIVAS, PERFILES_DEPORTIVOS,
  calcularConsolidado,
  calcularPerfilesDeportivos,
  calcularRankingDeportes,
  generarInterpretacion,
} from '../logic/modelo';

function signo(d) { const r = Math.round(d * 10)/10; return r > 0 ? `+${r}` : `${r}`; }

export default function ResultadosConsolidado({ analisis, onGuardar, onNuevo, onContinuar }) {
  const consolidado        = calcularConsolidado(analisis.fisicas, analisis.cognitivas, analisis.corporales);
  const perfilesDeportivos = calcularPerfilesDeportivos(consolidado, analisis.cognitivas, analisis.corporales);
  const rankingDeportes    = calcularRankingDeportes(perfilesDeportivos);
  const interpretacion     = generarInterpretacion(consolidado, perfilesDeportivos, analisis.cognitivas, rankingDeportes);

  const datosRadar = Object.fromEntries(VARS_FISICAS.map(v => [v.id, consolidado[v.id].total]));
  const totales    = VARS_FISICAS.map(v => consolidado[v.id].total);
  const promedio   = Math.round(totales.reduce((a,b) => a+b,0) / totales.length);
  const varMax     = VARS_FISICAS[totales.indexOf(Math.max(...totales))];
  const varMin     = VARS_FISICAS[totales.indexOf(Math.min(...totales))];

  return (
    <div className="panel-card">
      <ParticipantStrip participante={analisis.participante} />
      <h2 className="panel-title">Informe de orientacion de perfil</h2>
      <p className="panel-desc">
        Este informe describe la <strong>tendencia funcional</strong> del evaluado basada en
        sus capacidades físicas, cognitivas y corporales. No clasifica por baremos deportivos
        ni determina un deporte específico — orienta el perfil general.
      </p>

      {/* ── Tarjetas de resumen ── */}
      <div className="summary-strip">
        <div className="sum-card">
          <div className="sum-lbl">Promedio general</div>
          <div className="sum-val">{promedio}%</div>
          <div className="sum-sub">variables fisicas</div>
        </div>
        <div className="sum-card high">
          <div className="sum-lbl">Variable mas alta</div>
          <div className="sum-val">{consolidado[varMax.id].total}%</div>
          <div className="sum-sub">{varMax.nombre}</div>
        </div>
        <div className="sum-card low">
          <div className="sum-lbl">Variable mas baja</div>
          <div className="sum-val">{consolidado[varMin.id].total}%</div>
          <div className="sum-sub">{varMin.nombre}</div>
        </div>
      </div>

      {/* ── Tabla desglosada ── */}
      <h3 className="section-subtitle mt-lg">Desglose por variable fisica</h3>
      <div className="consol-table-wrap">
        <div className="consol-header">
          <span className="cr-var">Variable</span>
          <span className="cr-num">Base</span>
          <span className="cr-delta">Δ Cog.</span>
          <span className="cr-delta">Δ Corp.</span>
          <span className="cr-total">Total</span>
        </div>
        {VARS_FISICAS.map(v => {
          const { base, ajCog, ajCorp, total } = consolidado[v.id];
          return (
            <div key={v.id} className="consol-row">
              <span className="cr-var">{v.nombre}</span>
              <span className="cr-num">{base}%</span>
              <span className={`cr-delta ${ajCog>0?'delta-pos':ajCog<0?'delta-neg':'delta-neu'}`}>{ajCog!==0?signo(ajCog):'0'}</span>
              <span className={`cr-delta ${ajCorp>0?'delta-pos':ajCorp<0?'delta-neg':'delta-neu'}`}>{ajCorp!==0?signo(ajCorp):'0'}</span>
              <div className="cr-total">
                <span className="cr-total-num" style={{ color: v.color }}>{total}%</span>
                <div className="cr-mini-track">
                  <div className="cr-mini-fill" style={{ width: `${total}%`, background: v.color }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Radar ── */}
      <h3 className="section-subtitle mt-lg">Perfil fisico radial</h3>
      <div className="radar-wrap">
        <RadarChart datos={datosRadar} variables={VARS_FISICAS} />
        <div className="radar-key">
          {VARS_FISICAS.map(v => (
            <div key={v.id} className="rk-item">
              <span className="rk-dot" style={{ background: v.color }} />
              <span>{v.nombre}: <strong>{consolidado[v.id].total}%</strong></span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Perfiles funcionales ── */}
      <h3 className="section-subtitle mt-lg">Tendencias de perfil funcional</h3>
      <div className="perfiles-grid">
        {PERFILES_DEPORTIVOS.map(p => {
          const val = perfilesDeportivos[p.id];
          return (
            <div key={p.id} className="perfil-card">
              <div className="perfil-header">
                <span className="perfil-icono">{p.icono}</span>
                <span className="perfil-nombre">{p.nombre}</span>
                <span className="perfil-pct" style={{ color: p.color }}>{val}%</span>
              </div>
              <div className="perfil-bar-track">
                <div className="perfil-bar-fill" style={{ width: `${val}%`, background: p.color }} />
              </div>
              <p className="perfil-desc">{p.descripcion}</p>
            </div>
          );
        })}
      </div>

      {/* ── Cognitivas resumen ── */}
      <h3 className="section-subtitle mt-lg">Perfil cognitivo</h3>
      <div className="bars-list">
        {VARS_COGNITIVAS.map(v => (
          <BarraVariable key={v.id} nombre={v.nombre} pct={analisis.cognitivas[v.id]} color={v.color}
            subtexto={analisis.realesC[v.id] !== '' ? `${analisis.realesC[v.id]} ${v.unidad}` : undefined}
          />
        ))}
      </div>

      {/* ── Orientación de actividades ── */}
      <h3 className="section-subtitle mt-lg">Orientacion de actividades fisicas</h3>
      <div className="ranking-disclaimer">
        <span className="ranking-disclaimer-icon">ℹ</span>
        <span>
          Esta orientación muestra afinidad de perfil con familias de actividad, no aptitud
          ni selección. Es una tendencia, no una determinación absoluta.
        </span>
      </div>
      <div className="ranking-list">
        {rankingDeportes.slice(0, 8).map((d, i) => (
          <div key={d.nombre} className={`ranking-item${i < 3 ? ' ranking-top' : ''}`}>
            <span className="rank-pos">#{i + 1}</span>
            <span className="rank-icono">{d.icono}</span>
            <span className="rank-nombre">{d.nombre}</span>
            <div className="rank-bar-wrap">
              <div className="rank-bar-track">
                <div className="rank-bar-fill" style={{ width: `${d.afinidad}%`, background: i === 0 ? '#2555d4' : i === 1 ? '#0f9d66' : '#0891b2' }} />
              </div>
              <span className="rank-pct">{d.afinidad}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Interpretación automática ── */}
      <h3 className="section-subtitle mt-lg">Interpretacion del perfil funcional</h3>
      <div className="interp-block">
        <p className="interp-parrafo">{interpretacion.parrafo}</p>

        {interpretacion.recomendacion && (
          <div className="interp-recomendacion">
            <span className="interp-label">Recomendacion deportiva</span>
            <p>{interpretacion.recomendacion}</p>
          </div>
        )}

        <div className="interp-cols">
          {interpretacion.fortalezas.length > 0 && (
            <div className="interp-col fortalezas">
              <span className="interp-col-title">✅ Fortalezas</span>
              <ul>
                {interpretacion.fortalezas.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}
          {interpretacion.debilidades.length > 0 && (
            <div className="interp-col debilidades">
              <span className="interp-col-title">⚠ Areas de mejora</span>
              <ul>
                {interpretacion.debilidades.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ── Acciones ── */}
      <div className="action-row mt-lg">
        <button className="btn btn-primary" onClick={onGuardar}>💾 Guardar en historial</button>
        {onContinuar && (
          <button className="btn btn-primary" onClick={onContinuar}>🏅 Ver recomendacion deportiva →</button>
        )}
        <button className="btn btn-outline" onClick={onNuevo}>＋ Nuevo analisis</button>
      </div>
    </div>
  );
}
