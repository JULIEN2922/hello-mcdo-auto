import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireAdmin, canConfigureRestaurant } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// Get restaurant configuration
router.get('/:restaurantId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { restaurantId } = req.params;
    const user = req.user!;

    // Check if user has access to this restaurant
    if (user.role !== 'ADMIN') {
      const access = await prisma.restaurantAccess.findFirst({
        where: { userId: user.id, restaurantId }
      });
      if (!access) {
        return res.status(403).json({ error: 'Access denied to this restaurant' });
      }
    }

    // Get or create config
    let config = await prisma.restaurantConfig.findUnique({
      where: { restaurantId },
      include: { restaurant: { select: { code: true, name: true } } }
    });

    if (!config) {
      // Create default config
      config = await prisma.restaurantConfig.create({
        data: { restaurantId },
        include: { restaurant: { select: { code: true, name: true } } }
      });
    }

    // Parse JSON fields
    const response = {
      ...config,
      enabledScenarios: JSON.parse(config.enabledScenarios),
      scenarioVariants: JSON.parse(config.scenarioVariants)
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error fetching restaurant config:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

// Update restaurant configuration
router.put('/:restaurantId', authenticate, canConfigureRestaurant, async (req: AuthRequest, res) => {
  try {
    const { restaurantId } = req.params;
    const user = req.user!;
    const {
      rating1Percent,
      rating2Percent,
      rating3Percent,
      rating4Percent,
      rating5Percent,
      age15_24Percent,
      age25_34Percent,
      age35_49Percent,
      age50PlusPercent,
      enabledScenarios,
      scenarioVariants,
      exactOrderPercent,
      problemEncounteredPercent
    } = req.body;

    // Validate rating distribution
    const ratingTotal = rating1Percent + rating2Percent + rating3Percent + rating4Percent + rating5Percent;
    if (ratingTotal !== 100) {
      return res.status(400).json({ error: 'Rating percentages must sum to 100' });
    }

    // Validate age distribution
    const ageTotal = age15_24Percent + age25_34Percent + age35_49Percent + age50PlusPercent;
    if (ageTotal !== 100) {
      return res.status(400).json({ error: 'Age percentages must sum to 100' });
    }

    // Validate exact order percent
    if (exactOrderPercent < 0 || exactOrderPercent > 100) {
      return res.status(400).json({ error: 'Exact order percentage must be between 0 and 100' });
    }

    // Validate problem encountered percent
    if (problemEncounteredPercent < 0 || problemEncounteredPercent > 100) {
      return res.status(400).json({ error: 'Problem encountered percentage must be between 0 and 100' });
    }

    // Get old config for change log
    const oldConfig = await prisma.restaurantConfig.findUnique({
      where: { restaurantId }
    });

    // Update or create config
    const config = await prisma.restaurantConfig.upsert({
      where: { restaurantId },
      create: {
        restaurantId,
        rating1Percent,
        rating2Percent,
        rating3Percent,
        rating4Percent,
        rating5Percent,
        age15_24Percent,
        age25_34Percent,
        age35_49Percent,
        age50PlusPercent,
        enabledScenarios: JSON.stringify(enabledScenarios || []),
        scenarioVariants: JSON.stringify(scenarioVariants || {}),
        exactOrderPercent,
        problemEncounteredPercent
      },
      update: {
        rating1Percent,
        rating2Percent,
        rating3Percent,
        rating4Percent,
        rating5Percent,
        age15_24Percent,
        age25_34Percent,
        age35_49Percent,
        age50PlusPercent,
        enabledScenarios: JSON.stringify(enabledScenarios || []),
        scenarioVariants: JSON.stringify(scenarioVariants || {}),
        exactOrderPercent,
        problemEncounteredPercent
      },
      include: { restaurant: { select: { code: true, name: true } } }
    });

    // Log the changes
    const changes: any = {};
    if (oldConfig) {
      if (oldConfig.rating1Percent !== rating1Percent) changes.rating1Percent = { from: oldConfig.rating1Percent, to: rating1Percent };
      if (oldConfig.rating2Percent !== rating2Percent) changes.rating2Percent = { from: oldConfig.rating2Percent, to: rating2Percent };
      if (oldConfig.rating3Percent !== rating3Percent) changes.rating3Percent = { from: oldConfig.rating3Percent, to: rating3Percent };
      if (oldConfig.rating4Percent !== rating4Percent) changes.rating4Percent = { from: oldConfig.rating4Percent, to: rating4Percent };
      if (oldConfig.rating5Percent !== rating5Percent) changes.rating5Percent = { from: oldConfig.rating5Percent, to: rating5Percent };
      if (oldConfig.age15_24Percent !== age15_24Percent) changes.age15_24Percent = { from: oldConfig.age15_24Percent, to: age15_24Percent };
      if (oldConfig.age25_34Percent !== age25_34Percent) changes.age25_34Percent = { from: oldConfig.age25_34Percent, to: age25_34Percent };
      if (oldConfig.age35_49Percent !== age35_49Percent) changes.age35_49Percent = { from: oldConfig.age35_49Percent, to: age35_49Percent };
      if (oldConfig.age50PlusPercent !== age50PlusPercent) changes.age50PlusPercent = { from: oldConfig.age50PlusPercent, to: age50PlusPercent };
      if (oldConfig.enabledScenarios !== JSON.stringify(enabledScenarios)) changes.enabledScenarios = { from: JSON.parse(oldConfig.enabledScenarios), to: enabledScenarios };
      if (oldConfig.scenarioVariants !== JSON.stringify(scenarioVariants)) changes.scenarioVariants = { from: JSON.parse(oldConfig.scenarioVariants), to: scenarioVariants };
      if (oldConfig.exactOrderPercent !== exactOrderPercent) changes.exactOrderPercent = { from: oldConfig.exactOrderPercent, to: exactOrderPercent };
      if (oldConfig.problemEncounteredPercent !== problemEncounteredPercent) changes.problemEncounteredPercent = { from: oldConfig.problemEncounteredPercent, to: problemEncounteredPercent };
    } else {
      changes.created = true;
    }

    // Save change log
    await prisma.configChangeLog.create({
      data: {
        restaurantId,
        userId: user.id,
        changes: JSON.stringify(changes)
      }
    });

    // Parse JSON fields for response
    const response = {
      ...config,
      enabledScenarios: JSON.parse(config.enabledScenarios),
      scenarioVariants: JSON.parse(config.scenarioVariants)
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error updating restaurant config:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// Reset to default configuration
router.post('/:restaurantId/reset', authenticate, requireAdmin, async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const config = await prisma.restaurantConfig.upsert({
      where: { restaurantId },
      create: { restaurantId },
      update: {
        rating1Percent: 0,
        rating2Percent: 0,
        rating3Percent: 10,
        rating4Percent: 20,
        rating5Percent: 70,
        age15_24Percent: 10,
        age25_34Percent: 50,
        age35_49Percent: 30,
        age50PlusPercent: 10,
        enabledScenarios: JSON.stringify(['BORNE', 'COMPTOIR', 'DRIVE']),
        scenarioVariants: JSON.stringify({}),
        exactOrderPercent: 100
      },
      include: { restaurant: { select: { code: true, name: true } } }
    });

    const response = {
      ...config,
      enabledScenarios: JSON.parse(config.enabledScenarios),
      scenarioVariants: JSON.parse(config.scenarioVariants)
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error resetting restaurant config:', error);
    res.status(500).json({ error: 'Failed to reset configuration' });
  }
});

// Get configuration change history
router.get('/:restaurantId/history', authenticate, async (req: AuthRequest, res) => {
  try {
    const { restaurantId } = req.params;
    const user = req.user!;

    // Check if user has access to this restaurant
    if (user.role !== 'ADMIN') {
      const access = await prisma.restaurantAccess.findFirst({
        where: { userId: user.id, restaurantId }
      });
      if (!access) {
        return res.status(403).json({ error: 'Access denied to this restaurant' });
      }
    }

    const history = await prisma.configChangeLog.findMany({
      where: { restaurantId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50 // Limit to last 50 changes
    });

    // Parse JSON changes
    const response = history.map(log => ({
      ...log,
      changes: JSON.parse(log.changes)
    }));

    res.json(response);
  } catch (error: any) {
    console.error('Error fetching config history:', error);
    res.status(500).json({ error: 'Failed to fetch configuration history' });
  }
});

export default router;
