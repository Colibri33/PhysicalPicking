/**
 * @module src/utils/pdf
 * @description Genera el informe PDF descargable a partir del payload de un análisis (usuarios autenticados e invitados), con la identidad visual de PhysicalPicking.
 *
 * Principios SOLID aplicados:
 *  - S (Responsabilidad única): única razón de cambio es el contenido y el diseño del informe PDF.
 *  - D (Inversión de dependencias): escribe en cualquier WritableStream recibido (res), sin acoplarse a Express.
 * Notas: el PDF nunca debe incluir claves de cifrado, IV, authTag, tokens, ids internos de Supabase ni estructura técnica de la base de datos.
 * Los recursos gráficos (logo, robot y tipografías Poppins y Fredoka) se leen de /assets.
 */

import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

const MORADO = '#5B3FE0';
const MORADO_OSC = '#2C1B6B';
const AZUL = '#2F5CE8';
const CIAN = '#22D3EE';
const TINTA = '#1C1233';
const GRIS = '#5B5678';
const TARJETA = '#F3F1FD';
const PISTA = '#E2DEF5';
const AMBAR = '#F59E0B';

const MARGEN_X = 48;
const ANCHO = 612 - MARGEN_X * 2;
const MARGEN_INF = 74;   // franja inferior reservada al pie y al robot

const ETIQUETA_CAPACIDAD = {
  fuerza: 'fuerza', fuerza_explosiva: 'fuerza explosiva', vo2max: 'resistencia aeróbica',
  flexibilidad: 'flexibilidad', equilibrio: 'equilibrio',
};

const ETIQUETA_FISICA = {
  fuerza: 'Fuerza prensil', fuerzaExp: 'Fuerza explosiva', resistencia: 'Resistencia aeróbica',
  flexibilidad: 'Flexibilidad', equilibrio: 'Equilibrio',
};

const ETIQUETA_ANTROP = {
  peso: 'Peso (kg)', talla: 'Talla (cm)', cintura: 'Cintura (cm)', cadera: 'Cadera (cm)',
  grasaVisc: 'Grasa visceral', imc: 'IMC', icc: 'ICC',
};

/** Ruta absoluta de un recurso gráfico.
 * @param {string} archivo - nombre dentro de /assets.
 * @returns {string} ruta en disco. */
const recurso = (archivo) => fileURLToPath(new URL(`../../assets/${archivo}`, import.meta.url));

/** Describe los motivos por los que una familia deportiva no es recomendable (registros antiguos: solo carencias).
 * @param {Object} f - familia del ranking.
 * @returns {string} motivos separados por punto y coma. */
function textoNoFirme(f) {
  const motivos = Array.isArray(f.motivosNoFirme)
    ? f.motivosNoFirme
    : (f.carencias || []).map(c => ({ tipo: 'sin_dato', capacidad: c.capacidad, demanda: c.demanda }));
  if (motivos.length === 0) return 'demanda definitoria sin evaluar';
  return motivos.map(m => (m.tipo === 'brecha_severa'
    ? `${ETIQUETA_CAPACIDAD[m.capacidad] ?? m.capacidad} ${m.nivel} frente a demanda ${m.demanda}`
    : `${ETIQUETA_CAPACIDAD[m.capacidad] ?? m.capacidad} sin dato (demanda ${m.demanda})`)).join('; ');
}

/** Formatea una fecha ISO en español; devuelve el valor original si no es válida.
 * @param {string} iso - fecha en formato ISO.
 * @returns {string} fecha legible. */
function formatearFecha(iso) {
  try {
    return new Date(iso).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' });
  } catch {
    return iso || '—';
  }
}

/** Pone en mayúscula la primera letra.
 * @param {*} s - texto.
 * @returns {string} texto capitalizado. */
function capitalizar(s) {
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

/** Dibuja la franja superior con el degradado de marca.
 * @param {PDFDocument} doc - documento en construcción. */
function franjaMarca(doc) {
  const g = doc.linearGradient(0, 0, 612, 0);
  g.stop(0, MORADO).stop(0.55, AZUL).stop(1, CIAN);
  doc.rect(0, 0, 612, 14).fill(g);
}

/** Cabecera reducida de las páginas siguientes a la primera.
 * @param {PDFDocument} doc - documento en construcción. */
function cabeceraInterior(doc) {
  franjaMarca(doc);
  doc.image(recurso('logo.png'), MARGEN_X, 24, { height: 34 });
  doc.font('Poppins').fontSize(8.5).fillColor(GRIS)
    .text('Informe de evaluación', MARGEN_X, 38, { width: ANCHO, align: 'right', lineBreak: false });
  doc.x = MARGEN_X;
  doc.y = 74;
}

/** Salta de página si lo que sigue no cabe.
 * @param {PDFDocument} doc - documento en construcción.
 * @param {number} alto - alto requerido en puntos. */
function asegurar(doc, alto) {
  if (doc.y + alto > doc.page.height - MARGEN_INF) doc.addPage();
}

/** Escribe el título de una sección con su marca de color.
 * @param {PDFDocument} doc - documento en construcción.
 * @param {string} texto - título. */
function seccionTitulo(doc, texto) {
  asegurar(doc, 56);
  const y = doc.y;
  doc.roundedRect(MARGEN_X, y + 1, 5, 17, 2.5).fill(MORADO);
  doc.font('Fredoka').fontSize(14).fillColor(MORADO_OSC)
    .text(texto, MARGEN_X + 14, y, { width: ANCHO - 14 });
  doc.x = MARGEN_X;
  doc.y = y + 26;
}

/** Escribe un párrafo de texto corriente.
 * @param {PDFDocument} doc - documento en construcción.
 * @param {string} texto - contenido.
 * @param {Object} [o] - opciones: tamano, color, fuente, indent, align. */
function parrafo(doc, texto, { tamano = 10, color = TINTA, fuente = 'Poppins', indent = 0, align = 'left' } = {}) {
  doc.font(fuente).fontSize(tamano).fillColor(color)
    .text(texto, MARGEN_X + indent, doc.y, { width: ANCHO - indent, align, lineGap: 2 });
  doc.x = MARGEN_X;
}

/** Tarjeta con pares etiqueta-valor en dos columnas.
 * @param {PDFDocument} doc - documento en construcción.
 * @param {Array<[string, string]>} filas - pares [etiqueta, valor]. */
function tarjetaDatos(doc, filas) {
  const colW = (ANCHO - 36) / 2;
  const nFilas = Math.ceil(filas.length / 2);
  const alto = nFilas * 34 + 16;
  asegurar(doc, alto + 8);
  const y0 = doc.y;
  doc.roundedRect(MARGEN_X, y0, ANCHO, alto, 12).fill(TARJETA);
  filas.forEach(([k, v], i) => {
    const x = MARGEN_X + 18 + (i % 2) * (colW + 0);
    const y = y0 + 12 + Math.floor(i / 2) * 34;
    doc.font('Poppins').fontSize(8).fillColor(GRIS).text(k, x, y, { width: colW - 8, lineBreak: false });
    doc.font('PoppinsB').fontSize(10.5).fillColor(TINTA).text(String(v), x, y + 11, { width: colW - 8, lineBreak: false });
  });
  doc.x = MARGEN_X;
  doc.y = y0 + alto + 14;
}

/** Barra de progreso con etiqueta y valor.
 * @param {PDFDocument} doc - documento en construcción.
 * @param {string} etiqueta - texto de la barra.
 * @param {number} valor - porcentaje 0-100.
 * @param {string} [color] - color de relleno.
 * @param {string} [textoValor] - texto mostrado a la derecha. */
function barra(doc, etiqueta, valor, color = MORADO, textoValor = null) {
  asegurar(doc, 30);
  const y = doc.y;
  const pct = Math.max(0, Math.min(100, Number(valor) || 0));
  doc.font('Poppins').fontSize(9.5).fillColor(TINTA).text(etiqueta, MARGEN_X, y, { width: ANCHO - 70, lineBreak: false });
  doc.font('PoppinsB').fontSize(9.5).fillColor(TINTA)
    .text(textoValor ?? `${Math.round(pct)}%`, MARGEN_X, y, { width: ANCHO, align: 'right', lineBreak: false });
  doc.roundedRect(MARGEN_X, y + 16, ANCHO, 6, 3).fill(PISTA);
  if (pct > 0) doc.roundedRect(MARGEN_X, y + 16, Math.max(6, (ANCHO * pct) / 100), 6, 3).fill(color);
  doc.x = MARGEN_X;
  doc.y = y + 30;
}

/** Caja de aviso con acento de color.
 * @param {PDFDocument} doc - documento en construcción.
 * @param {string[]} lineas - mensajes a mostrar.
 * @param {string} fondo - color de fondo.
 * @param {string} acento - color del borde izquierdo. */
function cajaAviso(doc, lineas, fondo, acento) {
  doc.font('Poppins').fontSize(9.5);
  const alto = lineas.reduce((t, l) => t + doc.heightOfString(l, { width: ANCHO - 34, lineGap: 2 }) + 5, 0) + 16;
  asegurar(doc, alto + 8);
  const y0 = doc.y;
  doc.roundedRect(MARGEN_X, y0, ANCHO, alto, 10).fill(fondo);
  doc.roundedRect(MARGEN_X, y0, 6, alto, 3).fill(acento);
  let y = y0 + 10;
  lineas.forEach(l => {
    doc.font('Poppins').fontSize(9.5).fillColor(TINTA).text(l, MARGEN_X + 20, y, { width: ANCHO - 34, lineGap: 2 });
    y = doc.y + 5;
  });
  doc.x = MARGEN_X;
  doc.y = y0 + alto + 14;
}

/** Dibuja el pie de marca y el robot en todas las páginas.
 * @param {PDFDocument} doc - documento con páginas en búfer.
 * @param {string} fecha - fecha del análisis. */
function pintarPies(doc, fecha) {
  const rango = doc.bufferedPageRange();
  for (let i = 0; i < rango.count; i++) {
    doc.switchToPage(rango.start + i);
    const margen = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;   // evita saltos de página al escribir en la franja inferior
    doc.image(recurso('robot.png'), 612 - 22 - 66, 792 - 10 - 74, { width: 66 });
    doc.font('Poppins').fontSize(7.5).fillColor(GRIS);
    doc.text(`PhysicalPicking · Análisis del ${fecha || '—'} · Generado el ${formatearFecha(new Date().toISOString())}`, MARGEN_X, 742, { width: 440, lineBreak: false });
    doc.text('Informe orientativo: no es un diagnóstico clínico ni una evaluación de alto rendimiento.', MARGEN_X, 753, { width: 440, lineBreak: false });
    doc.text(`Página ${i + 1} de ${rango.count}`, MARGEN_X, 764, { width: 440, lineBreak: false });
    doc.page.margins.bottom = margen;
  }
}

/** Construye el informe y lo transmite a `res` por streaming.
 * @param {Object} payload - análisis con la forma que produce el frontend.
 * @param {import('stream').Writable} res - destino del PDF (típicamente la respuesta HTTP).
 * @returns {void} */
export function generarPdfInforme(payload, res) {
  const doc = new PDFDocument({ size: 'LETTER', bufferPages: true, margins: { top: 56, bottom: MARGEN_INF, left: MARGEN_X, right: MARGEN_X } });
  doc.registerFont('Poppins', recurso('Poppins-Regular.ttf'));
  doc.registerFont('PoppinsB', recurso('Poppins-SemiBold.ttf'));
  doc.registerFont('Fredoka', recurso('Fredoka-SemiBold.ttf'));
  doc.pipe(res);

  const p = payload.participante || {};

  // Portada: franja de marca, logo y título.
  franjaMarca(doc);
  doc.image(recurso('logo.png'), MARGEN_X, 30, { height: 74 });
  doc.font('Fredoka').fontSize(22).fillColor(MORADO_OSC)
    .text('Informe de evaluación', MARGEN_X, 44, { width: ANCHO, align: 'right', lineBreak: false });
  doc.font('Poppins').fontSize(9).fillColor(GRIS)
    .text('Evaluación multivariable del rendimiento deportivo', MARGEN_X, 74, { width: ANCHO, align: 'right', lineBreak: false });
  doc.x = MARGEN_X;
  doc.y = 124;
  doc.on('pageAdded', () => cabeceraInterior(doc));

  // Banner del participante.
  const yb = doc.y;
  doc.roundedRect(MARGEN_X, yb, ANCHO, 64, 14).fill(MORADO_OSC);
  doc.roundedRect(MARGEN_X + 16, yb + 14, 5, 36, 2.5).fill(CIAN);
  doc.font('Fredoka').fontSize(18).fillColor('#FFFFFF')
    .text(p.nombre || 'Participante', MARGEN_X + 32, yb + 14, { width: ANCHO - 60, lineBreak: false });
  const detalle = [p.edad ? `${p.edad} años` : null, p.genero ? capitalizar(p.genero) : null, p.perfil ? `perfil ${p.perfil}` : null, p.deporte || null].filter(Boolean).join('  ·  ');
  doc.font('Poppins').fontSize(9.5).fillColor('#D6D0F5')
    .text(detalle || '—', MARGEN_X + 32, yb + 40, { width: ANCHO - 60, lineBreak: false });
  doc.x = MARGEN_X;
  doc.y = yb + 84;

  // Perfil físico.
  const fis = payload.fisicas
    ? Object.keys(ETIQUETA_FISICA).filter(k => payload.fisicas[k] !== undefined && payload.fisicas[k] !== null)
    : [];
  if (fis.length > 0) {
    seccionTitulo(doc, 'Perfil físico');
    fis.forEach(k => barra(doc, ETIQUETA_FISICA[k], payload.fisicas[k]));
    doc.moveDown(0.4);
  }

  // Medidas antropométricas (solo las registradas).
  const antrop = Object.entries(payload.antropometricas || {})
    .filter(([, v]) => v !== '' && v !== null && v !== undefined);
  if (antrop.length > 0) {
    seccionTitulo(doc, 'Medidas corporales');
    tarjetaDatos(doc, antrop.map(([k, v]) => [ETIQUETA_ANTROP[k] ?? capitalizar(k), String(v)]));
  }

  // Seguridad (PAR-Q+): siempre antes de la recomendación.
  const seguridad = payload.evaluacion?.informe?.seguridad;
  if (seguridad) {
    seccionTitulo(doc, 'Seguridad y precauciones');
    const lineas = [`Prueba máxima de resistencia (Léger): ${seguridad.pruebaMaxima?.autorizada ? 'autorizada' : 'no autorizada automáticamente'}. ${seguridad.pruebaMaxima?.motivo || ''}`.trim(),
      ...(seguridad.alertas || []).map(a => a.mensaje)];
    cajaAviso(doc, lineas, '#FFF6E6', AMBAR);
  }

  // Perfil consolidado.
  if (payload.perfilesDeportivos) {
    seccionTitulo(doc, 'Perfil funcional consolidado');
    Object.entries(payload.perfilesDeportivos).forEach(([k, v]) => barra(doc, capitalizar(k), v, AZUL));
    doc.moveDown(0.4);
  }

  // Complementarias propias de PhysicalPicking (no es PAR-Q+).
  const comp = payload.complementarias?.resultado;
  if (comp) {
    seccionTitulo(doc, 'Antecedentes y experiencia');
    const ant = comp.antecedentes || {};
    const alguna = ant.lesion2anios === true || ant.cirugiaMusculoesqueletica === true || ant.dolorArticular === true;
    const zona = ant.zona ?? null;
    const lineas = [];
    if (alguna) {
      lineas.push(`Lesión previa: sí${zona ? ` (${zona})` : ''}`
        + `${ant.fechaAprox ? `, fecha aprox.: ${ant.fechaAprox}` : ''}`
        + `${ant.tratamiento === true ? ', con tratamiento' : ant.tratamiento === false ? ', sin tratamiento' : ''}.`);
      // R-SEG-04: los registros anteriores a la regla no traen la alerta en el flujo.
      const yaAlertada = (payload.evaluacion?.informe?.seguridad?.alertas || []).some(a => a.codigo === 'ANTECEDENTE_LESION');
      if (!yaAlertada) {
        lineas.push('Se recomienda un periodo de adaptación y recuperación previa antes de iniciar nuevamente con algún deporte.');
      }
    } else {
      lineas.push('Lesión previa: no declarada.');
    }
    const exp = comp.experiencia || {};
    const deps = (exp.experiencias || []).map(e => [e.deporte, e.tipo, e.anios != null ? `${e.anios} años` : null].filter(Boolean).join(' · ')).filter(Boolean);
    if (deps.length > 0) lineas.push(`Experiencia: ${deps.join('; ')}.`);
    if (exp.practicaActual === true) lineas.push('Práctica actual: sí.');
    else if (exp.practicaActual === false) lineas.push('Práctica actual: no.');
    cajaAviso(doc, lineas, TARJETA, MORADO);
  }

  // Estilo de vida: Léger, IPAQ y PSQI en una sola tarjeta.
  const vida = [];
  const palierLeger = payload.leger?.palier ?? payload.realesF?.resistencia;
  if (palierLeger !== undefined && palierLeger !== '' && palierLeger !== null && Number(palierLeger) <= 21) {
    vida.push(['Resistencia (Léger)', `Último nivel alcanzado: ${palierLeger}`]);
  }
  const ipaqRes = payload.ipaq?.resultado;
  if (ipaqRes?.categoria) vida.push(['Actividad física (IPAQ)', `${capitalizar(ipaqRes.categoria)} · ${ipaqRes.met?.total ?? '—'} MET-min/semana`]);
  const psqiRes = payload.psqi?.resultado;
  if (typeof psqiRes?.puntajeGlobal === 'number') vida.push(['Calidad de sueño (PSQI)', `${psqiRes.puntajeGlobal}/21 · ${psqiRes.categoria || ''}`.trim()]);
  if (vida.length > 0) {
    seccionTitulo(doc, 'Hábitos y resistencia');
    tarjetaDatos(doc, vida);
  }

  // Interpretación.
  if (payload.interpretacion?.parrafo) {
    seccionTitulo(doc, 'Interpretación');
    parrafo(doc, payload.interpretacion.parrafo, { align: 'justify' });
    doc.moveDown(0.8);
  }

  // Recomendación deportiva: ranking del motor si existe; si no, el heredado.
  const rankingMotor = payload.evaluacion?.etapas?.ranking;
  const familiasMotor = rankingMotor?.familias;
  if (Array.isArray(familiasMotor) && familiasMotor.length > 0) {
    // R-DEC-03: si ninguna familia es firme no se presenta un deporte
    // (los registros antiguos sin `sinFamiliaCompatible` conservan su forma).
    const recomendada = rankingMotor?.recomendada ?? (rankingMotor?.sinFamiliaCompatible ? null : familiasMotor[0]);
    const plan = payload.evaluacion?.etapas?.planAdaptacion;
    seccionTitulo(doc, 'Recomendación deportiva');
    if (recomendada) {
      asegurar(doc, 60);
      const y0 = doc.y;
      doc.roundedRect(MARGEN_X, y0, ANCHO, 50, 12).fill(MORADO);
      doc.font('Poppins').fontSize(8.5).fillColor('#D6D0F5').text('Mayor compatibilidad', MARGEN_X + 18, y0 + 9, { lineBreak: false });
      doc.font('Fredoka').fontSize(17).fillColor('#FFFFFF').text(recomendada?.nombre ?? recomendada?.id ?? '—', MARGEN_X + 18, y0 + 23, { width: ANCHO - 120, lineBreak: false });
      if (recomendada?.porcentaje != null) {
        doc.font('Fredoka').fontSize(24).fillColor('#FFFFFF').text(`${recomendada.porcentaje}%`, MARGEN_X, y0 + 14, { width: ANCHO - 18, align: 'right', lineBreak: false });
      }
      doc.x = MARGEN_X;
      doc.y = y0 + 64;
    } else if (plan?.estado === 3) {
      const lineas = [`Estado ${plan.estado}: ${plan.nombre}`, plan.motivo || ''];
      if (Array.isArray(plan.prioridades) && plan.prioridades.length > 0) {
        lineas.push(`Capacidades a priorizar: ${plan.prioridades.map(pr => `${ETIQUETA_CAPACIDAD[pr.capacidad] ?? pr.capacidad} (${pr.nivel})`).join(', ')}.`);
      }
      [...(plan.pautasGenerales || []), ...(plan.pautasComponentes || [])].forEach(pa => {
        lineas.push(`${pa.titulo}: ${pa.texto} (${pa.referencia})`);
      });
      if (plan.fuente?.referencia) lineas.push(`Fuente: ${plan.fuente.referencia}`);
      cajaAviso(doc, lineas.filter(Boolean), TARJETA, MORADO);
    } else if (plan?.tipo === 'datos_insuficientes') {
      cajaAviso(doc, [`${plan.motivo || 'Faltan datos para recomendar.'} Datos faltantes: ${(plan.faltantes || []).map(c => ETIQUETA_CAPACIDAD[c] ?? c).join(', ')}.`], TARJETA, MORADO);
    } else {
      cajaAviso(doc, ['Ninguna familia deportiva puede presentarse como recomendación firme con el perfil actual.'], TARJETA, MORADO);
    }
    familiasMotor.slice(0, 5).forEach((f, i) => {
      const noFirme = f.firme === false;
      barra(doc, `${f.nombre ?? f.id}${noFirme ? ' (no recomendable)' : ''}`, f.porcentaje ?? 0,
        i === 0 && !noFirme ? MORADO : AZUL, f.porcentaje != null ? `${f.porcentaje}%` : '—');
      const rel = (f.brechas ?? []).filter(b => b.relevanteMitchell);
      const car = (f.carencias ?? []).filter(c => c.relevanteMitchell || c.demanda === 'Alta' || c.demanda === 'Muy alta');
      const notas = [];
      if (noFirme) notas.push(`Motivo: ${textoNoFirme(f)}`);
      if (rel.length > 0) notas.push(`Brechas relevantes: ${rel.map(b => `${ETIQUETA_CAPACIDAD[b.capacidad] ?? b.capacidad} (demanda ${b.demanda})`).join(', ')}`);
      if (car.length > 0) notas.push(`Sin evaluar: ${car.map(c => `${ETIQUETA_CAPACIDAD[c.capacidad] ?? c.capacidad} (demanda ${c.demanda})`).join(', ')}`);
      if (notas.length > 0) {
        doc.y -= 6;
        parrafo(doc, notas.join(' · '), { tamano: 8, color: GRIS, indent: 8 });
        doc.moveDown(0.4);
      }
    });
    (rankingMotor?.advertencias ?? []).forEach(a => parrafo(doc, `Nota: ${a}`, { tamano: 8, color: GRIS }));
  } else if (Array.isArray(payload.rankingDeportes) && payload.rankingDeportes.length > 0) {
    seccionTitulo(doc, 'Recomendación deportiva');
    payload.rankingDeportes.slice(0, 5).forEach((d, i) => {
      barra(doc, d.nombre, d.afinidad, i === 0 ? MORADO : AZUL, `${d.afinidad}% de afinidad`);
      if (d.descripcion) { doc.y -= 6; parrafo(doc, d.descripcion, { tamano: 8, color: GRIS, indent: 8 }); doc.moveDown(0.4); }
    });
  }

  pintarPies(doc, payload.fecha);
  doc.flushPages();
  doc.end();
}
