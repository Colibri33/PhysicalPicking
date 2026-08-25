/* ═══════════════════════════════════════════════════════════════
   utils/crypto.js
   Cifrado simétrico AES-256-GCM para datos sensibles (resultados
   de test físicos/cognitivos) antes de guardarlos en Postgres.

   Por qué cifrado a nivel de campo, además del cifrado que ya da
   Supabase (disco cifrado + TLS en tránsito):
   - Defensa en profundidad: si alguien obtiene acceso directo a la
     base de datos (backup filtrado, credencial comprometida, admin
     malicioso), los valores de mediciones siguen siendo ilegibles
     sin la FIELD_ENCRYPTION_KEY, que NUNCA vive en la base de datos
     ni en el frontend — solo en el entorno del backend.
   - Es una buena práctica reconocida para "datos sensibles" bajo
     el Art. 5 de la Ley 1581/2012 (aquí, datos de salud/condición
     física relacionados con menores en algunos casos).
   ═══════════════════════════════════════════════════════════════ */

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

/**
 * cifrarJSON — cifra un objeto JS y devuelve las partes necesarias
 * para guardarlo en columnas `bytea` separadas (datos, iv, tag).
 */
export function cifrarJSON(objeto) {
  const clave = obtenerClave();
  const iv = crypto.randomBytes(12); // recomendado para GCM
  const cipher = crypto.createCipheriv(ALGORITHM, clave, iv);

  const textoPlano = Buffer.from(JSON.stringify(objeto), 'utf8');
  const cifrado = Buffer.concat([cipher.update(textoPlano), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return { datosCifrados: cifrado, iv, authTag };
}

/**
 * descifrarJSON — reconstruye el objeto original a partir de las
 * columnas guardadas.
 */
export function descifrarJSON({ datosCifrados, iv, authTag }) {
  const clave = obtenerClave();
  const decipher = crypto.createDecipheriv(ALGORITHM, clave, Buffer.from(iv));
  decipher.setAuthTag(Buffer.from(authTag));

  const descifrado = Buffer.concat([
    decipher.update(Buffer.from(datosCifrados)),
    decipher.final(),
  ]);

  return JSON.parse(descifrado.toString('utf8'));
}
