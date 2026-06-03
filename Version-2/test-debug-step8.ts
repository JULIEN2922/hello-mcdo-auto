/**
 * Test Debug - Inspecter le HTML de l'étape 8 (dimensions)
 */

import puppeteer from 'puppeteer';

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

async function debugStep8() {
  console.log('🔍 Debug Step 8 - Inspecter les sélecteurs des dimensions');
  console.log('═══════════════════════════════════════════════════════════\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    const { date, hour, minute } = getDateTimeNow();
    const restaurantCode = '1318';

    // Navigation jusqu'à l'étape 7 (satisfaction)
    console.log('📄 Navigating to step 7...');
    await page.goto('https://survey2.medallia.eu/?hellomcdo', { waitUntil: 'networkidle2', timeout: 60000 });
    await wait(1000);
    
    await page.waitForSelector('#buttonBegin', { timeout: 10000 });
    await page.click('#buttonBegin');
    await wait(2000);
    
    // Age
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await page.evaluate(() => {
      const radios = document.querySelectorAll('input[type="radio"]');
      (radios[2] as HTMLInputElement)?.click();
    });
    await wait(1000);
    await clickNext(page);
    
    // Ticket info
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
    
    // Location
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await wait(500);
    await page.evaluate(() => {
      const radios = document.querySelectorAll('input[type="radio"]');
      (radios[0] as HTMLInputElement)?.click();
    });
    await wait(1000);
    await clickNext(page);
    
    // Consumption type
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await wait(500);
    await page.evaluate(() => {
      const radios = document.querySelectorAll('input[type="radio"]');
      (radios[0] as HTMLInputElement)?.click();
    });
    await wait(1000);
    await clickNext(page);
    
    // Pickup location
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await wait(500);
    await page.evaluate(() => {
      const radios = document.querySelectorAll('input[type="radio"]');
      (radios[2] as HTMLInputElement)?.click();
    });
    await wait(1000);
    await clickNext(page);
    
    // Step 7: Overall satisfaction
    console.log('📄 Step 7: Overall satisfaction...');
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await wait(500);
    await page.evaluate(() => {
      const radio = document.querySelector('input[type="radio"][value="1"]');
      console.log('Step 7 radio:', radio);
      (radio as HTMLInputElement)?.click();
    });
    await wait(1000);
    await clickNext(page);
    
    // Step 8: INSPECTION DES DIMENSIONS
    console.log('\n🔍 INSPECTION ÉTAPE 8 (Dimensions)');
    console.log('═══════════════════════════════════════════════════════════');
    
    await page.waitForSelector('input[type="radio"]', { timeout: 10000 });
    await wait(2000); // Attendre que tout soit bien chargé
    
    const debugInfo = await page.evaluate(() => {
      const allRadios = document.querySelectorAll('input[type="radio"]');
      const radiosWithValue1 = document.querySelectorAll('input[type="radio"][value="1"]');
      
      const radioDetails = Array.from(allRadios).slice(0, 20).map((r: any) => ({
        id: r.id,
        name: r.name,
        value: r.value,
        checked: r.checked,
        visible: r.offsetParent !== null,
        html: r.outerHTML.substring(0, 200)
      }));
      
      return {
        totalRadios: allRadios.length,
        radiosWithValue1: radiosWithValue1.length,
        radioDetails,
        pageTitle: document.title,
        questionText: document.querySelector('h2, .question')?.textContent || 'Not found'
      };
    });
    
    console.log('\n📊 Résultats de l\'inspection:');
    console.log('─────────────────────────────────────────────────────────');
    console.log(`Total radios sur la page: ${debugInfo.totalRadios}`);
    console.log(`Radios avec value="1": ${debugInfo.radiosWithValue1}`);
    console.log(`Question: ${debugInfo.questionText}`);
    console.log('\n📋 Détails des premiers radios:');
    debugInfo.radioDetails.forEach((r: any, i: number) => {
      console.log(`\n[${i}] id="${r.id}" name="${r.name}" value="${r.value}"`);
      console.log(`    checked=${r.checked} visible=${r.visible}`);
      console.log(`    HTML: ${r.html}`);
    });
    
    // Essayer différentes méthodes de click
    console.log('\n\n🧪 Test de différentes méthodes de click:');
    console.log('─────────────────────────────────────────────────────────');
    
    // Méthode 1: querySelectorAll avec value="1"
    console.log('\n1️⃣ Méthode V1/V2 actuelle (querySelectorAll + forEach):');
    const method1Result = await page.evaluate(() => {
      const radios = document.querySelectorAll('input[type="radio"][value="1"]');
      let clicked = 0;
      radios.forEach((r: any) => {
        r.click();
        clicked++;
      });
      return { clicked, totalFound: radios.length };
    });
    console.log(`   Trouvés: ${method1Result.totalFound}, Cliqués: ${method1Result.clicked}`);
    
    await wait(2000);
    
    // Vérifier si les radios sont cochés
    const checkedAfterMethod1 = await page.evaluate(() => {
      const radios = document.querySelectorAll('input[type="radio"][value="1"]');
      return Array.from(radios).map((r: any) => r.checked);
    });
    console.log(`   État après click: ${checkedAfterMethod1}`);
    
    // Screenshot
    await page.screenshot({ path: 'debug-step8-after-clicks.png', fullPage: true });
    console.log('\n📸 Screenshot sauvegardé: debug-step8-after-clicks.png');
    
    console.log('\n\n💡 Analyse:');
    if (method1Result.totalFound === 0) {
      console.log('   ❌ PROBLÈME: Aucun radio avec value="1" trouvé !');
      console.log('   → Il faut trouver un autre sélecteur');
    } else if (checkedAfterMethod1.every((c: boolean) => c === false)) {
      console.log('   ❌ PROBLÈME: Les radios sont trouvés mais le click ne fonctionne pas !');
      console.log('   → Il faut peut-être cliquer sur un label ou utiliser une autre méthode');
    } else {
      console.log('   ✅ Les radios semblent correctement cochés');
    }
    
    console.log('\n\n⏸️  Pause de 30 secondes pour inspection manuelle...');
    await wait(30000);

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debugStep8();
