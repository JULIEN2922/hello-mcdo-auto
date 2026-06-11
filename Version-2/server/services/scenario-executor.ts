import puppeteer, { Browser, Page } from 'puppeteer';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { renewTorIP, getTorProxyArgs, checkTorConnection, verifyFrenchIP, startTor, isTorRunning, isIPv6 } from './tor-manager.js';

const prisma = new PrismaClient();

// Module-level timestamp helper for functions outside executeScenario
const mts = () => `[${new Date().toISOString()}]`;

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

/**
 * Call page.evaluate with a JS-level timeout.
 * If the page JS thread is frozen (SPA transition), returns undefined after timeoutMs instead of hanging forever.
 */
async function safeEvaluate<T>(page: Page, fn: (...args: any[]) => T, timeoutMs: number, ...args: any[]): Promise<T | undefined> {
  try {
    return await Promise.race([
      page.evaluate(fn, ...args),
      new Promise<undefined>((_, reject) => setTimeout(() => reject(new Error('evaluate_timeout')), timeoutMs))
    ]);
  } catch (e: any) {
    if (e.message === 'evaluate_timeout') {
      return undefined;
    }
    throw e;
  }
}

/**
 * Click "Suivant" button — V1-style with timeout safety.
 */
async function clickSuivant(page: Page): Promise<void> {
  await wait(500);
  const result = await safeEvaluate(page, () => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const suivantBtn = buttons.find(b => b.textContent?.includes('Suivant'));
    if (suivantBtn) {
      suivantBtn.click();
      return true;
    }
    return false;
  }, 8000);
  
  if (result) {
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
  let ipAddress: string | undefined;
  let ipCountry: string | undefined;
  
  // Save original console methods and override with timestamped versions
  const _log = console.log.bind(console);
  const _warn = console.warn.bind(console);
  const _error = console.error.bind(console);
  const ts = () => `[${new Date().toISOString()}]`;
  
  try {
    console.log = (...args: any[]) => _log(ts(), ...args);
    console.warn = (...args: any[]) => _warn(ts(), ...args);
    console.error = (...args: any[]) => _error(ts(), ...args);
    
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
    
    const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      // Anti-bot-detection: hide automation flags
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-dev-shm-usage',
    ];
    if (config.useTor) {
      launchArgs.push(...getTorProxyArgs());
      launchArgs.push('--disable-ipv6'); // Force IPv4 only in browser
    }
    
    browser = await puppeteer.launch({
      headless: config.headless,
      slowMo: 50, // V1 uses this — critical for Calendra date picker & masked inputs
      args: launchArgs,
      env: launchEnv,
      protocolTimeout: 0 // Disable CDP timeout to prevent Runtime.callFunctionOn timeout on slow SPA transitions
    });
    
    const page = await browser.newPage();
    
    // Hide webdriver flag to avoid bot detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
    
    // Use a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36');
    
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to form (longer timeout for Tor)
    const url = 'https://survey2.medallia.eu/?hellomcdo';
    const navigationTimeout = config.useTor ? 120000 : 60000;
    console.log(`📄 Step 1: Navigating to: ${url}${config.useTor ? ' (via Tor, may take longer)' : ''}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: navigationTimeout });
    await randomWait(config.delayMin, config.delayMax);
    
    // Step 1: Click Begin button
    await page.click('#buttonBegin');
    await wait(1000);
    await randomWait(config.delayMin, config.delayMax);
    
    // Step 2: Age selection (index-based, V1-style)
    const ageIndex = getAgeIndex(config.age || '25-34');
    console.log(`📄 Step 2: Age selection (${config.age} → index ${ageIndex})...`);
    await safeEvaluate(page, (idx) => {
      const radios = document.querySelectorAll('input[type="radio"]');
      if (radios[idx]) (radios[idx] as HTMLInputElement).click();
    }, 8000, ageIndex);
    await randomWait(config.delayMin, config.delayMax);
    await clickSuivant(page);
    
    // Step 3: Ticket information (V1-style: page.type for all fields)
    const { date, hour, minute } = getDateTimeNow();
    console.log(`📄 Step 3: Ticket information...`);
    await page.type('#cal_q_mc_q_date_', date);
    await randomWait(config.delayMin, config.delayMax);
    await page.type('#spl_rng_q_mc_q_hour', hour);
    await randomWait(config.delayMin, config.delayMax);
    await page.type('#spl_rng_q_mc_q_minute', minute);
    await randomWait(config.delayMin, config.delayMax);
    await page.type('#spl_rng_q_mc_q_idrestaurant', config.restaurantCode);
    await randomWait(config.delayMin, config.delayMax);
    await clickSuivant(page);
    
    // Step 4: Order location (index-based, V1-style)
    const locationIndex = getLocationIndex(config.location);
    console.log(`📄 Step 4: Order location (${config.location} → index ${locationIndex})...`);
    await safeEvaluate(page, (idx) => {
      const radios = document.querySelectorAll('input[type="radio"]');
      if (radios[idx]) (radios[idx] as HTMLInputElement).click();
    }, 8000, locationIndex);
    await randomWait(config.delayMin, config.delayMax);
    await clickSuivant(page);
    
    // Step 5: Consumption type (V1-style: ALWAYS executed, radios may not exist for some location types)
    const consumptionIndex = getConsumptionIndex(config.consumptionType);
    console.log(`📄 Step 5: Consumption type (${config.consumptionType} → index ${consumptionIndex})...`);
    await safeEvaluate(page, (idx) => {
      const radios = document.querySelectorAll('input[type="radio"]');
      if (radios[idx]) (radios[idx] as HTMLInputElement).click();
    }, 8000, consumptionIndex);
    await randomWait(config.delayMin, config.delayMax);
    await clickSuivant(page);
    
    // Step 6: Pickup location / Platform (V1-style: ALWAYS executed, radios may not exist)
    const pickupIndex = getPickupIndex(config.location, config.pickupLocation);
    console.log(`📄 Step 6: Pickup/Platform (${config.pickupLocation} → index ${pickupIndex})...`);
    await safeEvaluate(page, (idx) => {
      const radios = document.querySelectorAll('input[type="radio"]');
      if (radios[idx]) (radios[idx] as HTMLInputElement).click();
    }, 8000, pickupIndex);
    await randomWait(config.delayMin, config.delayMax);
    await clickSuivant(page);
    
    // Step 7: Overall satisfaction (index-based: 0=best, 4=worst)
    const ratingIndex = config.rating - 1;
    console.log(`📄 Step 7: Overall satisfaction (${config.rating}/5 → index ${ratingIndex})...`);
    await safeEvaluate(page, (idx) => {
      const radios = document.querySelectorAll('input[type="radio"]');
      if (radios[idx]) (radios[idx] as HTMLInputElement).click();
    }, 8000, ratingIndex);
    await randomWait(config.delayMin, config.delayMax);
    await clickSuivant(page);
    
    // Step 8: Detailed dimensions (index-based: click same rating index for each group of 5)
    console.log(`📄 Step 8: Detailed dimensions (all ${config.rating}/5 → index ${ratingIndex})...`);
    await safeEvaluate(page, (idx) => {
      const radios = document.querySelectorAll('input[type="radio"]');
      for (let i = idx; i < radios.length; i += 5) {
        if (radios[i]) (radios[i] as HTMLInputElement).click();
      }
    }, 8000, ratingIndex);
    await randomWait(config.delayMin, config.delayMax);
    await clickSuivant(page);
    
    // Step 9: Exact order (index-based: 0=Oui, 1=Non)
    console.log(`📄 Step 9: Exact order (${config.exactOrder ? 'Yes' : 'No'})...`);
    await safeEvaluate(page, (isExact) => {
      const radios = document.querySelectorAll('input[type="radio"]');
      if (radios[isExact ? 0 : 1]) (radios[isExact ? 0 : 1] as HTMLInputElement).click();
    }, 8000, config.exactOrder);
    await randomWait(config.delayMin, config.delayMax);
    await clickSuivant(page);
    
    // Step 10: Problem encountered (index-based: 0=Oui, 1=Non)
    console.log(`📄 Step 10: Problem encountered (${config.problemEncountered ? 'Yes' : 'No'})...`);
    await safeEvaluate(page, (hasProblem) => {
      const radios = document.querySelectorAll('input[type="radio"]');
      if (radios[hasProblem ? 0 : 1]) (radios[hasProblem ? 0 : 1] as HTMLInputElement).click();
    }, 8000, config.problemEncountered);
    await randomWait(config.delayMin, config.delayMax);
    await clickSuivant(page);
    
    // Step 11: Phone contact — always Non (index 1)
    console.log(`📄 Step 11: Phone contact (No)...`);
    await safeEvaluate(page, () => {
      const radios = document.querySelectorAll('input[type="radio"]');
      if (radios[1]) (radios[1] as HTMLInputElement).click();
    }, 8000);
    await randomWait(config.delayMin, config.delayMax);
    await clickSuivant(page);
    
    // Wait for completion
    await wait(2000);
    
    const durationMs = Date.now() - startTime;
    console.log(`✅ Scenario completed in ${(durationMs / 1000).toFixed(1)}s`);
    
    try {
      await browser.close();
    } catch (e) {
      // Browser may already be closed
    }
    
    // Restore original console
    console.log = _log; console.warn = _warn; console.error = _error;
    
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
    
    // Restore original console
    console.log = _log; console.warn = _warn; console.error = _error;
    
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
  console.log(mts(), `\n🚀 Starting execution of ${scenarios.length} scenarios with concurrency ${concurrency}`);
  
  const results: ExecutionResult[] = [];
  const executing: Promise<void>[] = [];
  
  for (const [index, scenario] of scenarios.entries()) {
    const promise = (async () => {
      console.log(mts(), `\n[${index + 1}/${scenarios.length}] 🔄 Starting scenario...`);
      
      // Renew Tor IP before each scenario if enabled
      if (scenario.useTor && index > 0) {
        try {
          await renewTorIP();
        } catch (error) {
          console.warn(mts(), '⚠️  Failed to renew Tor IP, continuing with current IP');
        }
      }
      
      const result = await executeScenario(scenario);
      results.push(result);
      console.log(mts(), `[${index + 1}/${scenarios.length}] ${result.success ? '✅' : '❌'} Completed`);
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
  
  console.log(mts(), `\n📊 Execution complete: ${success} success, ${failed} failed`);
  
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

// Helper functions — return DOM indices (like V1)
function getAgeIndex(age: string): number {
  const map: Record<string, number> = {
    '<15': 0,
    '15-24': 1,
    '25-34': 2,
    '35-49': 3,
    '50+': 4
  };
  return map[age] || 2;
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

function getConsumptionIndex(type: string): number {
  return type === 'SUR_PLACE' ? 0 : 1;
}

// Pickup index depends on the location context (matches V1 SCENARIOS definitions exactly)
function getPickupIndex(location: string, pickupLocation: string): number {
  // CLICK_COLLECT_APP / CLICK_COLLECT_WEB: COMPTOIR=0, DRIVE=1, GUICHET_EXTERIEUR=2, EXTERIEUR=3
  if (location === 'CLICK_COLLECT_APP' || location === 'CLICK_COLLECT_WEB') {
    const map: Record<string, number> = {
      'COMPTOIR': 0,
      'MCDRIVE': 1,
      'GUICHET_EXTERIEUR': 2,
      'EXTERIEUR': 3
    };
    return map[pickupLocation] ?? 0;
  }
  
  // LIVRAISON: UBER_EATS=0, DELIVEROO=1, JUST_EAT=2, MCDO_APP=3
  if (location === 'LIVRAISON') {
    const map: Record<string, number> = {
      'UBER_EATS': 0,
      'DELIVEROO': 1,
      'JUST_EAT': 2,
      'MCDO_APP': 3
    };
    return map[pickupLocation] ?? 0;
  }
  
  // TABLETTE à emporter: COMPTOIR=0, DRIVE=1, MCCAFE=2 (different from other locations!)
  if (location === 'TABLETTE') {
    const map: Record<string, number> = {
      'COMPTOIR': 0,
      'MCDRIVE': 1,
      'MCCAFE': 2
    };
    return map[pickupLocation] ?? 0;
  }
  
  // BORNE, COMPTOIR, MCCAFE (sur place & à emporter): COMPTOIR=0, MCCAFE=1, TABLE=2
  // Note: TABLE only appears for SUR_PLACE, not for A_EMPORTER
  const map: Record<string, number> = {
    'COMPTOIR': 0,
    'MCCAFE': 1,
    'TABLE': 2
  };
  return map[pickupLocation] ?? 0;
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
  
  console.log(mts(), '🎲 Rating generation:');
  console.log(mts(), `   Random: ${random.toFixed(2)}`);
  console.log(mts(), `   Percents: [${ratings.map(r => `${r.rating}=${r.percent}%`).join(', ')}]`);
  
  for (const { rating, percent } of ratings) {
    cumulative += percent;
    console.log(mts(), `   Checking rating ${rating}: cumulative=${cumulative}, random=${random.toFixed(2)} -> ${random <= cumulative ? '✅ SELECTED' : '❌'}`);
    if (random <= cumulative) {
      console.log(mts(), `   ⭐ Final rating: ${rating}`);
      return rating;
    }
  }
  
  console.log(mts(), '   ⚠️  No rating matched, using default: 1');
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
