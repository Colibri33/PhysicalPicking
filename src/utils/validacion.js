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
     fisicas: { fuerza, fuerzaExp, ... },      // NORMALIZADOS 0-100
     antropometricas: { peso, talla, grasa, muscular, grasaVisc, imc },
     consolidado: { <mismos ids de fisicas>: { base, ajAntrop, total } },
     perfilesDeportivos: {...}, rankingDeportes: [...], interpretacion: {...},
     cuestionarios: { parq, complementarias, ipaq, psqi, breq3, bbaq21 }, // opcional
     evaluacion: { versionFlujo, etapas, informe }                         // opcional
   }

   v6: se elimino el modulo cognitivo (realesC/cognitivas/ajCog) y
   "corporales" paso a llamarse "antropometricas" (ajCorp → ajAntrop).
   Los registros antiguos se adaptan con utils/registroLegado.js antes
   de validar.

   
  FUENTE UNICA DE VERDAD: NOTA IMPORTANTE SOBRE ARQUITECTURA:
  
   Frontend y backend son dos repositorios/despliegues Node
   independientes (Render Static Site vs Render Web Service), sin
   build compartido ni paquete npm comun entre ellos. Por lo tanto
   NO es posible, sin introducir tooling de monorepo (workspaces),
   que ambos importen literalmente el mismo archivo modelo.js.

   La definicion CANONICA y ORIGINAL de cada variable (rango, paso,
   unidad, direccion) vive en:
     frontend/src/logic/modelo.js → VARS_FISICAS, RANGOS_ANTROPOMETRICOS

   Lo que sigue en DEFINICIONES_FISICAS / RANGOS_ANTROPOMETRICOS es
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
// (fuerza prensil como SUMA 0-200, resistencia aeróbica como nivel máximo
// de Léger, entero 1-21). Ver esNivelLegerValido() en el frontend.
export const DEFINICIONES_FISICAS = [
  { id: 'fuerza',       min: 20,   max: 200,  paso: 1,   unidad: 'kg',           direccion: 'mayor_mejor' },
  { id: 'fuerzaExp',    min: 5,    max: 65,   paso: 1,   unidad: 'cm',           direccion: 'mayor_mejor' },
  { id: 'resistencia',  min: 1,    max: 21,   paso: 1,   unidad: 'nivel',        direccion: 'mayor_mejor' },
  { id: 'flexibilidad', min: -20,  max: 30,   paso: 1,   unidad: 'cm',           direccion: 'mayor_mejor' },
  { id: 'equilibrio',   min: 0,    max: 60,   paso: 1,   unidad: 'intentos',     direccion: 'menor_mejor' },
];

// Copia espejo de RANGOS_ANTROPOMETRICOS en frontend/src/logic/modelo.js.
// Variables antropometricas (opcionales): peso, talla, cintura, cadera
// (ICC WHO 2008) y grasa visceral. Solo limites de coherencia fisica
// basica para rechazar valores absurdos.
const RANGOS_ANTROPOMETRICOS = {
  peso:      { min: 1,  max: 400 },
  talla:     { min: 30, max: 250 },
  cintura:   { min: 40, max: 250 },
  cadera:    { min: 40, max: 250 },
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
 * base que usan tanto la validacion de valores crudos (realesF)
 * como, en principio, cualquier otra variable con rango
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

  const camposObjeto = ['participante', 'realesF', 'fisicas', 'antropometricas', 'consolidado', 'perfilesDeportivos', 'interpretacion'];
  for (const campo of camposObjeto) {
    if (!esObjetoPlano(payload[campo])) {
      return { ok: false, error: `El analisis no tiene una estructura valida: falta o es invalido el campo "${campo}".` };
    }
  }

  if (!Array.isArray(payload.rankingDeportes)) {
    return { ok: false, error: 'El analisis no tiene una estructura valida: "rankingDeportes" debe ser una lista.' };
  }

  // Bloques opcionales del flujo de evaluacion (src/evaluacion en el frontend)
  for (const campo of ['cuestionarios', 'evaluacion']) {
    if (payload[campo] !== undefined && !esObjetoPlano(payload[campo])) {
      return { ok: false, error: `El campo "${campo}" del analisis debe ser un objeto.` };
    }
  }
  if (payload.evaluacion !== undefined && typeof payload.evaluacion.versionFlujo !== 'string') {
    return { ok: false, error: 'El bloque "evaluacion" no indica su version de flujo.' };
  }

  // Cuestionarios PAR-Q+, BREQ-3 y BBAQ-21 (opcionales; registros antiguos no los tienen).
  // IPAQ y PSQI/ICSP-VC (opcionales; mismo criterio: solo coherencia, nunca baremos).
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

  // Complementarias PhysicalPicking + Leger (opcionales; registros antiguos no los tienen).
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

/**
 * validarValoresAnalisis: validacion PROFUNDA de los valores
 * numericos internos: realesF (valores crudos, cada uno
 * contra SU PROPIO rango real via validarVariable) y
 * fisicas/consolidado (valores ya normalizados, que por
 * definicion matematica de normalizarValor() SIEMPRE caen en 0-100
 * validar eso como 0-100 no es pereza, es lo correcto para esa
 * capa especifica, distinta de los valores crudos).
 */
export function validarValoresAnalisis(payload) {
  // Blindaje defensivo: aunque en resultados.js esta funcion solo se
  // llama despues de validarPayloadAnalisis (que ya garantiza estos
  // campos), no debe lanzar una excepcion no controlada si alguna
  // vez se invoca de forma aislada — debe devolver un error claro.
  const camposRequeridos = ['realesF', 'fisicas', 'consolidado', 'antropometricas'];
  for (const campo of camposRequeridos) {
    if (!esObjetoPlano(payload?.[campo])) {
      return { ok: false, error: `Falta o es invalido el campo "${campo}" del analisis.` };
    }
  }

  // 1. Valores CRUDOS reales — cada uno contra su propio rango real
  //    (kg, segundos, metros — nunca 0-100 generico).
  for (const def of DEFINICIONES_FISICAS) {
    const resultado = validarVariable(payload.realesF[def.id], def);
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
  // 3. Consolidado (base/ajAntrop/total por cada variable fisica)
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

  // 4. Antropometricas: opcionales, sin rango metodologico definido —
  //    solo coherencia fisica basica. Si vienen vacios/null, se omiten.
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
