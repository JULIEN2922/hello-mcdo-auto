import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);
router.use(authorize('ADMIN')); // All user management routes require admin

// Get all users
router.get('/', async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        lastLogin: true,
        createdAt: true,
        _count: {
          select: {
            restaurantAccess: true,
            logs: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(users);
  } catch (error) {
    next(error);
  }
});

// Get user by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        restaurantAccess: {
          include: {
            restaurant: {
              select: {
                id: true,
                code: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Update user role
router.patch('/:id/role', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['ADMIN', 'USER'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true
      }
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Delete user
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    // Don't allow deleting yourself
    if (id === req.user!.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await prisma.user.delete({
      where: { id }
    });

    res.json({ message: 'User deleted' });
  } catch (error) {
    next(error);
  }
});

// Update user (role, name, etc.)
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, firstName, lastName, email } = req.body;

    if (role && !['ADMIN', 'USER'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(role && { role }),
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(email && { email })
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true
      }
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Update user restaurant access
router.post('/:id/restaurants', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { restaurantAccess } = req.body; // Array of { restaurantId, canView, canConfigure }

    // Delete all existing access for this user
    await prisma.restaurantAccess.deleteMany({
      where: { userId: id }
    });

    // Create new access records
    if (restaurantAccess && restaurantAccess.length > 0) {
      await prisma.restaurantAccess.createMany({
        data: restaurantAccess.map((access: any) => ({
          userId: id,
          restaurantId: access.restaurantId,
          canView: access.canView ?? true,
          canConfigure: access.canConfigure ?? false
        }))
      });
    }

    // Return updated user with restaurant access
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        restaurantAccess: {
          include: {
            restaurant: {
              select: {
                id: true,
                code: true,
                name: true
              }
            }
          }
        }
      }
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
});

export default router;
