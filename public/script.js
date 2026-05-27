// État de l'application
let configuration = null;
let progressInterval = null;

// Chargement de la configuration au démarrage
document.addEventListener('DOMContentLoaded', async () => {
    await chargerConfiguration();
    initialiserFormulaire();
    
    // Vérifier le progrès toutes les 2 secondes si une exécution est en cours
    progressInterval = setInterval(verifierProgress, 2000);
});

/**
 * Charger la configuration depuis le serveur
 */
async function chargerConfiguration() {
    try {
        const response = await fetch('/api/configuration');
        configuration = await response.json();
        
        // Remplir l'arborescence des scénarios
        remplirArborescenceScenarios(configuration.scenarios);
        
    } catch (error) {
        console.error('Erreur lors du chargement de la configuration:', error);
        alert('Erreur de connexion au serveur');
    }
}

/**
 * Remplir l'arborescence des scénarios
 */
function remplirArborescenceScenarios(scenarios) {
    const container = document.getElementById('scenariosTree');
    
    const html = Object.keys(scenarios).map(key => {
        const lieu = scenarios[key];
        const variantsCount = compterSousScenarios(lieu);
        
        return `
            <div class="scenario-location" data-location-id="${lieu.id}">
                <div class="scenario-location-header" onclick="toggleScenarioVariants('${lieu.id}')">
                    <input type="checkbox" 
                           id="location_${lieu.id}" 
                           value="${lieu.id}"
                           onchange="handleLocationChange('${lieu.id}')"
                           onclick="event.stopPropagation()">
                    <label for="location_${lieu.id}">${lieu.label}</label>
                    <small>${variantsCount} variante${variantsCount > 1 ? 's' : ''}</small>
                    <span class="scenario-toggle">▶</span>
                </div>
                <div class="scenario-variants" id="variants_${lieu.id}">
                    ${genererVariantesHTML(lieu)}
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

/**
 * Générer le HTML des variantes pour un lieu de commande
 */
function genererVariantesHTML(lieu) {
    if (!lieu.options) {
        return '<div class="variant-options"><p style="color: var(--muted); padding-left: 25px;">Pas de sous-options (parcours direct)</p></div>';
    }
    
    if (lieu.options.plateforme) {
        return `
            <div class="variant-group">
                <div class="variant-group-title">Plateforme de livraison</div>
                <div class="variant-options">
                    ${lieu.options.plateforme.map(p => `
                        <div class="variant-option">
                            <input type="checkbox" 
                                   id="variant_${lieu.id}_${p.id}" 
                                   value="${p.id}"
                                   data-location="${lieu.id}"
                                   data-type="plateforme">
                            <label for="variant_${lieu.id}_${p.id}">${p.label}</label>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    if (lieu.options.recuperation && !lieu.options.sur_place) {
        return `
            <div class="variant-group">
                <div class="variant-group-title">Lieu de récupération</div>
                <div class="variant-options">
                    ${lieu.options.recuperation.map(r => `
                        <div class="variant-option">
                            <input type="checkbox" 
                                   id="variant_${lieu.id}_${r.id}" 
                                   value="${r.id}"
                                   data-location="${lieu.id}"
                                   data-type="recuperation">
                            <label for="variant_${lieu.id}_${r.id}">${r.label}</label>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    let html = '';
    
    if (lieu.options.sur_place) {
        html += `
            <div class="variant-group">
                <div class="variant-group-title">🍽️ Consommé sur place</div>
                <div class="variant-options">
                    ${lieu.options.sur_place.recuperation.map(r => `
                        <div class="variant-option">
                            <input type="checkbox" 
                                   id="variant_${lieu.id}_sur_place_${r.id}" 
                                   value="${r.id}"
                                   data-location="${lieu.id}"
                                   data-type="sur_place"
                                   data-consommation="sur_place">
                            <label for="variant_${lieu.id}_sur_place_${r.id}">${r.label}</label>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    if (lieu.options.a_emporter) {
        html += `
            <div class="variant-group">
                <div class="variant-group-title">📦 Pris à emporter</div>
                <div class="variant-options">
                    ${lieu.options.a_emporter.recuperation.map(r => `
                        <div class="variant-option">
                            <input type="checkbox" 
                                   id="variant_${lieu.id}_a_emporter_${r.id}" 
                                   value="${r.id}"
                                   data-location="${lieu.id}"
                                   data-type="a_emporter"
                                   data-consommation="a_emporter">
                            <label for="variant_${lieu.id}_a_emporter_${r.id}">${r.label}</label>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    return html;
}

/**
 * Toggle l'affichage des variantes
 */
function toggleScenarioVariants(locationId) {
    const variants = document.getElementById(`variants_${locationId}`);
    const toggle = event.currentTarget.querySelector('.scenario-toggle');
    
    variants.classList.toggle('visible');
    toggle.classList.toggle('expanded');
}

/**
 * Gérer le changement de checkbox de lieu de commande
 */
function handleLocationChange(locationId) {
    const locationCheckbox = document.getElementById(`location_${locationId}`);
    const variants = document.querySelectorAll(`input[data-location="${locationId}"]`);
    
    // Si on coche le lieu, cocher toutes ses variantes
    if (locationCheckbox.checked) {
        variants.forEach(v => v.checked = true);
    } else {
        variants.forEach(v => v.checked = false);
    }
}


/**
 * Compter le nombre de sous-scénarios pour un lieu de commande
 */
function compterSousScenarios(lieu) {
    if (!lieu.options) return 1;
    
    if (lieu.options.plateforme) {
        return lieu.options.plateforme.length;
    }
    
    if (lieu.options.recuperation && !lieu.options.sur_place) {
        return lieu.options.recuperation.length;
    }
    
    let count = 0;
    if (lieu.options.sur_place) {
        count += lieu.options.sur_place.recuperation.length;
    }
    if (lieu.options.a_emporter) {
        count += lieu.options.a_emporter.recuperation.length;
    }
    
    return count;
}

/**
 * Initialiser les événements du formulaire
 */
function initialiserFormulaire() {
    const form = document.getElementById('configForm');
    const previewBtn = document.getElementById('previewBtn');
    const stopBtn = document.getElementById('stopBtn');
    const plageHoraireCheckbox = document.getElementById('utiliserPlageHoraire');
    const plageHoraireInputs = document.getElementById('plageHoraireInputs');
    
    // Initialiser les dates avec la date actuelle
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('plageHoraireDateDebut').value = today;
    document.getElementById('plageHoraireDateFin').value = today;
    
    // Toggle plage horaire
    plageHoraireCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            plageHoraireInputs.classList.remove('hidden');
        } else {
            plageHoraireInputs.classList.add('hidden');
        }
    });
    
    // Prévisualisation
    previewBtn.addEventListener('click', previsualiser);
    
    // Soumission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await lancerExecution();
    });
    
    // Arrêt
    stopBtn.addEventListener('click', arreterExecution);
}

/**
 * Récupérer la configuration du formulaire
 */
function obtenirConfiguration() {
    const form = document.getElementById('configForm');
    const formData = new FormData(form);
    
    // Récupérer les sélections de variantes
    const selections = {};
    
    // Pour chaque lieu de commande
    Object.keys(configuration.scenarios).forEach(locationKey => {
        const lieu = configuration.scenarios[locationKey];
        const locationCheckbox = document.getElementById(`location_${lieu.id}`);
        
        // Si le lieu est coché
        if (locationCheckbox && locationCheckbox.checked) {
            // Récupérer les variantes cochées pour ce lieu
            const variantCheckboxes = document.querySelectorAll(`input[data-location="${lieu.id}"]:checked`);
            
            if (variantCheckboxes.length > 0) {
                const variants = Array.from(variantCheckboxes).map(cb => ({
                    id: cb.value,
                    type: cb.dataset.type,
                    consommation: cb.dataset.consommation
                }));
                
                selections[lieu.id] = variants;
            } else if (!lieu.options) {
                // Pas d'options, donc sélection simple
                selections[lieu.id] = 'all';
            }
        }
    });
    
    const config = {
        nombre: parseInt(formData.get('nombre')),
        utiliserPlageHoraire: document.getElementById('utiliserPlageHoraire').checked,
        plageHoraireDateDebut: formData.get('plageHoraireDateDebut'),
        plageHoraireDebut: formData.get('plageHoraireDebut') || '08:00',
        plageHoraireDateFin: formData.get('plageHoraireDateFin'),
        plageHoraireFin: formData.get('plageHoraireFin') || '22:00',
        headless: document.getElementById('headless').checked,
        debug: document.getElementById('debug').checked,
        concurrence: parseInt(formData.get('concurrence')) || 1,
        delaiMin: parseInt(formData.get('delaiMin')) || 0,
        delaiMax: parseInt(formData.get('delaiMax')) || 0,
        numeroRestaurant: formData.get('numeroRestaurant')?.trim() || '',
        scenariosSelections: selections
    };
    
    // Convertir le type d'avis en notes
    const typeAvis = document.getElementById('typeAvis').value;
    config.notesPersonnalisees = obtenirNotesParType(typeAvis);
    
    // Collecter les tranches d'âge sélectionnées
    const agesCheckboxes = document.querySelectorAll('input[id^="age_"]:checked');
    const agesSelectionnes = Array.from(agesCheckboxes).map(cb => parseInt(cb.value));
    
    // Si aucune sélection, utiliser toutes les tranches (1 à 4)
    config.ages = agesSelectionnes.length > 0 ? agesSelectionnes : [1, 2, 3, 4];
    
    return config;
}

/**
 * Obtenir les notes selon le type d'avis
 */
function obtenirNotesParType(type) {
    switch (type) {
        case 'excellent':
            return { commandeExacte: true, problemeRencontre: false, note: 1 };
        case 'bon':
            return { commandeExacte: true, problemeRencontre: false, note: 2 };
        case 'moyen':
            return { commandeExacte: true, problemeRencontre: false, note: 3 };
        case 'mauvais':
            return { commandeExacte: false, problemeRencontre: true, note: 4 };
        case 'aleatoire':
            return 'aleatoire';
        default:
            return { commandeExacte: true, problemeRencontre: false, note: 1 };
    }
}

/**
 * Prévisualiser les scénarios
 */
async function previsualiser() {
    const config = obtenirConfiguration();
    
    // Validation du numéro de restaurant
    if (!config.numeroRestaurant) {
        alert('⚠️ Veuillez entrer un numéro de restaurant');
        return;
    }
    
    try {
        const response = await fetch('/api/scenarios/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        
        const data = await response.json();
        
        // Afficher la prévisualisation
        const previewSection = document.getElementById('previewSection');
        const previewContent = document.getElementById('previewContent');
        
        previewSection.classList.remove('hidden');
        
        let html = `
            <div class="preview-summary">
                📊 ${data.nombre} scénario(s) sera/seront exécuté(s)
            </div>
        `;
        
        if (data.scenarios.length > 0) {
            html += `<ul class="preview-list">`;
            data.scenarios.slice(0, 10).forEach((s, i) => {
                html += `
                    <li class="preview-item">
                        <strong>Scénario ${i + 1}</strong>
                        🏪 ${s.restaurant} (${s.restaurantId})<br>
                        📱 ${s.lieuCommande}<br>
                        🍔 ${s.typeConsommation}<br>
                        📦 ${s.lieuRecuperation}
                    </li>
                `;
            });
            html += `</ul>`;
            
            if (data.scenarios.length > 10) {
                html += `<p class="alert alert-info">... et ${data.scenarios.length - 10} autre(s) scénario(s)</p>`;
            }
        }
        
        previewContent.innerHTML = html;
        
        // Scroller vers la prévisualisation
        previewSection.scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        console.error('Erreur lors de la prévisualisation:', error);
        alert('Erreur lors de la prévisualisation');
    }
}

/**
 * Lancer l'exécution
 */
async function lancerExecution() {
    const config = obtenirConfiguration();
    
    // Validation du numéro de restaurant
    if (!config.numeroRestaurant) {
        alert('⚠️ Veuillez entrer un numéro de restaurant');
        return;
    }
    
    if (!confirm(`Êtes-vous sûr de vouloir lancer ${config.nombre} scénario(s) ?`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/scenarios/executer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erreur lors du lancement');
        }
        
        const data = await response.json();
        
        // Afficher la section de progression
        document.getElementById('progressSection').classList.remove('hidden');
        document.getElementById('progressSection').scrollIntoView({ behavior: 'smooth' });
        
        // Réinitialiser et afficher la structure de progression
        const progressContent = document.getElementById('progressContent');
        const delaiMinutes = Math.round(data.delaiDebut / 60000);
        
        let messageHTML = '';
        if (delaiMinutes > 0) {
            messageHTML = `
                <div class="alert alert-info">
                    ⏰ L'exécution commencera dans ${delaiMinutes} minute(s)<br>
                    📊 ${data.nombreScenarios} scénario(s) seront exécutés<br>
                    🕐 Début prévu: ${new Date(data.debut).toLocaleTimeString('fr-FR', { hour12: false })}<br>
                    🕐 Fin prévue: ${new Date(data.fin).toLocaleTimeString('fr-FR', { hour12: false })}
                </div>
            `;
        } else {
            messageHTML = `
                <div class="alert alert-success">
                    🚀 Exécution démarrée!<br>
                    📊 ${data.nombreScenarios} scénario(s) en cours
                </div>
            `;
        }
        
        progressContent.innerHTML = `
            ${messageHTML}
            <div class="progress-bar">
                <div id="progressBar" class="progress-fill">0%</div>
            </div>
            <div id="progressStats"></div>
            <div id="progressErrors"></div>
        `;
        
    } catch (error) {
        console.error('Erreur lors du lancement:', error);
        alert(`Erreur: ${error.message}`);
    }
}

/**
 * Vérifier le progrès de l'exécution
 */
async function verifierProgress() {
    try {
        const response = await fetch('/api/progress');
        const data = await response.json();
        
        if (data.enCours) {
            // Afficher la progression
            document.getElementById('progressSection').classList.remove('hidden');
            
            const pourcentage = data.total > 0 ? Math.round((data.termine / data.total) * 100) : 0;
            
            // Barre de progression
            const progressBar = document.getElementById('progressBar');
            progressBar.style.width = pourcentage + '%';
            progressBar.textContent = pourcentage + '%';
            
            // Statistiques
            const progressStats = document.getElementById('progressStats');
            progressStats.innerHTML = `
                <div class="progress-stats">
                    <div class="stat-box stat-success">
                        <div class="number">${data.termine}</div>
                        <div class="label">✅ Terminés</div>
                    </div>
                    <div class="stat-box stat-warning">
                        <div class="number">${data.enCours.length}</div>
                        <div class="label">⏳ En cours</div>
                    </div>
                    <div class="stat-box stat-info">
                        <div class="number">${data.total - data.termine}</div>
                        <div class="label">📋 Restants</div>
                    </div>
                    <div class="stat-box stat-danger">
                        <div class="number">${data.erreurs.length}</div>
                        <div class="label">❌ Erreurs</div>
                    </div>
                </div>
            `;
            
            // Erreurs
            if (data.erreurs.length > 0) {
                const progressErrors = document.getElementById('progressErrors');
                progressErrors.innerHTML = `
                    <div class="error-list">
                        <h3>⚠️ Erreurs rencontrées</h3>
                        ${data.erreurs.map(e => `
                            <div class="error-item">
                                <strong>${e.scenarioName}</strong>: ${e.error}
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        } else if (document.getElementById('progressSection').classList.contains('hidden') === false) {
            // Exécution terminée
            const progressStats = document.getElementById('progressStats');
            if (progressStats.querySelector('.stat-box')) {
                const totalTermine = parseInt(progressStats.querySelector('.stat-box .number').textContent);
                if (totalTermine > 0) {
                    // Afficher le message de fin
                    const progressContent = document.getElementById('progressContent');
                    progressContent.innerHTML = `
                        <div class="alert alert-success">
                            ✅ Exécution terminée!<br>
                            📊 Résultats sauvegardés dans le dossier scenarios/
                        </div>
                    ` + progressContent.innerHTML;
                }
            }
        }
        
    } catch (error) {
        console.error('Erreur lors de la vérification du progrès:', error);
    }
}

/**
 * Arrêter l'exécution
 */
async function arreterExecution() {
    if (!confirm('Êtes-vous sûr de vouloir arrêter l\'exécution en cours ?')) {
        return;
    }
    
    try {
        const response = await fetch('/api/stop', {
            method: 'POST'
        });
        
        if (response.ok) {
            alert('Arrêt demandé. Les scénarios en cours vont se terminer.');
        }
        
    } catch (error) {
        console.error('Erreur lors de l\'arrêt:', error);
        alert('Erreur lors de l\'arrêt');
    }
}
