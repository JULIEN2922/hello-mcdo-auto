/**
 * Inspecter la configuration du restaurant 1318
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspectRestaurant() {
  console.log('🔍 Inspection du restaurant 1318 (SOYONS)');
  console.log('═══════════════════════════════════════════\n');

  // Find restaurant by code
  const restaurant = await prisma.restaurant.findUnique({
    where: { code: '1318' }
  });

  if (!restaurant) {
    console.log('❌ Restaurant 1318 non trouvé !');
    return;
  }

  console.log('🏪 Restaurant:');
  console.log(`   ID: ${restaurant.id}`);
  console.log(`   Code: ${restaurant.code}`);
  console.log(`   Nom: ${restaurant.name}`);
  console.log(`   Ville: ${restaurant.city}`);
  console.log();

  // Find config
  const config = await prisma.restaurantConfig.findUnique({
    where: { restaurantId: restaurant.id }
  });

  if (!config) {
    console.log('⚠️  Aucune configuration trouvée');
    console.log('   → Les valeurs par défaut seront utilisées');
    console.log('   → rating par défaut = 1 (excellent)');
    return;
  }

  console.log('⚙️  Configuration:');
  console.log(`   Concurrency: ${config.concurrency}`);
  console.log(`   Delays: ${config.delayMinSeconds}-${config.delayMaxSeconds}s`);
  console.log(`   Headless: ${config.headless}`);
  console.log(`   Tor: ${config.useTor}`);
  console.log();

  console.log('📊 Distributions:');
  console.log();
  
  // Rating distribution (directly in columns)
  const hasRatingConfig = (config.rating1Percent || 0) + (config.rating2Percent || 0) + 
                          (config.rating3Percent || 0) + (config.rating4Percent || 0) + 
                          (config.rating5Percent || 0) > 0;
  
  if (hasRatingConfig) {
    console.log('   Ratings (1=excellent, 5=très mauvais):');
    console.log(`     - Rating 1 (⭐⭐⭐⭐⭐): ${config.rating1Percent || 0}%`);
    console.log(`     - Rating 2 (⭐⭐⭐⭐):   ${config.rating2Percent || 0}%`);
    console.log(`     - Rating 3 (⭐⭐⭐):     ${config.rating3Percent || 0}%`);
    console.log(`     - Rating 4 (⭐⭐):       ${config.rating4Percent || 0}%`);
    console.log(`     - Rating 5 (⭐):         ${config.rating5Percent || 0}%`);
    
    const total = (config.rating1Percent || 0) + (config.rating2Percent || 0) + 
                  (config.rating3Percent || 0) + (config.rating4Percent || 0) + 
                  (config.rating5Percent || 0);
    console.log(`     TOTAL: ${total}%`);
    console.log();
  } else {
    console.log('   ⚠️  Ratings: Non configurés → Valeur par défaut = 1 (excellent)');
    console.log();
  }
  
  // Enabled scenarios
  if (config.enabledScenarios) {
    const enabled = JSON.parse(config.enabledScenarios as string);
    console.log('   Scénarios activés:');
    console.log(`     ${enabled.join(', ')}`);
    console.log();
  } else {
    console.log('   ⚠️  Scénarios: Non configurés');
    console.log();
  }

  // Age distribution (directly in columns)
  const hasAgeConfig = (config.age15_24Percent || 0) + (config.age25_34Percent || 0) + 
                       (config.age35_49Percent || 0) + (config.age50PlusPercent || 0) > 0;
  
  if (hasAgeConfig) {
    console.log('   Âges:');
    console.log(`     - 15-24 ans: ${config.age15_24Percent || 0}%`);
    console.log(`     - 25-34 ans: ${config.age25_34Percent || 0}%`);
    console.log(`     - 35-49 ans: ${config.age35_49Percent || 0}%`);
    console.log(`     - 50+ ans:   ${config.age50PlusPercent || 0}%`);
    console.log();
  } else {
    console.log('   ⚠️  Âges: Non configurés');
    console.log();
  }

  console.log(`   Commande exacte: ${config.exactOrderPercent || 'Non configuré (défaut: true)'}%`);
  console.log(`   Problème rencontré: ${config.problemEncounteredPercent || 'Non configuré (défaut: false)'}%`);
  console.log();

  console.log('✅ Inspection terminée');
}

inspectRestaurant()
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
