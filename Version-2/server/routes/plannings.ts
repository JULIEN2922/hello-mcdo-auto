import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { 
  authenticate, 
  AuthRequest, 
  canManagePlanningByBody, 
  canManagePlanningById, 
  canManagePlanningByParam 
} from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

const planningBaseSchema = z.object({
  restaurantId: z.string().uuid(),
  dayOfWeek: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  minScenarios: z.number().int().min(0),
  maxScenarios: z.number().int().min(0),
  active: z.boolean().optional()
});

const planningSchema = planningBaseSchema.refine(data => data.maxScenarios >= data.minScenarios, {
  message: 'maxScenarios must be greater than or equal to minScenarios'
});

// Get all plannings for a restaurant
router.get('/restaurant/:restaurantId', async (req: AuthRequest, res, next) => {
  try {
    const { restaurantId } = req.params;
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'ADMIN';

    // Check access
    if (!isAdmin) {
      const hasAccess = await prisma.restaurantAccess.findUnique({
        where: {
          userId_restaurantId: { userId, restaurantId }
        }
      });

      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const plannings = await prisma.planning.findMany({
      where: { restaurantId },
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' }
      ],
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

    res.json(plannings);
  } catch (error) {
    next(error);
  }
});

// Get planning by ID
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'ADMIN';

    const planning = await prisma.planning.findUnique({
      where: { id },
      include: {
        restaurant: true
      }
    });

    if (!planning) {
      return res.status(404).json({ error: 'Planning not found' });
    }

    // Check access
    if (!isAdmin) {
      const hasAccess = await prisma.restaurantAccess.findUnique({
        where: {
          userId_restaurantId: { userId, restaurantId: planning.restaurantId }
        }
      });

      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    res.json(planning);
  } catch (error) {
    next(error);
  }
});

// Create planning
router.post('/', canManagePlanningByBody, async (req, res, next) => {
  try {
    const data = planningSchema.parse(req.body);

    const planning = await prisma.planning.create({
      data,
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

    res.status(201).json(planning);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    next(error);
  }
});

// Update planning
router.put('/:id', canManagePlanningById, async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = planningBaseSchema.partial().parse(req.body);

    const planning = await prisma.planning.update({
      where: { id },
      data,
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

    res.json(planning);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    next(error);
  }
});

// Delete planning
router.delete('/:id', canManagePlanningById, async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.planning.delete({
      where: { id }
    });

    res.json({ message: 'Planning deleted' });
  } catch (error) {
    next(error);
  }
});

// Bulk create/update plannings for a restaurant
router.post('/restaurant/:restaurantId/bulk', canManagePlanningByParam, async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const plannings = z.array(planningSchema).parse(req.body);

    // Validate all plannings belong to the same restaurant
    const allSameRestaurant = plannings.every(p => p.restaurantId === restaurantId);
    if (!allSameRestaurant) {
      return res.status(400).json({ error: 'All plannings must belong to the same restaurant' });
    }

    // Delete existing plannings for this restaurant
    await prisma.planning.deleteMany({
      where: { restaurantId }
    });

    // Create new plannings
    const created = await prisma.planning.createMany({
      data: plannings
    });

    res.json({ created: created.count });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    next(error);
  }
});

export default router;
