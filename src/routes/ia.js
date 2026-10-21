/* routes/ia.js — interpretación del análisis y chatbot (IA).
   No requiere sesión (también funciona en modo invitado), pero tiene un
   límite propio por IP. El resumen NO incluye el nombre del participante. */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  validarResumen, validarMensajes, llamarDeepSeek, mensajesInterpretacion, mensajesChat,
  normalizarBase, BASE_POR_DEFECTO, MODELO_POR_DEFECTO,
} from '../utils/ia.js';

/** Traduce el código de error de la capa IA a un status HTTP y un mensaje útil. */
export const ERRORES_IA = {
  sin_clave: { status: 503, mensaje: 'La IA no está configurada en el servidor.' },
  auth: { status: 500, mensaje: 'La clave o el modelo de la IA no son válidos en el servidor. Revisa la configuración.' },
  limite: { status: 429, mensaje: 'La IA alcanzó su límite de uso por ahora. Espera unos minutos e inténtalo de nuevo.' },
  timeout: { status: 504, mensaje: 'La IA tardó demasiado en responder. Inténtalo de nuevo.' },
  vacio: { status: 502, mensaje: 'La IA devolvió una respuesta vacía. Inténtalo de nuevo.' },
  red: { status: 502, mensaje: 'No se pudo conectar con el proveedor de IA. Inténtalo de nuevo.' },
  upstream: { status: 502, mensaje: 'No se pudo obtener respuesta de la IA. Intenta de nuevo.' },
};

export function crearIaRouter({ llamar = llamarDeepSeek, env = process.env } = {}) {
  const router = Router();
  router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Demasiadas consultas a la IA. Intenta de nuevo en unos minutos.' } }));

  async function responder(res, mensajes) {
    try {
      const texto = await llamar(mensajes);
      res.json({ texto });
    } catch (e) {
      const cfg = ERRORES_IA[e?.codigo] || ERRORES_IA.upstream;
      console.error(`IA [${e?.codigo || 'desconocido'}] status=${e?.status ?? '-'} :: ${e?.message}`);
      res.status(cfg.status).json({ error: cfg.mensaje });
    }
  }

  // Diagnóstico: qué proveedor/modelo está configurado y si responde.
  // `?verificar=1` además hace una llamada real al proveedor (gasta cuota).
  router.get('/estado', async (_req, res) => {
    const base = normalizarBase(env.DEEPSEEK_BASE_URL) || BASE_POR_DEFECTO;
    const info = {
      configurado: Boolean(env.DEEPSEEK_API_KEY),
      baseUrl: base,
      modelo: env.DEEPSEEK_MODEL || MODELO_POR_DEFECTO,
    };
    if (_req.query.verificar) {
      try {
        await llamar([{ role: 'user', content: 'ping' }]);
        info.proveedor = { ok: true };
      } catch (e) {
        info.proveedor = { ok: false, codigo: e?.codigo || 'desconocido', status: e?.status ?? null, mensaje: e?.message };
      }
    }
    res.json(info);
  });

  router.post('/interpretar', async (req, res) => {
    const err = validarResumen(req.body?.resumen);
    if (err) return res.status(400).json({ error: err });
    await responder(res, mensajesInterpretacion(req.body.resumen));
  });

  router.post('/chat', async (req, res) => {
    const e1 = validarMensajes(req.body?.mensajes);
    if (e1) return res.status(400).json({ error: e1 });
    if (req.body.resumen !== undefined && req.body.resumen !== null) {
      const e2 = validarResumen(req.body.resumen);
      if (e2) return res.status(400).json({ error: e2 });
    }
    await responder(res, mensajesChat(req.body.resumen, req.body.mensajes));
  });

  return router;
}

export const iaRouter = crearIaRouter();
