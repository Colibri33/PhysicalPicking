/* ParticipantStrip.jsx v5 — sin patron */
export default function ParticipantStrip({ participante }) {
  if (!participante?.nombre) return null;
  const campos = [
    ['Participante', participante.nombre],
    ['Edad',   `${participante.edad} años`],
    ['Genero', cap(participante.genero)],
    ['Perfil', cap(participante.perfil)],
    ...(participante.deporte ? [['Actividad', participante.deporte]] : []),
  ];
  return (
    <div className="participant-strip">
      {campos.map(([lbl, val]) => (
        <div key={lbl} className="ps-item">
          <div className="ps-lbl">{lbl}</div>
          <div className="ps-val">{val}</div>
        </div>
      ))}
    </div>
  );
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—'; }
