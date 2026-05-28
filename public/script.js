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
                <div class="variant-group-title">Consommé sur place</div>
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
                <div class="variant-group-title">Pris à emporter</div>
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
    
    // Initialiser les sliders de distribution des avis
    initialiserSlidersAvis();
}

/**
 * Initialiser les sliders de distribution des avis
 */
function initialiserSlidersAvis() {
    const sliders = ['rating5', 'rating4', 'rating3', 'rating2', 'rating1'];
    
    sliders.forEach(sliderId => {
        const slider = document.getElementById(sliderId);
        const valueSpan = document.getElementById(sliderId + 'Value');
        
        slider.addEventListener('input', (e) => {
            const value = e.target.value;
            valueSpan.textContent = value + '%';
            mettreAJourTotalAvis();
        });
    });
    
    // Mettre à jour le total initial
    mettreAJourTotalAvis();
}

/**
 * Mettre à jour le total des pourcentages d'avis
 */
function mettreAJourTotalAvis() {
    const rating5 = parseInt(document.getElementById('rating5').value);
    const rating4 = parseInt(document.getElementById('rating4').value);
    const rating3 = parseInt(document.getElementById('rating3').value);
    const rating2 = parseInt(document.getElementById('rating2').value);
    const rating1 = parseInt(document.getElementById('rating1').value);
    
    const total = rating5 + rating4 + rating3 + rating2 + rating1;
    const totalSpan = document.getElementById('ratingTotal');
    
    totalSpan.textContent = total + '%';
    
    if (total === 100) {
        totalSpan.className = 'valid';
    } else {
        totalSpan.className = 'invalid';
    }
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
        
        // Récupérer les variantes cochées pour ce lieu
        const variantCheckboxes = document.querySelectorAll(`input[data-location="${lieu.id}"]:checked`);
        
        // Si le lieu est coché OU si au moins une variante est cochée
        if ((locationCheckbox && locationCheckbox.checked) || variantCheckboxes.length > 0) {
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
            } else {
                // Lieu coché mais aucune variante : utiliser toutes les variantes
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
    
    // Récupérer les pourcentages de distribution des avis
    const rating5 = parseInt(document.getElementById('rating5').value);
    const rating4 = parseInt(document.getElementById('rating4').value);
    const rating3 = parseInt(document.getElementById('rating3').value);
    const rating2 = parseInt(document.getElementById('rating2').value);
    const rating1 = parseInt(document.getElementById('rating1').value);
    
    config.distributionAvis = {
        5: rating5,
        4: rating4,
        3: rating3,
        2: rating2,
        1: rating1
    };
    
    // Collecter les tranches d'âge sélectionnées
    const agesCheckboxes = document.querySelectorAll('input[id^="age_"]:checked');
    const agesSelectionnes = Array.from(agesCheckboxes).map(cb => parseInt(cb.value));
    
    // Si aucune sélection, utiliser toutes les tranches (1 à 4)
    config.ages = agesSelectionnes.length > 0 ? agesSelectionnes : [1, 2, 3, 4];
    
    return config;
}

/**
 * Prévisualiser les scénarios
 */
async function previsualiser() {
    const config = obtenirConfiguration();
    
    // Validation du numéro de restaurant
    if (!config.numeroRestaurant) {
        alert('Veuillez entrer un numéro de restaurant');
        return;
    }
    
    // Validation de la distribution des avis
    const totalDistribution = Object.values(config.distributionAvis).reduce((sum, val) => sum + val, 0);
    if (totalDistribution !== 100) {
        alert(`La somme des pourcentages doit être exactement 100% (actuellement ${totalDistribution}%)`);
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
                ${data.nombre} scénario(s) sera/seront exécuté(s)
            </div>
        `;
        
        if (data.scenarios.length > 0) {
            html += `<ul class="preview-list">`;
            data.scenarios.slice(0, 10).forEach((s, i) => {
                html += `
                    <li class="preview-item">
                        <strong>Scénario ${i + 1}</strong>
                        Restaurant: ${s.restaurant} (${s.restaurantId})<br>
                        Lieu: ${s.lieuCommande}<br>
                        Consommation: ${s.typeConsommation}<br>
                        Récupération: ${s.lieuRecuperation}
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
        alert('Veuillez entrer un numéro de restaurant');
        return;
    }
    
    // Validation de la distribution des avis
    const totalDistribution = Object.values(config.distributionAvis).reduce((sum, val) => sum + val, 0);
    if (totalDistribution !== 100) {
        alert(`La somme des pourcentages doit être exactement 100% (actuellement ${totalDistribution}%)`);
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
                    L'exécution commencera dans ${delaiMinutes} minute(s)<br>
                    ${data.nombreScenarios} scénario(s) seront exécutés<br>
                    Début prévu: ${new Date(data.debut).toLocaleTimeString('fr-FR', { hour12: false })}<br>
                    Fin prévue: ${new Date(data.fin).toLocaleTimeString('fr-FR', { hour12: false })}
                </div>
            `;
        } else {
            messageHTML = `
                <div class="alert alert-success">
                    Exécution démarrée!<br>
                    ${data.nombreScenarios} scénario(s) en cours
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
        
        // Si planifiée mais pas encore en cours
        if (data.planifiee && !data.enCours && data.planification) {
            document.getElementById('progressSection').classList.remove('hidden');
            
            const debutDate = new Date(data.planification.debut);
            const finDate = new Date(data.planification.fin);
            const maintenant = new Date();
            const tempsRestant = debutDate - maintenant;
            const minutesRestantes = Math.max(0, Math.ceil(tempsRestant / 60000));
            const secondesRestantes = Math.max(0, Math.ceil((tempsRestant % 60000) / 1000));
            
            const progressContent = document.getElementById('progressContent');
            progressContent.innerHTML = `
                <div class="alert alert-info">
                    <strong>Exécution planifiée</strong><br>
                    ${data.total} scénario(s) à exécuter<br>
                    Temps restant: <strong>${minutesRestantes}min ${secondesRestantes}s</strong><br>
                    Début prévu: ${debutDate.toLocaleTimeString('fr-FR', { hour12: false })}<br>
                    Fin prévue: ${finDate.toLocaleTimeString('fr-FR', { hour12: false })}
                </div>
                <div class="progress-bar">
                    <div id="progressBar" class="progress-fill" style="width: 0%">En attente...</div>
                </div>
                <div id="progressStats"></div>
                <div id="progressErrors"></div>
            `;
            
            return;
        }
        
        if (data.enCours) {
            // Afficher la progression
            document.getElementById('progressSection').classList.remove('hidden');
            
            const pourcentage = data.total > 0 ? Math.round((data.termine / data.total) * 100) : 0;
            
            // Barre de progression
            const progressBar = document.getElementById('progressBar');
            if (progressBar) {
                progressBar.style.width = pourcentage + '%';
                progressBar.textContent = pourcentage + '%';
            }
            
            // Info de planification si disponible
            let planificationHTML = '';
            if (data.planification) {
                const debutDate = new Date(data.planification.debut);
                const finDate = new Date(data.planification.fin);
                planificationHTML = `
                    <div class="alert alert-info" style="margin-bottom: 1rem;">
                        Exécution en cours<br>
                        Début: ${debutDate.toLocaleTimeString('fr-FR', { hour12: false })} | 
                        Fin prévue: ${finDate.toLocaleTimeString('fr-FR', { hour12: false })}
                    </div>
                `;
            }
            
            // Statistiques
            const progressStats = document.getElementById('progressStats');
            if (progressStats) {
                progressStats.innerHTML = `
                    ${planificationHTML}
                    <div class="progress-stats">
                        <div class="stat-box stat-success">
                            <div class="number">${data.termine}</div>
                            <div class="label">Terminés</div>
                        </div>
                        <div class="stat-box stat-warning">
                            <div class="number">${data.enCours.length}</div>
                            <div class="label">En cours</div>
                        </div>
                        <div class="stat-box stat-info">
                            <div class="number">${data.total - data.termine}</div>
                            <div class="label">Restants</div>
                        </div>
                        <div class="stat-box stat-danger">
                            <div class="number">${data.erreurs.length}</div>
                            <div class="label">Erreurs</div>
                        </div>
                    </div>
                `;
            }
            
            // Erreurs
            if (data.erreurs.length > 0) {
                const progressErrors = document.getElementById('progressErrors');
                if (progressErrors) {
                    progressErrors.innerHTML = `
                        <div class="error-list">
                            <h3>Erreurs rencontrées</h3>
                            ${data.erreurs.map(e => `
                                <div class="error-item">
                                    <strong>${e.scenarioName}</strong>: ${e.error}
                                </div>
                            `).join('')}
                        </div>
                    `;
                }
            }
        } else if (!data.planifiee && document.getElementById('progressSection').classList.contains('hidden') === false) {
            // Exécution terminée
            const progressStats = document.getElementById('progressStats');
            if (progressStats && progressStats.querySelector('.stat-box')) {
                const totalTermine = data.termine || 0;
                if (totalTermine > 0) {
                    // Afficher le message de fin
                    const progressContent = document.getElementById('progressContent');
                    progressContent.innerHTML = `
                        <div class="alert alert-success">
                            Exécution terminée!<br>
                            ${totalTermine} scénario(s) traité(s)<br>
                            ${data.erreurs && data.erreurs.length > 0 ? `${data.erreurs.length} erreur(s)` : ''}
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
    if (!confirm('Êtes-vous sûr de vouloir arrêter l\'exécution en cours ou annuler la planification ?')) {
        return;
    }
    
    try {
        const response = await fetch('/api/stop', {
            method: 'POST'
        });
        
        if (response.ok) {
            const data = await response.json();
            alert(data.message);
            // Rafraîchir l'affichage
            document.getElementById('progressSection').classList.add('hidden');
        }
        
    } catch (error) {
        console.error('Erreur lors de l\'arrêt:', error);
        alert('Erreur lors de l\'arrêt');
    }
}
