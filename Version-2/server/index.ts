import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import authRoutes from './routes/auth.js';
import restaurantRoutes from './routes/restaurants.js';
import restaurantConfigRoutes from './routes/restaurant-configs.js';
import planningRoutes from './routes/plannings.js';
import scenarioRoutes from './routes/scenarios.js';
import userRoutes from './routes/users.js';
import executionRoutes from './routes/execution.js';
import { errorHandler } from './middleware/errorHandler.js';
import { startScheduler } from './services/scheduler.js';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const ts = () => `[${new Date().toISOString()}]`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Core dump cleanup ──────────────────────────────────────────────
const PROJECT_ROOT = path.resolve(__dirname, '..');

/**
 * Supprime les fichiers core.[number] (core dumps) de façon périodique.
 * Par défaut toutes les 30 minutes, configurable via CLEANUP_CORE_INTERVAL_MIN.
 */
function startCoreCleanup(intervalMinutes: number = 30): void {
  const intervalMs = intervalMinutes * 60 * 1000;

  const cleanup = () => {
    try {
      const files = fs.readdirSync(PROJECT_ROOT);
      const coreFiles = files.filter(f => /^core\.\d+$/.test(f));
      if (coreFiles.length === 0) return;

      for (const file of coreFiles) {
        try {
          const filePath = path.join(PROJECT_ROOT, file);
          fs.unlinkSync(filePath);
          console.log(ts(), `🧹 Core dump supprimé : ${file}`);
        } catch (e: any) {
          console.error(ts(), `❌ Erreur suppression ${file}:`, e.message);
        }
      }
    } catch (e: any) {
      console.error(ts(), `❌ Erreur scan core dumps:`, e.message);
    }
  };

  // Nettoyage immédiat au démarrage
  cleanup();

  // Puis toutes les X minutes
  setInterval(cleanup, intervalMs);
  console.log(ts(), `🧹 Nettoyage core dumps programmé toutes les ${intervalMinutes} min`);
}

const app = express();
const PORT = process.env.PORT || 12312;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/restaurant-configs', restaurantConfigRoutes);
app.use('/api/plannings', planningRoutes);
app.use('/api/scenarios', scenarioRoutes);
app.use('/api/users', userRoutes);
app.use('/api/execution', executionRoutes);

// Serve static files (Vite build output) — only if built client exists
const clientDist = path.resolve(__dirname, '..', 'client');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res, next) => {
    if (_req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(ts(), `🚀 Server running on http://localhost:${PORT}`);
  console.log(ts(), `📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Nettoyage périodique des core dumps (toutes les 30 min par défaut)
  const cleanupInterval = parseInt(process.env.CLEANUP_CORE_INTERVAL_MIN || '30', 10);
  startCoreCleanup(cleanupInterval);

  // Start the scenario execution scheduler
  startScheduler();
});
