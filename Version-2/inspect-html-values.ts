/**
 * Script pour inspecter les valeurs HTML des radios de satisfaction
 */

import puppeteer from 'puppeteer';

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function clickNext(page: any): Promise<boolean> {
  await wait(500);
  const result = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const nextButton = buttons.find(b => b.textContent?.includes('Suivant'));
    if (nextButton) {
      (nextButton as HTMLButtonElement).click();
      return true;
    }
    return false;
  });
  if (result) {
    await wait(1000);
  }
  return result;
}

function getDateTimeNow() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const date = `${day}/${month}/${year}`;
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  
  return { date, hour, minute };
}

async function inspectHtml() {
  console.log('🔍 Inspecting HTML Values at Step 7 (Satisfaction)');
  console.log('═══════════════════════════════════════\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    const { date, hour, minute } = getDateTimeNow();
    const restaurantCode = '1318';

    // Navigate through steps 1-6 to reach step 7
    console.log('📄 Step 1: Navigation...');
    await page.goto('https://survey2.medallia.eu/?hellomcdo', { waitUntil: 'networkidle2', timeout: 60000 });
    await wait(1000);
    await page.waitForSelector('#buttonBegin', { timeout: 10000 });
    await page.click('#buttonBegin');
    await wait(2000);

    console.log('📄 Step 2: Age (15-24)...');
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await page.evaluate(() => {
      const radios = document.querySelectorAll('input[type="radio"]');
      (radios[0] as HTMLInputElement)?.click();
    });
    await wait(1000);
    await clickNext(page);

    console.log('📄 Step 3: Ticket info...');
    await page.waitForSelector('input[name="Tracker.Establishment.Code"]', { timeout: 10000 });
    await page.type('input[name="Tracker.Establishment.Code"]', restaurantCode);
    await page.type('input[name="Tracker.Receipt.Day"]', date.split('/')[0]);
    await page.type('input[name="Tracker.Receipt.Month"]', date.split('/')[1]);
    await page.type('input[name="Tracker.Receipt.Year"]', date.split('/')[2]);
    await page.type('input[name="Tracker.Receipt.Hour"]', hour);
    await page.type('input[name="Tracker.Receipt.Minutes"]', minute);
    await wait(1000);
    await clickNext(page);

    console.log('📄 Step 4: Order location (BORNE)...');
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await page.evaluate(() => {
      const radios = document.querySelectorAll('input[type="radio"]');
      (radios[1] as HTMLInputElement)?.click(); // BORNE
    });
    await wait(1000);
    await clickNext(page);

    console.log('📄 Step 5: Consumption type (SUR_PLACE)...');
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await page.evaluate(() => {
      const radios = document.querySelectorAll('input[type="radio"]');
      (radios[0] as HTMLInputElement)?.click(); // SUR_PLACE
    });
    await wait(1000);
    await clickNext(page);

    console.log('📄 Step 6: Pickup location (COMPTOIR)...');
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await page.evaluate(() => {
      const radios = document.querySelectorAll('input[type="radio"]');
      (radios[0] as HTMLInputElement)?.click(); // COMPTOIR
    });
    await wait(1000);
    await clickNext(page);

    // STEP 7: Inspect radio values
    console.log('\n📄 Step 7: INSPECTING SATISFACTION RADIO VALUES');
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await wait(1000);

    const radioInfo = await page.evaluate(() => {
      const radios = document.querySelectorAll('input[type="radio"]');
      return Array.from(radios).map((radio, index) => {
        const input = radio as HTMLInputElement;
        const label = radio.parentElement?.textContent?.trim() || 'N/A';
        return {
          index,
          value: input.value,
          name: input.name,
          checked: input.checked,
          label: label.substring(0, 50) // First 50 chars
        };
      });
    });

    console.log('\n📊 Radio Buttons Analysis:');
    console.log('═══════════════════════════════════════');
    radioInfo.forEach(radio => {
      console.log(`\n[${radio.index}] value="${radio.value}"`);
      console.log(`    Name: ${radio.name}`);
      console.log(`    Label: ${radio.label}`);
      console.log(`    Checked: ${radio.checked}`);
    });

    console.log('\n\n🎯 Visual representation (based on typical Medallia layout):');
    console.log('═══════════════════════════════════════');
    console.log('Position 0 (😊😊😊😊😊) = 5 stars visual → value =', radioInfo[0]?.value);
    console.log('Position 1 (😊😊😊😊)   = 4 stars visual → value =', radioInfo[1]?.value);
    console.log('Position 2 (😊😊😊)     = 3 stars visual → value =', radioInfo[2]?.value);
    console.log('Position 3 (😊😊)       = 2 stars visual → value =', radioInfo[3]?.value);
    console.log('Position 4 (😊)         = 1 star visual  → value =', radioInfo[4]?.value);

    console.log('\n\n⏸️  Browser will stay open for manual inspection...');
    console.log('Press Ctrl+C when done.');
    
    // Keep browser open
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Error:', error);
    await browser.close();
  }
}

inspectHtml();
