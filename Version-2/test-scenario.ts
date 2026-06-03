/**
 * Script de test pour lancer 1 scénario en mode debug
 * Usage: npm run test:scenario <restaurantId>
 * Exemple: npm run test:scenario 1001
 */

import { PrismaClient } from '@prisma/client';
import { generateScenarios, executeScenarios } from './server/services/scenario-executor.js';

const prisma = new PrismaClient();

async function testScenario(restaurantIdArg?: string) {
  try {
    // Get restaurant ID from command line or use default
    const restaurantId = restaurantIdArg || process.argv[2] || '1001';
    
    console.log('🎯 Test Scenario - Mode Debug');
    console.log('═══════════════════════════════════════\n');

    // Fetch restaurant
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId }
    });

    if (!restaurant) {
      console.error(`❌ Restaurant not found: ${restaurantId}`);
      console.log('\n📋 Available restaurants:');
      const restaurants = await prisma.restaurant.findMany();
      restaurants.forEach(r => {
        console.log(`   - ${r.code} (${r.name}) - ID: ${r.id}`);
      });
      process.exit(1);
    }

    console.log(`🏪 Restaurant: ${restaurant.name} (#${restaurant.code})`);

    // Fetch restaurant config
    let config = await prisma.restaurantConfig.findUnique({
      where: { restaurantId }
    });

    if (!config) {
      console.log('⚠️  No config found, using defaults...');
      config = await prisma.restaurantConfig.create({
        data: {
          restaurantId,
          concurrency: 1,
          delayMinSeconds: 2,
          delayMaxSeconds: 5,
          headless: false, // Mode debug = voir le navigateur
          useTor: false
        }
      });
    }

    // Force debug mode (non-headless)
    const debugConfig = {
      ...config,
      headless: false, // Toujours visible en mode debug
      delayMinSeconds: 1, // Délais plus courts pour tester
      delayMaxSeconds: 3
    };

    console.log('\n⚙️  Configuration:');
    console.log(`   - Concurrency: ${debugConfig.concurrency}`);
    console.log(`   - Delays: ${debugConfig.delayMinSeconds}-${debugConfig.delayMaxSeconds}s`);
    console.log(`   - Headless: ${debugConfig.headless} (forced for debug)`);
    console.log(`   - Tor: ${debugConfig.useTor}`);

    // Enabled scenarios
    if (config.enabledScenarios) {
      const enabled = JSON.parse(config.enabledScenarios as string);
      console.log('\n📊 Enabled Scenarios:');
      console.log(`   ${enabled.join(', ')}`);
    } else {
      console.log('\n⚠️  No scenarios configured');
    }

    // Rating distribution (directly in columns)
    const hasRatingConfig = (config.rating1Percent || 0) + (config.rating2Percent || 0) + 
                            (config.rating3Percent || 0) + (config.rating4Percent || 0) + 
                            (config.rating5Percent || 0) > 0;
    
    if (hasRatingConfig) {
      console.log(`\n⭐ Rating Distribution (1=excellent ⭐⭐⭐⭐⭐, 5=très mauvais ⭐):`);
      console.log(`   - Rating 1 (⭐⭐⭐⭐⭐): ${config.rating1Percent || 0}%`);
      console.log(`   - Rating 2 (⭐⭐⭐⭐):   ${config.rating2Percent || 0}%`);
      console.log(`   - Rating 3 (⭐⭐⭐):     ${config.rating3Percent || 0}%`);
      console.log(`   - Rating 4 (⭐⭐):       ${config.rating4Percent || 0}%`);
      console.log(`   - Rating 5 (⭐):         ${config.rating5Percent || 0}%`);
      const total = (config.rating1Percent || 0) + (config.rating2Percent || 0) + 
                    (config.rating3Percent || 0) + (config.rating4Percent || 0) + 
                    (config.rating5Percent || 0);
      console.log(`   - TOTAL: ${total}%`);
    } else {
      console.log(`\n⚠️  No rating distributions configured → Default = 1 (excellent)`);
    }

    // Age distribution (directly in columns)
    const hasAgeConfig = (config.age15_24Percent || 0) + (config.age25_34Percent || 0) + 
                         (config.age35_49Percent || 0) + (config.age50PlusPercent || 0) > 0;
    
    if (hasAgeConfig) {
      console.log(`\n👤 Age Distribution:`);
      console.log(`   - 15-24 ans: ${config.age15_24Percent || 0}%`);
      console.log(`   - 25-34 ans: ${config.age25_34Percent || 0}%`);
      console.log(`   - 35-49 ans: ${config.age35_49Percent || 0}%`);
      console.log(`   - 50+ ans:   ${config.age50PlusPercent || 0}%`);
      const total = (config.age15_24Percent || 0) + (config.age25_34Percent || 0) + 
                    (config.age35_49Percent || 0) + (config.age50PlusPercent || 0);
      console.log(`   - TOTAL: ${total}%`);
    } else {
      console.log(`\n⚠️  No age distributions configured`);
    }
    
    console.log('\n🚀 Launching 1 test scenario...');
    console.log('═══════════════════════════════════════\n');

    // Generate 1 scenario
    const scenarios = await generateScenarios(restaurantId, 1);
    
    // Force debug mode settings (non-headless, shorter delays)
    scenarios.forEach(s => {
      s.headless = false; // Always visible in debug mode
      s.delayMin = 1;
      s.delayMax = 3;
    });
    
    // Execute with concurrency = 1 (debug mode)
    const results = await executeScenarios(scenarios, 1);

    console.log('\n═══════════════════════════════════════');
    console.log('📊 Test Results:');
    console.log(`   - Success: ${results.filter(r => r.success).length}`);
    console.log(`   - Failed: ${results.filter(r => !r.success).length}`);

    if (results.length > 0) {
      const result = results[0];
      console.log('\n📋 Scenario Details:');
      console.log(`   - Name: ${result.scenarioName}`);
      console.log(`   - Success: ${result.success ? '✅' : '❌'}`);
      console.log(`   - Duration: ${result.duration || 'N/A'}`);
      if (result.usedTor) {
        console.log(`   - Tor: ✅ ${result.ipAddress} (${result.ipCountry})`);
      }
      if (result.error) {
        console.log(`   - Error: ${result.error}`);
      }
    }

    console.log('\n✅ Test complete!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  testScenario();
}

export { testScenario };
