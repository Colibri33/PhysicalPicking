import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { validarResumen, validarMensajes, llamarDeepSeek, mensajesChat, normalizarBase } from '../src/utils/ia.js';
import { crearIaRouter, ERRORES_IA } from '../src/routes/ia.js';

test('validarMensajes: roles, largo y último del usuario', () => {
  assert.equal(validarMensajes([{ role: 'user', content: 'hola' }]), null);
  assert.ok(validarMensajes([]));
  assert.ok(validarMensajes([{ role: 'system', content: 'x' }]));
  assert.ok(validarMensajes([{ role: 'assistant', content: 'x' }]));
  assert.ok(validarMensajes([{ role: 'user', content: 'a'.repeat(1001) }]));
});

test('validarResumen: objeto y tamaño', () => {
  assert.equal(validarResumen({ a: 1 }), null);
  assert.ok(validarResumen(null));
  assert.ok(validarResumen({ x: 'a'.repeat(13000) }));
});

test('llamarDeepSeek: modelo por defecto, thinking desactivado y sin clave', async () => {
  let visto;
  const fetchImpl = async (url, o) => { visto = { url, body: JSON.parse(o.body), auth: o.headers.Authorization };
    return { ok: true, json: async () => ({ choices: [{ message: { content: ' hola ' } }] }) }; };
  const t = await llamarDeepSeek([{ role: 'user', content: 'x' }], { fetchImpl, env: { DEEPSEEK_API_KEY: 'k' } });
  assert.equal(t, 'hola');
  assert.equal(visto.body.model, 'deepseek-flash');
  assert.deepEqual(visto.body.thinking, { type: 'disabled' });
  assert.equal(visto.auth, 'Bearer k');
  await assert.rejects(() => llamarDeepSeek([], { fetchImpl, env: {} }), e => e.codigo === 'sin_clave');
});

test('normalizarBase: recorta espacios y barras finales', () => {
  assert.equal(normalizarBase(' https://openrouter.ai/api/v1/ '), 'https://openrouter.ai/api/v1');
  assert.equal(normalizarBase('https://openrouter.ai/api/v1///'), 'https://openrouter.ai/api/v1');
  assert.equal(normalizarBase(undefined), '');
});

test('llamarDeepSeek: normaliza la URL base y no manda thinking con OpenRouter', async () => {
  let visto;
  const fetchImpl = async (url, o) => { visto = { url, body: JSON.parse(o.body), headers: o.headers };
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'hola' } }] }) }; };
  const env = { DEEPSEEK_API_KEY: 'k', DEEPSEEK_BASE_URL: ' https://openrouter.ai/api/v1/ ', DEEPSEEK_MODEL: 'minimax/minimax-m3.1-flash:free' };
  assert.equal(await llamarDeepSeek([{ role: 'user', content: 'x' }], { fetchImpl, env }), 'hola');
  assert.equal(visto.url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(visto.body.model, 'minimax/minimax-m3.1-flash:free');
  assert.equal(visto.body.thinking, undefined);
  assert.equal(visto.headers['HTTP-Referer'], 'https://physicalpicking.app');
  assert.equal(visto.headers['X-Title'], 'PhysicalPicking');
});

test('llamarDeepSeek: clasifica 401/403, 429, vacía y red', async () => {
  const env = { DEEPSEEK_API_KEY: 'k', DEEPSEEK_BASE_URL: 'https://x.test/api/v1' };
  const conStatus = async status => llamarDeepSeek([], {
    fetchImpl: async () => ({ ok: false, status, text: async () => 'error' }), env,
  });
  await assert.rejects(() => conStatus(401), e => e.codigo === 'auth' && e.status === 401);
  await assert.rejects(() => conStatus(403), e => e.codigo === 'auth');
  await assert.rejects(() => conStatus(429), e => e.codigo === 'limite');
  await assert.rejects(() => conStatus(500), e => e.codigo === 'upstream');
  await assert.rejects(() => llamarDeepSeek([], {
    fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '  ' }, finish_reason: 'length' }] }) }), env,
  }), e => e.codigo === 'vacio');
  await assert.rejects(() => llamarDeepSeek([], {
    fetchImpl: async () => { throw new TypeError('fetch failed'); }, env,
  }), e => e.codigo === 'red');
});

test('llamarDeepSeek: reintenta una vez ante 5xx y devuelve el éxito', async () => {
  let intentos = 0;
  const env = { DEEPSEEK_API_KEY: 'k', DEEPSEEK_BASE_URL: 'https://x.test/api/v1' };
  const texto = await llamarDeepSeek([], {
    fetchImpl: async () => {
      intentos++;
      if (intentos === 1) return { ok: false, status: 503, text: async () => 'no disponible' };
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) };
    },
    env,
  });
  assert.equal(texto, 'ok');
  assert.equal(intentos, 2);
});

test('llamarDeepSeek: no reintenta ante 401 (error de configuración)', async () => {
  let intentos = 0;
  await assert.rejects(() => llamarDeepSeek([], {
    fetchImpl: async () => { intentos++; return { ok: false, status: 401, text: async () => 'x' }; },
    env: { DEEPSEEK_API_KEY: 'k', DEEPSEEK_BASE_URL: 'https://x.test/api/v1' },
  }), e => e.codigo === 'auth');
  assert.equal(intentos, 1);
});

test('mensajesChat incluye el resumen en el sistema', () => {
  const m = mensajesChat({ edad: 20 }, [{ role: 'user', content: 'q' }]);
  assert.equal(m[0].role, 'system');
  assert.match(m[0].content, /"edad":20/);
});

async function post(llamar, ruta, cuerpo) {
  const app = express(); app.use(express.json()); app.use('/ia', crearIaRouter({ llamar }));
  const srv = app.listen(0); const { port } = srv.address();
  const r = await fetch(`http://127.0.0.1:${port}/ia${ruta}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const j = await r.json(); srv.close(); return { status: r.status, j };
}

test('rutas /ia: ok, validación y errores', async () => {
  const ok = await post(async () => 'respuesta', '/interpretar', { resumen: { a: 1 } });
  assert.deepEqual([ok.status, ok.j.texto], [200, 'respuesta']);
  assert.equal((await post(async () => 'x', '/interpretar', {})).status, 400);
  assert.equal((await post(async () => 'x', '/chat', { mensajes: [] })).status, 400);
  const sinClave = await post(async () => { const e = new Error('x'); e.codigo = 'sin_clave'; throw e; }, '/chat', { mensajes: [{ role: 'user', content: 'hola' }] });
  assert.equal(sinClave.status, 503);
  const caido = await post(async () => { throw new Error('boom'); }, '/chat', { mensajes: [{ role: 'user', content: 'hola' }] });
  assert.equal(caido.status, 502);
});

test('rutas /ia: el estado de la IA distingue config, límite y caída', async () => {
  const auth = await post(async () => { const e = new Error('x'); e.codigo = 'auth'; throw e; }, '/chat', { mensajes: [{ role: 'user', content: 'hola' }] });
  assert.equal(auth.status, 500);
  assert.match(auth.j.error, /configuración/i);
  const limite = await post(async () => { const e = new Error('x'); e.codigo = 'limite'; throw e; }, '/chat', { mensajes: [{ role: 'user', content: 'hola' }] });
  assert.equal(limite.status, 429);
  assert.match(limite.j.error, /límite/i);
  const timeout = await post(async () => { const e = new Error('x'); e.codigo = 'timeout'; throw e; }, '/chat', { mensajes: [{ role: 'user', content: 'hola' }] });
  assert.equal(timeout.status, 504);
  assert.equal(ERRORES_IA.upstream.status, 502);
});

test('GET /ia/estado reporta proveedor y modelo sin filtrar la clave', async () => {
  const app = express(); app.use(express.json());
  app.use('/ia', crearIaRouter({ llamar: async () => 'ok', env: { DEEPSEEK_API_KEY: 'secreto', DEEPSEEK_BASE_URL: 'https://openrouter.ai/api/v1', DEEPSEEK_MODEL: 'minimax/minimax-m3.1-flash:free' } }));
  const srv = app.listen(0); const { port } = srv.address();
  const r = await fetch(`http://127.0.0.1:${port}/ia/estado`);
  const j = await r.json(); srv.close();
  assert.equal(r.status, 200);
  assert.equal(j.configurado, true);
  assert.equal(j.baseUrl, 'https://openrouter.ai/api/v1');
  assert.equal(j.modelo, 'minimax/minimax-m3.1-flash:free');
  assert.ok(!JSON.stringify(j).includes('secreto'));
});
