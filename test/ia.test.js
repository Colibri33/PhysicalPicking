import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { validarResumen, validarMensajes, llamarDeepSeek, mensajesChat } from '../src/utils/ia.js';
import { crearIaRouter } from '../src/routes/ia.js';

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
