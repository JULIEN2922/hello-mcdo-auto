/**
 * Test simple - 1 scénario en mode excellent (rating=1)
 * Usage: node --import tsx test-simple.ts
 */

import puppeteer from 'puppeteer';

// Helpers
function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function clickNext(page: any) {
  await wait(500);
  const clicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const nextBtn = buttons.find((b: any) => b.textContent.includes('Suivant'));
    if (nextBtn) {
      (nextBtn as HTMLButtonElement).click();
      return true;
    }
    return false;
  });
  
  if (clicked) {
    await wait(1000);
  }
  return clicked;
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

async function testScenario() {
  console.log('🎯 Test Simple - Rating = 1 (Excellent)');
  console.log('═══════════════════════════════════════\n');

  const browser = await puppeteer.launch({
    headless: false,  // Visible pour debug
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    const { date, hour, minute } = getDateTimeNow();
    const restaurantCode = '1318'; // SOYONS
    const rating = 1; // EXCELLENT (⭐⭐⭐⭐⭐)

    // 1. Navigation
    console.log('📄 Step 1: Navigation...');
    await page.goto('https://survey2.medallia.eu/?hellomcdo', { waitUntil: 'networkidle2', timeout: 60000 });
    await wait(1000);

    // Click Begin
    await page.waitForSelector('#buttonBegin', { timeout: 10000 });
    await page.click('#buttonBegin');
    await wait(2000);

    // 2. Age (25-34 ans = index 2)
    console.log('📄 Step 2: Age (25-34 ans)...');
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await page.evaluate(() => {
      const radios = document.querySelectorAll('input[type="radio"]');
      (radios[2] as HTMLInputElement)?.click();
    });
    await wait(1000);
    await clickNext(page);

    // 3. Ticket info
    console.log('📄 Step 3: Ticket information...');
    await page.waitForSelector('#cal_q_mc_q_date_', { timeout: 10000 });
    await wait(500);
    
    await page.type('#cal_q_mc_q_date_', date);
    await wait(500);
    
    await page.type('#spl_rng_q_mc_q_hour', hour);
    await wait(500);
    
    await page.type('#spl_rng_q_mc_q_minute', minute);
    await wait(500);
    
    await page.type('#spl_rng_q_mc_q_idrestaurant', restaurantCode);
    await wait(500);
    
    await clickNext(page);

    // 4. Order location (BORNE = index 0)
    console.log('📄 Step 4: Order location (BORNE)...');
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await wait(500);
    await page.evaluate(() => {
      const radios = document.querySelectorAll('input[type="radio"]');
      (radios[0] as HTMLInputElement)?.click();
    });
    await wait(1000);
    await clickNext(page);

    // 5. Consumption type (SUR_PLACE = index 0)
    console.log('📄 Step 5: Consumption type (SUR_PLACE)...');
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await wait(500);
    await page.evaluate(() => {
      const radios = document.querySelectorAll('input[type="radio"]');
      (radios[0] as HTMLInputElement)?.click();
    });
    await wait(1000);
    await clickNext(page);

    // 6. Pickup location (TABLE = index 2)
    console.log('📄 Step 6: Pickup location (TABLE)...');
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await wait(500);
    await page.evaluate(() => {
      const radios = document.querySelectorAll('input[type="radio"]');
      (radios[2] as HTMLInputElement)?.click();
    });
    await wait(1000);
    await clickNext(page);

    // 7. Overall satisfaction (rating = 1 = EXCELLENT ⭐⭐⭐⭐⭐)
    console.log(`📄 Step 7: Overall satisfaction (rating=${rating} = ⭐⭐⭐⭐⭐)...`);
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await wait(500);
    await page.evaluate((r) => {
      const radio = document.querySelector(`input[type="radio"][value="${r}"]`);
      console.log(`Found radio with value="${r}":`, radio);
      (radio as HTMLInputElement)?.click();
    }, rating);
    await wait(1000);
    await clickNext(page);

    // 8. Detailed dimensions (all rating = 1)
    console.log(`📄 Step 8: Detailed dimensions (all ${rating})...`);
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await wait(500);
    await page.evaluate((r) => {
      const radios = document.querySelectorAll(`input[type="radio"][value="${r}"]`);
      console.log(`Found ${radios.length} radios with value="${r}"`);
      radios.forEach((radio: any) => radio.click());
    }, rating);
    await wait(1000);
    await clickNext(page);

    // 9. Exact order (YES)
    console.log('📄 Step 9: Exact order (YES)...');
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await wait(500);
    await page.evaluate(() => {
      const radios = document.querySelectorAll('input[type="radio"]');
      (radios[0] as HTMLInputElement)?.click();
    });
    await wait(1000);
    await clickNext(page);

    // 10. Problem encountered (NO)
    console.log('📄 Step 10: Problem encountered (NO)...');
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await wait(500);
    await page.evaluate(() => {
      const radios = document.querySelectorAll('input[type="radio"]');
      (radios[1] as HTMLInputElement)?.click();
    });
    await wait(1000);
    await clickNext(page);

    // 11. Phone contact (NO)
    console.log('📄 Step 11: Phone contact (NO)...');
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await wait(500);
    await page.evaluate(() => {
      const radios = document.querySelectorAll('input[type="radio"]');
      (radios[1] as HTMLInputElement)?.click();
    });
    await wait(1000);
    await clickNext(page);

    await wait(3000);

    console.log('\n✅ Scenario completed successfully!');
    console.log('⭐ Rating sent: 1 (Excellent)');
    console.log('🏪 Restaurant: 1318 (SOYONS)');
    console.log('\n💡 Vérifiez maintenant les stats Medallia pour voir si vous avez bien un "Excellent"\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await wait(5000); // Laisser voir le résultat
    await browser.close();
  }
}

testScenario();
