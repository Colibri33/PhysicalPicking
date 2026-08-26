/* Historial.jsx v5 */
import { useState } from 'react';
import { VARS_FISICAS } from '../logic/modelo';
import { exportarMisDatos, eliminarCuenta } from '../auth/authService';

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

function ModalDetalle({ registro: r, onClose }) {
  if (!r) return null;
  const getTotal = id => { const c = r.consolidado?.[id]; if (!c) return 0; return typeof c === 'object' ? c.total : c; };
  return (
    <div className="modal-veil" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 className="modal-title">{r.participante.nombre}</h2>
        <div className="modal-meta-grid">
          {[['Edad', `${r.participante.edad} años`], ['Perfil', cap(r.participante.perfil)], ['Fecha', r.fecha]]
            .map(([k, v]) => (
              <div key={k}>
                <div className="modal-meta-lbl">{k}</div>
                <div className="modal-meta-val">{v}</div>
              </div>
            ))}
        </div>

        {r.interpretacion?.recomendacion && (
          <div className="interp-recomendacion" style={{ marginBottom: '1rem' }}>
            <span className="interp-label">Recomendacion</span>
            <p style={{ fontSize: '.82rem' }}>{r.interpretacion.recomendacion}</p>
          </div>
        )}

        <p className="modal-section-title">Perfil consolidado final</p>
        <div className="modal-bars">
          {VARS_FISICAS.map(v => {
            const total = getTotal(v.id);
            return (
              <div key={v.id} className="modal-bar-row">
                <div className="modal-bar-meta">
                  <span>{v.nombre}</span>
                  <strong style={{ color: v.color }}>{total}%</strong>
                </div>
                <div className="modal-bar-track">
                  <div className="modal-bar-fill" style={{ width: `${total}%`, background: v.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Historial({ historial, onLimpiar, onNuevo, usuarioActual, mostrarToast, onLogout }) {
  const [detalle, setDetalle] = useState(null);

  async function handleExportar() {
    try {
      const datos = await exportarMisDatos();
      const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mis-datos-dermaanalyzer.json';
      a.click();
      URL.revokeObjectURL(url);
      mostrarToast?.('Descarga de tus datos generada.', 'success');
    } catch (e) {
      mostrarToast?.(e.message || 'No se pudo exportar tus datos.', 'error');
    }
  }

  async function handleEliminarCuenta() {
    if (!window.confirm('Esto eliminara tu cuenta y TODOS tus datos de forma permanente. ¿Continuar?')) return;
    try {
      await eliminarCuenta();
      mostrarToast?.('Cuenta eliminada.', 'info');
      onLogout?.();
    } catch (e) {
      mostrarToast?.(e.message || 'No se pudo eliminar la cuenta.', 'error');
    }
  }

  return (
    <div className="panel-card">
      <div className="historial-header">
        <h2 className="panel-title" style={{ margin: 0 }}>Historial</h2>
        <span className="hist-count">{historial.length} {historial.length === 1 ? 'registro' : 'registros'}</span>
      </div>

      {usuarioActual && (
        <div className="action-row mt-lg" style={{ marginBottom: '1rem' }}>
          <button className="btn btn-ghost" onClick={handleExportar}>⭳ Descargar mis datos (Habeas Data)</button>
          <button className="btn btn-ghost btn-danger" onClick={handleEliminarCuenta}>Eliminar mi cuenta y mis datos</button>
        </div>
      )}
      {historial.length === 0 ? (
        <div className="empty-block">
          <div className="empty-char">🗁</div>
          <p>No hay registros guardados.</p>
          <button className="btn btn-outline" onClick={onNuevo}>Iniciar primer analisis</button>
        </div>
      ) : (
        <>
          <div className="hist-list">
            {historial.map((r, i) => (
              <button key={r.id} className="hist-card" onClick={() => setDetalle(r)}>
                <span className="hist-num">#{historial.length - i}</span>
                <div className="hist-info">
                  <div className="hist-name">{r.participante.nombre}</div>
                  <div className="hist-meta">{r.participante.edad} años · {r.participante.perfil} · {r.fecha}</div>
                  {r.rankingDeportes?.[0] && (
                    <div className="hist-top-deporte">{r.rankingDeportes[0].icono} {r.rankingDeportes[0].nombre} — {r.rankingDeportes[0].afinidad}%</div>
                  )}
                </div>
                <span className="hist-tag ht-sport">Ver</span>
              </button>
            ))}
          </div>
          <div className="action-row mt-lg">
            <button className="btn btn-outline btn-danger" onClick={onLimpiar}>🗑 Limpiar historial</button>
            <button className="btn btn-outline" onClick={onNuevo}>＋ Nuevo analisis</button>
          </div>
        </>
      )}
      {detalle && <ModalDetalle registro={detalle} onClose={() => setDetalle(null)} />}
    </div>
  );
}
