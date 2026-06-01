/**
 * Script d'automatisation avancé pour Hello McDo
 * Gère tous les scénarios possibles du questionnaire
 * - 9 lieux de commande (Borne, Comptoir, Drive, Guichet, McCafé, Click&Collect, Livraison, Tablette)
 * - 3 modes de consommation (Sur place, A emporter, Drive)
 * - 3 lieux de récupération (Comptoir, McDrive, Table)
 * - Support des notes personnalisées et dates/heures configurables
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Configuration des restaurants McDonald's à Paris (exemples réalistes)
const RESTAURANTS_PARIS = [
  { id: '1001', nom: 'Paris Champs-Élysées' },
  { id: '1015', nom: 'Paris Bastille' },
  { id: '1042', nom: 'Paris Gare du Nord' },
  { id: '1078', nom: 'Paris Opéra' },
  { id: '1123', nom: 'Paris Saint-Lazare' },
  { id: '1156', nom: 'Paris Montparnasse' },
  { id: '1234', nom: 'Paris République' },
  { id: '1289', nom: 'Paris Nation' },
  { id: '1456', nom: 'Paris Châtelet' }
];

// Mapping complet de tous les scénarios possibles avec hiérarchie réelle
const SCENARIOS = {
  // Borne: sur place (comptoir, mccafe, table) OU à emporter (comptoir, mccafe)
  borne: {
    id: 'borne',
    label: 'A une borne de commande en restaurant',
    index: 0,
    options: {
      sur_place: {
        label: 'Consommé sur place',
        recuperation: [
          { id: 'comptoir', label: 'Au comptoir', index: 0 },
          { id: 'mccafe', label: 'Au McCafe', index: 1 },
          { id: 'table', label: 'En service à table', index: 2 }
        ]
      },
      a_emporter: {
        label: 'Pris à emporter',
        recuperation: [
          { id: 'comptoir', label: 'Au comptoir', index: 0 },
          { id: 'mccafe', label: 'Au McCafe', index: 1 }
        ]
      }
    }
  },
  
  // Comptoir: sur place (comptoir, mccafe, table) OU à emporter (comptoir, mccafe)
  comptoir: {
    id: 'comptoir',
    label: 'Au comptoir',
    index: 1,
    options: {
      sur_place: {
        label: 'Consommé sur place',
        recuperation: [
          { id: 'comptoir', label: 'Au comptoir', index: 0 },
          { id: 'mccafe', label: 'Au McCafe', index: 1 },
          { id: 'table', label: 'En service à table', index: 2 }
        ]
      },
      a_emporter: {
        label: 'Pris à emporter',
        recuperation: [
          { id: 'comptoir', label: 'Au comptoir', index: 0 },
          { id: 'mccafe', label: 'Au McCafe', index: 1 }
        ]
      }
    }
  },
  
  // Drive: pas d'options supplémentaires
  drive: {
    id: 'drive',
    label: 'Au drive',
    index: 2,
    options: null
  },
  
  // Guichet extérieur: pas d'options
  guichet_exterieur: {
    id: 'guichet_exterieur',
    label: 'Au guichet extérieur de vente à emporter',
    index: 3,
    options: null
  },
  
  // McCafé: sur place (comptoir, mccafe, table) OU à emporter (comptoir, mccafe)
  mccafe: {
    id: 'mccafe',
    label: 'Au McCafe',
    index: 4,
    options: {
      sur_place: {
        label: 'Consommé sur place',
        recuperation: [
          { id: 'comptoir', label: 'Au comptoir', index: 0 },
          { id: 'mccafe', label: 'Au McCafe', index: 1 },
          { id: 'table', label: 'En service à table', index: 2 }
        ]
      },
      a_emporter: {
        label: 'Pris à emporter',
        recuperation: [
          { id: 'comptoir', label: 'Au comptoir', index: 0 },
          { id: 'mccafe', label: 'Au McCafe', index: 1 }
        ]
      }
    }
  },
  
  // Click & Collect App: choix du lieu de récupération
  click_collect_app: {
    id: 'click_collect_app',
    label: 'En Click & Collect via l\'application mobile McDo+',
    index: 5,
    options: {
      recuperation: [
        { id: 'comptoir', label: 'Au comptoir', index: 0 },
        { id: 'drive', label: 'Au drive', index: 1 },
        { id: 'guichet_exterieur', label: 'Au guichet extérieur de vente à emporter', index: 2 },
        { id: 'exterieur', label: 'A l\'extérieur du restaurant', index: 3 }
      ]
    }
  },
  
  // Click & Collect Web: choix du lieu de récupération
  click_collect_web: {
    id: 'click_collect_web',
    label: 'En Click & Collect via le site internet McDonalds.fr',
    index: 6,
    options: {
      recuperation: [
        { id: 'comptoir', label: 'Au comptoir', index: 0 },
        { id: 'drive', label: 'Au drive', index: 1 },
        { id: 'guichet_exterieur', label: 'Au guichet extérieur de vente à emporter', index: 2 },
        { id: 'exterieur', label: 'A l\'extérieur du restaurant', index: 3 }
      ]
    }
  },
  
  // Livraison: choix de la plateforme
  livraison: {
    id: 'livraison',
    label: 'En livraison',
    index: 7,
    options: {
      plateforme: [
        { id: 'uber_eats', label: 'UBER EATS', index: 0 },
        { id: 'deliveroo', label: 'DELIVEROO', index: 1 },
        { id: 'just_eat', label: 'JUST EAT', index: 2 },
        { id: 'mcdo_app', label: 'L\'application mobile McDo+', index: 3 }
      ]
    }
  },
  
  // Tablette: sur place (comptoir, mccafe, table) OU à emporter (comptoir, drive, mccafe)
  tablette: {
    id: 'tablette',
    label: 'Auprès d\'un employé McDonald\'s équipé d\'une tablette',
    index: 8,
    options: {
      sur_place: {
        label: 'Consommé sur place',
        recuperation: [
          { id: 'comptoir', label: 'Au comptoir', index: 0 },
          { id: 'mccafe', label: 'Au McCafe', index: 1 },
          { id: 'table', label: 'En service à table', index: 2 }
        ]
      },
      a_emporter: {
        label: 'Pris à emporter',
        recuperation: [
          { id: 'comptoir', label: 'Au comptoir', index: 0 },
          { id: 'drive', label: 'Au drive', index: 1 },
          { id: 'mccafe', label: 'Au McCafe', index: 2 }
        ]
      }
    }
  }
};

// Configuration
const CONFIG = {
  url: 'https://survey2.medallia.eu/?hellomcdo',
  screenshotsDir: path.join(__dirname, 'scenarios'),
  headless: false,
  slowMo: 50,
  // Valeurs par défaut pour toujours obtenir les meilleures notes
  defaults: {
    age: 2, // "Entre 25 et 34 ans"
    commandeExacte: true, // Toujours "Oui"
    problemeRencontre: false, // Toujours "Non"
    contactTelephonique: false, // Toujours "Non"
    noteSatisfaction: 1, // Meilleur score (vert foncé)
    noteDimensions: 1, // Meilleur score pour toutes les dimensions
    debug: false // Mode debug (screenshots à chaque étape)
  }
};

// Créer le dossier screenshots s'il n'existe pas
if (!fs.existsSync(CONFIG.screenshotsDir)) {
  fs.mkdirSync(CONFIG.screenshotsDir, { recursive: true });
}

/**
 * Obtenir la date et l'heure actuelles
 */
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

/**
 * Attendre un délai
 */
async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Attendre un délai aléatoire entre min et max secondes
 */
async function randomWait(minSec, maxSec) {
  if (maxSec === 0) return Promise.resolve(); // Pas de délai si max = 0
  const ms = (minSec + Math.random() * (maxSec - minSec)) * 1000;
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Prendre une capture d'écran
 */
async function takeScreenshot(page, scenarioDir, name) {
  const screenshotPath = path.join(scenarioDir, `${name}.png`);
  await page.screenshot({ 
    path: screenshotPath, 
    fullPage: true 
  });
  console.log(`  📸 ${name}.png`);
}

/**
 * Cliquer sur "Suivant"
 */
async function clickSuivant(page) {
  await wait(500);
  const result = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const suivantBtn = buttons.find(b => b.textContent.includes('Suivant'));
    if (suivantBtn) {
      suivantBtn.click();
      return true;
    }
    return false;
  });
  
  if (result) {
    await wait(1000);
  }
  return result;
}

/**
 * Remplir le formulaire avec un scénario spécifique
 */
async function remplirScenario(restaurant, lieuCommande, typeConsommation, lieuRecuperation, options = {}) {
  const scenarioName = `${restaurant.id}_${lieuCommande.id}_${typeConsommation.id}_${lieuRecuperation.id}`;
  const scenarioDir = path.join(CONFIG.screenshotsDir, scenarioName);
  
  // Créer le dossier du scénario (si mode debug activé)
  if (options.debug && !fs.existsSync(scenarioDir)) {
    fs.mkdirSync(scenarioDir, { recursive: true });
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🎯 SCÉNARIO: ${scenarioName}`);
  console.log(`${'='.repeat(80)}`);
  console.log(`🏪 Restaurant: ${restaurant.nom} (${restaurant.id})`);
  console.log(`📱 Lieu de commande: ${lieuCommande.description}`);
  console.log(`🍔 Type: ${typeConsommation.description}`);
  console.log(`📦 Récupération: ${lieuRecuperation.description}`);
  console.log(`${'='.repeat(80)}\n`);
  
  const browser = await puppeteer.launch({
    headless: options.headless !== undefined ? options.headless : CONFIG.headless,
    slowMo: CONFIG.slowMo,
    defaultViewport: { width: 1920, height: 1080 }
  });
  
  const page = await browser.newPage();
  let stepNumber = 1;
  
  try {
    // Utiliser date/heure personnalisée ou actuelle
    const dateTime = options.dateHeurePersonnalisee || getDateTimeNow();
    const { date, hour, minute } = dateTime;
    
    // Délais aléatoires entre actions (en secondes)
    const delaiMin = options.delaiMin || 0;
    const delaiMax = options.delaiMax || 0;
    
    // Âge sélectionné
    const age = options.age !== undefined ? options.age : CONFIG.defaults.age;
    
    // Utiliser notes personnalisées ou par défaut
    let notes = options.notesPersonnalisees || CONFIG.defaults;
    
    // Si notes aléatoires
    if (notes === 'aleatoire') {
      notes = {
        commandeExacte: Math.random() > 0.3, // 70% oui
        problemeRencontre: Math.random() > 0.7, // 30% oui
        note: Math.floor(Math.random() * 3) + 1 // 1-3 (éviter les trop mauvaises notes)
      };
    }
    
    // 1. Page d'accueil
    console.log('📄 Étape 1: Navigation...');
    await page.goto(CONFIG.url, { waitUntil: 'networkidle2' });
    await randomWait(delaiMin, delaiMax);
    if (options.debug) await takeScreenshot(page, scenarioDir, `${String(stepNumber++).padStart(2, '0')}-accueil`);
    
    await page.click('#buttonBegin');
    await wait(1000);
    await randomWait(delaiMin, delaiMax);
    if (options.debug) await takeScreenshot(page, scenarioDir, `${String(stepNumber++).padStart(2, '0')}-age`);
    
    // 2. Sélection de l'âge
    const ageLabels = ['Moins de 15 ans', '15-24 ans', '25-34 ans', '35-49 ans', '50 ans+'];
    console.log(`📄 Étape 2: Âge (${ageLabels[age] || 'inconnu'})...`);
    await page.evaluate((ageIndex) => {
      const radios = document.querySelectorAll('input[type="radio"]');
      radios[ageIndex]?.click();
    }, age);
    await randomWait(delaiMin, delaiMax);
    await clickSuivant(page);
    if (options.debug) await takeScreenshot(page, scenarioDir, `${String(stepNumber++).padStart(2, '0')}-ticket`);
    
    // 3. Informations du ticket
    console.log('📄 Étape 3: Informations ticket...');
    await page.type('#cal_q_mc_q_date_', date);
    await randomWait(delaiMin, delaiMax);
    await page.type('#spl_rng_q_mc_q_hour', hour);
    await randomWait(delaiMin, delaiMax);
    await page.type('#spl_rng_q_mc_q_minute', minute);
    await randomWait(delaiMin, delaiMax);
    await page.type('#spl_rng_q_mc_q_idrestaurant', restaurant.id);
    await randomWait(delaiMin, delaiMax);
    if (options.debug) await takeScreenshot(page, scenarioDir, `${String(stepNumber++).padStart(2, '0')}-ticket-rempli`);
    await clickSuivant(page);
    if (options.debug) await takeScreenshot(page, scenarioDir, `${String(stepNumber++).padStart(2, '0')}-lieu-commande`);
    
    // 4. Lieu de commande
    console.log(`📄 Étape 4: Lieu de commande (${lieuCommande.label})...`);
    await page.evaluate((index) => {
      const radios = document.querySelectorAll('input[type="radio"]');
      radios[index]?.click();
    }, lieuCommande.index);
    await randomWait(delaiMin, delaiMax);
    await clickSuivant(page);
    if (options.debug) await takeScreenshot(page, scenarioDir, `${String(stepNumber++).padStart(2, '0')}-type-consommation`);
    
    // 5. Type de consommation
    console.log(`📄 Étape 5: Type consommation (${typeConsommation.label})...`);
    await page.evaluate((index) => {
      const radios = document.querySelectorAll('input[type="radio"]');
      radios[index]?.click();
    }, typeConsommation.index);
    await randomWait(delaiMin, delaiMax);
    await clickSuivant(page);
    if (options.debug) await takeScreenshot(page, scenarioDir, `${String(stepNumber++).padStart(2, '0')}-lieu-recuperation`);
    
    // 6. Lieu de récupération
    console.log(`📄 Étape 6: Lieu récupération (${lieuRecuperation.label})...`);
    await page.evaluate((index) => {
      const radios = document.querySelectorAll('input[type="radio"]');
      radios[index]?.click();
    }, lieuRecuperation.index);
    await randomWait(delaiMin, delaiMax);
    await clickSuivant(page);
    if (options.debug) await takeScreenshot(page, scenarioDir, `${String(stepNumber++).padStart(2, '0')}-satisfaction`);
    
    // 7. Satisfaction générale
    const noteText = ['⭐⭐⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐', '⭐⭐', '⭐'][notes.note - 1] || '⭐⭐⭐⭐⭐';
    console.log(`📄 Étape 7: Satisfaction (${noteText})...`);
    await page.evaluate((note) => {
      const radio = document.querySelector(`input[type="radio"][value="${note}"]`);
      radio?.click();
    }, notes.note || CONFIG.defaults.noteSatisfaction);
    await randomWait(delaiMin, delaiMax);
    await clickSuivant(page);
    if (options.debug) await takeScreenshot(page, scenarioDir, `${String(stepNumber++).padStart(2, '0')}-dimensions`);
    
    // 8. Évaluation des dimensions
    console.log(`📄 Étape 8: Dimensions (${noteText} pour chaque)...`);
    await page.evaluate((note) => {
      const radios = document.querySelectorAll(`input[type="radio"][value="${note}"]`);
      radios.forEach(r => r.click());
    }, notes.note || CONFIG.defaults.noteDimensions);
    await randomWait(delaiMin, delaiMax);
    if (options.debug) await takeScreenshot(page, scenarioDir, `${String(stepNumber++).padStart(2, '0')}-dimensions-ok`);
    await clickSuivant(page);
    if (options.debug) await takeScreenshot(page, scenarioDir, `${String(stepNumber++).padStart(2, '0')}-exactitude`);
    
    // 9. Exactitude de la commande
    const exactitudeText = notes.commandeExacte ? 'OUI ✅' : 'NON ❌';
    console.log(`📄 Étape 9: Exactitude commande (${exactitudeText})...`);
    await page.evaluate((exact) => {
      const radios = document.querySelectorAll('input[type="radio"]');
      radios[exact ? 0 : 1]?.click();
    }, notes.commandeExacte !== undefined ? notes.commandeExacte : CONFIG.defaults.commandeExacte);
    await randomWait(delaiMin, delaiMax);
    await clickSuivant(page);
    if (options.debug) await takeScreenshot(page, scenarioDir, `${String(stepNumber++).padStart(2, '0')}-problemes`);
    
    // 10. Problèmes rencontrés
    const problemeText = notes.problemeRencontre ? 'OUI ⚠️' : 'NON ✅';
    console.log(`📄 Étape 10: Problèmes (${problemeText})...`);
    await page.evaluate((probleme) => {
      const radios = document.querySelectorAll('input[type="radio"]');
      radios[probleme ? 0 : 1]?.click();
    }, notes.problemeRencontre !== undefined ? notes.problemeRencontre : CONFIG.defaults.problemeRencontre);
    await randomWait(delaiMin, delaiMax);
    await clickSuivant(page);
    if (options.debug) await takeScreenshot(page, scenarioDir, `${String(stepNumber++).padStart(2, '0')}-contact`);
    
    // 11. Contact téléphonique (toujours NON)
    console.log('📄 Étape 11: Contact (NON)...');
    await page.evaluate(() => {
      const radios = document.querySelectorAll('input[type="radio"]');
      radios[1]?.click(); // Non
    });
    await randomWait(delaiMin, delaiMax);
    await clickSuivant(page);
    if (options.debug) await takeScreenshot(page, scenarioDir, `${String(stepNumber++).padStart(2, '0')}-confirmation`);
    
    console.log('\n✅ Scénario complété avec succès!');
    if (options.debug) console.log(`📁 Screenshots: ${scenarioDir}\n`);
    
    return {
      success: true,
      scenarioName,
      restaurant: restaurant.nom,
      screenshots: stepNumber - 1
    };
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    await takeScreenshot(page, scenarioDir, `ERROR-${Date.now()}`);
    return {
      success: false,
      scenarioName,
      error: error.message
    };
  } finally {
    await wait(2000);
    await browser.close();
  }
}

/**
 * Générer tous les scénarios possibles selon la hiérarchie réelle du formulaire
 */
function genererTousLesScenarios() {
  const scenarios = [];
  
  for (const restaurant of RESTAURANTS_PARIS) {
    for (const lieuCommandeKey in SCENARIOS) {
      const lieuCommande = SCENARIOS[lieuCommandeKey];
      
      // Si pas d'options (drive, guichet_exterieur)
      if (!lieuCommande.options) {
        scenarios.push({
          restaurant,
          lieuCommande: { id: lieuCommande.id, label: lieuCommande.label, index: lieuCommande.index },
          parcours: { type: 'simple' }
        });
        continue;
      }
      
      // Si c'est une livraison (choix de plateforme)
      if (lieuCommande.options.plateforme) {
        for (const plateforme of lieuCommande.options.plateforme) {
          scenarios.push({
            restaurant,
            lieuCommande: { id: lieuCommande.id, label: lieuCommande.label, index: lieuCommande.index },
            parcours: { 
              type: 'livraison',
              plateforme
            }
          });
        }
        continue;
      }
      
      // Si c'est Click & Collect (choix de récupération uniquement)
      if (lieuCommande.options.recuperation && !lieuCommande.options.sur_place) {
        for (const recuperation of lieuCommande.options.recuperation) {
          scenarios.push({
            restaurant,
            lieuCommande: { id: lieuCommande.id, label: lieuCommande.label, index: lieuCommande.index },
            parcours: {
              type: 'click_collect',
              recuperation
            }
          });
        }
        continue;
      }
      
      // Si c'est un parcours complet (sur place / à emporter + récupération)
      if (lieuCommande.options.sur_place || lieuCommande.options.a_emporter) {
        if (lieuCommande.options.sur_place) {
          for (const recuperation of lieuCommande.options.sur_place.recuperation) {
            scenarios.push({
              restaurant,
              lieuCommande: { id: lieuCommande.id, label: lieuCommande.label, index: lieuCommande.index },
              parcours: {
                type: 'complet',
                consommation: { id: 'sur_place', label: 'Consommé sur place' },
                recuperation
              }
            });
          }
        }
        
        if (lieuCommande.options.a_emporter) {
          for (const recuperation of lieuCommande.options.a_emporter.recuperation) {
            scenarios.push({
              restaurant,
              lieuCommande: { id: lieuCommande.id, label: lieuCommande.label, index: lieuCommande.index },
              parcours: {
                type: 'complet',
                consommation: { id: 'a_emporter', label: 'Pris à emporter' },
                recuperation
              }
            });
          }
        }
      }
    }
  }
  
  return scenarios;
}

/**
 * Exécuter plusieurs tâches avec limite de concurrence
 */
async function executeWithConcurrency(tasks, concurrency) {
  const results = [];
  const executing = [];
  
  for (const [index, task] of tasks.entries()) {
    const promise = task().then(result => {
      executing.splice(executing.indexOf(promise), 1);
      return result;
    });
    
    results.push(promise);
    executing.push(promise);
    
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }
  
  return Promise.all(results);
}

/**
 * Exécuter tous les scénarios
 */
async function executerTousLesScenarios(options = {}) {
  const scenarios = genererTousLesScenarios();
  const concurrency = options.concurrency || 1;
  const headless = options.headless !== undefined ? options.headless : CONFIG.headless;
  
  console.log('\n' + '='.repeat(80));
  console.log('🚀 HELLO MCDO - AUTOMATISATION COMPLÈTE');
  console.log('='.repeat(80));
  console.log(`📊 Nombre total de scénarios: ${scenarios.length}`);
  console.log(`🏪 Restaurants: ${RESTAURANTS_PARIS.length}`);
  console.log(`📱 Lieux de commande: ${SCENARIOS.lieuCommande.length}`);
  console.log(`🍔 Types de consommation: ${SCENARIOS.typeConsommation.length}`);
  console.log(`📦 Lieux de récupération: ${SCENARIOS.lieuRecuperation.length}`);
  console.log(`⚡ Concurrence: ${concurrency} scénario(s) en parallèle`);
  console.log(`👁️  Mode: ${headless ? 'Headless' : 'Visible'}`);
  console.log('='.repeat(80));
  
  const startTime = Date.now();
  
  // Créer les tâches
  const tasks = scenarios.map((scenario, i) => async () => {
    console.log(`\n[${i + 1}/${scenarios.length}] 🔄 Démarrage du scénario...`);
    
    const resultat = await remplirScenario(
      scenario.restaurant,
      scenario.lieuCommande,
      scenario.typeConsommation,
      scenario.lieuRecuperation,
      { headless }
    );
    
    console.log(`[${i + 1}/${scenarios.length}] ${resultat.success ? '✅' : '❌'} Terminé`);
    return resultat;
  });
  
  // Exécuter avec concurrence
  const resultats = await executeWithConcurrency(tasks, concurrency);
  
  // Résumé final
  console.log('\n' + '='.repeat(80));
  console.log('📊 RÉSUMÉ FINAL');
  console.log('='.repeat(80));
  
  const succes = resultats.filter(r => r.success).length;
  const echecs = resultats.filter(r => !r.success).length;
  
  console.log(`✅ Scénarios réussis: ${succes}/${scenarios.length}`);
  console.log(`❌ Scénarios échoués: ${echecs}/${scenarios.length}`);
  
  if (echecs > 0) {
    console.log('\n⚠️ Scénarios en échec:');
    resultats.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.scenarioName}: ${r.error}`);
    });
  }
  
  const endTime = Date.now();
  const durationSeconds = Math.round((endTime - startTime) / 1000);
  const durationMinutes = Math.floor(durationSeconds / 60);
  const remainingSeconds = durationSeconds % 60;
  
  console.log('\n🏁 Tous les scénarios ont été traités!');
  console.log(`📁 Dossier de sortie: ${CONFIG.screenshotsDir}`);
  console.log(`⏱️  Durée totale: ${durationMinutes}m ${remainingSeconds}s`);
  console.log('='.repeat(80) + '\n');
  
  // Sauvegarder le résumé
  const resume = {
    date: new Date().toISOString(),
    total: scenarios.length,
    succes,
    echecs,
    concurrency,
    headless,
    durationSeconds,
    resultats
  };
  
  fs.writeFileSync(
    path.join(CONFIG.screenshotsDir, 'resume.json'),
    JSON.stringify(resume, null, 2)
  );
  
  console.log('💾 Résumé sauvegardé: resume.json\n');
}

/**
 * Exécuter un scénario spécifique
 */
async function executerScenarioSpecifique(restaurantId, lieuCommandeId, typeConsommationId, lieuRecuperationId, options = {}) {
  const restaurant = RESTAURANTS_PARIS.find(r => r.id === restaurantId);
  const lieuCommande = SCENARIOS.lieuCommande.find(l => l.id === lieuCommandeId);
  const typeConsommation = SCENARIOS.typeConsommation.find(t => t.id === typeConsommationId);
  const lieuRecuperation = SCENARIOS.lieuRecuperation.find(l => l.id === lieuRecuperationId);
  
  if (!restaurant || !lieuCommande || !typeConsommation || !lieuRecuperation) {
    console.error('❌ Scénario invalide!');
    return;
  }
  
  if (!isCompatible(typeConsommation, lieuRecuperation)) {
    console.error('❌ Combinaison incompatible!');
    return;
  }
  
  await remplirScenario(restaurant, lieuCommande, typeConsommation, lieuRecuperation, options);
}

// Interface en ligne de commande
if (require.main === module) {
  const args = process.argv.slice(2);
  
  // Parser les options
  const options = {
    concurrency: 1,
    headless: false
  };
  
  const filteredArgs = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-c' && i + 1 < args.length) {
      options.concurrency = parseInt(args[i + 1], 10);
      i++; // Skip next arg
    } else if (args[i] === '-h') {
      options.headless = true;
    } else {
      filteredArgs.push(args[i]);
    }
  }
  
  if (filteredArgs.length === 0 || filteredArgs[0] === '--all') {
    // Exécuter tous les scénarios
    executerTousLesScenarios(options).catch(console.error);
  } else if (filteredArgs[0] === '--list') {
    // Lister tous les scénarios possibles
    console.log('\n📋 SCÉNARIOS DISPONIBLES:\n');
    console.log('🏪 Restaurants:');
    RESTAURANTS_PARIS.forEach(r => console.log(`  - ${r.id}: ${r.nom}`));
    console.log('\n📱 Lieux de commande:');
    SCENARIOS.lieuCommande.forEach(l => console.log(`  - ${l.id}: ${l.label}`));
    console.log('\n🍔 Types de consommation:');
    SCENARIOS.typeConsommation.forEach(t => console.log(`  - ${t.id}: ${t.label}`));
    console.log('\n📦 Lieux de récupération:');
    SCENARIOS.lieuRecuperation.forEach(l => console.log(`  - ${l.id}: ${l.label}`));
    console.log('\nTotal de combinaisons possibles:', genererTousLesScenarios().length);
  } else if (filteredArgs.length === 4) {
    // Exécuter un scénario spécifique
    executerScenarioSpecifique(filteredArgs[0], filteredArgs[1], filteredArgs[2], filteredArgs[3], options).catch(console.error);
  } else {
    console.log(`
Usage:
  node auto-hello-mcdo-advanced.js [options] [commande]

Options:
  -c <number>    Nombre de scénarios en parallèle (défaut: 1)
  -h             Mode headless (pas d'interface graphique)

Commandes:
  --all                                Exécuter tous les scénarios (défaut)
  --list                               Lister tous les scénarios disponibles
  <resto> <commande> <conso> <recup>   Exécuter un scénario spécifique

Exemples:
  node auto-hello-mcdo-advanced.js --all
  node auto-hello-mcdo-advanced.js -c 5 --all
  node auto-hello-mcdo-advanced.js -h -c 10 --all
  node auto-hello-mcdo-advanced.js --list
  node auto-hello-mcdo-advanced.js 1234 borne sur_place comptoir
  node auto-hello-mcdo-advanced.js -h 1456 app_web drive mcdrive
    `);
  }
}

module.exports = {
  remplirScenario,
  executerTousLesScenarios,
  executerScenarioSpecifique,
  SCENARIOS,
  RESTAURANTS_PARIS
};
