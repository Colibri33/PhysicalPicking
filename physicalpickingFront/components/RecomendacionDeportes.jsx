/* ─── RecomendacionDeportes.jsx ───
   Paso final: recomienda deportes específicos basado en reglas
   derivadas de los valores ya calculados (consolidado + cognitivas).
   NO modifica ningún cálculo — solo consume resultados finales.
*/
import {
  VARS_FISICAS,
  calcularConsolidado,
  calcularPerfilesDeportivos,
} from '../logic/modelo';

/* ── Catálogo de deportes con reglas de recomendación ──
   Cada deporte tiene:
     - umbrales: qué variables deben estar por encima de cierto valor
     - descripcion: explicación personalizada generada dinámicamente
     - icono, color de acento
*/
const CATALOGO_DEPORTES = [
  {
    id: 'futbol',
    nombre: 'Fútbol',
    icono: '⚽',
    color: '#16a34a',
    regla: (f, c) => f.velocidad >= 60 && f.agilidad >= 55 && f.resistencia >= 55,
    fortalezas: (f, c) => {
      const pts = [];
      if (f.velocidad >= 60)    pts.push(`velocidad (${f.velocidad}%)`);
      if (f.agilidad >= 55)     pts.push(`agilidad (${f.agilidad}%)`);
      if (f.resistencia >= 55)  pts.push(`resistencia (${f.resistencia}%)`);
      if (f.coordinacion >= 55) pts.push(`coordinación (${f.coordinacion}%)`);
      return pts;
    },
    descripcion: (f) =>
      `Tu perfil de velocidad y agilidad se adapta bien a los requerimientos del fútbol. ` +
      `El deporte exige desplazamientos explosivos, cambios de dirección frecuentes y ` +
      `resistencia para sostener el ritmo durante los 90 minutos.`,
  },
  {
    id: 'baloncesto',
    nombre: 'Baloncesto',
    icono: '🏀',
    color: '#ea580c',
    regla: (f, c) => f.velocidad >= 58 && f.coordinacion >= 55 && f.fuerzaExp >= 55,
    fortalezas: (f, c) => {
      const pts = [];
      if (f.velocidad >= 58)    pts.push(`velocidad (${f.velocidad}%)`);
      if (f.coordinacion >= 55) pts.push(`coordinación (${f.coordinacion}%)`);
      if (f.fuerzaExp >= 55)    pts.push(`fuerza explosiva (${f.fuerzaExp}%)`);
      if (c.reaccion >= 55)     pts.push(`reacción (${c.reaccion}%)`);
      return pts;
    },
    descripcion: (f) =>
      `El baloncesto demanda explosividad, coordinación ojo-mano y capacidad de reacción ` +
      `rápida. Tu perfil en fuerza explosiva y velocidad se alinea con las exigencias del juego.`,
  },
  {
    id: 'natacion',
    nombre: 'Natación',
    icono: '🏊',
    color: '#0284c7',
    regla: (f, c) => f.resistencia >= 65 && f.coordinacion >= 50 && f.flexibilidad >= 45,
    fortalezas: (f, c) => {
      const pts = [];
      if (f.resistencia >= 65)  pts.push(`resistencia (${f.resistencia}%)`);
      if (f.coordinacion >= 50) pts.push(`coordinación (${f.coordinacion}%)`);
      if (f.flexibilidad >= 45) pts.push(`flexibilidad (${f.flexibilidad}%)`);
      return pts;
    },
    descripcion: (f) =>
      `La natación requiere resistencia aeróbica sostenida, coordinación de movimientos ` +
      `y flexibilidad articular. Tu perfil muestra capacidad para sostener el esfuerzo ` +
      `prolongado que exige este deporte.`,
  },
  {
    id: 'levantamiento',
    nombre: 'Levantamiento de pesas',
    icono: '🏋️',
    color: '#7c3aed',
    regla: (f, c) => f.fuerza >= 65 && f.fuerzaExp >= 60,
    fortalezas: (f, c) => {
      const pts = [];
      if (f.fuerza >= 65)    pts.push(`fuerza máxima (${f.fuerza}%)`);
      if (f.fuerzaExp >= 60) pts.push(`fuerza explosiva (${f.fuerzaExp}%)`);
      if (f.equilibrio >= 50) pts.push(`equilibrio (${f.equilibrio}%)`);
      return pts;
    },
    descripcion: (f) =>
      `Tu capacidad de fuerza máxima y explosiva es ideal para las disciplinas de ` +
      `halterofilia y powerlifting. Este deporte desarrolla la musculatura y potencia ` +
      `de forma sistemática y progresiva.`,
  },
  {
    id: 'running',
    nombre: 'Running / atletismo de fondo',
    icono: '🏃',
    color: '#0f9d66',
    regla: (f, c) => f.resistencia >= 70,
    fortalezas: (f, c) => {
      const pts = [];
      if (f.resistencia >= 70)  pts.push(`resistencia (${f.resistencia}%)`);
      if (c.atencion >= 55)     pts.push(`atención sostenida (${c.atencion}%)`);
      return pts;
    },
    descripcion: (f) =>
      `El running y las pruebas de fondo priorizan la resistencia aeróbica por encima ` +
      `de cualquier otra capacidad. Tu perfil de resistencia indica una base sólida ` +
      `para correr distancias medias y largas.`,
  },
  {
    id: 'ciclismo',
    nombre: 'Ciclismo',
    icono: '🚴',
    color: '#d97706',
    regla: (f, c) => f.resistencia >= 65 && f.fuerzaExp >= 50,
    fortalezas: (f, c) => {
      const pts = [];
      if (f.resistencia >= 65)  pts.push(`resistencia (${f.resistencia}%)`);
      if (f.fuerzaExp >= 50)    pts.push(`fuerza explosiva (${f.fuerzaExp}%)`);
      if (f.equilibrio >= 50)   pts.push(`equilibrio (${f.equilibrio}%)`);
      return pts;
    },
    descripcion: (f) =>
      `El ciclismo combina resistencia aeróbica con potencia en los pedaleos. ` +
      `Tu capacidad de fuerza y resistencia te permite afrontar tanto etapas llanas ` +
      `como esfuerzos de subida.`,
  },
  {
    id: 'gimnasia',
    nombre: 'Gimnasia / acrobacia',
    icono: '🤸',
    color: '#db2777',
    regla: (f, c) => f.coordinacion >= 65 && f.equilibrio >= 65,
    fortalezas: (f, c) => {
      const pts = [];
      if (f.coordinacion >= 65) pts.push(`coordinación (${f.coordinacion}%)`);
      if (f.equilibrio >= 65)   pts.push(`equilibrio (${f.equilibrio}%)`);
      if (f.flexibilidad >= 55) pts.push(`flexibilidad (${f.flexibilidad}%)`);
      return pts;
    },
    descripcion: (f) =>
      `La gimnasia artística y acrobática exige coordinación fina, equilibrio y ` +
      `flexibilidad excepcionales. Tu perfil coordinativo-motor es compatible con ` +
      `las demandas técnicas de estas disciplinas.`,
  },
  {
    id: 'artes_marciales',
    nombre: 'Artes marciales / combate',
    icono: '🥋',
    color: '#b45309',
    regla: (f, c) => f.fuerzaExp >= 60 && f.agilidad >= 55 && c.reaccion >= 55,
    fortalezas: (f, c) => {
      const pts = [];
      if (f.fuerzaExp >= 60) pts.push(`fuerza explosiva (${f.fuerzaExp}%)`);
      if (f.agilidad >= 55)  pts.push(`agilidad (${f.agilidad}%)`);
      if (c.reaccion >= 55)  pts.push(`velocidad de reacción (${c.reaccion}%)`);
      if (c.anticipacion >= 55) pts.push(`anticipación (${c.anticipacion}%)`);
      return pts;
    },
    descripcion: (f) =>
      `Las artes marciales requieren explosividad, reflejos rápidos y capacidad de ` +
      `anticipar los movimientos del oponente. Tu perfil reactivo y tu fuerza ` +
      `explosiva son activos clave en estas disciplinas.`,
  },
  {
    id: 'tenis',
    nombre: 'Deportes de raqueta',
    icono: '🎾',
    color: '#0891b2',
    regla: (f, c) => f.coordinacion >= 60 && f.velocidad >= 55 && c.decision >= 55,
    fortalezas: (f, c) => {
      const pts = [];
      if (f.coordinacion >= 60) pts.push(`coordinación (${f.coordinacion}%)`);
      if (f.velocidad >= 55)    pts.push(`velocidad (${f.velocidad}%)`);
      if (c.decision >= 55)     pts.push(`toma de decisiones (${c.decision}%)`);
      return pts;
    },
    descripcion: (f) =>
      `El tenis y otros deportes de raqueta demandan coordinación ojo-mano, ` +
      `velocidad de desplazamiento y toma de decisiones bajo presión. ` +
      `Tu perfil cognitivo-motor se adapta bien a estas exigencias.`,
  },
  {
    id: 'precision',
    nombre: 'Deportes de precisión',
    icono: '🎯',
    color: '#1d4ed8',
    regla: (f, c) => f.equilibrio >= 60 && c.atencion >= 65 && c.anticipacion >= 55,
    fortalezas: (f, c) => {
      const pts = [];
      if (f.equilibrio >= 60)   pts.push(`equilibrio (${f.equilibrio}%)`);
      if (c.atencion >= 65)     pts.push(`atención (${c.atencion}%)`);
      if (c.anticipacion >= 55) pts.push(`anticipación (${c.anticipacion}%)`);
      return pts;
    },
    descripcion: (f) =>
      `El tiro deportivo, arquería y otras disciplinas de precisión dependen del ` +
      `control postural, la atención sostenida y la capacidad de anticipar ` +
      `y regular la acción motriz. Tu perfil de equilibrio y atención se destacan aquí.`,
  },
  {
    id: 'voleibol',
    nombre: 'Voleibol',
    icono: '🏐',
    color: '#7e22ce',
    regla: (f, c) => f.fuerzaExp >= 55 && f.coordinacion >= 55 && c.reaccion >= 50,
    fortalezas: (f, c) => {
      const pts = [];
      if (f.fuerzaExp >= 55)    pts.push(`fuerza explosiva (${f.fuerzaExp}%)`);
      if (f.coordinacion >= 55) pts.push(`coordinación (${f.coordinacion}%)`);
      if (c.reaccion >= 50)     pts.push(`reacción (${c.reaccion}%)`);
      return pts;
    },
    descripcion: (f) =>
      `El voleibol exige saltos explosivos, coordinación en los gestos técnicos ` +
      `y reacción rápida a los movimientos del balón. Tu perfil explosivo y ` +
      `coordinativo encaja con las demandas del deporte.`,
  },
  {
    id: 'atletismo_velocidad',
    nombre: 'Atletismo de velocidad',
    icono: '⚡',
    color: '#ea580c',
    regla: (f, c) => f.velocidad >= 70 && f.fuerzaExp >= 65,
    fortalezas: (f, c) => {
      const pts = [];
      if (f.velocidad >= 70)    pts.push(`velocidad (${f.velocidad}%)`);
      if (f.fuerzaExp >= 65)    pts.push(`fuerza explosiva (${f.fuerzaExp}%)`);
      if (c.reaccion >= 60)     pts.push(`reacción de salida (${c.reaccion}%)`);
      return pts;
    },
    descripcion: (f) =>
      `Las pruebas de velocidad (100m, 200m, vallas) requieren máxima potencia ` +
      `explosiva y aceleración en tiempo mínimo. Tu combinación de velocidad y ` +
      `fuerza explosiva es el núcleo de este perfil de sprint.`,
  },
  {
    id: 'danza',
    nombre: 'Danza / actividades rítmicas',
    icono: '💃',
    color: '#c026d3',
    regla: (f, c) => f.coordinacion >= 65 && f.flexibilidad >= 55 && c.atencion >= 55,
    fortalezas: (f, c) => {
      const pts = [];
      if (f.coordinacion >= 65) pts.push(`coordinación (${f.coordinacion}%)`);
      if (f.flexibilidad >= 55) pts.push(`flexibilidad (${f.flexibilidad}%)`);
      if (c.atencion >= 55)     pts.push(`atención (${c.atencion}%)`);
      return pts;
    },
    descripcion: (f) =>
      `La danza y las actividades rítmicas exigen coordinación, flexibilidad y ` +
      `atención sostenida para sincronizar el movimiento con el ritmo y los compañeros. ` +
      `Tu perfil coordinativo-flexible se adapta naturalmente a estas disciplinas.`,
  },
  {
    id: 'fitness',
    nombre: 'Fitness funcional',
    icono: '🏋️',
    color: '#475569',
    regla: (f, c) => true, // Recomendación de fallback para todos los perfiles
    fortalezas: (f, c) => {
      // Buscar las 2 mejores variables físicas de este usuario
      const vars = [
        { n: 'fuerza', v: f.fuerza },
        { n: 'resistencia', v: f.resistencia },
        { n: 'velocidad', v: f.velocidad },
        { n: 'coordinación', v: f.coordinacion },
      ].sort((a, b) => b.v - a.v).slice(0, 2);
      return vars.map(x => `${x.n} (${x.v}%)`);
    },
    descripcion: (f) =>
      `El entrenamiento funcional es una excelente base para cualquier perfil, ` +
      `ya que trabaja de forma integrada fuerza, movilidad, resistencia y coordinación. ` +
      `Ideal como punto de partida o complemento a cualquier deporte.`,
  },
];

/* ── Lógica de selección: aplica reglas y devuelve top 3-5 ── */
function calcularRecomendaciones(consolidado, cognitivas) {
  const f = Object.fromEntries(
    Object.entries(consolidado).map(([k, v]) => [k, v.total])
  );
  const c = cognitivas;

  // Separar fitness (fallback) del resto
  const principales = CATALOGO_DEPORTES.filter(d => d.id !== 'fitness');
  const fitnessFallback = CATALOGO_DEPORTES.find(d => d.id === 'fitness');

  const resultados = principales
    .filter(d => d.regla(f, c))
    .map(d => ({
      ...d,
      fortalezasDetalle: d.fortalezas(f, c),
      descripcionTexto:  d.descripcion(f),
    }));

  // Si hay menos de 3, agregar fitness como complemento
  if (resultados.length < 3 && fitnessFallback) {
    resultados.push({
      ...fitnessFallback,
      fortalezasDetalle: fitnessFallback.fortalezas(f, c),
      descripcionTexto:  fitnessFallback.descripcion(f),
    });
  }

  // Retornar máximo 5, mínimo 3 (si hay más de 5 tomar los primeros en aparecer)
  return resultados.slice(0, 5);
}

export default function RecomendacionDeportes({ analisis, onNuevo, onGuardar }) {
  const consolidado = calcularConsolidado(
    analisis.fisicas,
    analisis.cognitivas,
    analisis.corporales
  );
  const recomendaciones = calcularRecomendaciones(consolidado, analisis.cognitivas);

  // Calcular perfil dominante para el encabezado
  const perfilesDeportivos = calcularPerfilesDeportivos(
    consolidado,
    analisis.cognitivas,
    analisis.corporales
  );
  const perfilTop = Object.entries(perfilesDeportivos)
    .sort((a, b) => b[1] - a[1])[0];

  const PERFIL_NOMBRES = {
    resistencia: 'Resistencia',
    potencia:    'Potencia',
    velocidad:   'Velocidad',
    coordinativo: 'Coordinación',
  };

  return (
    <div className="panel-card">
      <h2 className="panel-title">Recomendación de deportes</h2>
      <p className="panel-desc">
        Basado en tus capacidades físicas y cognitivo-motrices evaluadas, el sistema
        identifica los deportes y actividades con mayor afinidad para tu perfil funcional.
        Esta recomendación es una <strong>orientación de tendencia</strong>, no una
        selección definitiva.
      </p>

      {/* Resumen del perfil dominante */}
      {perfilTop && (
        <div className="rec-perfil-banner" style={{ borderColor: '#2555d4' }}>
          <span className="rec-perfil-etiqueta">Tu perfil dominante</span>
          <span className="rec-perfil-nombre">{PERFIL_NOMBRES[perfilTop[0]] ?? perfilTop[0]}</span>
          <span className="rec-perfil-pct">{perfilTop[1]}%</span>
        </div>
      )}

      {/* Lista de deportes recomendados */}
      <div className="rec-lista">
        {recomendaciones.map((deporte, idx) => (
          <div key={deporte.id} className="rec-card">
            <div className="rec-card-header">
              <div className="rec-card-rank" style={{ background: idx === 0 ? '#2555d4' : idx === 1 ? '#0f9d66' : '#6b7280' }}>
                #{idx + 1}
              </div>
              <span className="rec-card-icono">{deporte.icono}</span>
              <div className="rec-card-meta">
                <span className="rec-card-nombre">{deporte.nombre}</span>
                {deporte.fortalezasDetalle.length > 0 && (
                  <span className="rec-card-tags">
                    {deporte.fortalezasDetalle.map((tag, i) => (
                      <span key={i} className="rec-tag" style={{ borderColor: deporte.color, color: deporte.color }}>
                        {tag}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            </div>
            <p className="rec-card-desc">{deporte.descripcionTexto}</p>
            <div className="rec-card-bar-track">
              <div
                className="rec-card-bar-fill"
                style={{ width: `${Math.min(100, 50 + idx * 0 + deporte.fortalezasDetalle.length * 15)}%`, background: deporte.color }}
              />
            </div>
          </div>
        ))}
      </div>

      {recomendaciones.length === 0 && (
        <div className="empty-text" style={{ textAlign: 'center', padding: '2rem' }}>
          No se encontraron deportes recomendados con los umbrales actuales.
          Completa todas las variables para obtener recomendaciones precisas.
        </div>
      )}

      <div className="rec-disclaimer">
        <span className="ranking-disclaimer-icon">ℹ</span>
        <span>
          Las recomendaciones se basan en reglas de perfil funcional. No reemplazan
          la orientación de un especialista en ciencias del deporte.
        </span>
      </div>

      {/* Acciones */}
      <div className="action-row mt-lg">
        {onGuardar && (
          <button className="btn btn-primary" onClick={onGuardar}>💾 Guardar en historial</button>
        )}
        {onNuevo && (
          <button className="btn btn-outline" onClick={onNuevo}>＋ Nuevo análisis</button>
        )}
      </div>
    </div>
  );
}
