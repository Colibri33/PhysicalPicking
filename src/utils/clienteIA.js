/* clienteIA.js — cliente HTTP del proveedor de IA (API compatible con OpenAI:
   DeepSeek, OpenRouter, OpenCode...). La clave vive SOLO en el backend
   (DEEPSEEK_API_KEY). El destino se define con DEEPSEEK_BASE_URL y el modelo
   con DEEPSEEK_MODEL; ambos se cambian por entorno sin tocar código.

   Vive aparte de `ia.js` (prompts y reglas) para que editar el texto del
   asistente no arrastre el cliente HTTP ni rompa el arranque del servidor. */

export const MODELO_POR_DEFECTO = 'deepseek-flash';
export const BASE_POR_DEFECTO = 'https://api.deepseek.com';
export const TIEMPO_LIMITE_MS = 90_000;
export const INTENTOS_MAX = 2; // 1 reintento ante fallos transitorios (red, 429, 5xx)

/** Normaliza la URL base: recorta espacios y barras finales (evita "//chat/completions"). */
export function normalizarBase(url) {
  return String(url ?? '').trim().replace(/\/+$/, '');
}

function cabeceras(base, key, env) {
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };
  // OpenRouter recomienda identificar la app (atribución y enrutado más estable).
  if (/openrouter\.ai/i.test(base)) {
    h['HTTP-Referer'] = env.DEEPSEEK_REFERER || 'https://physicalpicking.app';
    h['X-Title'] = env.DEEPSEEK_TITLE || 'PhysicalPicking';
  }
  return h;
}

function reintentable(e) {
  return e.codigo === 'limite' || e.codigo === 'upstream' || e.codigo === 'red';
}

async function pedir({ fetchImpl, url, cuerpo, cabeceras, timeoutMs, modelo, base }) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    let r;
    try {
      r = await fetchImpl(url, {
        method: 'POST',
        headers: cabeceras,
        body: JSON.stringify(cuerpo),
        signal: ctl.signal,
      });
    } catch (err) {
      if (err?.name === 'AbortError') {
        const e = new Error('La IA tardó demasiado y se canceló la solicitud.');
        e.codigo = 'timeout';
        throw e;
      }
      const e = new Error(`No se pudo contactar al proveedor de IA: ${err?.message || err}`);
      e.codigo = 'red';
      throw e;
    }
    if (!r.ok) {
      let detalle = '';
      try { detalle = (await r.text()).slice(0, 300); } catch { /* sin cuerpo */ }
      const e = new Error(`IA ${r.status} (${modelo} @ ${base}): ${detalle}`);
      e.codigo = (r.status === 401 || r.status === 403) ? 'auth'
        : r.status === 429 ? 'limite'
          : r.status >= 500 ? 'upstream' : 'upstream';
      e.status = r.status;
      e.detalle = detalle;
      throw e;
    }
    let data;
    try {
      data = await r.json();
    } catch {
      const e = new Error(`La IA devolvió una respuesta que no es JSON (${modelo} @ ${base}).`);
      e.codigo = 'upstream';
      throw e;
    }
    const choice = data?.choices?.[0];
    const texto = typeof choice?.message?.content === 'string' ? choice.message.content.trim() : '';
    if (texto) return texto;
    // Modelos de "razonamiento" pueden devolver `content` vacío (p. ej. tokens agotados).
    const razon = typeof choice?.message?.reasoning === 'string' ? choice.message.reasoning.trim() : '';
    const e = new Error(`Respuesta vacía de la IA (finish_reason: ${choice?.finish_reason ?? 'desconocido'}${razon ? ', solo razonamiento' : ''}).`);
    e.codigo = 'vacio';
    throw e;
  } finally {
    clearTimeout(t);
  }
}

export async function llamarDeepSeek(messages, { fetchImpl = fetch, env = process.env, maxTokens, timeoutMs = TIEMPO_LIMITE_MS } = {}) {
  const key = env.DEEPSEEK_API_KEY;
  if (!key) { const e = new Error('IA no configurada'); e.codigo = 'sin_clave'; throw e; }
  const base = normalizarBase(env.DEEPSEEK_BASE_URL) || BASE_POR_DEFECTO;
  const modelo = env.DEEPSEEK_MODEL || MODELO_POR_DEFECTO;
  const cuerpo = {
    model: modelo,
    messages,
    temperature: 0.4,
    stream: false,
  };
  // Sin tope de tokens salvo que se indique explícitamente.
  if (maxTokens) cuerpo.max_tokens = maxTokens;
  // Respuesta rápida: sin modo "thinking" (parámetro propio de la API de DeepSeek;
  // con otra URL base —OpenRouter, OpenCode— no se envía).
  if (base === BASE_POR_DEFECTO && env.DEEPSEEK_THINKING !== 'enabled') cuerpo.thinking = { type: 'disabled' };

  let ultimo;
  for (let intento = 1; intento <= INTENTOS_MAX; intento++) {
    try {
      return await pedir({
        fetchImpl, url: `${base}/chat/completions`, cuerpo,
        cabeceras: cabeceras(base, key, env), timeoutMs, modelo, base,
      });
    } catch (e) {
      ultimo = e;
      if (intento >= INTENTOS_MAX || !reintentable(e)) throw e;
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  throw ultimo;
}
