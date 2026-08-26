/* AnalizadorWizard.jsx v6
   - Sin dermatoglifia
   - Sin somatotipo
   - Paso 9: Recomendación de deportes (nuevo paso final)
   - Navegación automática al completar cada bloque
   - Panel lateral conservado
*/
import { useState, useEffect } from 'react';
import Sidebar               from './Sidebar';
import StepParticipante      from './StepParticipante';
import StepFisicas           from './StepFisicas';
import StepCognitivas        from './StepCognitivas';
import StepCorporales        from './StepCorporales';
import ResultadosFisico      from './ResultadosFisico';
import ResultadosCognitivo   from './ResultadosCognitivo';
import ResultadosCorporales  from './ResultadosCorporales';
import ResultadosConsolidado from './ResultadosConsolidado';
import RecomendacionDeportes from './RecomendacionDeportes';
import Historial             from './Historial';
import {
  estadoAnalisisInicial,
  calcularConsolidado,
  calcularPerfilesDeportivos,
  calcularRankingDeportes,
  generarInterpretacion,
} from '../logic/modelo';
import {
  guardarRegistroHistorial,
  leerHistorial,
  limpiarHistorialInvitado,
} from '../auth/authService';

const TITULOS = {
  1:  ['Registro',      'Datos del participante'],
  2:  ['Mediciones',    'Variables fisicas'],
  3:  ['Mediciones',    'Variables cognitivas'],
  4:  ['Mediciones',    'Variables corporales'],
  5:  ['Resultados',    'Perfil fisico'],
  6:  ['Resultados',    'Perfil cognitivo'],
  7:  ['Resultados',    'Ajustes corporales'],
  8:  ['Resultados',    'Informe final'],
  9:  ['Recomendacion', 'Recomendacion de deportes'],
  10: ['Sistema',       'Historial'],
};

export default function AnalizadorWizard({ usuarioActual, modoInvitado, mostrarToast, onLogout }) {
  const [paso,        setPaso]      = useState(1);
  const [pasoMax,     setPasoMax]   = useState(1);
  const [sidebarOpen, setSidebar]   = useState(false);
  const [analisis,    setAnalisis]  = useState(estadoAnalisisInicial());
  const [historial,   setHistorial] = useState([]);

  useEffect(() => {
    let cancelado = false;
    leerHistorial(usuarioActual?.id ?? null).then(h => { if (!cancelado) setHistorial(h); });
    return () => { cancelado = true; };
  }, [usuarioActual]);

  function irA(n) {
    if (n > pasoMax && n !== 10) return;
    setPaso(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function avanzarA(n) {
    setPasoMax(p => Math.max(p, n));
    setPaso(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateAnalisis(cambios) {
    setAnalisis(prev => ({ ...prev, ...cambios }));
  }

  async function guardarEnHistorial() {
    if (!analisis.participante.nombre) {
      mostrarToast('Completa los datos del participante antes de guardar.', 'error');
      return;
    }
    const consolidado        = calcularConsolidado(analisis.fisicas, analisis.cognitivas, analisis.corporales);
    const perfilesDeportivos = calcularPerfilesDeportivos(consolidado, analisis.cognitivas, analisis.corporales);
    const rankingDeportes    = calcularRankingDeportes(perfilesDeportivos);
    const interpretacion     = generarInterpretacion(consolidado, perfilesDeportivos, analisis.cognitivas, rankingDeportes);

    const registro = {
      id: Date.now(),
      fecha: new Date().toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }),
      participante: { ...analisis.participante },
      realesF:    { ...analisis.realesF },
      realesC:    { ...analisis.realesC },
      fisicas:    { ...analisis.fisicas },
      cognitivas: { ...analisis.cognitivas },
      corporales: { ...analisis.corporales },
      consolidado,
      perfilesDeportivos,
      rankingDeportes: rankingDeportes.slice(0, 5),
      interpretacion,
    };
    const res = await guardarRegistroHistorial(usuarioActual?.id ?? null, registro);
    if (res && res.ok === false) {
      mostrarToast(res.error || 'No se pudo guardar el analisis.', 'error');
      return;
    }
    setHistorial(await leerHistorial(usuarioActual?.id ?? null));
    mostrarToast('Analisis guardado en historial.', 'success');
  }

  function nuevoAnalisis() {
    setAnalisis(estadoAnalisisInicial());
    setPaso(1);
    setPasoMax(1);
    mostrarToast('Listo para un nuevo analisis.', 'info');
  }

  const props = { mostrarToast, analisis, updateAnalisis };

  function renderPaso() {
    switch (paso) {
      case 1:  return <StepParticipante      {...props} onContinuar={() => avanzarA(2)} />;
      case 2:  return <StepFisicas           {...props} onContinuar={() => avanzarA(3)} />;
      case 3:  return <StepCognitivas        {...props} onContinuar={() => avanzarA(4)} />;
      case 4:  return <StepCorporales        {...props} onContinuar={() => avanzarA(5)} />;
      case 5:  return <ResultadosFisico      {...props} onContinuar={() => avanzarA(6)} />;
      case 6:  return <ResultadosCognitivo   {...props} onContinuar={() => avanzarA(7)} />;
      case 7:  return <ResultadosCorporales  {...props} onContinuar={() => avanzarA(8)} />;
      case 8:  return (
        <ResultadosConsolidado
          {...props}
          onContinuar={() => avanzarA(9)}
          onGuardar={guardarEnHistorial}
          onNuevo={nuevoAnalisis}
        />
      );
      case 9:  return (
        <RecomendacionDeportes
          {...props}
          onGuardar={guardarEnHistorial}
          onNuevo={nuevoAnalisis}
        />
      );
      case 10: return (
        <Historial
          historial={historial}
          usuarioActual={usuarioActual}
          mostrarToast={mostrarToast}
          onLogout={onLogout}
          onLimpiar={() => {
            if (!window.confirm('Borrar todos los registros?')) return;
            if (usuarioActual?.id == null) limpiarHistorialInvitado();
            setHistorial([]);
            mostrarToast('Historial borrado.', 'info');
          }}
          onNuevo={() => irA(1)}
        />
      );
      default: return null;
    }
  }

  const [seccion, titulo] = TITULOS[paso] || ['', ''];

  return (
    <div className="app-layout">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebar(false)} />}
      <Sidebar
        paso={paso} pasoMax={pasoMax} open={sidebarOpen}
        onClose={() => setSidebar(false)}
        onNavegar={n => { irA(n); setSidebar(false); }}
        usuarioActual={usuarioActual} modoInvitado={modoInvitado} onLogout={onLogout}
      />
      <div className="main-content">
        <header className="topbar">
          <button className="menu-toggle" onClick={() => setSidebar(o => !o)} aria-label="Menu">☰</button>
          <div className="topbar-info">
            <span className="tb-section">{seccion}</span>
            <span className="tb-title">{titulo}</span>
          </div>
          <div className="step-dots">
            {Array.from({ length: 9 }, (_, i) => {
              const n = i + 1;
              return <div key={n} className={n < paso ? 'sd-dot done' : n === paso ? 'sd-dot active' : 'sd-dot'} />;
            })}
          </div>
        </header>
        <main className="panel-area">{renderPaso()}</main>
      </div>
    </div>
  );
}
