import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env.js';
import { globalErrorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import v1Router from './routes/index.js';

const app: Application = express();

// Allowed origins
const allowedOrigins = [
  'http://localhost:3000',
  'https://medxverse-hms.vercel.app',
];

// Middleware Setup
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // Allow cookies / authorization headers
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '10mb', verify: (req, _res, buffer) => { (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer); } }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health Check Route
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    system: 'MedxVerse Core API',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Primary V1 API Routes
app.use('/api/v1', v1Router);

// 404 and Global Error Middleware
app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;
