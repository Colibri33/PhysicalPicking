/**
 * @module src/utils/crypto
 * @description Cifrado simétrico AES-256-GCM de datos sensibles (tests físicos, antropometría, cuestionarios) antes de guardarlos en Postgres.
 *
 * Principios SOLID aplicados:
 *  - S (Responsabilidad única): única razón de cambio es el esquema de cifrado y su codificación bytea.
 * Notas: el cifrado a nivel de campo añade defensa en profundidad a la protección de Supabase (disco cifrado y TLS):
 * ante acceso directo a la base los datos siguen ilegibles sin FIELD_ENCRYPTION_KEY, que reside solo en el backend.
 * Práctica reconocida para "datos sensibles" bajo el Art. 5 de la Ley 1581/2012.
 */

import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

/** Lee y valida FIELD_ENCRYPTION_KEY del entorno.
 * @returns {Buffer} clave de 32 bytes. */
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

/** Codifica un Buffer como string hex "\x..." aceptado por columnas `bytea`.
 * Un Buffer pasado directo a supabase-js se serializa como {"type":"Buffer","data":[...]},
 * lo que corrompe el dato y hace fallar el descifrado posterior (historial con "0 registros").
 * @param {Buffer} buf - datos binarios.
 * @returns {string} representación hex para Postgres. */
export function bufferABytea(buf) {
  return '\\x' + buf.toString('hex');
}

/** Decodifica el valor `bytea` leído de Postgres a Buffer.
 * @param {string|Buffer} valor - string hex "\x..." o Buffer.
 * @returns {Buffer} datos binarios. */
export function byteaABuffer(valor) {
  if (Buffer.isBuffer(valor)) return valor; // Ya es Buffer (p. ej. en pruebas locales).
  const hex = typeof valor === 'string' && valor.startsWith('\\x') ? valor.slice(2) : valor;
  return Buffer.from(hex, 'hex');
}

/** Cifra un objeto con AES-256-GCM y devuelve datos, iv y authTag como strings hex para columnas `bytea`.
 * @param {Object} objeto - objeto serializable a JSON.
 * @returns {{datosCifrados: string, iv: string, authTag: string}} partes cifradas listas para insertar. */
export function cifrarJSON(objeto) {
  const clave = obtenerClave();
  const iv = crypto.randomBytes(12); // Longitud recomendada para GCM.
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

/** Reconstruye el objeto original a partir de las columnas leídas de Supabase.
 * @param {{datosCifrados: string|Buffer, iv: string|Buffer, authTag: string|Buffer}} columnas - partes cifradas (hex "\x..." o Buffer).
 * @returns {Object} objeto descifrado; lanza error si la autenticación GCM falla. */
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
