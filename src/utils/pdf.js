/*
   utils/pdf.js
   Genera el informe descargable en PDF a partir del payload de un
   analisis (la misma forma que produce el frontend: participante,
   fisicas, antropometricas, consolidado, rankingDeportes,
   interpretacion y, desde v6, el bloque opcional `evaluacion`). Se usa tanto para usuarios autenticados (tras
   descifrar su registro guardado) como para el modo invitado (que
   envia el payload directamente, sin pasar por la base de datos).

   IMPORTANTE: el PDF NUNCA debe incluir: claves de cifrado, IV,
   authTag, tokens, ids internos de Supabase, ni ninguna estructura
   tecnica de la base de datos. Solo el contenido legible pensado
   para el usuario final.
 */

import PDFDocument from 'pdfkit';

const AZUL = '#1E3A5F';
const GRIS = '#6B7280';

function formatearFecha(iso) {
  try {
    return new Date(iso).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' });
  } catch {
    return iso || '—';
  }
}

/**
 * generarPdfInforme — construye el documento y lo escribe en `res`
 * (un WritableStream, tipicamente la respuesta HTTP de Express).
 * No retorna una promesa que resuelva con el buffer completo: hace
 * streaming directo, para no cargar todo el PDF en memoria.
 */
export function generarPdfInforme(payload, res) {
  const doc = new PDFDocument({ size: 'LETTER', margins: { top: 50, bottom: 50, left: 56, right: 56 } });
  doc.pipe(res);

  const p = payload.participante || {};

  //Encabezado
  doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(22).text('PHYSICALPICKING', { align: 'center' });
  doc.fillColor(GRIS).font('Helvetica').fontSize(10)
    .text('Informe de evaluación multivariable del rendimiento deportivo', { align: 'center' });
  doc.moveDown(1.2);
  doc.strokeColor('#E5E7EB').lineWidth(1).moveTo(56, doc.y).lineTo(556, doc.y).stroke();
  doc.moveDown(1);

  //Datos del participante
  seccionTitulo(doc, 'Datos del participante');
  tablaClaveValor(doc, [
    ['Nombre', p.nombre || '—'],
    ['Edad', p.edad ? `${p.edad} años` : '—'],
    ['Género', p.genero || '—'],
    ['Tipo de perfil', p.perfil || '—'],
    ['Actividad / deporte', p.deporte || '—'],
  ]);
  doc.moveDown(0.6);

  //Variables físicas
  if (payload.fisicas) {
    seccionTitulo(doc, 'Resultados físicos (normalizados)');
    tablaClaveValor(doc, Object.entries(payload.fisicas).map(([k, v]) => [k, `${Math.round(v)}%`]));
    doc.moveDown(0.6);
  }

  //Variables antropometricas (solo las registradas)
  const antrop = Object.entries(payload.antropometricas || {})
    .filter(([, v]) => v !== '' && v !== null && v !== undefined);
  if (antrop.length > 0) {
    seccionTitulo(doc, 'Variables antropométricas');
    tablaClaveValor(doc, antrop.map(([k, v]) => [k, String(v)]));
    doc.moveDown(0.6);
  }

  //Seguridad (PAR-Q+): siempre antes de la recomendacion
  const seguridad = payload.evaluacion?.informe?.seguridad;
  if (seguridad) {
    seccionTitulo(doc, 'Seguridad (PAR-Q+)');
    doc.font('Helvetica').fontSize(9.5).fillColor('#1F2937')
      .text(`Prueba máxima (Léger): ${seguridad.pruebaMaxima?.autorizada ? 'autorizada' : 'no autorizada automáticamente'}. ${seguridad.pruebaMaxima?.motivo || ''}`);
    (seguridad.alertas || []).forEach(a => doc.text(`• ${a.mensaje}`, { indent: 8 }));
    doc.moveDown(0.6);
  }

  //Perfil consolidado
  if (payload.perfilesDeportivos) {
    seccionTitulo(doc, 'Perfil funcional consolidado');
    tablaClaveValor(doc, Object.entries(payload.perfilesDeportivos).map(([k, v]) => [k, `${Math.round(v)}%`]));
    doc.moveDown(0.6);
  }

  //Complementarias PhysicalPicking (no es PAR-Q+)
  const comp = payload.complementarias?.resultado;
  if (comp) {
    seccionTitulo(doc, 'Antecedentes y experiencia (PhysicalPicking)');
    const ant = comp.antecedentes || {};
    const alguna = ant.lesion2anios === true || ant.cirugiaMusculoesqueletica === true || ant.dolorArticular === true;
    const zona = ant.zona ?? null;
    doc.font('Helvetica').fontSize(9.5).fillColor('#1F2937');
    if (alguna) {
      doc.text(`Lesión previa: sí${zona ? ` (${zona})` : ''}`
        + `${ant.fechaAprox ? `, fecha aprox.: ${ant.fechaAprox}` : ''}`
        + `${ant.tratamiento === true ? ', con tratamiento' : ant.tratamiento === false ? ', sin tratamiento' : ''}.`);
    } else {
      doc.text('Lesión previa: no declarada.');
    }
    const exp = comp.experiencia || {};
    const deps = (exp.experiencias || []).map(e => [e.deporte, e.tipo, e.anios != null ? `${e.anios} años` : null].filter(Boolean).join(' · ')).filter(Boolean);
    if (deps.length > 0) doc.text(`Experiencia: ${deps.join('; ')}.`);
    if (exp.practicaActual === true) doc.text('Práctica actual: sí.');
    else if (exp.practicaActual === false) doc.text('Práctica actual: no.');
    doc.moveDown(0.6);
  }

  //Resistencia aeróbica, Léger (nivel alcanzado; estimacion de VO2max pendiente)
  const palierLeger = payload.leger?.palier ?? payload.realesF?.resistencia;
  if (palierLeger !== undefined && palierLeger !== '' && palierLeger !== null && Number(palierLeger) <= 21) {
    seccionTitulo(doc, 'Resistencia aeróbica (Léger)');
    doc.font('Helvetica').fontSize(9.5).fillColor('#1F2937')
      .text(`Último nivel alcanzado: ${palierLeger}. Estimación de VO2max pendiente.`);
    doc.moveDown(0.6);
  }

  //Cuestionarios IPAQ / PSQI (resumen calculado en el frontend)
  const ipaqRes = payload.ipaq?.resultado;
  if (ipaqRes?.categoria) {
    seccionTitulo(doc, 'Actividad física (IPAQ corto)');
    doc.font('Helvetica').fontSize(9.5).fillColor('#1F2937')
      .text(`Nivel: ${ipaqRes.categoria} — Total: ${ipaqRes.met?.total ?? '—'} MET-min/semana `
        + `(vigorosa ${ipaqRes.met?.vigorosa ?? '—'}, moderada ${ipaqRes.met?.moderada ?? '—'}, caminata ${ipaqRes.met?.caminata ?? '—'}).`);
    doc.moveDown(0.6);
  }
  const psqiRes = payload.psqi?.resultado;
  if (typeof psqiRes?.puntajeGlobal === 'number') {
    seccionTitulo(doc, 'Calidad de sueño (PSQI/ICSP-VC)');
    doc.font('Helvetica').fontSize(9.5).fillColor('#1F2937')
      .text(`Puntaje global: ${psqiRes.puntajeGlobal}/21 — ${psqiRes.categoria || ''}`);
    doc.moveDown(0.6);
  }

  //Interpretación
  if (payload.interpretacion?.parrafo) {
    seccionTitulo(doc, 'Interpretación');
    doc.font('Helvetica').fontSize(10).fillColor('#1F2937').text(payload.interpretacion.parrafo, { align: 'justify' });
    doc.moveDown(0.6);
  }

  //Recomendación deportiva: ranking del DecisionEngine si existe; si no, el heredado.
  const rankingMotor = payload.evaluacion?.etapas?.ranking;
  const familiasMotor = rankingMotor?.familias;
  if (Array.isArray(familiasMotor) && familiasMotor.length > 0) {
    const recomendada = rankingMotor?.recomendada ?? familiasMotor[0];
    seccionTitulo(doc, 'Recomendación deportiva (DecisionEngine)');
    doc.font('Helvetica').fontSize(9.5).fillColor('#1F2937')
      .text(`Mayor compatibilidad firme: ${recomendada?.nombre ?? recomendada?.id ?? '—'}${recomendada?.porcentaje != null ? ` — ${recomendada.porcentaje}% de compatibilidad` : ''}.`);
    familiasMotor.slice(0, 5).forEach((f, i) => {
      const pct = f.porcentaje ?? '—';
      doc.font('Helvetica-Bold').fontSize(10).fillColor(AZUL)
        .text(`${i + 1}. ${f.nombre ?? f.id} — ${pct}${f.porcentaje != null ? '% de compatibilidad' : ''}${f.firme === false ? ' (provisional: demanda definitoria sin evaluar)' : ''}`);
      const rel = (f.brechas ?? []).filter(b => b.relevanteMitchell);
      if (rel.length > 0) {
        doc.font('Helvetica').fontSize(9).fillColor(GRIS)
          .text(`Brechas relevantes: ${rel.map(b => `${b.capacidad} (demanda ${b.demanda})`).join(', ')}`, { indent: 12 });
      }
      const car = (f.carencias ?? []).filter(c => c.relevanteMitchell || c.demanda === 'Alta' || c.demanda === 'Muy alta');
      if (car.length > 0) {
        doc.font('Helvetica').fontSize(9).fillColor(GRIS)
          .text(`Sin evaluar: ${car.map(c => `${c.capacidad} (demanda ${c.demanda})`).join(', ')}`, { indent: 12 });
      }
      doc.moveDown(0.3);
    });
    (rankingMotor?.advertencias ?? []).forEach(a => {
      doc.font('Helvetica').fontSize(9).fillColor(GRIS).text(`Nota: ${a}`, { indent: 8 });
    });
    doc.moveDown(0.3);
  } else if (Array.isArray(payload.rankingDeportes) && payload.rankingDeportes.length > 0) {
    seccionTitulo(doc, 'Recomendación deportiva');
    payload.rankingDeportes.slice(0, 5).forEach((d, i) => {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(AZUL)
        .text(`${i + 1}. ${d.nombre} — ${d.afinidad}% de afinidad`);
      if (d.descripcion) {
        doc.font('Helvetica').fontSize(9).fillColor(GRIS).text(d.descripcion, { indent: 12 });
      }
      doc.moveDown(0.3);
    });
    doc.moveDown(0.3);
  }

  //Pie de pagina: fechas 
  doc.moveDown(0.8);
  doc.strokeColor('#E5E7EB').lineWidth(1).moveTo(56, doc.y).lineTo(556, doc.y).stroke();
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(8).fillColor(GRIS);
  doc.text(`Fecha del análisis: ${payload.fecha || '—'}`);
  doc.text(`Documento generado: ${formatearFecha(new Date().toISOString())}`);
  doc.text('Este informe es orientativo y no constituye un diagnóstico clínico ni una evaluación de alto rendimiento.');

  doc.end();
}

function seccionTitulo(doc, texto) {
  doc.font('Helvetica-Bold').fontSize(12).fillColor(AZUL).text(texto);
  doc.moveDown(0.3);
}

function tablaClaveValor(doc, filas) {
  doc.font('Helvetica').fontSize(9.5).fillColor('#1F2937');
  filas.forEach(([clave, valor]) => {
    doc.text(`${capitalizar(clave)}:  ${valor}`);
  });
}

function capitalizar(s) {
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}
