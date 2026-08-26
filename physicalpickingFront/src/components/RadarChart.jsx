/* ─── RadarChart.jsx ───
   Radar SVG puro. Sin dependencias externas.
   Acepta datos={ [id]: pct } y variables=[{ id, nombre, color }]
*/
export default function RadarChart({ datos, variables }) {
  const cx = 150, cy = 155, r = 105;
  const n  = variables.length;
  const angulo = i => (Math.PI * 2 * i / n) - Math.PI / 2;
  const punto  = (i, radio) => ({
    x: cx + radio * Math.cos(angulo(i)),
    y: cy + radio * Math.sin(angulo(i)),
  });

  /* Guías */
  const guias = [20, 40, 60, 80, 100].map(pct => {
    const rad = r * pct / 100;
    const pts = variables.map((_, i) => `${punto(i, rad).x},${punto(i, rad).y}`).join(' ');
    return (
      <polygon
        key={pct}
        points={pts}
        fill="none"
        stroke="#e1e4ea"
        strokeWidth="1"
        strokeDasharray={pct < 100 ? '3 3' : undefined}
      />
    );
  });

  /* Ejes */
  const ejes = variables.map((_, i) => {
    const p = punto(i, r);
    return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#e1e4ea" strokeWidth="1" />;
  });

  /* Polígono de datos */
  const ptsDatos = variables.map((v, i) => {
    const rad = r * (datos[v.id] ?? 0) / 100;
    const p   = punto(i, rad);
    return `${p.x},${p.y}`;
  }).join(' ');

  /* Puntos individuales */
  const puntos = variables.map((v, i) => {
    const rad = r * (datos[v.id] ?? 0) / 100;
    const p   = punto(i, rad);
    return (
      <circle key={v.id} cx={p.x} cy={p.y} r="4.5"
        fill={v.color} stroke="#fff" strokeWidth="2" />
    );
  });

  /* Etiquetas de valor */
  const etiquetas = variables.map((v, i) => {
    const p = punto(i, r + 18);
    return (
      <text key={v.id} x={p.x} y={p.y}
        textAnchor="middle" dominantBaseline="middle"
        fontSize="10" fill="#454c5e" fontFamily="monospace">
        {datos[v.id] ?? 0}%
      </text>
    );
  });

  return (
    <svg viewBox="0 0 300 310" style={{ width: '100%', maxWidth: 320 }}>
      {guias}
      {ejes}
      <polygon
        points={ptsDatos}
        fill="rgba(37,85,212,0.12)"
        stroke="#2555d4"
        strokeWidth="2"
      />
      {puntos}
      {etiquetas}
    </svg>
  );
}
