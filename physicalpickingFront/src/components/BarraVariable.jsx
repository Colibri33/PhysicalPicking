/* ─── BarraVariable.jsx ─── */

/** Barra horizontal animada por CSS transition. */
export default function BarraVariable({ nombre, pct, color, subtexto }) {
  return (
    <div className="bar-row">
      <div className="bar-meta">
        <span className="bar-lbl">{nombre}</span>
        <div className="bar-values">
          {subtexto && <span className="bar-sub">{subtexto}</span>}
          <span className="bar-pct" style={{ color }}>{pct}%</span>
        </div>
      </div>
      <div className="bar-track">
        <div
          className="bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
