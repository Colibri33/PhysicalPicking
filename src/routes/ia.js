/* routes/ia.js — interpretación del análisis y chatbot (DeepSeek).
   No requiere sesión (también funciona en modo invitado), pero tiene un
   límite propio por IP. El resumen NO incluye el nombre del participante. */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  validarResumen, validarMensajes, llamarDeepSeek, mensajesInterpretacion, mensajesChat,
} from '../utils/ia.js';

export function crearIaRouter({ llamar = llamarDeepSeek } = {}) {
  const router = Router();
  router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Demasiadas consultas a la IA. Intenta de nuevo en unos minutos.' } }));

  async function responder(res, mensajes) {
    try {
      const texto = await llamar(mensajes);
      res.json({ texto });
    } catch (e) {
      if (e.codigo === 'sin_clave') return res.status(503).json({ error: 'La IA no está configurada en el servidor.' });
      console.error('IA:', e.message);
      res.status(502).json({ error: 'No se pudo obtener respuesta de la IA. Intenta de nuevo.' });
    }
  }

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
