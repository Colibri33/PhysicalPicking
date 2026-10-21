/**
 * @module src/server
 * @description Punto de entrada de la API: configura seguridad, CORS, límites y monta los routers.
 *
 * Principios SOLID aplicados:
 *  - S (Responsabilidad única): única razón de cambio es la composición del servidor HTTP.
 *  - O (Abierto/Cerrado): se añaden funcionalidades montando nuevos routers sin alterar los existentes.
 * Notas: en producción el tráfico va sobre HTTPS (provisto por Render); CORS limitado a los dominios del frontend.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { consentimientoRouter } from './routes/consentimiento.js';
import { resultadosRouter } from './routes/resultados.js';
import { arcoRouter } from './routes/derechosArco.js';
import { iaRouter } from './routes/ia.js';

const app = express();

app.set('trust proxy', 1); // Render opera tras un proxy; requerido para obtener req.ip correcto.

app.use(helmet());
app.use(express.json({ limit: '256kb' }));

const origenesPermitidos = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: origenesPermitidos.length ? origenesPermitidos : false,
  credentials: false,
}));

// Límite general contra fuerza bruta y scraping: 100 solicitudes cada 15 min por IP.
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/consentimiento', consentimientoRouter);
app.use('/resultados', resultadosRouter);
app.use('/arco', arcoRouter);
app.use('/ia', iaRouter);

// Manejador de errores genérico: no expone detalles internos al cliente.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`PhysicalPicking backend escuchando en :${port}`));
