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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

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

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist/client'));
  app.get('*', (_req, res) => {
    res.sendFile('dist/client/index.html', { root: '.' });
  });
}

// Error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Start the scenario execution scheduler
  startScheduler();
});
