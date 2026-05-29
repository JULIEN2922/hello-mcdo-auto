/**
 * Serveur web pour l'interface de gestion des scénarios Hello McDo
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { remplirScenario, SCENARIOS, RESTAURANTS_PARIS } = require('./auto-hello-mcdo-advanced');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// État de l'exécution
let executionEnCours = false;
let executionPlanifiee = false;
let timeoutPlanification = null;
let progressActuel = {
  total: 0,
  termine: 0,
  enCours: [], // Array d'objets {name, index, description}
  erreurs: [],
  planification: null // Info sur la planification (heure de début, etc.)
};

/**
 * Générer des scénarios aléatoires selon les critères avec sélections granulaires
 */
function genererScenariosAleatoires(config) {
  const combinaisonsParcours = [];
  const restaurant = { 
    id: config.numeroRestaurant, 
    nom: `Restaurant ${config.numeroRestaurant}` 
  };
  
  const selections = config.scenariosSelections || {};
  
  // Si aucune sélection, utiliser tous les scénarios
  const lieuxAUtiliser = Object.keys(selections).length > 0 
    ? Object.keys(selections)
    : Object.keys(SCENARIOS);
  
  // Pour chaque lieu de commande sélectionné
  for (const lieuKey of lieuxAUtiliser) {
    const lieu = SCENARIOS[lieuKey];
    if (!lieu) continue;
    
    const lieuCommandeData = {
      id: lieu.id,
      label: lieu.label,
      index: lieu.index
    };
    
    const selectedVariants = selections[lieuKey];
    
    // Si pas d'options (drive, guichet_exterieur)
    if (!lieu.options) {
      combinaisonsParcours.push({
        restaurant,
        lieuCommande: lieuCommandeData,
        typeConsommation: { id: 'aucun', label: 'Aucun', index: 0 },
        lieuRecuperation: { id: 'aucun', label: 'Aucun', index: 0 }
      });
      continue;
    }
    
    // Si c'est une livraison
    if (lieu.options.plateforme) {
      const plateformes = selectedVariants === 'all' || !Array.isArray(selectedVariants)
        ? lieu.options.plateforme
        : lieu.options.plateforme.filter(p => selectedVariants.some(v => v.id === p.id));
      
      for (const plateforme of plateformes) {
        combinaisonsParcours.push({
          restaurant,
          lieuCommande: lieuCommandeData,
          typeConsommation: { id: 'livraison', label: plateforme.label, index: plateforme.index },
          lieuRecuperation: { id: 'livraison', label: 'Livraison', index: 0 }
        });
      }
      continue;
    }
    
    // Si c'est Click & Collect
    if (lieu.options.recuperation && !lieu.options.sur_place) {
      const recuperations = selectedVariants === 'all' || !Array.isArray(selectedVariants)
        ? lieu.options.recuperation
        : lieu.options.recuperation.filter(r => selectedVariants.some(v => v.id === r.id));
      
      for (const recuperation of recuperations) {
        combinaisonsParcours.push({
          restaurant,
          lieuCommande: lieuCommandeData,
          typeConsommation: { id: 'click_collect', label: 'Click & Collect', index: 0 },
          lieuRecuperation: { id: recuperation.id, label: recuperation.label, index: recuperation.index }
        });
      }
      continue;
    }
    
    // Parcours complet (sur place / à emporter)
    if (lieu.options.sur_place) {
      const recuperationsSurPlace = selectedVariants === 'all' || !Array.isArray(selectedVariants)
        ? lieu.options.sur_place.recuperation
        : lieu.options.sur_place.recuperation.filter(r => 
            selectedVariants.some(v => v.consommation === 'sur_place' && v.id === r.id)
          );
      
      for (const recuperation of recuperationsSurPlace) {
        combinaisonsParcours.push({
          restaurant,
          lieuCommande: lieuCommandeData,
          typeConsommation: { id: 'sur_place', label: 'Consommé sur place', index: 0 },
          lieuRecuperation: { id: recuperation.id, label: recuperation.label, index: recuperation.index }
        });
      }
    }
    
    if (lieu.options.a_emporter) {
      const recuperationsAEmporter = selectedVariants === 'all' || !Array.isArray(selectedVariants)
        ? lieu.options.a_emporter.recuperation
        : lieu.options.a_emporter.recuperation.filter(r => 
            selectedVariants.some(v => v.consommation === 'a_emporter' && v.id === r.id)
          );
      
      for (const recuperation of recuperationsAEmporter) {
        combinaisonsParcours.push({
          restaurant,
          lieuCommande: lieuCommandeData,
          typeConsommation: { id: 'a_emporter', label: 'Pris à emporter', index: 1 },
          lieuRecuperation: { id: recuperation.id, label: recuperation.label, index: recuperation.index }
        });
      }
    }
  }
  
  // Mélanger les combinaisons
  const parcoursMelanges = combinaisonsParcours.sort(() => Math.random() - 0.5);
  const nombre = Math.min(config.nombre || 1, parcoursMelanges.length * 100);
  
  // Créer les scénarios en sélectionnant aléatoirement parmi les combinaisons
  const scenarios = [];
  for (let i = 0; i < nombre; i++) {
    // Sélectionner une combinaison aléatoire pour chaque scénario
    const indexAleatoire = Math.floor(Math.random() * parcoursMelanges.length);
    scenarios.push(parcoursMelanges[indexAleatoire]);
  }
  
  return scenarios;
}

/**
 * Exécuter avec limite de concurrence
 */
async function executeWithConcurrency(tasks, concurrency) {
  const results = [];
  const executing = [];
  
  for (const task of tasks) {
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
 * Planifier une exécution dans une plage horaire
 */
function planifierExecution(config) {
  const maintenant = new Date();
  const [heureDebut, minuteDebut] = config.plageHoraireHeureDebut.split(':').map(Number);
  const [heureFin, minuteFin] = config.plageHoraireFin.split(':').map(Number);
  
  // Utiliser les dates fournies ou la date actuelle par défaut
  const dateDebut = config.plageHoraireDateDebut || maintenant.toISOString().split('T')[0];
  const dateFin = config.plageHoraireDateFin || maintenant.toISOString().split('T')[0];
  
  const debut = new Date(dateDebut);
  debut.setHours(heureDebut, minuteDebut, 0, 0);
  
  const fin = new Date(dateFin);
  fin.setHours(heureFin, minuteFin, 0, 0);
  
  // Calculer le délai avant le début
  const delaiDebut = Math.max(0, debut.getTime() - maintenant.getTime());
  
  return {
    debut,
    fin,
    delaiDebut,
    dureeDisponible: fin.getTime() - Math.max(debut.getTime(), maintenant.getTime())
  };
}

/**
 * Générer des dates/heures aléatoires dans la plage
 */
function genererDateHeureAleatoire(debut, fin) {
  const timestampDebut = debut.getTime();
  const timestampFin = fin.getTime();
  const timestampAleatoire = timestampDebut + Math.random() * (timestampFin - timestampDebut);
  
  const date = new Date(timestampAleatoire);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  
  return {
    date: `${day}/${month}/${year}`,
    hour,
    minute
  };
}

// Routes API

/**
 * GET /api/configuration - Récupérer la configuration disponible
 */
app.get('/api/configuration', (req, res) => {
  res.json({
    scenarios: SCENARIOS
  });
});

/**
 * POST /api/scenarios/preview - Prévisualiser les scénarios qui seront générés
 */
app.post('/api/scenarios/preview', (req, res) => {
  try {
    // Validation du numéro de restaurant
    if (!req.body.numeroRestaurant) {
      return res.status(400).json({ error: 'Le numéro de restaurant est obligatoire' });
    }
    
    const scenarios = genererScenariosAleatoires(req.body);
    
    console.log('📊 Configuration reçue:', {
      distributionAvis: req.body.distributionAvis,
      distributionAge: req.body.distributionAge,
      nombreScenarios: scenarios.length
    });
    
    // Distribuer les attributs des scénarios
    const notesDistribuees = req.body.distributionAvis 
      ? distribuerNotes(scenarios.length, req.body.distributionAvis)
      : scenarios.map(() => ({ commandeExacte: true, problemeRencontre: false, note: 1 }));
    
    const agesDistribues = req.body.distributionAge
      ? distribuerAges(scenarios.length, req.body.distributionAge)
      : scenarios.map(() => 2);
    
    console.log('📊 Distributions créées:', {
      notes: notesDistribuees.length,
      ages: agesDistribues.length,
      premiereNote: notesDistribuees[0],
      premierAge: agesDistribues[0]
    });
    
    const commandeExacteDistribuee = distribuerCommandeExacte(
      scenarios.length, 
      req.body.pourcentageCommandeExacte !== undefined ? req.body.pourcentageCommandeExacte : 100
    );
    
    const problemesDistribues = distribuerProblemes(
      scenarios.length,
      req.body.pourcentageProbleme !== undefined ? req.body.pourcentageProbleme : 0
    );
    
    // Mapper les âges en labels
    const ageLabels = {
      1: '15-24 ans',
      2: '25-34 ans',
      3: '35-49 ans',
      4: '50 ans et plus'
    };
    
    // Mapper les notes en étoiles
    const noteLabels = {
      1: '⭐⭐⭐⭐⭐ (5/5)',
      2: '⭐⭐⭐⭐ (4/5)',
      3: '⭐⭐⭐ (3/5)',
      4: '⭐⭐ (2/5)',
      5: '⭐ (1/5)'
    };
    
    // Fonction pour formater les notes détaillées
    const formaterNotesDetaillees = (notesDetaillees) => {
      if (!notesDetaillees) return null;
      return {
        satisfaction: noteLabels[notesDetaillees.satisfaction],
        qualite: noteLabels[notesDetaillees.qualite],
        amabilite: noteLabels[notesDetaillees.amabilite],
        proprete: noteLabels[notesDetaillees.proprete],
        rapidite: noteLabels[notesDetaillees.rapidite]
      };
    };
    
    // Calculer les dates/heures théoriques d'exécution
    let dateExecutionTheorique = null;
    
    if (req.body.utiliserPlageHoraire) {
      // Extraire la plage horaire
      const dateDebut = new Date(`${req.body.plageHoraireDateDebut}T${req.body.plageHoraireHeureDebut}:00`);
      const dateFin = new Date(`${req.body.plageHoraireDateFin}T${req.body.plageHoraireFin}:00`);
      
      const maintenant = Date.now();
      const tempsDebut = dateDebut.getTime();
      const tempsFin = dateFin.getTime();
      const dureetotale = tempsFin - tempsDebut;
      
      // Calculer les moments théoriques pour chaque scénario
      const scenariosAvecDates = scenarios.map((s, index) => {
        // Distribution aléatoire dans la plage
        const momentAleatoire = Math.random();
        const delaiDepuisDebut = dureetotale * momentAleatoire;
        const momentExecution = tempsDebut + delaiDepuisDebut;
        
        return {
          restaurant: s.restaurant.nom,
          restaurantId: s.restaurant.id,
          lieuCommande: s.lieuCommande.label,
          typeConsommation: s.typeConsommation.label,
          lieuRecuperation: s.lieuRecuperation.label,
          momentExecution: momentExecution, // Timestamp pour le tri
          age: ageLabels[agesDistribues[index]] || 'Non défini',
          note: notesDistribuees[index] && notesDistribuees[index].note ? noteLabels[notesDistribuees[index].note] : 'Non défini',
          notesDetaillees: notesDistribuees[index] && notesDistribuees[index].notesDetaillees ? formaterNotesDetaillees(notesDistribuees[index].notesDetaillees) : null,
          commandeExacte: commandeExacteDistribuee[index],
          problemeRencontre: problemesDistribues[index]
        };
      });
      
      // Trier par timestamp
      scenariosAvecDates.sort((a, b) => a.momentExecution - b.momentExecution);
      
      // Formater les dates après le tri
      scenariosAvecDates.forEach(scenario => {
        scenario.dateExecution = new Date(scenario.momentExecution).toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        delete scenario.momentExecution; // Retirer le timestamp de la réponse
      });
      
      res.json({
        nombre: scenarios.length,
        scenarios: scenariosAvecDates,
        utiliserPlageHoraire: true
      });
    } else {
      // Exécution immédiate
      res.json({
        nombre: scenarios.length,
        scenarios: scenarios.map((s, index) => ({
          restaurant: s.restaurant.nom,
          restaurantId: s.restaurant.id,
          lieuCommande: s.lieuCommande.label,
          typeConsommation: s.typeConsommation.label,
          lieuRecuperation: s.lieuRecuperation.label,
          age: ageLabels[agesDistribues[index]] || 'Non défini',
          note: notesDistribuees[index] && notesDistribuees[index].note ? noteLabels[notesDistribuees[index].note] : 'Non défini',
          notesDetaillees: notesDistribuees[index] && notesDistribuees[index].notesDetaillees ? formaterNotesDetaillees(notesDistribuees[index].notesDetaillees) : null,
          commandeExacte: commandeExacteDistribuee[index],
          problemeRencontre: problemesDistribues[index]
        })),
        utiliserPlageHoraire: false
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Générer des notes détaillées avec variation autour de la note globale
 */
function genererNotesDetaillees(noteGlobale) {
  // noteGlobale est entre 1 (meilleur) et 5 (pire)
  const notes = {
    satisfaction: noteGlobale,
    qualite: noteGlobale,
    amabilite: noteGlobale,
    proprete: noteGlobale,
    rapidite: noteGlobale
  };
  
  // Ajouter une légère variation aléatoire (+/- 1) pour chaque critère
  const criteres = ['qualite', 'amabilite', 'proprete', 'rapidite'];
  criteres.forEach(critere => {
    const variation = Math.random() < 0.3 ? (Math.random() < 0.5 ? -1 : 1) : 0; // 30% de chance de varier
    notes[critere] = Math.max(1, Math.min(5, noteGlobale + variation));
  });
  
  return notes;
}

/**
 * Distribuer les notes selon les pourcentages définis
 */
function distribuerNotes(nombreScenarios, distributionAvis) {
  // Convertir les pourcentages en valeurs de notes
  // Note 1 = 5/5 (Excellent), Note 2 = 4/5 (Bon), Note 3 = 3/5 (Moyen), Note 4 = 2/5 (Mauvais), Note 5 = 1/5 (Très mauvais)
  const notesMapping = {
    5: { commandeExacte: true, problemeRencontre: false, note: 1 },  // 5 étoiles
    4: { commandeExacte: true, problemeRencontre: false, note: 2 },  // 4 étoiles
    3: { commandeExacte: true, problemeRencontre: false, note: 3 },  // 3 étoiles
    2: { commandeExacte: false, problemeRencontre: true, note: 4 },  // 2 étoiles
    1: { commandeExacte: false, problemeRencontre: true, note: 5 }   // 1 étoile
  };
  
  const notes = [];
  
  // Calculer le nombre de scénarios pour chaque note selon les pourcentages
  for (const [etoiles, pourcentage] of Object.entries(distributionAvis)) {
    const etoilesNum = parseInt(etoiles); // Convertir en nombre
    const nombre = Math.round((pourcentage / 100) * nombreScenarios);
    for (let i = 0; i < nombre; i++) {
      const noteBase = { ...notesMapping[etoilesNum] };
      noteBase.notesDetaillees = genererNotesDetaillees(noteBase.note);
      notes.push(noteBase);
    }
  }
  
  // Ajuster si le total ne correspond pas exactement (à cause des arrondis)
  while (notes.length < nombreScenarios) {
    // Ajouter la note la plus fréquente
    const maxPourcentage = Math.max(...Object.values(distributionAvis));
    const etoilesMax = parseInt(Object.keys(distributionAvis).find(key => distributionAvis[key] === maxPourcentage));
    const noteBase = { ...notesMapping[etoilesMax] };
    noteBase.notesDetaillees = genererNotesDetaillees(noteBase.note);
    notes.push(noteBase);
  }
  
  while (notes.length > nombreScenarios) {
    notes.pop();
  }
  
  // Mélanger les notes pour une distribution aléatoire
  return notes.sort(() => Math.random() - 0.5);
}

/**
 * Distribuer les âges selon les pourcentages définis
 */
function distribuerAges(nombreScenarios, distributionAge) {
  const ages = [];
  
  // Calculer le nombre de scénarios pour chaque tranche d'âge selon les pourcentages
  for (const [age, pourcentage] of Object.entries(distributionAge)) {
    const nombre = Math.round((pourcentage / 100) * nombreScenarios);
    for (let i = 0; i < nombre; i++) {
      ages.push(parseInt(age));
    }
  }
  
  // Ajuster si le total ne correspond pas exactement (à cause des arrondis)
  while (ages.length < nombreScenarios) {
    // Ajouter l'âge le plus fréquent
    const maxPourcentage = Math.max(...Object.values(distributionAge));
    const ageMax = Object.keys(distributionAge).find(key => distributionAge[key] === maxPourcentage);
    ages.push(parseInt(ageMax));
  }
  
  while (ages.length > nombreScenarios) {
    ages.pop();
  }
  
  // Mélanger les âges pour une distribution aléatoire
  return ages.sort(() => Math.random() - 0.5);
}

/**
 * Distribuer les valeurs de commande exacte selon le pourcentage
 */
function distribuerCommandeExacte(nombreScenarios, pourcentage) {
  const valeurs = [];
  const nombreExactes = Math.round((pourcentage / 100) * nombreScenarios);
  
  for (let i = 0; i < nombreExactes; i++) {
    valeurs.push(true);
  }
  
  for (let i = nombreExactes; i < nombreScenarios; i++) {
    valeurs.push(false);
  }
  
  // Mélanger pour une distribution aléatoire
  return valeurs.sort(() => Math.random() - 0.5);
}

/**
 * Distribuer les valeurs de problème rencontré selon le pourcentage
 */
function distribuerProblemes(nombreScenarios, pourcentage) {
  const valeurs = [];
  const nombreProblemes = Math.round((pourcentage / 100) * nombreScenarios);
  
  for (let i = 0; i < nombreProblemes; i++) {
    valeurs.push(true);
  }
  
  for (let i = nombreProblemes; i < nombreScenarios; i++) {
    valeurs.push(false);
  }
  
  // Mélanger pour une distribution aléatoire
  return valeurs.sort(() => Math.random() - 0.5);
}

/**
 * Exécuter les scénarios avec planification dans le temps
 */
async function executerScenariosAvecPlanification(scenarios, config, planning) {
  console.log('🚀 Début de l\'exécution des scénarios...');
  
  const maintenant = Date.now();
  const tempsDebut = planning.debut.getTime();
  const tempsFin = planning.fin.getTime();
  const dureeDisponible = tempsFin - Math.max(tempsDebut, maintenant);
  
  // Générer des moments d'exécution aléatoires pour chaque scénario
  const momentsExecution = scenarios.map(() => {
    const momentAleatoire = Math.max(tempsDebut, maintenant) + Math.random() * dureeDisponible;
    return momentAleatoire;
  });
  
  // Distribuer les notes selon les pourcentages définis
  const notesDistribuees = config.distributionAvis 
    ? distribuerNotes(scenarios.length, config.distributionAvis)
    : scenarios.map(() => ({ commandeExacte: true, problemeRencontre: false, note: 1 })); // Par défaut: excellent
  
  // Distribuer les âges selon les pourcentages définis
  const agesDistribues = config.distributionAge
    ? distribuerAges(scenarios.length, config.distributionAge)
    : scenarios.map(() => 2); // Par défaut: 25-34 ans
  
  // Distribuer les valeurs de commande exacte et problème
  const commandeExacteDistribuee = distribuerCommandeExacte(
    scenarios.length,
    config.pourcentageCommandeExacte !== undefined ? config.pourcentageCommandeExacte : 100
  );
  
  const problemesDistribues = distribuerProblemes(
    scenarios.length,
    config.pourcentageProbleme !== undefined ? config.pourcentageProbleme : 0
  );
  
  // Trier les moments d'exécution pour les traiter dans l'ordre chronologique
  const scenariosAvecMoments = scenarios.map((scenario, index) => ({
    scenario,
    momentExecution: momentsExecution[index],
    notePersonnalisee: notesDistribuees[index],
    agePersonnalise: agesDistribues[index],
    commandeExacte: commandeExacteDistribuee[index],
    problemeRencontre: problemesDistribues[index],
    index: index + 1
  })).sort((a, b) => a.momentExecution - b.momentExecution);
  
  // Créer les tâches avec délais planifiés aléatoires
  const tasks = scenariosAvecMoments.map(({ scenario, momentExecution, notePersonnalisee, agePersonnalise, commandeExacte, problemeRencontre, index }) => async () => {
    const scenarioName = `${scenario.restaurant.id}_${scenario.lieuCommande.id}_${scenario.typeConsommation.id}_${scenario.lieuRecuperation.id}`;
    
    const delaiAvantExecution = momentExecution - Date.now();
    
    // Attendre jusqu'au moment prévu
    if (delaiAvantExecution > 0) {
      const dateExecution = new Date(momentExecution);
      console.log(`⏳ Scénario ${index}/${scenarios.length} planifié pour ${dateExecution.toLocaleTimeString('fr-FR')}`);
      await new Promise(resolve => setTimeout(resolve, delaiAvantExecution));
    }
    
    progressActuel.enCours.push({
      name: scenarioName,
      index: index,
      description: `${scenario.lieuCommande.label} - ${scenario.typeConsommation.label}`,
      etape: 'Démarrage...'
    });
    
    try {
      // Générer une date/heure correspondant au moment d'exécution
      const dateExecution = new Date(momentExecution);
      const dateHeure = config.utiliserPlageHoraire ? {
        date: dateExecution.toLocaleDateString('fr-FR', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric' 
        }),
        hour: String(dateExecution.getHours()).padStart(2, '0'),
        minute: String(dateExecution.getMinutes()).padStart(2, '0')
      } : null;
      
      console.log(`🔄 Exécution du scénario ${index}/${scenarios.length} à ${dateExecution.toLocaleTimeString('fr-FR')}`);
      
      // Combiner les notes avec les valeurs de commandeExacte et problemeRencontre
      const noteFinale = {
        ...notePersonnalisee,
        commandeExacte: commandeExacte,
        problemeRencontre: problemeRencontre
      };
      
      const resultat = await remplirScenario(
        scenario.restaurant,
        scenario.lieuCommande,
        scenario.typeConsommation,
        scenario.lieuRecuperation,
        {
          headless: config.headless !== false,
          debug: config.debug === true,
          dateHeurePersonnalisee: dateHeure,
          notesPersonnalisees: noteFinale,
          age: agePersonnalise,
          delaiMin: config.delaiMin || 0,
          delaiMax: config.delaiMax || 0
        }
      );
      
      progressActuel.enCours = progressActuel.enCours.filter(s => s.name !== scenarioName);
      progressActuel.termine++;
      
      if (!resultat.success) {
        progressActuel.erreurs.push({ scenarioName, error: resultat.error });
      }
      
      console.log(`✅ Scénario ${index}/${scenarios.length} terminé`);
      return resultat;
    } catch (error) {
      progressActuel.enCours = progressActuel.enCours.filter(s => s.name !== scenarioName);
      progressActuel.termine++;
      progressActuel.erreurs.push({ scenarioName, error: error.message });
      console.error(`❌ Erreur scénario ${index}/${scenarios.length}:`, error.message);
      return { success: false, scenarioName, error: error.message };
    }
  });
  
  // Exécuter avec concurrence
  const concurrency = config.concurrence || 1;
  await executeWithConcurrency(tasks, concurrency);
  
  console.log('✅ Exécution terminée!');
  executionEnCours = false;
  executionPlanifiee = false;
  progressActuel.planification = null;
}

/**
 * POST /api/scenarios/executer - Lancer l'exécution des scénarios
 */
app.post('/api/scenarios/executer', async (req, res) => {
  if (executionEnCours || executionPlanifiee) {
    return res.status(409).json({ error: 'Une exécution est déjà en cours ou planifiée' });
  }
  
  try {
    const config = req.body;
    
    // Validation du numéro de restaurant
    if (!config.numeroRestaurant) {
      return res.status(400).json({ error: 'Le numéro de restaurant est obligatoire' });
    }
    
    const scenarios = genererScenariosAleatoires(config);
    
    if (scenarios.length === 0) {
      return res.status(400).json({ error: 'Aucun scénario ne correspond aux critères' });
    }
    
    // Calculer la planification
    const planning = planifierExecution(config);
    const maintenant = Date.now();
    
    // Initialiser le progrès
    progressActuel = {
      total: scenarios.length,
      termine: 0,
      enCours: [],
      erreurs: [],
      config,
      planification: {
        debut: planning.debut.toISOString(),
        fin: planning.fin.toISOString(),
        delaiDebut: planning.delaiDebut,
        statut: planning.delaiDebut > 0 ? 'EN_ATTENTE' : 'EN_COURS'
      }
    };
    
    // Si on doit attendre avant de commencer
    if (planning.delaiDebut > 0) {
      executionPlanifiee = true;
      const minutesAttente = Math.round(planning.delaiDebut / 60000);
      console.log(`⏰ Exécution planifiée dans ${minutesAttente} minute(s) (à ${planning.debut.toLocaleTimeString('fr-FR')})`);
      
      res.json({
        message: `Exécution planifiée pour ${planning.debut.toLocaleTimeString('fr-FR')}`,
        nombreScenarios: scenarios.length,
        debut: planning.debut.toISOString(),
        fin: planning.fin.toISOString(),
        delaiDebut: planning.delaiDebut,
        minutesAttente,
        statut: 'EN_ATTENTE'
      });
      
      // Planifier l'exécution
      timeoutPlanification = setTimeout(async () => {
        executionPlanifiee = false;
        executionEnCours = true;
        progressActuel.planification.statut = 'EN_COURS';
        await executerScenariosAvecPlanification(scenarios, config, planning);
      }, planning.delaiDebut);
      
    } else {
      // Exécuter immédiatement
      executionEnCours = true;
      
      res.json({
        message: 'Exécution démarrée immédiatement',
        nombreScenarios: scenarios.length,
        debut: planning.debut.toISOString(),
        fin: planning.fin.toISOString(),
        delaiDebut: 0,
        statut: 'EN_COURS'
      });
      
      // Démarrer l'exécution de manière asynchrone
      executerScenariosAvecPlanification(scenarios, config, planning).catch(error => {
        console.error('Erreur lors de l\'exécution:', error);
        executionEnCours = false;
        executionPlanifiee = false;
      });
    }
    
  } catch (error) {
    executionEnCours = false;
    executionPlanifiee = false;
    console.error('Erreur lors de la planification:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/progress - Récupérer le progrès de l'exécution
 */
app.get('/api/progress', (req, res) => {
  res.json({
    enCours: executionEnCours,
    planifiee: executionPlanifiee,
    ...progressActuel
  });
});

/**
 * POST /api/stop - Arrêter l'exécution en cours
 */
app.post('/api/stop', (req, res) => {
  if (!executionEnCours && !executionPlanifiee) {
    return res.status(400).json({ error: 'Aucune exécution en cours ou planifiée' });
  }
  
  // Annuler la planification si elle existe
  if (timeoutPlanification) {
    clearTimeout(timeoutPlanification);
    timeoutPlanification = null;
  }
  
  executionEnCours = false;
  executionPlanifiee = false;
  
  res.json({ message: 'Exécution arrêtée / Planification annulée' });
});

// Route principale
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(80));
  console.log('🌐 SERVEUR HELLO MCDO - INTERFACE WEB');
  console.log('='.repeat(80));
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📊 Ouvrez votre navigateur à cette adresse pour configurer les scénarios`);
  console.log('='.repeat(80) + '\n');
});
