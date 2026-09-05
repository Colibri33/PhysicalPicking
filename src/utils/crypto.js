/* 
   utils/crypto.js
   Cifrado simétrico AES-256-GCM para datos sensibles (resultados
   de test físicos/cognitivos) antes de guardarlos en Postgres.

   Por qué cifrado a nivel de campo, además del cifrado que ya da
   Supabase (disco cifrado + TLS en tránsito):
   - Defensa en profundidad: si alguien obtiene acceso directo a la
     base de datos (backup filtrado, credencial comprometida, admin
     malicioso), los valores de mediciones siguen siendo ilegibles
     sin la FIELD_ENCRYPTION_KEY, que NUNCA vive en la base de datos
     ni en el frontend, solo en el entorno del backend.
   - Es una buena práctica reconocida para "datos sensibles" bajo
     el Art. 5 de la Ley 1581/2012 (aquí, datos de condición física
     de los participantes evaluados).
   */

import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

function obtenerClave() {
  const hex = process.env.FIELD_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'FIELD_ENCRYPTION_KEY debe ser una cadena hexadecimal de 64 caracteres (32 bytes). ' +
      'Genérala con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(hex, 'hex');
}

/*
 * bufferABytea / byteaABuffer: conversion correcta entre Buffer de
 * Node y el formato que Postgres/PostgREST esperan para columnas
 * `bytea` quando se viaja por HTTP como JSON.
 *
 * BUG REAL ENCONTRADO Y CORREGIDO: supabase-js envia el body como
 * JSON. Si se le pasa un Buffer de Node directamente, JSON.stringify
 * invoca Buffer.prototype.toJSON() y lo serializa como
 * {"type":"Buffer","data":[...]}, un objeto anidado, NO el string
 * hexadecimal ("\x1a2b3c...") que Postgres entiende para bytea. El
 * resultado es que el insert falla o guarda datos corruptos que
 * luego no se pueden descifrar (por eso el historial aparecia con
 * "0 registros" pese a que el guardado parecia completarse: el INSERT
 * podia "aceptar" el valor mal formado, pero el descifrado posterior
 * fallaba silenciosamente y la fila se descartaba).
 *
 * La correccion: codificar cada Buffer como el string hex que
 * Postgres espera ANTES de insertar, y decodificar ese mismo string
 * de vuelta a Buffer al leer.
 */
export function bufferABytea(buf) {
  return '\\x' + buf.toString('hex');
}

export function byteaABuffer(valor) {
  if (Buffer.isBuffer(valor)) return valor; // ya es un Buffer (p.ej. en pruebas locales)
  const hex = typeof valor === 'string' && valor.startsWith('\\x') ? valor.slice(2) : valor;
  return Buffer.from(hex, 'hex');
}

/**
 * cifrarJSON: cifra un objeto JS y devuelve las partes necesarias
 * para guardarlo en columnas `bytea` separadas (datos, iv, tag),
 * ya codificadas como strings hex listos para insertar via Supabase.
 */
export function cifrarJSON(objeto) {
  const clave = obtenerClave();
  const iv = crypto.randomBytes(12); // recomendado para GCM
  const cipher = crypto.createCipheriv(ALGORITHM, clave, iv);

  const textoPlano = Buffer.from(JSON.stringify(objeto), 'utf8');
  const cifrado = Buffer.concat([cipher.update(textoPlano), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    datosCifrados: bufferABytea(cifrado),
    iv: bufferABytea(iv),
    authTag: bufferABytea(authTag),
  };
}

/**
 * descifrarJSON: reconstruye el objeto original a partir de las
 * columnas leidas de Supabase (que llegan como strings hex "\x...",
 * o como Buffer si se invoca localmente con datos ya binarios).
 */
export function descifrarJSON({ datosCifrados, iv, authTag }) {
  const clave = obtenerClave();
  const decipher = crypto.createDecipheriv(ALGORITHM, clave, byteaABuffer(iv));
  decipher.setAuthTag(byteaABuffer(authTag));

  const descifrado = Buffer.concat([
    decipher.update(byteaABuffer(datosCifrados)),
    decipher.final(),
  ]);

  return JSON.parse(descifrado.toString('utf8'));
}
