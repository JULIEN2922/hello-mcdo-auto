import puppeteer, { Browser, Page } from 'puppeteer';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { renewTorIP, getTorProxyArgs, checkTorConnection, verifyFrenchIP, startTor, isTorRunning, isIPv6 } from './tor-manager.js';

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
  useTor: boolean;
}

interface ExecutionResult {
  success: boolean;
  scenarioName: string;
  durationMs?: number;
  error?: string;
  usedTor?: boolean;
  ipAddress?: string;
  ipCountry?: string;
}

// Utility functions
async function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function randomWait(minSec: number, maxSec: number): Promise<void> {
  const delay = Math.random() * (maxSec - minSec) + minSec;
  await wait(delay * 1000);
}

async function clickNext(page: Page): Promise<boolean> {
  await wait(500);
  const result = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
    const nextButton = buttons.find(b => b.textContent?.includes('Suivant'));
    if (nextButton) {
      nextButton.click();
      return true;
    }
    return false;
  });
  
  if (result) {
    // Wait for DOM to stabilize after SPA transition
    // First, a short wait for the click to register
    await wait(1500);
    // Then wait for any network requests triggered by the transition to settle
    try {
      await page.waitForNetworkIdle({ timeout: 15000, idleTime: 1000 });
    } catch {
      // network idle timeout is OK - page may not have triggered requests
    }
  }
  return result;
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
  let ipAddress: string | undefined;
  let ipCountry: string | undefined;
  
  try {
    console.log(`🎯 Starting scenario: ${scenarioName}`);
    
    // Check Tor connection if enabled
    if (config.useTor) {
      // Start Tor if not running
      if (!isTorRunning()) {
        console.log('🚀 Starting Tor daemon automatically...');
        await startTor();
      }
      
      const torRunning = await checkTorConnection();
      if (!torRunning) {
        throw new Error('Tor failed to start. Please check logs.');
      }
      
      // Renew IP until we get IPv4 (max 5 attempts)
      let ipInfo;
      let attempts = 0;
      const maxAttempts = 5;
      
      while (attempts < maxAttempts) {
        ipInfo = await verifyFrenchIP();
        
        if (!isIPv6(ipInfo.ip)) {
          // Got IPv4, we're good!
          break;
        }
        
        attempts++;
        console.log(`⚠️  Got IPv6 address (${ipInfo.ip}), renewing circuit (attempt ${attempts}/${maxAttempts})...`);
        await renewTorIP();
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s for new circuit (Tor rate limit)
      }
      
      if (!ipInfo || isIPv6(ipInfo.ip)) {
        throw new Error(`Failed to obtain IPv4 address after ${maxAttempts} attempts. Last IP: ${ipInfo?.ip}`);
      }
      
      ipAddress = ipInfo.ip;
      ipCountry = ipInfo.country;
      console.log(`✅ Using IPv4: ${ipAddress} (${ipCountry})`);
      
      if (!ipInfo.isFrench) {
        console.warn(`⚠️  Warning: IP is not French (${ipCountry}). Continuing anyway...`);
      }
    }
    
    // Launch browser with chrome-libs path for shared libraries
    const chromeLibsPath = path.join(process.env.HOME || '/home/container', 'chrome-libs');
    const launchEnv: Record<string, string> = {};
    
    // Always prepend chrome-libs to LD_LIBRARY_PATH if the directory exists
    if (fs.existsSync(chromeLibsPath)) {
      const existingLdPath = process.env.LD_LIBRARY_PATH || '';
      launchEnv.LD_LIBRARY_PATH = existingLdPath 
        ? `${chromeLibsPath}:${existingLdPath}` 
        : chromeLibsPath;
      console.log(`📚 Using Chrome libs from: ${chromeLibsPath}`);
    } else {
      console.warn(`⚠️  Chrome libs not found at ${chromeLibsPath}. Run: npm run install:deps`);
    }
    
    const launchArgs = ['--no-sandbox', '--disable-setuid-sandbox'];
    if (config.useTor) {
      launchArgs.push(...getTorProxyArgs());
      launchArgs.push('--disable-ipv6'); // Force IPv4 only in browser
    }
    
    browser = await puppeteer.launch({
      headless: config.headless,
      args: launchArgs,
      env: launchEnv
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to form (longer timeout for Tor)
    const url = 'https://survey2.medallia.eu/?hellomcdo';
    const navigationTimeout = config.useTor ? 120000 : 60000; // 2 minutes with Tor, 1 minute without
    console.log(`📄 Navigating to: ${url}${config.useTor ? ' (via Tor, may take longer)' : ''}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: navigationTimeout });
    
    await randomWait(config.delayMin, config.delayMax);
    
    // Step 1: Click Begin button
    console.log('📄 Step 1: Starting survey...');
    await page.waitForSelector('#buttonBegin', { timeout: 10000 });
    await page.click('#buttonBegin');
    // Wait for SPA transition to load Step 2 (cold start may be slow)
    try {
      await page.waitForNetworkIdle({ timeout: 20000, idleTime: 1000 });
    } catch {
      // network idle timeout is OK - continue anyway
    }
    await wait(2000);
    await randomWait(config.delayMin, config.delayMax);
    
    // Step 2: Age selection
    const ageIndex = getAgeIndex(config.age || '25-34');
    console.log(`📄 Step 2: Age selection (${config.age})...`);
    await page.waitForSelector('input[type="radio"]', { timeout: 30000 });
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
    // Note: 1=excellent (5 stars visual), 5=very bad (1 star visual)
    console.log(`📄 Step 7: Overall satisfaction (${config.rating}/5)...`);
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await wait(500);
    
    // DEBUG: Inspect all radio values
    const radioValues = await page.evaluate(() => {
      const radios = document.querySelectorAll('input[type="radio"]');
      return Array.from(radios).map((r, i) => ({
        index: i,
        value: (r as HTMLInputElement).value,
        name: (r as HTMLInputElement).name
      }));
    });
    console.log(`   📊 Available radios: ${radioValues.map(r => `[${r.index}]=value"${r.value}"`).join(', ')}`);
    console.log(`   🎯 Looking for radio with value="${config.rating}"`);
    
    const clicked = await page.evaluate((rating) => {
      const radio = document.querySelector(`input[type="radio"][value="${rating}"]`) as HTMLInputElement;
      if (radio) {
        radio.click();
        return true;
      }
      return false;
    }, config.rating);
    console.log(`   ${clicked ? '✅ Clicked' : '❌ NOT FOUND'}`);
    await wait(1000);
    await randomWait(config.delayMin, config.delayMax);
    await clickNext(page);
    
    // Step 8: Detailed dimensions rating
    // Note: 1=excellent, 5=very bad (same as V1)
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
    
    // Step 11: Phone contact (always No) - LAST STEP
    // Note: Page may close after step 10 if it's actually the last step
    try {
      console.log('📄 Step 11: Phone contact (No)...');
      await page.waitForSelector('input[type="radio"]', { timeout: 5000 });
      await wait(500);
      await page.evaluate(() => {
        const radios = document.querySelectorAll('input[type="radio"]');
        (radios[1] as HTMLInputElement)?.click(); // No
      });
      await wait(1000);
      await randomWait(config.delayMin, config.delayMax);
      
      // Final submission - page may close after this
      await clickNext(page);
      
      // Wait for completion
      await wait(2000);
    } catch (error: any) {
      // If page closed or step 11 doesn't exist, that's OK - form is submitted
      if (error.message?.includes('Target closed') || error.message?.includes('Execution context')) {
        console.log('📄 Step 11: Skipped (form already submitted)');
      } else {
        throw error;
      }
    }
    
    const durationMs = Date.now() - startTime;
    console.log(`✅ Scenario completed in ${(durationMs / 1000).toFixed(1)}s`);
    
    try {
      await browser.close();
    } catch (e) {
      // Browser may already be closed
    }
    
    return {
      success: true,
      scenarioName,
      durationMs,
      usedTor: config.useTor,
      ipAddress,
      ipCountry
    };
    
  } catch (error: any) {
    console.error(`❌ Scenario failed: ${error.message}`);
    
    if (browser) {
      await browser.close();
    }
    
    return {
      success: false,
      scenarioName,
      error: error.message,
      usedTor: config.useTor,
      ipAddress,
      ipCountry
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
      
      // Renew Tor IP before each scenario if enabled
      if (scenario.useTor && index > 0) {
        try {
          await renewTorIP();
        } catch (error) {
          console.warn('⚠️  Failed to renew Tor IP, continuing with current IP');
        }
      }
      
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

  // Check if we have enabled scenarios
  if (!enabledScenarios || enabledScenarios.length === 0) {
    throw new Error('No enabled scenarios configured for this restaurant');
  }
  
  for (let i = 0; i < count; i++) {
    // Random location
    const location = enabledScenarios[Math.floor(Math.random() * enabledScenarios.length)];
    
    // Apply logical rules based on location type
    let consumptionType: string;
    let pickupLocation: string;
    
    switch (location) {
      case 'COMPTOIR':
      case 'BORNE':
      case 'MCCAFE':
      case 'TABLETTE':
        // Ces types peuvent être SUR_PLACE ou A_EMPORTER
        consumptionType = Math.random() > 0.5 ? 'SUR_PLACE' : 'A_EMPORTER';
        
        if (consumptionType === 'SUR_PLACE') {
          // SUR_PLACE → COMPTOIR (60%), MCCAFE (10%), TABLE (30%)
          const rand = Math.random();
          if (rand < 0.6) pickupLocation = 'COMPTOIR';
          else if (rand < 0.7) pickupLocation = 'MCCAFE';
          else pickupLocation = 'TABLE';
        } else {
          // A_EMPORTER → COMPTOIR (80%), MCCAFE (10%), DRIVE (10% pour TABLETTE uniquement)
          if (location === 'TABLETTE' && Math.random() < 0.1) {
            pickupLocation = 'MCDRIVE';
          } else {
            pickupLocation = Math.random() < 0.9 ? 'COMPTOIR' : 'MCCAFE';
          }
        }
        break;
        
      case 'CLICK_COLLECT_APP':
      case 'CLICK_COLLECT_WEB':
        // Click & Collect: pas de consommation, choix direct de récupération
        consumptionType = 'A_EMPORTER'; // Implicite
        // Récupération: COMPTOIR (50%), MCDRIVE (30%), GUICHET_EXTERIEUR (10%), EXTERIEUR (10%)
        const rand = Math.random();
        if (rand < 0.5) pickupLocation = 'COMPTOIR';
        else if (rand < 0.8) pickupLocation = 'MCDRIVE';
        else if (rand < 0.9) pickupLocation = 'GUICHET_EXTERIEUR';
        else pickupLocation = 'EXTERIEUR';
        break;
        
      case 'DRIVE':
        // Drive: pas de choix (questions sautées)
        consumptionType = 'A_EMPORTER'; // Implicite
        pickupLocation = 'MCDRIVE'; // Implicite
        break;
        
      case 'GUICHET_EXTERIEUR':
        // Guichet extérieur: pas de choix (questions sautées)
        consumptionType = 'A_EMPORTER'; // Implicite
        pickupLocation = 'GUICHET_EXTERIEUR'; // Implicite
        break;
        
      case 'LIVRAISON':
        // Livraison: choix de plateforme (UBER_EATS, DELIVEROO, JUST_EAT, MCDO_APP)
        consumptionType = 'A_EMPORTER'; // Implicite
        // Utiliser les plateformes comme pickup location
        const platforms = ['UBER_EATS', 'DELIVEROO', 'JUST_EAT', 'MCDO_APP'];
        pickupLocation = platforms[Math.floor(Math.random() * platforms.length)];
        break;
        
      default:
        // Fallback par défaut
        consumptionType = 'SUR_PLACE';
        pickupLocation = 'COMPTOIR';
    }
    
    // Random rating based on distribution
    const rating = getRandomRating(config);
    
    // Random age based on distribution
    const age = getRandomAge(config);
    
    // Exact order (default true if no config)
    const exactOrder = config.exactOrderPercent !== undefined 
      ? Math.random() * 100 < config.exactOrderPercent
      : true;
    
    // Problem encountered (default false if no config)
    const problemEncountered = config.problemEncounteredPercent !== undefined
      ? Math.random() * 100 < config.problemEncounteredPercent
      : false;
    
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
      headless: config.headless,
      useTor: config.useTor
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
    'EXTERIEUR': 5,
    // Plateformes de livraison
    'UBER_EATS': 0,
    'DELIVEROO': 1,
    'JUST_EAT': 2,
    'MCDO_APP': 3
  };
  return map[location] || 0;
}

function getRandomRating(config: any): number {
  const random = Math.random() * 100;
  let cumulative = 0;
  
  const ratings = [
    { rating: 1, percent: config.rating1Percent || 0 },
    { rating: 2, percent: config.rating2Percent || 0 },
    { rating: 3, percent: config.rating3Percent || 0 },
    { rating: 4, percent: config.rating4Percent || 0 },
    { rating: 5, percent: config.rating5Percent || 0 }
  ];
  
  console.log('🎲 Rating generation:');
  console.log(`   Random: ${random.toFixed(2)}`);
  console.log(`   Percents: [${ratings.map(r => `${r.rating}=${r.percent}%`).join(', ')}]`);
  
  for (const { rating, percent } of ratings) {
    cumulative += percent;
    console.log(`   Checking rating ${rating}: cumulative=${cumulative}, random=${random.toFixed(2)} -> ${random <= cumulative ? '✅ SELECTED' : '❌'}`);
    if (random <= cumulative) {
      console.log(`   ⭐ Final rating: ${rating}`);
      return rating;
    }
  }
  
  console.log('   ⚠️  No rating matched, using default: 1');
  return 1; // Default to 1 (excellent)
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
