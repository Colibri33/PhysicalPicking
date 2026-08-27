/* ═══════════════════════════════════════════════════════════════
   utils/validacion.js
   Validacion defensiva de los datos que llegan al endpoint de
   resultados. Basada en la estructura y los rangos REALES definidos
   en el frontend (src/logic/modelo.js: VARS_FISICAS, VARS_COGNITIVAS,
   normalizarValor, calcularConsolidado) — no se inventan campos ni
   rangos aqui.

   El "registro" que genera el frontend (AnalizadorWizard.jsx →
   guardarEnHistorial) siempre tiene esta forma:

   {
     id, fecha,
     participante: { nombre, edad, genero, perfil, deporte },
     realesF: {...}, realesC: {...},
     fisicas: { fuerza, fuerzaExp, resistencia, velocidad, agilidad,
                flexibilidad, coordinacion, equilibrio },   // 0-100 cada uno
     cognitivas: { reaccion, decision, atencion, anticipacion }, // 0-100 cada uno
     corporales: { peso, talla, grasa, muscular, grasaVisc, imc },
     consolidado: { <mismos ids de fisicas>: { base, ajCog, ajCorp, total } },
     perfilesDeportivos: {...}, rankingDeportes: [...], interpretacion: {...}
   }
   ═══════════════════════════════════════════════════════════════ */

const NOMBRE_MAX_LEN = 120;
const EDAD_MIN = 1;
const EDAD_MAX = 120;

// IDs reales tomados de VARS_FISICAS / VARS_COGNITIVAS en
// frontend/src/logic/modelo.js. `fisicas`, `cognitivas` y cada
// entrada de `consolidado` siempre usan estos mismos identificadores.
const IDS_FISICAS = ['fuerza', 'fuerzaExp', 'resistencia', 'velocidad', 'agilidad', 'flexibilidad', 'coordinacion', 'equilibrio'];
const IDS_COGNITIVAS = ['reaccion', 'decision', 'atencion', 'anticipacion'];

// Rangos de los campos corporales (opcionales): los mismos limites
// de coherencia fisica que ya se validan en el frontend
// (StepCorporales.jsx), para que backend y frontend concuerden.
const RANGOS_CORPORALES = {
  peso:      { min: 1,  max: 400 },
  talla:     { min: 30, max: 250 },
  grasa:     { min: 0,  max: 75  },
  muscular:  { min: 0,  max: 75  },
  grasaVisc: { min: 0,  max: 60  },
};

function esObjetoPlano(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function esNumeroValido(n) {
  return typeof n === 'number' && Number.isFinite(n); // rechaza NaN e Infinity
}

/**
 * validarParticipante — valida el objeto participante recibido
 * en el body de la peticion (req.body.participante).
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
 * validarPayloadAnalisis — valida la ESTRUCTURA general del
 * "registro" de analisis (tipos y forma), sin entrar todavia en el
 * detalle de cada numero. Ver validarValoresAnalisis() para eso.
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

  const tamanoAprox = JSON.stringify(payload).length;
  if (tamanoAprox > 100_000) {
    return { ok: false, error: 'El contenido del analisis es demasiado grande.' };
  }

  return { ok: true };
}

/**
 * validarValoresAnalisis — validacion PROFUNDA de los valores
 * numericos internos de fisicas / cognitivas / consolidado /
 * corporales. Se ejecuta despues de validarPayloadAnalisis (que ya
 * garantiza que estos campos existen y son objetos).
 *
 * Rechaza NaN, Infinity, tipos incorrectos, y valores fuera del
 * rango real 0-100 en que se normalizan fisicas/cognitivas/consolidado
 * (ver normalizarValor() y calcularConsolidado() en modelo.js, que
 * siempre hacen clamp(..., 0, 100)).
 */
export function validarValoresAnalisis(payload) {
  for (const id of IDS_FISICAS) {
    const v = payload.fisicas[id];
    if (!esNumeroValido(v)) {
      return { ok: false, error: `El valor fisico "${id}" es invalido (debe ser un numero finito).` };
    }
    if (v < 0 || v > 100) {
      return { ok: false, error: `El valor fisico "${id}" esta fuera del rango normalizado valido (0-100).` };
    }
  }

  for (const id of IDS_COGNITIVAS) {
    const v = payload.cognitivas[id];
    if (!esNumeroValido(v)) {
      return { ok: false, error: `El valor cognitivo "${id}" es invalido (debe ser un numero finito).` };
    }
    if (v < 0 || v > 100) {
      return { ok: false, error: `El valor cognitivo "${id}" esta fuera del rango normalizado valido (0-100).` };
    }
  }

  for (const id of IDS_FISICAS) {
    const entrada = payload.consolidado[id];
    if (!esObjetoPlano(entrada)) {
      return { ok: false, error: `El consolidado de "${id}" es invalido (debe ser un objeto).` };
    }
    for (const campo of ['base', 'ajCog', 'ajCorp', 'total']) {
      if (!esNumeroValido(entrada[campo])) {
        return { ok: false, error: `El campo "${campo}" del consolidado de "${id}" es invalido (debe ser un numero finito).` };
      }
    }
    if (entrada.total < 0 || entrada.total > 100) {
      return { ok: false, error: `El total consolidado de "${id}" esta fuera del rango valido (0-100).` };
    }
  }

  // Corporales: opcionales. Si vienen, deben ser numeros coherentes
  // (o cadena vacia / null / undefined, que significa "no diligenciado").
  for (const [campo, rango] of Object.entries(RANGOS_CORPORALES)) {
    const raw = payload.corporales[campo];
    if (raw === '' || raw === null || raw === undefined) continue;
    const n = Number(raw);
    if (!esNumeroValido(n)) {
      return { ok: false, error: `El valor corporal "${campo}" es invalido (debe ser un numero finito).` };
    }
    if (n < rango.min || n > rango.max) {
      return { ok: false, error: `El valor corporal "${campo}" esta fuera de un rango fisicamente coherente (${rango.min}-${rango.max}).` };
    }
  }

  return { ok: true };
}
