/* ═══════════════════════════════════════════════════════════════
   server.js
   API de PhysicalPicking. Todo el tráfico va sobre HTTPS en
   producción (Render lo provee automáticamente). CORS restringido
   a los dominios del frontend. Rate limiting básico contra fuerza
   bruta / scraping.
   ═══════════════════════════════════════════════════════════════ */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { consentimientoRouter } from './routes/consentimiento.js';
import { resultadosRouter } from './routes/resultados.js';
import { arcoRouter } from './routes/derechosArco.js';

const app = express();

app.set('trust proxy', 1); // Render está detrás de un proxy; necesario para req.ip correcto

app.use(helmet());
app.use(express.json({ limit: '256kb' }));

const origenesPermitidos = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: origenesPermitidos.length ? origenesPermitidos : false,
  credentials: false,
}));

// Límite general: 100 solicitudes / 15 min por IP
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/consentimiento', consentimientoRouter);
app.use('/resultados', resultadosRouter);
app.use('/arco', arcoRouter);

// Manejador de errores genérico (nunca exponer detalles internos al cliente)
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`PhysicalPicking backend escuchando en :${port}`));
