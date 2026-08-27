/* ═══════════════════════════════════════════════════════════════
   utils/validacion.js
   Validacion defensiva de los datos que llegan al endpoint de
   resultados. Basada en la estructura REAL que genera el frontend
   (ver AnalizadorWizard.jsx → guardarEnHistorial): el "registro"
   que se envia como `payload` siempre tiene esta forma:

   {
     id, fecha,
     participante: { nombre, edad, genero, perfil, deporte },
     realesF: {...}, realesC: {...},
     fisicas: {...}, cognitivas: {...}, corporales: {...},
     consolidado: {...}, perfilesDeportivos: {...},
     rankingDeportes: [...], interpretacion: {...}
   }
   ═══════════════════════════════════════════════════════════════ */

const NOMBRE_MAX_LEN = 120;
const EDAD_MIN = 1;
const EDAD_MAX = 120;

function esObjetoPlano(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * validarParticipante — valida el objeto participante recibido
 * en el body de la peticion (req.body.participante).
 * @returns {{ ok: true, nombre: string, edad: number } | { ok: false, error: string }}
 */
export function validarParticipante(participante) {
  if (!esObjetoPlano(participante)) {
    return { ok: false, error: 'El campo "participante" es obligatorio y debe ser un objeto.' };
  }

  if (typeof participante.nombre !== 'string') {
    return { ok: false, error: 'El nombre del participante debe ser un texto.' };
  }
  const nombre = participante.nombre.trim();
  if (nombre.length === 0) {
    return { ok: false, error: 'El nombre del participante no puede estar vacio.' };
  }
  if (nombre.length > NOMBRE_MAX_LEN) {
    return { ok: false, error: `El nombre del participante supera el maximo permitido (${NOMBRE_MAX_LEN} caracteres).` };
  }

  const edadNum = Number(participante.edad);
  if (participante.edad === null || participante.edad === undefined || participante.edad === '' || Number.isNaN(edadNum)) {
    return { ok: false, error: 'La edad del participante es obligatoria y debe ser un numero.' };
  }
  if (!Number.isInteger(edadNum)) {
    return { ok: false, error: 'La edad del participante debe ser un numero entero (años completos).' };
  }
  if (edadNum < EDAD_MIN || edadNum > EDAD_MAX) {
    return { ok: false, error: `La edad del participante debe estar entre ${EDAD_MIN} y ${EDAD_MAX} años.` };
  }

  return { ok: true, nombre, edad: edadNum };
}

/**
 * validarPayloadAnalisis — valida la estructura del "registro" de
 * analisis completo antes de cifrarlo y guardarlo. No revalida los
 * calculos internos (eso es responsabilidad del motor en el
 * frontend) — verifica que la forma general sea la esperada y
 * rechaza tipos de datos inesperados (arrays sueltos, strings,
 * objetos vacios, etc.) que no podrian ser un analisis valido.
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validarPayloadAnalisis(payload) {
  if (!esObjetoPlano(payload)) {
    return { ok: false, error: 'El contenido del analisis ("payload") debe ser un objeto, no un arreglo ni un valor suelto.' };
  }

  const camposObjeto = ['participante', 'fisicas', 'cognitivas', 'corporales', 'consolidado', 'perfilesDeportivos', 'interpretacion'];
  for (const campo of camposObjeto) {
    if (!esObjetoPlano(payload[campo])) {
      return { ok: false, error: `El analisis no tiene una estructura valida: falta o es invalido el campo "${campo}".` };
    }
  }

  if (!Array.isArray(payload.rankingDeportes)) {
    return { ok: false, error: 'El analisis no tiene una estructura valida: "rankingDeportes" debe ser una lista.' };
  }

  if (payload.fecha !== undefined && typeof payload.fecha !== 'string') {
    return { ok: false, error: 'El campo "fecha" del analisis debe ser un texto.' };
  }

  // Limite defensivo de tamaño: un analisis real nunca deberia
  // acercarse a esto; protege contra payloads anomalos.
  const tamanoAprox = JSON.stringify(payload).length;
  if (tamanoAprox > 100_000) {
    return { ok: false, error: 'El contenido del analisis es demasiado grande.' };
  }

  return { ok: true };
}
