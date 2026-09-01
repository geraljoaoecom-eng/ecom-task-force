import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { router as healthRouter } from './routes/health';
import { router as foldersRouter } from './routes/folders';
import { router as librariesRouter } from './routes/libraries';
import { router as pagesRouter } from './routes/pages';
import { router as filterOptionsRouter } from './routes/filter-options';
import openRouterRouter from './routes/openrouter';
import { startScheduler } from './services/scheduler';

const app = express();

app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'http://0.0.0.0:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json({ limit: '1mb' }));

app.use((req, _res, next) => {
  console.log(`🌐 ${req.method} ${req.url} - Origin: ${req.headers.origin || 'none'}`);
  next();
});

app.use('/api/health', healthRouter);
app.use('/api/folders', foldersRouter);
app.use('/api/libraries', librariesRouter);
app.use('/api/pages', pagesRouter);
app.use('/api/filter-options', filterOptionsRouter);
app.use('/api/openrouter', openRouterRouter);

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log('🚀 Ecoom Task Force API');
  console.log(`📡 API rodando em http://${HOST}:${PORT}`);
  console.log(`🌐 Acessível na rede local em http://[SEU-IP]:${PORT}`);
  console.log('');
  startScheduler();
});
