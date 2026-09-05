/*
   utils/pdf.js
   Genera el informe descargable en PDF a partir del payload de un
   analisis (la misma forma que produce el frontend: participante,
   fisicas, cognitivas, corporales, consolidado, rankingDeportes,
   interpretacion). Se usa tanto para usuarios autenticados (tras
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

  //Variables cognitivas
  if (payload.cognitivas) {
    seccionTitulo(doc, 'Resultados cognitivos (normalizados)');
    tablaClaveValor(doc, Object.entries(payload.cognitivas).map(([k, v]) => [k, `${Math.round(v)}%`]));
    doc.moveDown(0.6);
  }

  //Perfil consolidado
  if (payload.perfilesDeportivos) {
    seccionTitulo(doc, 'Perfil funcional consolidado');
    tablaClaveValor(doc, Object.entries(payload.perfilesDeportivos).map(([k, v]) => [k, `${Math.round(v)}%`]));
    doc.moveDown(0.6);
  }

  //Interpretación
  if (payload.interpretacion?.parrafo) {
    seccionTitulo(doc, 'Interpretación');
    doc.font('Helvetica').fontSize(10).fillColor('#1F2937').text(payload.interpretacion.parrafo, { align: 'justify' });
    doc.moveDown(0.6);
  }

  //Recomendación deportiva
  if (Array.isArray(payload.rankingDeportes) && payload.rankingDeportes.length > 0) {
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
