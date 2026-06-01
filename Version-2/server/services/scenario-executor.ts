import puppeteer, { Browser, Page } from 'puppeteer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ScenarioConfig {
  restaurantId: string;
  restaurantCode: string;
  location: string;
  consumptionType: string;
  pickupLocation: string;
  age?: string;
  rating: number;
  detailedNotes?: any;
  exactOrder: boolean;
  problemEncountered: boolean;
  delayMin: number;
  delayMax: number;
  headless: boolean;
}

interface ExecutionResult {
  success: boolean;
  scenarioName: string;
  durationMs?: number;
  error?: string;
}

// Utility functions
async function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function randomWait(minSec: number, maxSec: number): Promise<void> {
  const delay = Math.random() * (maxSec - minSec) + minSec;
  await wait(delay * 1000);
}

async function clickNext(page: Page): Promise<void> {
  try {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {}),
      page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
        const nextButton = buttons.find(b => b.textContent?.includes('Suivant'));
        nextButton?.click();
      })
    ]);
    await wait(1000);
  } catch (error) {
    // If no navigation happens, just wait a bit
    await wait(1000);
  }
}

/**
 * Get current date and time formatted for the form
 */
function getDateTimeNow(): { date: string; hour: string; minute: string } {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const date = `${day}/${month}/${year}`;
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  
  return { date, hour, minute };
}

/**
 * Execute a single scenario
 */
export async function executeScenario(
  config: ScenarioConfig
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const scenarioName = `${config.restaurantCode}_${config.location}_${config.consumptionType}_${config.pickupLocation}`;
  
  let browser: Browser | null = null;
  
  try {
    console.log(`🎯 Starting scenario: ${scenarioName}`);
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to form
    const url = 'https://survey2.medallia.eu/?hellomcdo';
    console.log(`📄 Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    await randomWait(config.delayMin, config.delayMax);
    
    // Step 1: Click Begin button
    console.log('📄 Step 1: Starting survey...');
    await page.waitForSelector('#buttonBegin', { timeout: 10000 });
    await page.click('#buttonBegin');
    await wait(2000);
    await randomWait(config.delayMin, config.delayMax);
    
    // Step 2: Age selection
    const ageIndex = getAgeIndex(config.age || '25-34');
    console.log(`📄 Step 2: Age selection (${config.age})...`);
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await page.evaluate((index) => {
      const radios = document.querySelectorAll('input[type="radio"]');
      (radios[index] as HTMLInputElement)?.click();
    }, ageIndex);
    await wait(1000);
    await randomWait(config.delayMin, config.delayMax);
    await clickNext(page);
    
    // Step 3: Ticket information
    console.log('📄 Step 3: Ticket information...');
    const { date, hour, minute } = getDateTimeNow();
    
    await page.waitForSelector('#cal_q_mc_q_date_', { timeout: 10000 });
    await wait(500);
    await page.type('#cal_q_mc_q_date_', date);
    await wait(500);
    await randomWait(config.delayMin, config.delayMax);
    
    await page.type('#spl_rng_q_mc_q_hour', hour);
    await wait(500);
    await randomWait(config.delayMin, config.delayMax);
    
    await page.type('#spl_rng_q_mc_q_minute', minute);
    await wait(500);
    await randomWait(config.delayMin, config.delayMax);
    
    await page.type('#spl_rng_q_mc_q_idrestaurant', config.restaurantCode);
    await wait(500);
    await randomWait(config.delayMin, config.delayMax);
    
    await clickNext(page);
    
    // Step 4: Order location
    console.log(`📄 Step 4: Order location (${config.location})...`);
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await wait(500);
    
    const locationIndex = getLocationIndex(config.location);
    await page.evaluate((index) => {
      const radios = document.querySelectorAll('input[type="radio"]');
      (radios[index] as HTMLInputElement)?.click();
    }, locationIndex);
    await wait(1000);
    await randomWait(config.delayMin, config.delayMax);
    await clickNext(page);
    
    // Step 5: Consumption type
    console.log(`📄 Step 5: Consumption type (${config.consumptionType})...`);
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await wait(500);
    const consumptionIndex = getConsumptionTypeIndex(config.consumptionType);
    await page.evaluate((index) => {
      const radios = document.querySelectorAll('input[type="radio"]');
      (radios[index] as HTMLInputElement)?.click();
    }, consumptionIndex);
    await wait(1000);
    await randomWait(config.delayMin, config.delayMax);
    await clickNext(page);
    
    // Step 6: Pickup location
    console.log(`📄 Step 6: Pickup location (${config.pickupLocation})...`);
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await wait(500);
    const pickupIndex = getPickupLocationIndex(config.pickupLocation);
    await page.evaluate((index) => {
      const radios = document.querySelectorAll('input[type="radio"]');
      (radios[index] as HTMLInputElement)?.click();
    }, pickupIndex);
    await wait(1000);
    await randomWait(config.delayMin, config.delayMax);
    await clickNext(page);
    
    // Step 7: Overall satisfaction rating
    console.log(`📄 Step 7: Overall satisfaction (${config.rating}/5)...`);
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await wait(500);
    await page.evaluate((rating) => {
      const radio = document.querySelector(`input[type="radio"][value="${rating}"]`) as HTMLInputElement;
      radio?.click();
    }, config.rating);
    await wait(1000);
    await randomWait(config.delayMin, config.delayMax);
    await clickNext(page);
    
    // Step 8: Detailed dimensions rating
    console.log(`📄 Step 8: Detailed dimensions (all ${config.rating}/5)...`);
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await wait(500);
    await page.evaluate((rating) => {
      const radios = document.querySelectorAll(`input[type="radio"][value="${rating}"]`);
      radios.forEach((r: any) => r.click());
    }, config.rating);
    await wait(1000);
    await randomWait(config.delayMin, config.delayMax);
    await clickNext(page);
    
    // Step 9: Exact order
    console.log(`📄 Step 9: Exact order (${config.exactOrder ? 'Yes' : 'No'})...`);
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await wait(500);
    await page.evaluate((isExact) => {
      const radios = document.querySelectorAll('input[type="radio"]');
      (radios[isExact ? 0 : 1] as HTMLInputElement)?.click();
    }, config.exactOrder);
    await wait(1000);
    await randomWait(config.delayMin, config.delayMax);
    await clickNext(page);
    
    // Step 10: Problem encountered
    console.log(`📄 Step 10: Problem encountered (${config.problemEncountered ? 'Yes' : 'No'})...`);
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await wait(500);
    await page.evaluate((hasProblem) => {
      const radios = document.querySelectorAll('input[type="radio"]');
      (radios[hasProblem ? 0 : 1] as HTMLInputElement)?.click();
    }, config.problemEncountered);
    await wait(1000);
    await randomWait(config.delayMin, config.delayMax);
    await clickNext(page);
    
    // Step 11: Phone contact (always No)
    console.log('📄 Step 11: Phone contact (No)...');
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await wait(500);
    await page.evaluate(() => {
      const radios = document.querySelectorAll('input[type="radio"]');
      (radios[1] as HTMLInputElement)?.click(); // No
    });
    await wait(1000);
    await randomWait(config.delayMin, config.delayMax);
    await clickNext(page);
    
    // Wait for completion
    await wait(2000);
    
    const durationMs = Date.now() - startTime;
    console.log(`✅ Scenario completed in ${(durationMs / 1000).toFixed(1)}s`);
    
    await browser.close();
    
    return {
      success: true,
      scenarioName,
      durationMs
    };
    
  } catch (error: any) {
    console.error(`❌ Scenario failed: ${error.message}`);
    
    if (browser) {
      await browser.close();
    }
    
    return {
      success: false,
      scenarioName,
      error: error.message
    };
  }
}

/**
 * Execute multiple scenarios with concurrency control
 */
export async function executeScenarios(
  scenarios: ScenarioConfig[],
  concurrency: number = 1
): Promise<ExecutionResult[]> {
  console.log(`\n🚀 Starting execution of ${scenarios.length} scenarios with concurrency ${concurrency}`);
  
  const results: ExecutionResult[] = [];
  const executing: Promise<void>[] = [];
  
  for (const [index, scenario] of scenarios.entries()) {
    const promise = (async () => {
      console.log(`\n[${index + 1}/${scenarios.length}] 🔄 Starting scenario...`);
      const result = await executeScenario(scenario);
      results.push(result);
      console.log(`[${index + 1}/${scenarios.length}] ${result.success ? '✅' : '❌'} Completed`);
    })();
    
    executing.push(promise);
    
    // Wait if concurrency limit reached
    if (executing.length >= concurrency) {
      await Promise.race(executing.map(p => p.catch(() => {})));
      const completed = executing.filter(p => {
        return Promise.race([p, Promise.resolve('pending')]).then(v => v !== 'pending');
      });
      completed.forEach(p => executing.splice(executing.indexOf(p), 1));
    }
  }
  
  // Wait for all remaining
  await Promise.all(executing.map(p => p.catch(() => {})));
  
  const success = results.filter(r => r.success).length;
  const failed = results.length - success;
  
  console.log(`\n📊 Execution complete: ${success} success, ${failed} failed`);
  
  return results;
}

/**
 * Generate scenarios based on restaurant config and planning
 */
export async function generateScenarios(
  restaurantId: string,
  count: number
): Promise<ScenarioConfig[]> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: { config: true }
  });
  
  if (!restaurant || !restaurant.config) {
    throw new Error('Restaurant or config not found');
  }
  
  const config = restaurant.config;
  const scenarios: ScenarioConfig[] = [];
  
  // Parse enabled scenarios
  const enabledScenarios = JSON.parse(config.enabledScenarios || '["BORNE", "COMPTOIR", "DRIVE"]') as string[];
  const scenarioVariants = JSON.parse(config.scenarioVariants || '{}') as any;
  
  // Check if we have enabled scenarios
  if (!enabledScenarios || enabledScenarios.length === 0) {
    throw new Error('No enabled scenarios configured for this restaurant');
  }
  
  for (let i = 0; i < count; i++) {
    // Random location
    const location = enabledScenarios[Math.floor(Math.random() * enabledScenarios.length)];
    
    // Get variants for this location
    const variants = scenarioVariants[location] || {};
    const consumptionTypes = variants.consumptionTypes || ['SUR_PLACE', 'A_EMPORTER'];
    const pickupLocations = variants.pickupLocations || ['COMPTOIR', 'TABLE'];
    
    // Random consumption type and pickup location
    const consumptionType = consumptionTypes[
      Math.floor(Math.random() * consumptionTypes.length)
    ];
    const pickupLocation = pickupLocations[
      Math.floor(Math.random() * pickupLocations.length)
    ];
    
    // Random rating based on distribution
    const rating = getRandomRating(config);
    
    // Random age based on distribution
    const age = getRandomAge(config);
    
    // Exact order
    const exactOrder = Math.random() * 100 < config.exactOrderPercent;
    
    // Problem encountered
    const problemEncountered = Math.random() * 100 < config.problemEncounteredPercent;
    
    scenarios.push({
      restaurantId: restaurant.id,
      restaurantCode: restaurant.code,
      location,
      consumptionType,
      pickupLocation,
      age,
      rating,
      detailedNotes: generateDetailedNotes(rating),
      exactOrder,
      problemEncountered,
      delayMin: config.delayMinSeconds,
      delayMax: config.delayMaxSeconds,
      headless: config.headless
    });
  }
  
  return scenarios;
}

// Helper functions
function getAgeIndex(age: string): number {
  const map: Record<string, number> = {
    '<15': 0,
    '15-24': 1,
    '25-34': 2,
    '35-49': 3,
    '50+': 4
  };
  return map[age] || 2; // Default to 25-34
}

function getLocationIndex(location: string): number {
  const map: Record<string, number> = {
    'BORNE': 0,
    'COMPTOIR': 1,
    'DRIVE': 2,
    'GUICHET': 3,
    'MCCAFE': 4,
    'CLICK_COLLECT_APP': 5,
    'CLICK_COLLECT_WEB': 6,
    'LIVRAISON': 7,
    'TABLETTE': 8
  };
  return map[location] || 0;
}

function getConsumptionTypeIndex(type: string): number {
  const map: Record<string, number> = {
    'SUR_PLACE': 0,
    'A_EMPORTER': 1
  };
  return map[type] || 0;
}

function getPickupLocationIndex(location: string): number {
  const map: Record<string, number> = {
    'COMPTOIR': 0,
    'MCDRIVE': 1,
    'TABLE': 2,
    'MCCAFE': 3,
    'GUICHET_EXTERIEUR': 4,
    'EXTERIEUR': 5
  };
  return map[location] || 0;
}

function getRandomRating(config: any): number {
  const random = Math.random() * 100;
  let cumulative = 0;
  
  const ratings = [
    { rating: 1, percent: config.rating1Percent },
    { rating: 2, percent: config.rating2Percent },
    { rating: 3, percent: config.rating3Percent },
    { rating: 4, percent: config.rating4Percent },
    { rating: 5, percent: config.rating5Percent }
  ];
  
  for (const { rating, percent } of ratings) {
    cumulative += percent;
    if (random <= cumulative) {
      return rating;
    }
  }
  
  return 5; // Default to 5
}

function getRandomAge(config: any): string {
  const random = Math.random() * 100;
  let cumulative = 0;
  
  const ages = [
    { age: '15-24', percent: config.age15_24Percent },
    { age: '25-34', percent: config.age25_34Percent },
    { age: '35-49', percent: config.age35_49Percent },
    { age: '50+', percent: config.age50PlusPercent }
  ];
  
  for (const { age, percent } of ages) {
    cumulative += percent;
    if (random <= cumulative) {
      return age;
    }
  }
  
  return '25-34'; // Default
}

function generateDetailedNotes(rating: number): any {
  // Generate notes based on rating
  const baseNote = rating;
  return {
    service: baseNote,
    cleanliness: baseNote,
    speed: baseNote,
    quality: baseNote,
    value: baseNote
  };
}
