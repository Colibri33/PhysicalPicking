import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarPayloadAnalisis, validarValoresAnalisis, DEFINICIONES_FISICAS } from '../src/utils/validacion.js';
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

test('leger: admite medios niveles (3.5); rechaza 3.7 y fuera de rango', () => {
  const base = nuevo();
  assert.equal(validarPayloadAnalisis({ ...base, leger: { palier: 3.5 } }).ok, true);
  assert.equal(validarPayloadAnalisis({ ...base, leger: { palier: '3.5' } }).ok, true);
  assert.equal(validarPayloadAnalisis({ ...base, leger: { palier: 3.7 } }).ok, false);
  assert.equal(validarPayloadAnalisis({ ...base, leger: { palier: 22 } }).ok, false);
  assert.equal(validarPayloadAnalisis({ ...base, leger: { palier: '' } }).ok, true);
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
