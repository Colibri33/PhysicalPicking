/**
 * @module src/utils/validacion
 * @description Validación defensiva de participante, estructura y valores numéricos del análisis recibido en el endpoint de resultados.
 *
 * Principios SOLID aplicados:
 *  - S (Responsabilidad única): única razón de cambio es la regla de validación de datos de entrada.
 *  - O (Abierto/Cerrado): validarVariable es genérico; nuevas variables se añaden en DEFINICIONES_FISICAS o RANGOS_ANTROPOMETRICOS.
 * Notas: estructura y rangos reales del frontend (src/logic/modelo.js); el registro v6 incluye participante, realesF (crudos),
 * fisicas (0-100), antropometricas, consolidado, perfilesDeportivos, rankingDeportes, interpretacion y, opcionales,
 * cuestionarios y evaluacion. v6 eliminó el módulo cognitivo y renombró "corporales" a "antropometricas" (ajCorp a ajAntrop);
 * los registros antiguos se adaptan con utils/registroLegado.js antes de validar.
 * Fuente única de verdad: frontend y backend son repositorios Node independientes sin paquete común, por lo que
 * DEFINICIONES_FISICAS y RANGOS_ANTROPOMETRICOS son copia espejo manual de VARS_FISICAS y RANGOS_ANTROPOMETRICOS
 * de frontend/src/logic/modelo.js. Si cambia un rango allá, debe actualizarse aquí; la desincronización es una limitación conocida.
 */

const NOMBRE_MAX_LEN = 120;
// Población objetivo del proyecto: adultos de 18 a 30 años.
const EDAD_MIN = 18;
const EDAD_MAX = 30;

// Copia espejo de VARS_FISICAS (frontend): fuerza prensil como suma 0-200 y resistencia aeróbica
// como nivel máximo de Léger, entero 1-21 (ver esNivelLegerValido() en el frontend).
export const DEFINICIONES_FISICAS = [
  { id: 'fuerza',       min: 20,   max: 200,  paso: 1,   unidad: 'kg',           direccion: 'mayor_mejor' },
  { id: 'fuerzaExp',    min: 5,    max: 65,   paso: 1,   unidad: 'cm',           direccion: 'mayor_mejor' },
  { id: 'resistencia',  min: 1,    max: 21,   paso: 1,   unidad: 'nivel',        direccion: 'mayor_mejor' },
  { id: 'flexibilidad', min: -20,  max: 30,   paso: 1,   unidad: 'cm',           direccion: 'mayor_mejor' },
  { id: 'equilibrio',   min: 0,    max: 60,   paso: 1,   unidad: 'intentos',     direccion: 'menor_mejor' },
];

// Copia espejo de RANGOS_ANTROPOMETRICOS (frontend). Variables opcionales: peso, talla, cintura,
// cadera (ICC, OMS 2008) y grasa visceral; solo límites de coherencia física para rechazar valores absurdos.
const RANGOS_ANTROPOMETRICOS = {
  peso:      { min: 1,  max: 400 },
  talla:     { min: 30, max: 250 },
  cintura:   { min: 40, max: 250 },
  cadera:    { min: 40, max: 250 },
  grasaVisc: { min: 0,  max: 60  },
};

/** Indica si el valor es un objeto no nulo y no arreglo.
 * @param {*} v - valor a evaluar.
 * @returns {boolean} true si es objeto plano. */
function esObjetoPlano(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Indica si el valor es un número finito.
 * @param {*} n - valor a evaluar.
 * @returns {boolean} true si es número finito. */
function esNumeroValido(n) {
  return typeof n === 'number' && Number.isFinite(n); // Rechaza NaN e Infinity.
}

/** Valida un valor contra la definición de una variable (min, max, unidad); base para cualquier variable con rango.
 * @param {*} valor - valor recibido (puede venir como string).
 * @param {{id: string, min: number, max: number, paso?: number, unidad?: string}} definicion - definición de la variable.
 * @returns {{ok: true, valor: number}|{ok: false, error: string}} resultado de la validación. */
export function validarVariable(valor, definicion) {
  const { id, min, max, unidad } = definicion;

  if (valor === null || valor === undefined || valor === '') {
    return { ok: false, error: `El valor de "${id}" es obligatorio.` };
  }

  const n = typeof valor === 'number' ? valor : Number(valor);
  if (!esNumeroValido(n)) {
    return { ok: false, error: `El valor de "${id}" debe ser un numero finito (recibido: ${JSON.stringify(valor)}).` };
  }

  if (n < min || n > max) {
    return {
      ok: false,
      error: `El valor de "${id}" (${n}${unidad ? ' ' + unidad : ''}) esta fuera de su rango real (${min}-${max}${unidad ? ' ' + unidad : ''}).`,
    };
  }

  return { ok: true, valor: n };
}

/** Valida el participante recibido en req.body.participante (nombre y edad entera dentro del rango permitido).
 * @param {*} participante - objeto participante.
 * @returns {{ok: true, nombre: string, edad: number}|{ok: false, error: string}} datos normalizados o error. */
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

/** Valida la estructura general del registro de análisis (tipos y forma); los valores numéricos los cubre validarValoresAnalisis.
 * @param {*} payload - registro de análisis.
 * @returns {{ok: true}|{ok: false, error: string}} resultado de la validación. */
export function validarPayloadAnalisis(payload) {
  if (!esObjetoPlano(payload)) {
    return { ok: false, error: 'El contenido del analisis ("payload") debe ser un objeto, no un arreglo ni un valor suelto.' };
  }

  const camposObjeto = ['participante', 'realesF', 'fisicas', 'antropometricas', 'consolidado', 'perfilesDeportivos', 'interpretacion'];
  for (const campo of camposObjeto) {
    if (!esObjetoPlano(payload[campo])) {
      return { ok: false, error: `El analisis no tiene una estructura valida: falta o es invalido el campo "${campo}".` };
    }
  }

  if (!Array.isArray(payload.rankingDeportes)) {
    return { ok: false, error: 'El analisis no tiene una estructura valida: "rankingDeportes" debe ser una lista.' };
  }

  // Bloques opcionales del flujo de evaluación (src/evaluacion en el frontend).
  for (const campo of ['cuestionarios', 'evaluacion']) {
    if (payload[campo] !== undefined && !esObjetoPlano(payload[campo])) {
      return { ok: false, error: `El campo "${campo}" del analisis debe ser un objeto.` };
    }
  }
  if (payload.evaluacion !== undefined && typeof payload.evaluacion.versionFlujo !== 'string') {
    return { ok: false, error: 'El bloque "evaluacion" no indica su version de flujo.' };
  }

  // Cuestionarios IPAQ, PSQI/ICSP-VC, PAR-Q+, BREQ-3 y barreras: opcionales (los registros antiguos no los
  // tienen) y se valida solo coherencia, nunca baremos.
  if (payload.ipaq !== undefined) {
    if (!esObjetoPlano(payload.ipaq)) return { ok: false, error: 'El campo "ipaq" del analisis debe ser un objeto.' };
    const { respuestas } = payload.ipaq;
    if (respuestas !== undefined) {
      if (!esObjetoPlano(respuestas)) return { ok: false, error: 'El campo "ipaq.respuestas" debe ser un objeto.' };
      for (const k of ['i1', 'i3', 'i5']) {
        if (respuestas[k] !== undefined) {
          const v = respuestas[k];
          if (!Number.isInteger(v) || v < 0 || v > 7) return { ok: false, error: `La respuesta "${k}" de "ipaq" debe ser un entero entre 0 y 7.` };
        }
      }
      for (const k of ['i2', 'i4', 'i6', 'i7']) {
        if (respuestas[k] !== undefined) {
          const v = respuestas[k];
          if (v !== 'no_sabe' && (!esNumeroValido(v) || v < 0 || v > 1440)) {
            return { ok: false, error: `La respuesta "${k}" de "ipaq" debe ser minutos 0-1440 o "no_sabe".` };
          }
        }
      }
    }
  }
  if (payload.psqi !== undefined) {
    if (!esObjetoPlano(payload.psqi)) return { ok: false, error: 'El campo "psqi" del analisis debe ser un objeto.' };
    const { respuestas } = payload.psqi;
    if (respuestas !== undefined) {
      if (!esObjetoPlano(respuestas)) return { ok: false, error: 'El campo "psqi.respuestas" debe ser un objeto.' };
      const frecuencias = ['p5a', 'p5b', 'p5c', 'p5d', 'p5e', 'p5f', 'p5g', 'p5h', 'p5i', 'p5j', 'p6', 'p7', 'p8', 'p9', 'p10',
        'p10a', 'p10b', 'p10c', 'p10d', 'p10e'];
      for (const k of frecuencias) {
        if (respuestas[k] !== undefined) {
          const v = respuestas[k];
          if (!Number.isInteger(v) || v < 0 || v > 3) return { ok: false, error: `La respuesta "${k}" de "psqi" debe ser un entero entre 0 y 3.` };
        }
      }
      for (const k of ['p1', 'p3']) {
        if (respuestas[k] !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(respuestas[k])) {
          return { ok: false, error: `La respuesta "${k}" de "psqi" debe tener formato HH:MM.` };
        }
      }
      if (respuestas.p2 !== undefined && (!esNumeroValido(respuestas.p2) || respuestas.p2 < 0 || respuestas.p2 > 1440)) {
        return { ok: false, error: 'La respuesta "p2" de "psqi" debe estar entre 0 y 1440 minutos.' };
      }
      if (respuestas.p4 !== undefined && (!esNumeroValido(respuestas.p4) || respuestas.p4 < 0 || respuestas.p4 > 24)) {
        return { ok: false, error: 'La respuesta "p4" de "psqi" debe estar entre 0 y 24 horas.' };
      }
    }
  }
  if (payload.parq !== undefined) {
    if (!esObjetoPlano(payload.parq)) return { ok: false, error: 'El campo "parq" del analisis debe ser un objeto.' };
    const { respuestas, detalles } = payload.parq;
    if (respuestas !== undefined) {
      if (!esObjetoPlano(respuestas)) return { ok: false, error: 'El campo "parq.respuestas" debe ser un objeto.' };
      for (const [k, v] of Object.entries(respuestas)) {
        if (v !== 'si' && v !== 'no') return { ok: false, error: `La respuesta "${k}" de "parq" debe ser "si" o "no".` };
      }
    }
    if (detalles !== undefined) {
      if (!esObjetoPlano(detalles)) return { ok: false, error: 'El campo "parq.detalles" debe ser un objeto.' };
      for (const [k, v] of Object.entries(detalles)) {
        if (typeof v !== 'string') return { ok: false, error: `El detalle "${k}" de "parq" debe ser un texto.` };
        if (v.length > 300) return { ok: false, error: `El detalle "${k}" de "parq" supera los 300 caracteres.` };
      }
    }
  }
  if (payload.breq !== undefined) {
    if (!esObjetoPlano(payload.breq)) return { ok: false, error: 'El campo "breq" del analisis debe ser un objeto.' };
    const { respuestas } = payload.breq;
    if (respuestas !== undefined) {
      if (!esObjetoPlano(respuestas)) return { ok: false, error: 'El campo "breq.respuestas" debe ser un objeto.' };
      const claves = Object.keys(respuestas);
      if (claves.length > 23) return { ok: false, error: 'El campo "breq.respuestas" tiene demasiadas respuestas (maximo 23).' };
      for (const [k, v] of Object.entries(respuestas)) {
        const n = Number(k);
        if (!Number.isInteger(n) || n < 1 || n > 23) return { ok: false, error: `La clave "${k}" de "breq" debe estar entre 1 y 23.` };
        if (!Number.isInteger(v) || v < 0 || v > 4) return { ok: false, error: `La respuesta "${k}" de "breq" debe ser un entero entre 0 y 4.` };
      }
    }
  }
  if (payload.barreras !== undefined) {
    if (!esObjetoPlano(payload.barreras)) return { ok: false, error: 'El campo "barreras" del analisis debe ser un objeto.' };
    const { respuestas } = payload.barreras;
    if (respuestas !== undefined) {
      if (!esObjetoPlano(respuestas)) return { ok: false, error: 'El campo "barreras.respuestas" debe ser un objeto.' };
      const claves = Object.keys(respuestas);
      if (claves.length > 21) return { ok: false, error: 'El campo "barreras.respuestas" tiene demasiadas respuestas (maximo 21).' };
      for (const [k, v] of Object.entries(respuestas)) {
        const n = Number(k);
        if (!Number.isInteger(n) || n < 1 || n > 21) return { ok: false, error: `La clave "${k}" de "barreras" debe estar entre 1 y 21.` };
        if (!Number.isInteger(v) || v < 0 || v > 3) return { ok: false, error: `La respuesta "${k}" de "barreras" debe ser un entero entre 0 y 3.` };
      }
    }
  }

  // Complementarias y Léger: opcionales (los registros antiguos no los tienen).
  if (payload.complementarias !== undefined) {
    if (!esObjetoPlano(payload.complementarias)) return { ok: false, error: 'El campo "complementarias" del analisis debe ser un objeto.' };
    const { respuestas } = payload.complementarias;
    if (respuestas !== undefined && !esObjetoPlano(respuestas)) {
      return { ok: false, error: 'El campo "complementarias.respuestas" debe ser un objeto.' };
    }
  }
  if (payload.leger !== undefined) {
    if (!esObjetoPlano(payload.leger)) return { ok: false, error: 'El campo "leger" del analisis debe ser un objeto.' };
    const { palier } = payload.leger;
    // Nivel máximo de Léger: entero 1-21 (espejo de esNivelLegerValido).
    const n = Number(palier);
    if (palier !== undefined && palier !== '' && (!Number.isFinite(n) || n < 1 || n > 21 || !Number.isInteger(n))) {
      return { ok: false, error: 'El campo "leger.palier" debe ser un número entero entre 1 y 21 (nivel máximo alcanzado).' };
    }
  }

  if (payload.fecha !== undefined && typeof payload.fecha !== 'string') {
    return { ok: false, error: 'El campo "fecha" del analisis debe ser un texto.' };
  }

  const tamanoAprox = JSON.stringify(payload).length;
  if (tamanoAprox > 100_000) {
    return { ok: false, error: 'El contenido del analisis es demasiado grande.' };
  }

  return { ok: true };
}

/** Valida en profundidad los valores numéricos: realesF contra su rango real y fisicas/consolidado en 0-100
 * (rango garantizado por normalizarValor), además de las antropométricas.
 * @param {Object} payload - registro de análisis ya validado estructuralmente.
 * @returns {{ok: true}|{ok: false, error: string}} resultado de la validación. */
export function validarValoresAnalisis(payload) {
  // Blindaje defensivo: aunque se invoca tras validarPayloadAnalisis, no debe lanzar
  // una excepción si se usa de forma aislada; devuelve un error claro.
  const camposRequeridos = ['realesF', 'fisicas', 'consolidado', 'antropometricas'];
  for (const campo of camposRequeridos) {
    if (!esObjetoPlano(payload?.[campo])) {
      return { ok: false, error: `Falta o es invalido el campo "${campo}" del analisis.` };
    }
  }

  // 1. Valores crudos reales, cada uno contra su propio rango (kg, cm, nivel; nunca 0-100 genérico).
  for (const def of DEFINICIONES_FISICAS) {
    const resultado = validarVariable(payload.realesF[def.id], def);
    if (!resultado.ok) return resultado;
  }

  // 2. Valores normalizados: 0-100 por construcción (clamp en normalizarValor, modelo.js).
  for (const def of DEFINICIONES_FISICAS) {
    const v = payload.fisicas[def.id];
    if (!esNumeroValido(v)) {
      return { ok: false, error: `El valor fisico normalizado "${def.id}" es invalido (debe ser un numero finito).` };
    }
    if (v < 0 || v > 100) {
      return { ok: false, error: `El valor fisico normalizado "${def.id}" esta fuera del rango 0-100.` };
    }
  }
  // 3. Consolidado (base, ajAntrop y total por variable física).
  for (const def of DEFINICIONES_FISICAS) {
    const entrada = payload.consolidado[def.id];
    if (!esObjetoPlano(entrada)) {
      return { ok: false, error: `El consolidado de "${def.id}" es invalido (debe ser un objeto).` };
    }
    for (const campo of ['base', 'ajAntrop', 'total']) {
      if (!esNumeroValido(entrada[campo])) {
        return { ok: false, error: `El campo "${campo}" del consolidado de "${def.id}" es invalido (debe ser un numero finito).` };
      }
    }
    if (entrada.total < 0 || entrada.total > 100) {
      return { ok: false, error: `El total consolidado de "${def.id}" esta fuera del rango valido (0-100).` };
    }
  }

  // 4. Antropométricas: opcionales y sin rango metodológico; solo coherencia física básica. Vacías o nulas se omiten.
  for (const [campo, rango] of Object.entries(RANGOS_ANTROPOMETRICOS)) {
    const raw = payload.antropometricas[campo];
    if (raw === '' || raw === null || raw === undefined) continue;
    const n = Number(raw);
    if (!esNumeroValido(n)) {
      return { ok: false, error: `El valor antropometrico "${campo}" es invalido (debe ser un numero finito).` };
    }
    if (n < rango.min || n > rango.max) {
      return { ok: false, error: `El valor antropometrico "${campo}" esta fuera de un rango fisicamente coherente (${rango.min}-${rango.max}).` };
    }
  }

  return { ok: true };
}
