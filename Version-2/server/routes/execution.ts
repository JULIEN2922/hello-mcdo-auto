import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';
import { manualExecution, getExecutionState } from '../services/scheduler.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

const manualExecutionSchema = z.object({
  restaurantId: z.string().uuid(),
  count: z.number().int().min(1).max(100)
});

/**
 * GET /api/execution/status - Get current execution status
 */
router.get('/status', async (_req: AuthRequest, res, next) => {
  try {
    const state = getExecutionState();
    
    // Get restaurant details if execution is running
    let restaurant = null;
    if (state.restaurantId) {
      restaurant = await prisma.restaurant.findUnique({
        where: { id: state.restaurantId },
        select: { code: true, name: true }
      });
    }
    
    res.json({
      isRunning: state.isRunning,
      restaurantId: state.restaurantId,
      restaurant: restaurant ? {
        code: restaurant.code,
        name: restaurant.name
      } : undefined,
      startedAt: state.startedAt,
      totalScenarios: state.totalScenarios,
      completed: state.completed,
      progress: state.totalScenarios ? 
        Math.round((state.completed || 0) / state.totalScenarios * 100) : 0
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/execution/manual - Start manual execution
 */
router.post('/manual', authorize('ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const { restaurantId, count } = manualExecutionSchema.parse(req.body);
    
    // Check if execution is already running
    const state = getExecutionState();
    if (state.isRunning) {
      return res.status(409).json({ 
        error: 'Execution already in progress' 
      });
    }
    
    // Start execution in background
    manualExecution(restaurantId, count).catch(error => {
      console.error('Manual execution error:', error);
    });
    
    res.json({
      message: 'Manual execution started',
      restaurantId,
      count
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    next(error);
  }
});

/**
 * GET /api/execution/stats - Get execution statistics
 */
router.get('/stats', async (req: AuthRequest, res, next) => {
  try {
    const { restaurantId, startDate, endDate } = req.query;
    
    // Build filter
    const where: any = {};
    
    if (restaurantId) {
      where.restaurantId = restaurantId as string;
    }
    
    if (startDate || endDate) {
      where.executedAt = {};
      if (startDate) {
        where.executedAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.executedAt.lte = new Date(endDate as string);
      }
    }
    
    // Get stats
    const total = await prisma.scenarioLog.count({ where });
    const success = await prisma.scenarioLog.count({
      where: { ...where, success: true }
    });
    const failed = total - success;
    
    // Average duration
    const logs = await prisma.scenarioLog.findMany({
      where: {
        ...where,
        durationMs: { not: null }
      },
      select: { durationMs: true }
    });
    
    const avgDuration = logs.length > 0
      ? logs.reduce((sum, log) => sum + (log.durationMs || 0), 0) / logs.length
      : 0;
    
    // By location
    const byLocation = await prisma.scenarioLog.groupBy({
      by: ['location'],
      where,
      _count: true
    });
    
    // By rating
    const byRating = await prisma.scenarioLog.groupBy({
      by: ['rating'],
      where,
      _count: true
    });
    
    res.json({
      total,
      success,
      failed,
      successRate: total > 0 ? (success / total * 100).toFixed(1) : 0,
      avgDurationMs: Math.round(avgDuration),
      byLocation: byLocation.map(l => ({
        location: l.location,
        count: l._count
      })),
      byRating: byRating.map(r => ({
        rating: r.rating,
        count: r._count
      }))
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/execution/recent - Get recent executions
 */
router.get('/recent', async (req: AuthRequest, res, next) => {
  try {
    const { limit = '10', restaurantId } = req.query;
    
    const where: any = {};
    if (restaurantId) {
      where.restaurantId = restaurantId as string;
    }
    
    const logs = await prisma.scenarioLog.findMany({
      where,
      take: parseInt(limit as string),
      orderBy: { executedAt: 'desc' },
      include: {
        restaurant: {
          select: {
            code: true,
            name: true
          }
        }
      }
    });
    
    res.json(logs);
    
  } catch (error) {
    next(error);
  }
});

export default router;
