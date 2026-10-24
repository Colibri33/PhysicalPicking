/**
 * @module test/validacion.test
 * @description Pruebas de validación de payloads v6, migración de registros legados y rangos antropométricos.
 *
 * Principios SOLID aplicados:
 *  - S (Responsabilidad única): verifica únicamente validacion.js y registroLegado.js.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarPayloadAnalisis, validarValoresAnalisis, validarParticipante, DEFINICIONES_FISICAS } from '../src/utils/validacion.js';
import { migrarRegistroLegado } from '../src/utils/registroLegado.js';

const realesF = Object.fromEntries(DEFINICIONES_FISICAS.map(d => [d.id, d.min]));
const fisicas = Object.fromEntries(DEFINICIONES_FISICAS.map(d => [d.id, 50]));
const nuevo = () => ({
  participante: { nombre: 'X', edad: 22 }, realesF, fisicas,
  antropometricas: { peso: '70', talla: '', grasa: '', muscular: '', grasaVisc: '', imc: null },
  consolidado: Object.fromEntries(DEFINICIONES_FISICAS.map(d => [d.id, { base: 50, ajAntrop: 0, total: 50 }])),
  perfilesDeportivos: {}, rankingDeportes: [], interpretacion: {},
  cuestionarios: { parq: {} }, evaluacion: { versionFlujo: '0.1.0', etapas: {}, informe: {} },
});

test('payload v6 valido', () => {
  const p = nuevo();
  assert.deepEqual(validarPayloadAnalisis(p), { ok: true });
  assert.deepEqual(validarValoresAnalisis(p), { ok: true });
});

test('payload v6 sin campos cognitivos no se rechaza por su ausencia', () => {
  const p = nuevo();
  assert.ok(!('cognitivas' in p) && !('realesC' in p));
  assert.equal(validarValoresAnalisis(p).ok, true);
});

test('registro legado se adapta y valida', () => {
  const p = nuevo();
  const { antropometricas, ...resto } = p;
  const viejo = {
    ...resto, corporales: antropometricas, realesC: { reaccion: 300 }, cognitivas: { reaccion: 70 },
    consolidado: Object.fromEntries(DEFINICIONES_FISICAS.map(d => [d.id, { base: 50, ajCog: 1.5, ajCorp: -4, total: 48 }])),
  };
  delete viejo.evaluacion; delete viejo.cuestionarios;
  assert.equal(validarPayloadAnalisis(viejo).ok, false);
  const migrado = migrarRegistroLegado(viejo);
  assert.equal(validarPayloadAnalisis(migrado).ok, true);
  assert.equal(validarValoresAnalisis(migrado).ok, true);
  assert.equal(migrado.consolidado.fuerza.ajAntrop, -4);
  assert.equal(migrado._legado.ajCog.fuerza, 1.5);
});

test('leger: solo enteros 1-21 (nivel máximo alcanzado); vacío se permite', () => {
  const base = nuevo();
  for (const ok of [1, 8, '12', 21, '']) {
    assert.equal(validarPayloadAnalisis({ ...base, leger: { palier: ok } }).ok, true, `${ok} debe ser valido`);
  }
  for (const mal of [0, 3.5, '3.5', 3.6, 3.7, 22, -1, 'x']) {
    assert.equal(validarPayloadAnalisis({ ...base, leger: { palier: mal } }).ok, false, `${mal} debe rechazarse`);
  }
});

test('evaluacion sin version de flujo se rechaza', () => {
  const p = nuevo(); p.evaluacion = {};
  assert.equal(validarPayloadAnalisis(p).ok, false);
});

test('antropometrica absurda se rechaza', () => {
  const p = nuevo(); p.antropometricas.peso = '900';
  assert.equal(validarValoresAnalisis(p).ok, false);
});

test('% grasa y % muscular historicos se conservan en _legado', () => {
  const p = nuevo();
  p.antropometricas.grasa = '20';
  p.antropometricas.muscular = '42';
  const m = migrarRegistroLegado(p);
  assert.ok(!('grasa' in m.antropometricas) && !('muscular' in m.antropometricas));
  assert.deepEqual(m._legado.antropometriaRetirada, { grasa: '20', muscular: '42' });
  assert.deepEqual(migrarRegistroLegado(m), m);
  assert.equal(validarPayloadAnalisis(m).ok, true);
});

test('participante: el sexo biológico es obligatorio y solo masculino o femenino', () => {
  const base = { nombre: 'X', edad: 22 };
  assert.equal(validarParticipante({ ...base, genero: 'masculino' }).ok, true);
  assert.equal(validarParticipante({ ...base, genero: 'femenino' }).ok, true);
  for (const genero of ['otro', '', undefined, null]) {
    const r = validarParticipante({ ...base, genero });
    assert.equal(r.ok, false, `genero=${String(genero)}`);
    assert.match(r.error, /sexo biológico/);
  }
});

test('payload actual sin campos heredados es valido si trae evaluacion', () => {
  const { fisicas: _f, consolidado: _c, perfilesDeportivos: _p, rankingDeportes: _r, interpretacion: _i, ...actual } = nuevo();
  assert.deepEqual(validarPayloadAnalisis(actual), { ok: true });
  assert.deepEqual(validarValoresAnalisis(actual), { ok: true });
});

test('payload sin evaluacion ni campos heredados se rechaza', () => {
  const { fisicas: _f, consolidado: _c, perfilesDeportivos: _p, rankingDeportes: _r, interpretacion: _i, evaluacion: _e, ...sinNada } = nuevo();
  assert.equal(validarPayloadAnalisis(sinNada).ok, false);
});

test('registro anterior sin evaluacion sigue exigiendo el bloque heredado completo', () => {
  const { evaluacion: _e, ...anterior } = nuevo();
  assert.deepEqual(validarPayloadAnalisis(anterior), { ok: true });
  const { consolidado: _c, ...incompleto } = anterior;
  assert.equal(validarPayloadAnalisis(incompleto).ok, false);
});

test('un campo heredado mal formado se rechaza aunque haya evaluacion', () => {
  assert.equal(validarPayloadAnalisis({ ...nuevo(), consolidado: 'x' }).ok, false);
});
