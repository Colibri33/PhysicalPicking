/* Sidebar.jsx v6 — 9 pasos + historial, sin dermatoglifia */
const PASOS_SIDEBAR = [
  { n: 1,  label: 'Datos del participante'   },
  { n: 2,  label: 'Variables fisicas'        },
  { n: 3,  label: 'Variables cognitivas'     },
  { n: 4,  label: 'Variables corporales'     },
  { n: 5,  label: 'Perfil fisico'            },
  { n: 6,  label: 'Perfil cognitivo'         },
  { n: 7,  label: 'Ajustes corporales'       },
  { n: 8,  label: 'Orientacion de perfil'    },
  { n: 9,  label: 'Recomendacion deportiva'  },
  { n: 10, label: 'Historial'                },
];

export default function Sidebar({ paso, pasoMax, open, onClose, onNavegar, usuarioActual, modoInvitado, onLogout }) {
  return (
    <nav className={`sidebar${open ? ' open' : ''}`}>
      <div className="sidebar-header">
        <span className="sidebar-logo">◉ SportAnalyzer Pro</span>
        <button className="sidebar-close" onClick={onClose}>✕</button>
      </div>
      <div className="sidebar-user">
        {usuarioActual
          ? (<><span className="su-nombre">{usuarioActual.nombre}</span><span className="su-email">{usuarioActual.email}</span></>)
          : <span className="su-invitado">Modo invitado</span>}
        <button className="su-logout" onClick={onLogout}>Cerrar sesion</button>
      </div>
      <ul className="nav-list">
        {PASOS_SIDEBAR.map(({ n, label }) => {
          const habilitado = n <= pasoMax || n === 10;
          const esNuevo = n === 9;
          return (
            <li key={n}>
              <button
                className={`nav-item${n === paso ? ' active' : ''}${!habilitado ? ' disabled' : ''}`}
                disabled={!habilitado}
                onClick={() => habilitado && onNavegar(n)}
              >
                <span className="nav-num">{n}</span>
                <span className="nav-label">
                  {label}
                  {esNuevo && <span className="nav-badge">Nuevo</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
