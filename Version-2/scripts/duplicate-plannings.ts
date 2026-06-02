import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DAYS = ['TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

async function duplicateMondayPlannings() {
  try {
    // Get all MONDAY plannings
    const mondayPlannings = await prisma.planning.findMany({
      where: {
        dayOfWeek: 'MONDAY'
      }
    });

    if (mondayPlannings.length === 0) {
      console.log('❌ No MONDAY plannings found');
      return;
    }

    console.log(`✅ Found ${mondayPlannings.length} MONDAY planning(s)`);
    
    for (const mondayPlanning of mondayPlannings) {
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: mondayPlanning.restaurantId }
      });

      console.log(`\n📋 Duplicating planning for: ${restaurant?.name}`);
      console.log(`   Time slot: ${mondayPlanning.startTime} - ${mondayPlanning.endTime}`);
      console.log(`   Scenarios: ${mondayPlanning.minScenarios} - ${mondayPlanning.maxScenarios}`);

      for (const day of DAYS) {
        // Check if planning already exists for this day
        const existing = await prisma.planning.findFirst({
          where: {
            restaurantId: mondayPlanning.restaurantId,
            dayOfWeek: day,
            startTime: mondayPlanning.startTime,
            endTime: mondayPlanning.endTime
          }
        });

        if (existing) {
          console.log(`   ⏭️  ${day}: already exists, skipping`);
          continue;
        }

        // Create new planning
        await prisma.planning.create({
          data: {
            restaurantId: mondayPlanning.restaurantId,
            dayOfWeek: day,
            startTime: mondayPlanning.startTime,
            endTime: mondayPlanning.endTime,
            minScenarios: mondayPlanning.minScenarios,
            maxScenarios: mondayPlanning.maxScenarios,
            active: mondayPlanning.active
          }
        });

        console.log(`   ✅ ${day}: created`);
      }
    }

    console.log('\n🎉 Duplication complete!');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

duplicateMondayPlannings();
