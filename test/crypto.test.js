/**
 * @module test/crypto
 * @description Pruebas del cifrado simétrico AES-256-GCM de datos sensibles (src/utils/crypto.js).
 *
 * Principios SOLID aplicados:
 *  - S (Responsabilidad única): verifica unicamente el modulo crypto.
 * Notas: claves y payloads usados aqui son ficticios y de prueba; no contiene secretos reales.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { cifrarJSON, descifrarJSON, bufferABytea, byteaABuffer } from '../src/utils/crypto.js';

// Claves ficticias de 64 hex (32 bytes) para pruebas. No son secretos reales.
const CLAVE_VALIDA = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const CLAVE_VALIDA_OTRA = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

function fijarClave() { process.env.FIELD_ENCRYPTION_KEY = CLAVE_VALIDA; }
function limpiarClave() { delete process.env.FIELD_ENCRYPTION_KEY; }

before(() => { fijarClave(); });
after(() => { limpiarClave(); });

test('cifrarJSON + descifrarJSON restauran el objeto original (roundtrip AES-256-GCM)', () => {
  fijarClave();
  const objeto = { participante: { nombre: 'Ana', edad: 24 }, evaluacion: { version: '0.1.0', total: 50 } };
  const { datosCifrados, iv, authTag } = cifrarJSON(objeto);
  const desc = descifrarJSON({ datosCifrados, iv, authTag });
  assert.deepEqual(desc, objeto);
});

test('cada cifrado genera un IV aleatorio nuevo y distintos', () => {
  fijarClave();
  const a = cifrarJSON({ x: 1 });
  const b = cifrarJSON({ x: 1 });
  assert.notEqual(a.iv, b.iv);
});

test('las partes cifradas se representan como hex bytea con prefijo \\x', () => {
  fijarClave();
  const { datosCifrados, iv, authTag } = cifrarJSON({ secreto: true });
  assert.ok(typeof datosCifrados === 'string' && datosCifrados.startsWith('\\x'));
  assert.ok(typeof iv === 'string' && iv.startsWith('\\x'));
  assert.ok(typeof authTag === 'string' && authTag.startsWith('\\x'));
});

test('descifrar con una clave valida pero distinta a la usada para cifrar falla (auth)', () => {
  fijarClave();
  const { datosCifrados, iv, authTag } = cifrarJSON({ secreto: 'valor-ficticio' });
  process.env.FIELD_ENCRYPTION_KEY = CLAVE_VALIDA_OTRA;
  assert.throws(() => descifrarJSON({ datosCifrados, iv, authTag }), Error);
});

test('descifrar con clave mal formada o de longitud incorrecta falla', () => {
  fijarClave();
  const { datosCifrados, iv, authTag } = cifrarJSON({ secreto: 'valor-ficticio' });
  for (const clave of ['corto', CLAVE_VALIDA.slice(0, -2), CLAVE_VALIDA + 'ab', 'no-es-hex-no-es-longitud-0123456789abcdef']) {
    process.env.FIELD_ENCRYPTION_KEY = clave;
    assert.throws(() => descifrarJSON({ datosCifrados, iv, authTag }), /FIELD_ENCRYPTION_KEY/);
  }
});

test('cifrarJSON rechaza claves con formato o longitud incorrectos', () => {
  for (const clave of [undefined, '', 'corto', CLAVE_VALIDA.slice(0, -2), CLAVE_VALIDA + 'ab', 'no-es-hex-no-es-longitud-0123456789abcdef']) {
    process.env.FIELD_ENCRYPTION_KEY = clave;
    assert.throws(() => cifrarJSON({ x: 1 }), /FIELD_ENCRYPTION_KEY/, `debe rechazar: ${clave}`);
  }
});

test('descifrarJSON rechaza contenido con alteracion en el ciphertext (auth GCM)', () => {
  fijarClave();
  const { datosCifrados, iv, authTag } = cifrarJSON({ secreto: 'valor-ficticio' });
  const buf = byteaABuffer(datosCifrados);
  buf[0] = buf[0] ^ 0x01;
  assert.throws(() => descifrarJSON({ datosCifrados: bufferABytea(buf), iv, authTag }), Error);
});

test('descifrarJSON rechaza alteracion en la etiqueta de autenticacion (authTag)', () => {
  fijarClave();
  const { datosCifrados, iv, authTag } = cifrarJSON({ secreto: 'valor-ficticio' });
  const buf = byteaABuffer(authTag);
  buf[0] = buf[0] ^ 0x01;
  assert.throws(() => descifrarJSON({ datosCifrados, iv, authTag: bufferABytea(buf) }), Error);
});

test('descifrarJSON rechaza alteracion en el IV', () => {
  fijarClave();
  const { datosCifrados, iv, authTag } = cifrarJSON({ secreto: 'valor-ficticio' });
  const buf = byteaABuffer(iv);
  buf[0] = buf[0] ^ 0x01;
  assert.throws(() => descifrarJSON({ datosCifrados, iv: bufferABytea(buf), authTag }), Error);
});

test('manejo de error cuando falta la clave: no expone ni devuelve datos', () => {
  delete process.env.FIELD_ENCRYPTION_KEY;
  assert.throws(() => cifrarJSON({ secreto: 'valor-ficticio' }), /FIELD_ENCRYPTION_KEY/);
  assert.throws(() => descifrarJSON({ datosCifrados: '\\x' + '00'.repeat(16), iv: '\\x' + '00'.repeat(3), authTag: '\\x' + '00'.repeat(16) }), /FIELD_ENCRYPTION_KEY/);
});
