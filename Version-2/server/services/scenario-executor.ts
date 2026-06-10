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
 * Check if the survey has ended by looking for the thank-you message.
 * (feedless in URL is NORMAL - appears from Step 2 onward, do NOT use it)
 */
async function isSurveyEnded(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      return document.body?.innerText?.includes('remercions de votre participation') ?? false;
    });
  } catch {
    return false;
  }
}

/**
 * Click "Suivant" and check if the survey ended (thank-you page).
 * Uses simple waits instead of waitForNetworkIdle (Medallia has persistent analytics
 * connections that prevent network idle from ever being detected).
 * Throws SURVEY_ENDED if the survey completed after the click.
 */
async function clickNextOrEnd(page: Page): Promise<void> {
  await wait(500);
  
  // Click the Suivant button with a safety timeout
  const clicked = await Promise.race([
    page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
      const nextButton = buttons.find(b => b.textContent?.includes('Suivant'));
      if (nextButton) {
        nextButton.click();
        return true;
      }
      return false;
    }),
    new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('clickNextOrEnd: evaluate timed out')), 10000))
  ]);
  
  if (!clicked) {
    if (await isSurveyEnded(page)) {
      console.log('🏁 Survey ended (no Suivant button + thank-you page)');
      throw new Error('SURVEY_ENDED');
    }
    console.warn('⚠️  No Suivant button found, continuing...');
    return;
  }
  
  // Wait for SPA transition (Medallia takes ~1-3s to render next step)
  // Do NOT use waitForNetworkIdle — Medallia has persistent analytics pings
  await wait(3000);
  
  // Quick check: did we land on the thank-you page?
  if (await isSurveyEnded(page)) {
    console.log('🏁 Survey ended after Suivant (thank-you page)');
    throw new Error('SURVEY_ENDED');
  }
  
  // Wait briefly for the next step's content to appear
  // If radio buttons appear, the transition completed successfully
  try {
    await page.waitForSelector('input[type="radio"]', { timeout: 5000 });
  } catch {
    // No radios yet — check if survey ended, otherwise the next step's
    // waitForRadiosOrFail with longer timeout will handle it
    if (await isSurveyEnded(page)) {
      console.log('🏁 Survey ended after Suivant (thank-you page)');
      throw new Error('SURVEY_ENDED');
    }
  }
}

/**
 * Wait for radio buttons to appear, with debug info on timeout.
 * If the survey ended (thank-you page), treats it as success.
 */
async function waitForRadiosOrFail(page: Page, stepName: string, timeoutMs: number): Promise<void> {
  try {
    await page.waitForSelector('input[type="radio"]', { timeout: timeoutMs });
  } catch {
    // Check if survey ended (thank-you page) — not an error
    if (await isSurveyEnded(page)) {
      console.log(`🏁 [${stepName}] Survey ended (thank-you page) — treating as success`);
      throw new Error('SURVEY_ENDED');
    }
    
    // Capture page state for debugging
    const pageTitle = await page.title().catch(() => 'unknown');
    const pageUrl = page.url();
    const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '(empty)').catch(() => '(error)');
    
    console.error(`❌ [${stepName}] No radio buttons found after ${timeoutMs}ms`);
    console.error(`   📍 URL: ${pageUrl}`);
    console.error(`   📄 Title: "${pageTitle}"`);
    console.error(`   📝 Body preview: ${bodyText.replace(/\\n/g, ' | ')}`);
    
    throw new Error(`Step "${stepName}" failed: No radio buttons found. Page title: "${pageTitle}"`);
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
      args: launchArgs,
      env: launchEnv
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
    const navigationTimeout = config.useTor ? 120000 : 60000; // 2 minutes with Tor, 1 minute without
    console.log(`📄 Navigating to: ${url}${config.useTor ? ' (via Tor, may take longer)' : ''}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: navigationTimeout });
    
    await randomWait(config.delayMin, config.delayMax);
    
    // Step 1: Click Begin button
    console.log('📄 Step 1: Starting survey...');
    await page.waitForSelector('#buttonBegin', { timeout: 10000 });
    await page.click('#buttonBegin');
    // Wait for SPA transition to load Step 2 (cold start may be slow)
    // Do NOT use waitForNetworkIdle — Medallia has persistent analytics connections
    await wait(3000);
    // Quick check: did survey end immediately?
    if (await isSurveyEnded(page)) {
      console.log('🏁 Survey ended after Begin (thank-you page)');
      throw new Error('SURVEY_ENDED');
    }
    await randomWait(config.delayMin, config.delayMax);
    
    // Step 2: Age selection
    const ageValue = getAgeValue(config.age || '25-34');
    console.log(`📄 Step 2: Age selection (${config.age})...`);
    await waitForRadiosOrFail(page, 'Step 2 - Age', 30000);
    await page.evaluate((value) => {
      (document.querySelector(`input[type="radio"][value="${value}"]`) as HTMLInputElement)?.click();
    }, ageValue);
    await wait(1000);
    await randomWait(config.delayMin, config.delayMax);
    await clickNextOrEnd(page);
    
    // Step 3: Ticket information
    console.log('📄 Step 3: Ticket information...');
    const { date, hour, minute } = getDateTimeNow();
    
    await page.waitForSelector('#cal_q_mc_q_date_', { timeout: 10000 });
    
    // Fill fields by setting value directly via JS (Medallia date picker blocks page.type)
    const fillField = async (selector: string, value: string) => {
      await page.evaluate(({sel, val}) => {
        const el = document.querySelector(sel) as HTMLInputElement;
        if (!el) return;
        el.focus();
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
      }, {sel: selector, val: value});
      await wait(200);
    };
    
    await fillField('#cal_q_mc_q_date_', date);
    await randomWait(config.delayMin, config.delayMax);
    
    await fillField('#spl_rng_q_mc_q_hour', hour);
    await randomWait(config.delayMin, config.delayMax);
    
    await fillField('#spl_rng_q_mc_q_minute', minute);
    await randomWait(config.delayMin, config.delayMax);
    
    await fillField('#spl_rng_q_mc_q_idrestaurant', config.restaurantCode);
    await randomWait(config.delayMin, config.delayMax);
    
    await clickNextOrEnd(page);
    
    // Check if form validation blocked us (still on ticket page = no radios)
    let radioCheck = await page.evaluate(() => document.querySelectorAll('input[type="radio"]').length);
    if (radioCheck === 0) {
      console.warn('⚠️  Ticket validation failed — retrying with JS value set...');
      // Re-fill all fields
      await fillField('#cal_q_mc_q_date_', date);
      await fillField('#spl_rng_q_mc_q_hour', hour);
      await fillField('#spl_rng_q_mc_q_minute', minute);
      await fillField('#spl_rng_q_mc_q_idrestaurant', config.restaurantCode);
      await wait(500);
      await clickNextOrEnd(page);
      
      // Re-check after retry: did validation pass this time?
      radioCheck = await page.evaluate(() => document.querySelectorAll('input[type="radio"]').length);
      if (radioCheck === 0) {
        // Still on ticket page — capture validation error details
        const pageTitle = await page.title().catch(() => 'unknown');
        const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 800) || '(empty)').catch(() => '(error)');
        console.error(`❌ Ticket validation still failing after retry. Page: "${pageTitle}"`);
        console.error(`   📝 Body: ${bodyText.replace(/\\n/g, ' | ')}`);
        throw new Error(`Step "Step 3 - Ticket" failed: Form validation blocked progression after retry. Check date format and restaurant code. Date="${date}" Hour="${hour}" Min="${minute}" Restaurant="${config.restaurantCode}"`);
      }
      console.log('✅ Ticket validation succeeded on retry');
    }
    
    // Step 4: Order location
    console.log(`📄 Step 4: Order location (${config.location})...`);
    await waitForRadiosOrFail(page, 'Step 4 - Location', 20000);
    await wait(500);
    
    const locationValue = getLocationValue(config.location);
    await page.evaluate((value) => {
      (document.querySelector(`input[type="radio"][value="${value}"]`) as HTMLInputElement)?.click();
    }, locationValue);
    await wait(1000);
    await randomWait(config.delayMin, config.delayMax);
    await clickNextOrEnd(page);
    
    // Step 5: Consumption type
    console.log(`📄 Step 5: Consumption type (${config.consumptionType})...`);
    await waitForRadiosOrFail(page, 'Step 5 - Consumption', 20000);
    await wait(500);
    const consumptionValue = getConsumptionValue(config.consumptionType);
    await page.evaluate((value) => {
      (document.querySelector(`input[type="radio"][value="${value}"]`) as HTMLInputElement)?.click();
    }, consumptionValue);
    await wait(1000);
    await randomWait(config.delayMin, config.delayMax);
    await clickNextOrEnd(page);
    
    // Step 6: Pickup location
    console.log(`📄 Step 6: Pickup location (${config.pickupLocation})...`);
    await waitForRadiosOrFail(page, 'Step 6 - Pickup', 20000);
    await wait(500);
    const pickupValue = getPickupValue(config.pickupLocation);
    await page.evaluate((value) => {
      const radio = document.querySelector(`input[type="radio"][value="${value}"]`) as HTMLInputElement;
      if (radio) radio.click();
    }, pickupValue);
    await wait(1000);
    await randomWait(config.delayMin, config.delayMax);
    await clickNextOrEnd(page);
    
    // Step 7: Overall satisfaction rating
    // Note: 1=excellent (5 stars visual), 5=very bad (1 star visual)
    console.log(`📄 Step 7: Overall satisfaction (${config.rating}/5)...`);
    await waitForRadiosOrFail(page, 'Step 7 - Satisfaction', 20000);
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
    await clickNextOrEnd(page);
    
    // Step 8: Detailed dimensions rating
    // Note: 1=excellent, 5=very bad (same as V1)
    console.log(`📄 Step 8: Detailed dimensions (all ${config.rating}/5)...`);
    await waitForRadiosOrFail(page, 'Step 8 - Dimensions', 20000);
    await wait(500);
    await page.evaluate((rating) => {
      const radios = document.querySelectorAll(`input[type="radio"][value="${rating}"]`);
      radios.forEach((r: any) => r.click());
    }, config.rating);
    await wait(1000);
    await randomWait(config.delayMin, config.delayMax);
    await clickNextOrEnd(page);
    
    // Step 9: Exact order
    console.log(`📄 Step 9: Exact order (${config.exactOrder ? 'Yes' : 'No'})...`);
    await waitForRadiosOrFail(page, 'Step 9 - Exact order', 20000);
    await wait(500);
    await page.evaluate((isExact) => {
      const val = isExact ? '1' : '2'; // 1=Oui, 2=Non
      (document.querySelector(`input[type="radio"][value="${val}"]`) as HTMLInputElement)?.click();
    }, config.exactOrder);
    await wait(1000);
    await randomWait(config.delayMin, config.delayMax);
    await clickNextOrEnd(page);
    
    // Step 10: Problem encountered
    console.log(`📄 Step 10: Problem encountered (${config.problemEncountered ? 'Yes' : 'No'})...`);
    await waitForRadiosOrFail(page, 'Step 10 - Problem', 20000);
    await wait(500);
    await page.evaluate((hasProblem) => {
      const val = hasProblem ? '1' : '2'; // 1=Oui, 2=Non
      (document.querySelector(`input[type="radio"][value="${val}"]`) as HTMLInputElement)?.click();
    }, config.problemEncountered);
    await wait(1000);
    await randomWait(config.delayMin, config.delayMax);
    await clickNextOrEnd(page);
    
    // Step 11: Phone contact (always No) - LAST STEP
    // Note: Page may close after step 10 if it's actually the last step
    try {
      console.log('📄 Step 11: Phone contact (No)...');
      await waitForRadiosOrFail(page, 'Step 11 - Phone', 5000);
      await wait(500);
      await page.evaluate(() => {
        (document.querySelector(`input[type="radio"][value="2"]`) as HTMLInputElement)?.click(); // 2=Non
      });
      await wait(1000);
      await randomWait(config.delayMin, config.delayMax);
      
      // Final submission - page may close after this
      await clickNextOrEnd(page);
      
      // Wait for completion
      await wait(2000);
    } catch (error: any) {
      // SURVEY_ENDED = survey completed (thank-you page)
      if (error.message === 'SURVEY_ENDED') {
        throw error; // Re-throw to outer catch which treats it as success
      }
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
    // SURVEY_ENDED = survey reached thank-you page gracefully
    if (error.message === 'SURVEY_ENDED') {
      const durationMs = Date.now() - startTime;
      console.log(`✅ Survey ended (thank-you page) — treating as success (${(durationMs / 1000).toFixed(1)}s)`);
      
      if (browser) {
        await browser.close().catch(() => {});
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
    }
    
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

// Helper functions — return radio VALUES (not DOM indices)
function getAgeValue(age: string): number {
  const map: Record<string, number> = {
    '<15': 1,
    '15-24': 2,
    '25-34': 3,
    '35-49': 4,
    '50+': 5
  };
  return map[age] || 3;
}

function getLocationValue(location: string): number {
  const map: Record<string, number> = {
    'BORNE': 1,
    'COMPTOIR': 2,
    'DRIVE': 3,
    'GUICHET': 4,
    'MCCAFE': 5,
    'CLICK_COLLECT_APP': 6,
    'CLICK_COLLECT_WEB': 7,
    'LIVRAISON': 8,
    'TABLETTE': 9
  };
  return map[location] || 1;
}

function getConsumptionValue(type: string): number {
  return type === 'SUR_PLACE' ? 1 : 2;
}

// Pickup values are NON-sequential on Medallia: COMPTOIR=1, MCCAFE=4, TABLE=6
function getPickupValue(location: string): number {
  const map: Record<string, number> = {
    'COMPTOIR': 1,
    'MCCAFE': 4,
    'TABLE': 6,
    'MCDRIVE': 1,       // May vary by scenario context
    'GUICHET_EXTERIEUR': 1,
    'EXTERIEUR': 1,
    'UBER_EATS': 1,
    'DELIVEROO': 2,
    'JUST_EAT': 3,
    'MCDO_APP': 4
  };
  return map[location] || 1;
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
