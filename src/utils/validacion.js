/*
   utils/validacion.js
   Validacion defensiva de los datos que llegan al endpoint de
   resultados. Basada en la estructura y los rangos REALES definidos
   en el frontend (src/logic/modelo.js) — no se inventan campos ni
   rangos aqui.

   El "registro" que genera el frontend (AnalizadorWizard.jsx →
   guardarEnHistorial) siempre tiene esta forma:

   {
     id, fecha,
     participante: { nombre, edad, genero, perfil, deporte },
     realesF: { fuerza, fuerzaExp, ... },     // valores CRUDOS reales
                                                // (kg, segundos, metros...)
     realesC: { reaccion, decision, ... },     // valores CRUDOS reales
                                                // (ms, %)
     fisicas: { fuerza, fuerzaExp, ... },      // NORMALIZADOS 0-100
     cognitivas: { reaccion, decision, ... },  // NORMALIZADOS 0-100
     corporales: { peso, talla, grasa, muscular, grasaVisc, imc },
     consolidado: { <mismos ids de fisicas>: { base, ajCog, ajCorp, total } },
     perfilesDeportivos: {...}, rankingDeportes: [...], interpretacion: {...}
   }

   
  FUENTE UNICA DE VERDAD: NOTA IMPORTANTE SOBRE ARQUITECTURA:
  
   Frontend y backend son dos repositorios/despliegues Node
   independientes (Render Static Site vs Render Web Service), sin
   build compartido ni paquete npm comun entre ellos. Por lo tanto
   NO es posible, sin introducir tooling de monorepo (workspaces),
   que ambos importen literalmente el mismo archivo modelo.js.

   La definicion CANONICA y ORIGINAL de cada variable (rango, paso,
   unidad, direccion) vive en:
     frontend/src/logic/modelo.js → VARS_FISICAS, VARS_COGNITIVAS

   Lo que sigue en DEFINICIONES_FISICAS / DEFINICIONES_COGNITIVAS es
   una COPIA ESPEJO manual de esos mismos valores, mantenida a mano.
   Si cambias un rango en modelo.js, DEBES actualizar tambien aqui,
   o backend y frontend quedaran validando cosas distintas, este
   riesgo de desincronizacion es una limitacion real y conocida de
   esta arquitectura de dos repos separados, no un problema resuelto.
   ═══════════════════════════════════════════════════════════════ */

const NOMBRE_MAX_LEN = 120;
// PhysicalPicking evalua exclusivamente participantes adultos entre
// 18 y 30 años (poblacion objetivo del proyecto).
const EDAD_MIN = 18;
const EDAD_MAX = 30;

// Copia espejo exacta de VARS_FISICAS en frontend/src/logic/modelo.js
export const DEFINICIONES_FISICAS = [
  { id: 'fuerza',       min: 10,   max: 100,  paso: 1,   unidad: 'kg',           direccion: 'mayor_mejor' },
  { id: 'fuerzaExp',    min: 5,    max: 65,   paso: 1,   unidad: 'cm',           direccion: 'mayor_mejor' },
  { id: 'resistencia',  min: 800,  max: 3200, paso: 10,  unidad: 'metros',       direccion: 'mayor_mejor' },
  { id: 'velocidad',    min: 4.0,  max: 8.0,  paso: 0.1, unidad: 'segundos',     direccion: 'menor_mejor' },
  { id: 'agilidad',     min: 14,   max: 26,   paso: 0.1, unidad: 'segundos',     direccion: 'menor_mejor' },
  { id: 'flexibilidad', min: -20,  max: 30,   paso: 1,   unidad: 'cm',           direccion: 'mayor_mejor' },
  { id: 'coordinacion', min: 3,    max: 45,   paso: 1,   unidad: 'repeticiones', direccion: 'mayor_mejor' },
  { id: 'equilibrio',   min: 3,    max: 45,   paso: 1,   unidad: 'segundos',     direccion: 'mayor_mejor' },
];

// Copia espejo exacta de VARS_COGNITIVAS en frontend/src/logic/modelo.js
export const DEFINICIONES_COGNITIVAS = [
  { id: 'reaccion',     min: 150, max: 650, paso: 1, unidad: 'ms', direccion: 'menor_mejor' },
  { id: 'decision',     min: 20,  max: 100, paso: 1, unidad: '%',  direccion: 'mayor_mejor' },
  { id: 'atencion',     min: 20,  max: 100, paso: 1, unidad: '%',  direccion: 'mayor_mejor' },
  { id: 'anticipacion', min: 20,  max: 100, paso: 1, unidad: '%',  direccion: 'mayor_mejor' },
];

// Rangos de los campos corporales (opcionales): no tienen un rango
// metodologico definido en el proyecto (a diferencia de las fisicas
// y cognitivas de arriba), solo limites de coherencia fisica basica
// para rechazar valores absurdos. Ver StepCorporales.jsx en el
// frontend, que usa estos mismos limites.
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
 * validarVariable: validador GENERICO de un valor contra la
 * definicion de una variable (min/max/paso/unidad). Es la funcion
 * base que usan tanto la validacion de valores crudos (realesF/
 * realesC) como, en principio, cualquier otra variable con rango
 * definido que se agregue en el futuro.
 *
 * @param {*} valor - el valor recibido (puede venir como string)
 * @param {{id:string,min:number,max:number,paso?:number,unidad?:string}} definicion
 * @returns {{ ok: true, valor: number } | { ok: false, error: string }}
 */
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

/**
 * validarParticipante: valida el objeto participante recibido
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
 * validarPayloadAnalisis: valida la ESTRUCTURA general del
 * "registro" de analisis (tipos y forma), sin entrar todavia en el
 * detalle de cada numero. Ver validarValoresAnalisis() para eso.
 */
export function validarPayloadAnalisis(payload) {
  if (!esObjetoPlano(payload)) {
    return { ok: false, error: 'El contenido del analisis ("payload") debe ser un objeto, no un arreglo ni un valor suelto.' };
  }

  const camposObjeto = ['participante', 'realesF', 'realesC', 'fisicas', 'cognitivas', 'corporales', 'consolidado', 'perfilesDeportivos', 'interpretacion'];
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
 * validarValoresAnalisis: validacion PROFUNDA de los valores
 * numericos internos: realesF/realesC (valores crudos, cada uno
 * contra SU PROPIO rango real via validarVariable) y
 * fisicas/cognitivas/consolidado (valores ya normalizados, que por
 * definicion matematica de normalizarValor() SIEMPRE caen en 0-100
 * validar eso como 0-100 no es pereza, es lo correcto para esa
 * capa especifica, distinta de los valores crudos).
 */
export function validarValoresAnalisis(payload) {
  // Blindaje defensivo: aunque en resultados.js esta funcion solo se
  // llama despues de validarPayloadAnalisis (que ya garantiza estos
  // campos), no debe lanzar una excepcion no controlada si alguna
  // vez se invoca de forma aislada — debe devolver un error claro.
  const camposRequeridos = ['realesF', 'realesC', 'fisicas', 'cognitivas', 'consolidado', 'corporales'];
  for (const campo of camposRequeridos) {
    if (!esObjetoPlano(payload?.[campo])) {
      return { ok: false, error: `Falta o es invalido el campo "${campo}" del analisis.` };
    }
  }

  // 1. Valores CRUDOS reales — cada uno contra su propio rango real
  //    (kg, segundos, metros, ms, % — nunca 0-100 generico).
  for (const def of DEFINICIONES_FISICAS) {
    const resultado = validarVariable(payload.realesF[def.id], def);
    if (!resultado.ok) return resultado;
  }
  for (const def of DEFINICIONES_COGNITIVAS) {
    const resultado = validarVariable(payload.realesC[def.id], def);
    if (!resultado.ok) return resultado;
  }

  // 2. Valores NORMALIZADOS (0-100 por construccion matematica de
  //    normalizarValor en modelo.js — clamp(...,0,100)).
  for (const def of DEFINICIONES_FISICAS) {
    const v = payload.fisicas[def.id];
    if (!esNumeroValido(v)) {
      return { ok: false, error: `El valor fisico normalizado "${def.id}" es invalido (debe ser un numero finito).` };
    }
    if (v < 0 || v > 100) {
      return { ok: false, error: `El valor fisico normalizado "${def.id}" esta fuera del rango 0-100.` };
    }
  }
  for (const def of DEFINICIONES_COGNITIVAS) {
    const v = payload.cognitivas[def.id];
    if (!esNumeroValido(v)) {
      return { ok: false, error: `El valor cognitivo normalizado "${def.id}" es invalido (debe ser un numero finito).` };
    }
    if (v < 0 || v > 100) {
      return { ok: false, error: `El valor cognitivo normalizado "${def.id}" esta fuera del rango 0-100.` };
    }
  }

  // 3. Consolidado (base/ajCog/ajCorp/total por cada variable fisica)
  for (const def of DEFINICIONES_FISICAS) {
    const entrada = payload.consolidado[def.id];
    if (!esObjetoPlano(entrada)) {
      return { ok: false, error: `El consolidado de "${def.id}" es invalido (debe ser un objeto).` };
    }
    for (const campo of ['base', 'ajCog', 'ajCorp', 'total']) {
      if (!esNumeroValido(entrada[campo])) {
        return { ok: false, error: `El campo "${campo}" del consolidado de "${def.id}" es invalido (debe ser un numero finito).` };
      }
    }
    if (entrada.total < 0 || entrada.total > 100) {
      return { ok: false, error: `El total consolidado de "${def.id}" esta fuera del rango valido (0-100).` };
    }
  }

  // 4. Corporales: opcionales, sin rango metodologico definido — solo
  //    coherencia fisica basica. Si vienen vacios/null, se omiten.
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
