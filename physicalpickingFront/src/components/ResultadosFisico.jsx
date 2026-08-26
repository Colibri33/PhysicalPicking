/* ─── ResultadosFisico.jsx ─── */
import BarraVariable    from './BarraVariable';
import ParticipantStrip from './ParticipantStrip';
import { VARS_FISICAS } from '../logic/modelo';

export default function ResultadosFisico({ analisis, onContinuar }) {
  return (
    <div className="panel-card">
      <ParticipantStrip participante={analisis.participante} />
      <h2 className="panel-title">Perfil fisico</h2>
      <p className="panel-desc">Valores normalizados a escala 0-100 a partir de los resultados reales.</p>

      <div className="bars-list">
        {VARS_FISICAS.map(v => (
          <BarraVariable
            key={v.id}
            nombre={v.nombre}
            pct={analisis.fisicas[v.id]}
            color={v.color}
            subtexto={
              analisis.realesF[v.id] !== ''
                ? `${analisis.realesF[v.id]} ${v.unidad}`
                : undefined
            }
          />
        ))}
      </div>

      <button className="btn btn-primary btn-full mt-lg" onClick={onContinuar}>
        Ver perfil cognitivo →
      </button>
    </div>
  );
}
