/**
 * Serveur web pour l'interface de gestion des scénarios Hello McDo
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { remplirScenario, SCENARIOS, RESTAURANTS_PARIS } = require('./auto-hello-mcdo-advanced');

const app = express();
const PORT = 3000;

// Initialiser la base de données
const db = new sqlite3.Database('./logs.db', (err) => {
  if (err) {
    console.error('Erreur lors de l\'ouverture de la base de données:', err);
  } else {
    console.log('✅ Base de données connectée');
    initDatabase();
  }
});

// Créer les tables si elles n'existent pas
function initDatabase() {
  db.run(`CREATE TABLE IF NOT EXISTS scenario_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date_execution DATETIME DEFAULT CURRENT_TIMESTAMP,
    restaurant_id TEXT,
    lieu_commande TEXT,
    type_consommation TEXT,
    lieu_recuperation TEXT,
    age TEXT,
    note INTEGER,
    notes_detaillees TEXT,
    commande_exacte BOOLEAN,
    probleme_rencontre BOOLEAN,
    success BOOLEAN,
    error TEXT,
    duree_ms INTEGER,
    date_prevue TEXT
  )`, (err) => {
    if (err) {
      console.error('Erreur lors de la création de la table:', err);
    } else {
      console.log('✅ Table scenario_logs prête');
    }
  });
}

// Fonction pour logger un scénario
function logScenario(scenarioData) {
  const {
    restaurant,
    lieuCommande,
    typeConsommation,
    lieuRecuperation,
    age,
    note,
    notesDetaillees,
    commandeExacte,
    problemeRencontre,
    success,
    error,
    duree,
    datePrevue
  } = scenarioData;

  const sql = `INSERT INTO scenario_logs (
    restaurant_id, lieu_commande, type_consommation, lieu_recuperation,
    age, note, notes_detaillees, commande_exacte, probleme_rencontre,
    success, error, duree_ms, date_prevue
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  db.run(sql, [
    restaurant,
    lieuCommande,
    typeConsommation,
    lieuRecuperation,
    age,
    note,
    JSON.stringify(notesDetaillees),
    commandeExacte ? 1 : 0,
    problemeRencontre ? 1 : 0,
    success ? 1 : 0,
    error || null,
    duree || null,
    datePrevue || null
  ], (err) => {
    if (err) {
      console.error('Erreur lors de l\'enregistrement du log:', err);
    }
  });
}

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
  
  // Mode immédiat : pas de planification
  if (config.modePlanification === 'immediate') {
    return {
      mode: 'immediate',
      debut: maintenant,
      fin: maintenant,
      delaiDebut: 0,
      dureeDisponible: 0
    };
  }
  
  // Mode simple : une seule plage horaire
  if (config.modePlanification === 'simple') {
    const [heureDebut, minuteDebut] = config.plageHoraireHeureDebut.split(':').map(Number);
    const [heureFin, minuteFin] = config.plageHoraireFin.split(':').map(Number);
    
    const dateDebut = config.plageHoraireDateDebut || maintenant.toISOString().split('T')[0];
    const dateFin = config.plageHoraireDateFin || maintenant.toISOString().split('T')[0];
    
    const debut = new Date(dateDebut);
    debut.setHours(heureDebut, minuteDebut, 0, 0);
    
    const fin = new Date(dateFin);
    fin.setHours(heureFin, minuteFin, 0, 0);
    
    const delaiDebut = Math.max(0, debut.getTime() - maintenant.getTime());
    
    return {
      mode: 'simple',
      debut,
      fin,
      delaiDebut,
      dureeDisponible: fin.getTime() - Math.max(debut.getTime(), maintenant.getTime())
    };
  }
  
  // Mode avancé : plusieurs tranches horaires
  if (config.modePlanification === 'avancee' && config.tranches) {
    return {
      mode: 'avancee',
      tranches: config.tranches,
      delaiDebut: 0
    };
  }
  
  // Par défaut : mode immédiat
  return {
    mode: 'immediate',
    debut: maintenant,
    fin: maintenant,
    delaiDebut: 0,
    dureeDisponible: 0
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

/**
 * Générer des moments d'exécution pour le mode avancé (plusieurs tranches)
 * Distribue aléatoirement les scénarios sur les différents jours et tranches horaires de la semaine
 */
function genererMomentsExecutionAvancee(nombreScenarios, tranches) {
  const maintenant = new Date();
  const moments = [];
  
  // Construire tous les créneaux disponibles pour la semaine à venir
  const creneaux = [];
  
  // Pour chaque tranche horaire définie
  tranches.forEach(tranche => {
    const [heureDebut, minuteDebut] = tranche.heureDebut.split(':').map(Number);
    const [heureFin, minuteFin] = tranche.heureFin.split(':').map(Number);
    
    // Pour les 7 prochains jours
    for (let jourOffset = 0; jourOffset < 7; jourOffset++) {
      const jourCible = new Date(maintenant);
      jourCible.setDate(maintenant.getDate() + jourOffset);
      const jourSemaine = jourCible.getDay(); // 0 = Dimanche, 1 = Lundi, etc.
      
      // Vérifier si ce jour est sélectionné dans la tranche
      if (tranche.jours.includes(jourSemaine)) {
        const debut = new Date(jourCible);
        debut.setHours(heureDebut, minuteDebut, 0, 0);
        
        const fin = new Date(jourCible);
        fin.setHours(heureFin, minuteFin, 0, 0);
        
        creneaux.push({ debut, fin });
      }
    }
  });
  
  if (creneaux.length === 0) {
    console.warn('⚠️  Aucun créneau disponible, exécution immédiate');
    return Array(nombreScenarios).fill(maintenant.getTime());
  }
  
  // Distribuer aléatoirement les scénarios sur les créneaux
  for (let i = 0; i < nombreScenarios; i++) {
    // Choisir un créneau aléatoire
    const creneau = creneaux[Math.floor(Math.random() * creneaux.length)];
    
    // Générer un moment aléatoire dans ce créneau
    const timestampDebut = creneau.debut.getTime();
    const timestampFin = creneau.fin.getTime();
    const momentAleatoire = timestampDebut + Math.random() * (timestampFin - timestampDebut);
    
    moments.push(momentAleatoire);
  }
  
  return moments;
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
    
    // Préparer la planification selon le mode
    const planning = planifierExecution(req.body);
    let momentsExecution;
    
    if (planning.mode === 'immediate') {
      // Mode immédiat : exécution immédiate
      momentsExecution = scenarios.map(() => Date.now());
    } else if (planning.mode === 'simple') {
      // Mode simple : distribution sur une seule plage horaire
      const tempsDebut = planning.debut.getTime();
      const tempsFin = planning.fin.getTime();
      const dureeTotale = tempsFin - tempsDebut;
      
      momentsExecution = scenarios.map(() => {
        return tempsDebut + Math.random() * dureeTotale;
      });
    } else if (planning.mode === 'avancee') {
      // Mode avancé : distribution sur plusieurs tranches
      momentsExecution = genererMomentsExecutionAvancee(scenarios.length, planning.tranches);
    } else {
      momentsExecution = scenarios.map(() => Date.now());
    }
    
    // Construire les scénarios avec leurs dates d'exécution
    const scenariosAvecDates = scenarios.map((s, index) => {
      const momentExecution = momentsExecution[index];
      
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
      if (planning.mode === 'immediate') {
        scenario.dateExecution = 'Immédiat';
      } else {
        scenario.dateExecution = new Date(scenario.momentExecution).toLocaleString('fr-FR', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      delete scenario.momentExecution; // Retirer le timestamp de la réponse
    });
    
    res.json({
      nombre: scenarios.length,
      scenarios: scenariosAvecDates,
      modePlanification: planning.mode
    });
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
  let momentsExecution;
  
  // Générer les moments d'exécution selon le mode de planification
  if (planning.mode === 'immediate') {
    // Mode immédiat : tous les scénarios s'exécutent immédiatement
    momentsExecution = scenarios.map(() => maintenant);
    console.log('⚡ Mode immédiat : exécution de tous les scénarios maintenant');
  } else if (planning.mode === 'simple') {
    // Mode simple : distribution aléatoire sur une seule plage horaire
    const tempsDebut = planning.debut.getTime();
    const tempsFin = planning.fin.getTime();
    const dureeTotale = tempsFin - tempsDebut;
    
    momentsExecution = scenarios.map(() => {
      const momentAleatoire = tempsDebut + Math.random() * dureeTotale;
      return momentAleatoire;
    });
    
    console.log(`📅 Mode simple : distribution sur la plage ${planning.debut.toLocaleString('fr-FR')} - ${planning.fin.toLocaleString('fr-FR')}`);
  } else if (planning.mode === 'avancee') {
    // Mode avancé : distribution aléatoire sur plusieurs tranches horaires
    momentsExecution = genererMomentsExecutionAvancee(scenarios.length, planning.tranches);
    console.log(`📅 Mode avancé : distribution sur ${planning.tranches.length} tranche(s) horaire(s)`);
  } else {
    // Par défaut : exécution immédiate
    momentsExecution = scenarios.map(() => maintenant);
  }
  
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
    
    // Attendre jusqu'au moment prévu (sauf si c'est dans le passé)
    if (delaiAvantExecution > 0) {
      const dateExecution = new Date(momentExecution);
      console.log(`⏳ Scénario ${index}/${scenarios.length} planifié pour ${dateExecution.toLocaleTimeString('fr-FR')}`);
      await new Promise(resolve => setTimeout(resolve, delaiAvantExecution));
    } else {
      const dateExecution = new Date(momentExecution);
      console.log(`⚡ Scénario ${index}/${scenarios.length} (prévu pour ${dateExecution.toLocaleTimeString('fr-FR')}) - Exécution immédiate (heure passée)`);
    }
    
    progressActuel.enCours.push({
      name: scenarioName,
      index: index,
      restaurant: scenario.restaurant.id,
      lieuCommande: scenario.lieuCommande.label,
      typeConsommation: scenario.typeConsommation.label,
      lieuRecuperation: scenario.lieuRecuperation.label,
      dateExecution: new Date(momentExecution).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      etape: 'Démarrage du navigateur...',
      progress: 0
    });
    
    try {
      // Générer une date/heure correspondant au moment d'exécution
      const dateExecution = new Date(momentExecution);
      const dateHeure = (config.modePlanification && config.modePlanification !== 'immediate') ? {
        date: dateExecution.toLocaleDateString('fr-FR', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric' 
        }),
        hour: String(dateExecution.getHours()).padStart(2, '0'),
        minute: String(dateExecution.getMinutes()).padStart(2, '0')
      } : null;
      
      console.log(`🔄 Exécution du scénario ${index}/${scenarios.length} à ${dateExecution.toLocaleTimeString('fr-FR')}`);
      
      // Mettre à jour l'étape
      const scenarioEnCours = progressActuel.enCours.find(s => s.name === scenarioName);
      if (scenarioEnCours) {
        scenarioEnCours.etape = 'Navigation vers le formulaire...';
        scenarioEnCours.progress = 20;
      }
      
      // Combiner les notes avec les valeurs de commandeExacte et problemeRencontre
      const noteFinale = {
        ...notePersonnalisee,
        commandeExacte: commandeExacte,
        problemeRencontre: problemeRencontre
      };
      
      // Mettre à jour avant le remplissage
      if (scenarioEnCours) {
        scenarioEnCours.etape = 'Remplissage du questionnaire...';
        scenarioEnCours.progress = 40;
      }
      
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
      
      // Mettre à jour après le remplissage
      if (scenarioEnCours) {
        scenarioEnCours.etape = 'Finalisation...';
        scenarioEnCours.progress = 90;
      }
      
      progressActuel.enCours = progressActuel.enCours.filter(s => s.name !== scenarioName);
      progressActuel.termine++;
      
      if (!resultat.success) {
        progressActuel.erreurs.push({ scenarioName, error: resultat.error });
      }
      
      // Logger le scénario dans la base de données
      logScenario({
        restaurant: scenario.restaurant.id,
        lieuCommande: scenario.lieuCommande.label,
        typeConsommation: scenario.typeConsommation.label,
        lieuRecuperation: scenario.lieuRecuperation.label,
        age: agePersonnalise,
        note: notePersonnalisee.note,
        notesDetaillees: notePersonnalisee.notesDetaillees,
        commandeExacte: commandeExacte,
        problemeRencontre: problemeRencontre,
        success: resultat.success,
        error: resultat.error,
        duree: resultat.duree,
        datePrevue: new Date(momentExecution).toLocaleString('fr-FR')
      });
      
      console.log(`✅ Scénario ${index}/${scenarios.length} terminé`);
      return resultat;
    } catch (error) {
      progressActuel.enCours = progressActuel.enCours.filter(s => s.name !== scenarioName);
      progressActuel.termine++;
      progressActuel.erreurs.push({ scenarioName, error: error.message });
      
      // Logger l'erreur dans la base de données
      logScenario({
        restaurant: scenario.restaurant.id,
        lieuCommande: scenario.lieuCommande.label,
        typeConsommation: scenario.typeConsommation.label,
        lieuRecuperation: scenario.lieuRecuperation.label,
        age: agePersonnalise,
        note: notePersonnalisee.note,
        notesDetaillees: notePersonnalisee.notesDetaillees,
        commandeExacte: commandeExacte,
        problemeRencontre: problemeRencontre,
        success: false,
        error: error.message,
        duree: null,
        datePrevue: new Date(momentExecution).toLocaleString('fr-FR')
      });
      
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
        debut: planning.debut ? planning.debut.toISOString() : null,
        fin: planning.fin ? planning.fin.toISOString() : null,
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
        debut: planning.debut ? planning.debut.toISOString() : null,
        fin: planning.fin ? planning.fin.toISOString() : null,
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
        debut: planning.debut ? planning.debut.toISOString() : null,
        fin: planning.fin ? planning.fin.toISOString() : null,
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
 * GET /api/logs - Récupérer l'historique des scénarios exécutés
 */
app.get('/api/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const offset = parseInt(req.query.offset) || 0;
  const success = req.query.success;
  const restaurant = req.query.restaurant;
  const dateDebut = req.query.dateDebut;
  const dateFin = req.query.dateFin;
  
  let sql = 'SELECT * FROM scenario_logs WHERE 1=1';
  const params = [];
  
  // Filtres
  if (success !== undefined) {
    sql += ' AND success = ?';
    params.push(success === 'true' ? 1 : 0);
  }
  
  if (restaurant) {
    sql += ' AND restaurant_id = ?';
    params.push(restaurant);
  }
  
  if (dateDebut) {
    sql += ' AND date_execution >= ?';
    params.push(dateDebut);
  }
  
  if (dateFin) {
    sql += ' AND date_execution <= ?';
    params.push(dateFin);
  }
  
  sql += ' ORDER BY date_execution DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Erreur lors de la récupération des logs:', err);
      return res.status(500).json({ error: 'Erreur lors de la récupération des logs' });
    }
    
    // Compter le total
    let countSql = 'SELECT COUNT(*) as total FROM scenario_logs WHERE 1=1';
    const countParams = [];
    
    if (success !== undefined) {
      countSql += ' AND success = ?';
      countParams.push(success === 'true' ? 1 : 0);
    }
    
    if (restaurant) {
      countSql += ' AND restaurant_id = ?';
      countParams.push(restaurant);
    }
    
    if (dateDebut) {
      countSql += ' AND date_execution >= ?';
      countParams.push(dateDebut);
    }
    
    if (dateFin) {
      countSql += ' AND date_execution <= ?';
      countParams.push(dateFin);
    }
    
    db.get(countSql, countParams, (err, count) => {
      if (err) {
        console.error('Erreur lors du comptage des logs:', err);
        return res.json({ logs: rows, total: rows.length });
      }
      
      // Parser les notes détaillées
      const logsFormattes = rows.map(log => ({
        ...log,
        notes_detaillees: log.notes_detaillees ? JSON.parse(log.notes_detaillees) : null
      }));
      
      res.json({
        logs: logsFormattes,
        total: count.total,
        limit,
        offset
      });
    });
  });
});

/**
 * GET /api/logs/stats - Récupérer les statistiques des exécutions
 */
app.get('/api/logs/stats', (req, res) => {
  const sql = `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as reussis,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as echecs,
      AVG(duree_ms) as duree_moyenne,
      MIN(date_execution) as premiere_execution,
      MAX(date_execution) as derniere_execution
    FROM scenario_logs
  `;
  
  db.get(sql, [], (err, stats) => {
    if (err) {
      console.error('Erreur lors de la récupération des statistiques:', err);
      return res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
    }
    
    res.json(stats);
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
