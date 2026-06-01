import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// All routes require authentication
router.use(authenticate);

const restaurantSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  active: z.boolean().optional()
});

// Get all restaurants (filtered by user permissions)
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'ADMIN';

    let restaurants;

    if (isAdmin) {
      // Admin can see all restaurants
      restaurants = await prisma.restaurant.findMany({
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { plannings: true, logs: true }
          }
        }
      });
    } else {
      // Users can only see restaurants they have access to
      const access = await prisma.restaurantAccess.findMany({
        where: { userId },
        include: {
          restaurant: {
            include: {
              _count: {
                select: { plannings: true, logs: true }
              }
            }
          }
        }
      });
      restaurants = access.map(a => ({
        ...a.restaurant,
        userAccess: {
          canView: a.canView,
          canConfigure: a.canConfigure
        }
      }));
    }

    res.json(restaurants);
  } catch (error) {
    next(error);
  }
});

// Get restaurant by ID
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'ADMIN';

    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
      include: {
        plannings: true,
        _count: {
          select: { logs: true, userAccess: true }
        }
      }
    });

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Check access
    if (!isAdmin) {
      const hasAccess = await prisma.restaurantAccess.findUnique({
        where: {
          userId_restaurantId: { userId, restaurantId: id }
        }
      });

      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    res.json(restaurant);
  } catch (error) {
    next(error);
  }
});

// Create restaurant (admin only)
router.post('/', authorize('ADMIN'), async (req, res, next) => {
  try {
    const data = restaurantSchema.parse(req.body);

    // Check if code already exists
    const existing = await prisma.restaurant.findUnique({
      where: { code: data.code }
    });

    if (existing) {
      return res.status(400).json({ error: 'Restaurant code already exists' });
    }

    const restaurant = await prisma.restaurant.create({
      data
    });

    res.status(201).json(restaurant);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    next(error);
  }
});

// Update restaurant (admin only)
router.put('/:id', authorize('ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = restaurantSchema.partial().parse(req.body);

    const restaurant = await prisma.restaurant.update({
      where: { id },
      data
    });

    res.json(restaurant);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    next(error);
  }
});

// Delete restaurant (admin only)
router.delete('/:id', authorize('ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.restaurant.delete({
      where: { id }
    });

    res.json({ message: 'Restaurant deleted' });
  } catch (error) {
    next(error);
  }
});

// Grant user access to restaurant (admin only)
router.post('/:id/access', authorize('ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const access = await prisma.restaurantAccess.create({
      data: {
        userId,
        restaurantId: id
      },
      include: {
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

    res.status(201).json(access);
  } catch (error) {
    next(error);
  }
});

// Revoke user access (admin only)
router.delete('/:id/access/:userId', authorize('ADMIN'), async (req, res, next) => {
  try {
    const { id, userId } = req.params;

    await prisma.restaurantAccess.delete({
      where: {
        userId_restaurantId: {
          userId,
          restaurantId: id
        }
      }
    });

    res.json({ message: 'Access revoked' });
  } catch (error) {
    next(error);
  }
});

// Get users with access to restaurant (admin only)
router.get('/:id/users', authorize('ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const access = await prisma.restaurantAccess.findMany({
      where: { restaurantId: id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      }
    });

    res.json(access.map(a => a.user));
  } catch (error) {
    next(error);
  }
});

export default router;
