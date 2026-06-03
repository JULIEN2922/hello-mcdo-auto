/**
 * Corriger la configuration du restaurant 1318 - Mettre rating1 = 100% (excellent)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixRestaurantConfig() {
  console.log('🔧 Correction de la configuration du restaurant 1318');
  console.log('═════════════════════════════════════════════════════════\n');

  // Find restaurant by code
  const restaurant = await prisma.restaurant.findUnique({
    where: { code: '1318' }
  });

  if (!restaurant) {
    console.log('❌ Restaurant 1318 non trouvé !');
    return;
  }

  console.log(`🏪 Restaurant: ${restaurant.name} (#${restaurant.code})\n`);

  // Update config
  const config = await prisma.restaurantConfig.upsert({
    where: { restaurantId: restaurant.id },
    update: {
      rating1Percent: 100,  // ✅ 100% excellent (⭐⭐⭐⭐⭐)
      rating2Percent: 0,
      rating3Percent: 0,
      rating4Percent: 0,
      rating5Percent: 0,    // ✅ 0% très mauvais (⭐)
    },
    create: {
      restaurantId: restaurant.id,
      rating1Percent: 100,
      rating2Percent: 0,
      rating3Percent: 0,
      rating4Percent: 0,
      rating5Percent: 0,
      concurrency: 10,
      delayMinSeconds: 2,
      delayMaxSeconds: 30,
      headless: true,
      useTor: false,
      exactOrderPercent: 100,
      problemEncounteredPercent: 0
    }
  });

  console.log('✅ Configuration mise à jour:');
  console.log(`   Rating 1 (⭐⭐⭐⭐⭐ Excellent):  ${config.rating1Percent}%`);
  console.log(`   Rating 2 (⭐⭐⭐⭐ Très bon):    ${config.rating2Percent}%`);
  console.log(`   Rating 3 (⭐⭐⭐ Moyen):         ${config.rating3Percent}%`);
  console.log(`   Rating 4 (⭐⭐ Mauvais):         ${config.rating4Percent}%`);
  console.log(`   Rating 5 (⭐ Très mauvais):     ${config.rating5Percent}%`);
  console.log();
  console.log('✅ Maintenant les scénarios seront tous en mode EXCELLENT !');
}

fixRestaurantConfig()
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
