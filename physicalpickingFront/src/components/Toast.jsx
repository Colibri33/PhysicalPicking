/* ─── Toast.jsx ─── */
export default function Toast({ mensaje, tipo, visible }) {
  if (!visible) return null;
  return (
    <div className={`toast show ${tipo}`} role="alert">
      {mensaje}
    </div>
  );
}
