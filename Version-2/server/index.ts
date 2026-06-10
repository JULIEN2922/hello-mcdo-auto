import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Serve static files (Vite build output)
const clientDist = path.resolve(__dirname, '..', 'client');
app.use(express.static(clientDist));
app.get('*', (_req, res, next) => {
  // Skip API routes
  if (_req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Start the scenario execution scheduler
  startScheduler();
});
