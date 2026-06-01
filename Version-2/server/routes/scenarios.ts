import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

const scenarioLogSchema = z.object({
  restaurantId: z.string().uuid(),
  location: z.enum(['BORNE', 'COMPTOIR', 'DRIVE', 'GUICHET', 'MCCAFE', 'CLICK_COLLECT', 'LIVRAISON', 'TABLETTE', 'APP_MOBILE']),
  consumptionType: z.enum(['SUR_PLACE', 'A_EMPORTER', 'DRIVE']),
  pickupLocation: z.enum(['COMPTOIR', 'MCDRIVE', 'TABLE', 'MCCAFE']),
  age: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  detailedNotes: z.string().optional(),
  exactOrder: z.boolean().optional(),
  problemEncountered: z.boolean().optional(),
  success: z.boolean(),
  error: z.string().optional(),
  durationMs: z.number().int().optional(),
  scheduledDate: z.string().datetime().optional()
});

// Get logs (filtered by user access)
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'ADMIN';
    
    const { restaurantId, startDate, endDate, success, limit = '100', offset = '0' } = req.query;

    const where: any = {};

    // Filter by restaurant access
    if (!isAdmin) {
      const access = await prisma.restaurantAccess.findMany({
        where: { userId },
        select: { restaurantId: true }
      });
      where.restaurantId = { in: access.map(a => a.restaurantId) };
    }

    if (restaurantId) {
      where.restaurantId = restaurantId;
    }

    if (startDate || endDate) {
      where.executedAt = {};
      if (startDate) where.executedAt.gte = new Date(startDate as string);
      if (endDate) where.executedAt.lte = new Date(endDate as string);
    }

    if (success !== undefined) {
      where.success = success === 'true';
    }

    const [logs, total] = await Promise.all([
      prisma.scenarioLog.findMany({
        where,
        orderBy: { executedAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
        include: {
          restaurant: {
            select: {
              id: true,
              code: true,
              name: true
            }
          },
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      }),
      prisma.scenarioLog.count({ where })
    ]);

    res.json({ logs, total, limit: parseInt(limit as string), offset: parseInt(offset as string) });
  } catch (error) {
    next(error);
  }
});

// Get log by ID
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'ADMIN';

    const log = await prisma.scenarioLog.findUnique({
      where: { id },
      include: {
        restaurant: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!log) {
      return res.status(404).json({ error: 'Log not found' });
    }

    // Check access
    if (!isAdmin) {
      const hasAccess = await prisma.restaurantAccess.findUnique({
        where: {
          userId_restaurantId: { userId, restaurantId: log.restaurantId }
        }
      });

      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    res.json(log);
  } catch (error) {
    next(error);
  }
});

// Create log
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const data = scenarioLogSchema.parse(req.body);

    // Check access to restaurant
    const isAdmin = req.user!.role === 'ADMIN';
    if (!isAdmin) {
      const hasAccess = await prisma.restaurantAccess.findUnique({
        where: {
          userId_restaurantId: { userId, restaurantId: data.restaurantId }
        }
      });

      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const log = await prisma.scenarioLog.create({
      data: {
        ...data,
        userId,
        scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : undefined
      },
      include: {
        restaurant: {
          select: {
            id: true,
            code: true,
            name: true
          }
        }
      }
    });

    res.status(201).json(log);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    next(error);
  }
});

// Get statistics
router.get('/stats/summary', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'ADMIN';
    const { restaurantId, startDate, endDate } = req.query;

    const where: any = {};

    // Filter by restaurant access
    if (!isAdmin) {
      const access = await prisma.restaurantAccess.findMany({
        where: { userId },
        select: { restaurantId: true }
      });
      where.restaurantId = { in: access.map(a => a.restaurantId) };
    }

    if (restaurantId) {
      where.restaurantId = restaurantId;
    }

    if (startDate || endDate) {
      where.executedAt = {};
      if (startDate) where.executedAt.gte = new Date(startDate as string);
      if (endDate) where.executedAt.lte = new Date(endDate as string);
    }

    const [total, successful, failed, avgDuration, byLocation, byDay] = await Promise.all([
      prisma.scenarioLog.count({ where }),
      prisma.scenarioLog.count({ where: { ...where, success: true } }),
      prisma.scenarioLog.count({ where: { ...where, success: false } }),
      prisma.scenarioLog.aggregate({
        where: { ...where, durationMs: { not: null } },
        _avg: { durationMs: true }
      }),
      prisma.scenarioLog.groupBy({
        by: ['location'],
        where,
        _count: true
      }),
      prisma.scenarioLog.groupBy({
        by: ['executedAt'],
        where,
        _count: true
      })
    ]);

    res.json({
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total * 100).toFixed(2) : 0,
      avgDurationMs: avgDuration._avg.durationMs || 0,
      byLocation,
      totalDays: byDay.length
    });
  } catch (error) {
    next(error);
  }
});

export default router;
