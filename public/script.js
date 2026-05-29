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
    
    // Initialiser les dates avec la date actuelle
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('plageHoraireDateDebut').value = today;
    document.getElementById('plageHoraireDateFin').value = today;
    
    // Initialiser le mode de planification
    initialiserModePlanification();
    
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
    
    // Initialiser les sliders de distribution des âges
    initialiserSlidersAge();
    
    // Initialiser les sliders de qualité
    initialiserSlidersQualite();
}

/**
 * Initialiser le mode de planification
 */
function initialiserModePlanification() {
    const radioButtons = document.querySelectorAll('input[name="modePlanification"]');
    const planificationSimple = document.getElementById('planificationSimple');
    const planificationAvancee = document.getElementById('planificationAvancee');
    const ajouterTrancheBtn = document.getElementById('ajouterTranche');
    
    // Gérer le changement de mode
    radioButtons.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const mode = e.target.value;
            
            // Cacher toutes les sections
            planificationSimple.classList.add('hidden');
            planificationAvancee.classList.add('hidden');
            
            // Afficher la section appropriée
            if (mode === 'simple') {
                planificationSimple.classList.remove('hidden');
            } else if (mode === 'avancee') {
                planificationAvancee.classList.remove('hidden');
            }
        });
    });
    
    // Bouton d'ajout de tranche
    ajouterTrancheBtn.addEventListener('click', ajouterTranche);
    
    // Ajouter une tranche par défaut
    ajouterTranche();
}

/**
 * Ajouter une nouvelle tranche horaire
 */
let trancheCounter = 0;
function ajouterTranche() {
    const container = document.getElementById('joursTranches');
    const trancheId = 'tranche_' + (++trancheCounter);
    
    const trancheHtml = `
        <div class="tranche-item" id="${trancheId}">
            <div class="tranche-header">
                <h4>Tranche horaire ${trancheCounter}</h4>
                ${trancheCounter > 1 ? `<button type="button" class="btn-remove-tranche" onclick="supprimerTranche('${trancheId}')">× Supprimer</button>` : ''}
            </div>
            
            <div class="jours-semaine">
                <label class="jour-checkbox">
                    <input type="checkbox" name="${trancheId}_jour" value="1"> Lun
                </label>
                <label class="jour-checkbox">
                    <input type="checkbox" name="${trancheId}_jour" value="2"> Mar
                </label>
                <label class="jour-checkbox">
                    <input type="checkbox" name="${trancheId}_jour" value="3"> Mer
                </label>
                <label class="jour-checkbox">
                    <input type="checkbox" name="${trancheId}_jour" value="4"> Jeu
                </label>
                <label class="jour-checkbox">
                    <input type="checkbox" name="${trancheId}_jour" value="5"> Ven
                </label>
                <label class="jour-checkbox">
                    <input type="checkbox" name="${trancheId}_jour" value="6"> Sam
                </label>
                <label class="jour-checkbox">
                    <input type="checkbox" name="${trancheId}_jour" value="0"> Dim
                </label>
            </div>
            
            <div class="tranche-heures">
                <div>
                    <label>Heure de début</label>
                    <input type="time" name="${trancheId}_debut" value="08:00" required>
                </div>
                <div>
                    <label>Heure de fin</label>
                    <input type="time" name="${trancheId}_fin" value="22:00" required>
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', trancheHtml);
}

/**
 * Supprimer une tranche horaire
 */
function supprimerTranche(trancheId) {
    const tranche = document.getElementById(trancheId);
    if (tranche) {
        tranche.remove();
    }
}

/**
 * Collecter les tranches horaires configurées
 */
function collecterTranches() {
    const container = document.getElementById('joursTranches');
    const tranches = [];
    
    container.querySelectorAll('.tranche-item').forEach(trancheItem => {
        const trancheId = trancheItem.id;
        
        // Collecter les jours sélectionnés
        const jours = [];
        trancheItem.querySelectorAll(`input[name="${trancheId}_jour"]:checked`).forEach(checkbox => {
            jours.push(parseInt(checkbox.value));
        });
        
        // Collecter les heures
        const heureDebut = trancheItem.querySelector(`input[name="${trancheId}_debut"]`).value;
        const heureFin = trancheItem.querySelector(`input[name="${trancheId}_fin"]`).value;
        
        if (jours.length > 0) {
            tranches.push({
                jours: jours,
                heureDebut: heureDebut,
                heureFin: heureFin
            });
        }
    });
    
    return tranches;
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
            ajusterSlidersAvis(sliderId);
        });
    });
    
    // Mettre à jour le total initial
    mettreAJourTotalAvis();
}

/**
 * Initialiser les sliders de distribution des âges
 */
function initialiserSlidersAge() {
    const sliders = ['age1', 'age2', 'age3', 'age4'];
    
    sliders.forEach(sliderId => {
        const slider = document.getElementById(sliderId);
        const valueSpan = document.getElementById(sliderId + 'Value');
        
        slider.addEventListener('input', (e) => {
            const value = e.target.value;
            valueSpan.textContent = value + '%';
            ajusterSlidersAge(sliderId);
        });
    });
    
    // Mettre à jour le total initial
    mettreAJourTotalAge();
}

/**
 * Initialiser les sliders de qualité (commande exacte et problème)
 */
function initialiserSlidersQualite() {
    // Slider commande exacte
    const commandeExacteSlider = document.getElementById('commandeExacte');
    const commandeExacteValue = document.getElementById('commandeExacteValue');
    
    commandeExacteSlider.addEventListener('input', (e) => {
        const value = e.target.value;
        commandeExacteValue.textContent = value + '%';
    });
    
    // Slider problème rencontré
    const problemeSlider = document.getElementById('problemeRencontre');
    const problemeValue = document.getElementById('problemeRencontreValue');
    
    problemeSlider.addEventListener('input', (e) => {
        const value = e.target.value;
        problemeValue.textContent = value + '%';
    });
}

/**
 * Ajuster les sliders d'avis pour ne pas dépasser 100%
 */
function ajusterSlidersAvis(sliderModifie) {
    const sliders = ['rating5', 'rating4', 'rating3', 'rating2', 'rating1'];
    const valeurs = {};
    let total = 0;
    
    // Récupérer toutes les valeurs
    sliders.forEach(id => {
        valeurs[id] = parseInt(document.getElementById(id).value);
        total += valeurs[id];
    });
    
    // Si le total dépasse 100%, réduire proportionnellement les autres sliders
    if (total > 100) {
        const excedent = total - 100;
        const valeursAutres = sliders.filter(id => id !== sliderModifie);
        const totalAutres = valeursAutres.reduce((sum, id) => sum + valeurs[id], 0);
        
        if (totalAutres > 0) {
            valeursAutres.forEach(id => {
                const reduction = Math.floor((valeurs[id] / totalAutres) * excedent);
                const nouvelleValeur = Math.max(0, valeurs[id] - reduction);
                document.getElementById(id).value = nouvelleValeur;
                document.getElementById(id + 'Value').textContent = nouvelleValeur + '%';
            });
        }
    }
    
    mettreAJourTotalAvis();
}

/**
 * Ajuster les sliders d'âge pour ne pas dépasser 100%
 */
function ajusterSlidersAge(sliderModifie) {
    const sliders = ['age1', 'age2', 'age3', 'age4'];
    const valeurs = {};
    let total = 0;
    
    // Récupérer toutes les valeurs
    sliders.forEach(id => {
        valeurs[id] = parseInt(document.getElementById(id).value);
        total += valeurs[id];
    });
    
    // Si le total dépasse 100%, réduire proportionnellement les autres sliders
    if (total > 100) {
        const excedent = total - 100;
        const valeursAutres = sliders.filter(id => id !== sliderModifie);
        const totalAutres = valeursAutres.reduce((sum, id) => sum + valeurs[id], 0);
        
        if (totalAutres > 0) {
            valeursAutres.forEach(id => {
                const reduction = Math.floor((valeurs[id] / totalAutres) * excedent);
                const nouvelleValeur = Math.max(0, valeurs[id] - reduction);
                document.getElementById(id).value = nouvelleValeur;
                document.getElementById(id + 'Value').textContent = nouvelleValeur + '%';
            });
        }
    }
    
    mettreAJourTotalAge();
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
 * Mettre à jour le total des pourcentages d'âge
 */
function mettreAJourTotalAge() {
    const age1 = parseInt(document.getElementById('age1').value);
    const age2 = parseInt(document.getElementById('age2').value);
    const age3 = parseInt(document.getElementById('age3').value);
    const age4 = parseInt(document.getElementById('age4').value);
    
    const total = age1 + age2 + age3 + age4;
    const totalSpan = document.getElementById('ageTotal');
    
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
    
    // Déterminer le mode de planification
    const modePlanification = document.querySelector('input[name="modePlanification"]:checked').value;
    
    const config = {
        nombre: parseInt(formData.get('nombre')),
        modePlanification: modePlanification,
        headless: document.getElementById('headless').checked,
        debug: document.getElementById('debug').checked,
        concurrence: parseInt(formData.get('concurrence')) || 1,
        delaiMin: parseInt(formData.get('delaiMin')) || 0,
        delaiMax: parseInt(formData.get('delaiMax')) || 0,
        numeroRestaurant: formData.get('numeroRestaurant')?.trim() || '',
        scenariosSelections: selections
    };
    
    // Ajouter les paramètres selon le mode de planification
    if (modePlanification === 'simple') {
        config.plageHoraireDateDebut = formData.get('plageHoraireDateDebut');
        config.plageHoraireHeureDebut = formData.get('plageHoraireDebut') || '08:00';
        config.plageHoraireDateFin = formData.get('plageHoraireDateFin');
        config.plageHoraireFin = formData.get('plageHoraireFin') || '22:00';
    } else if (modePlanification === 'avancee') {
        config.tranches = collecterTranches();
    }
    
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
    
    // Récupérer les pourcentages de distribution des âges
    const age1 = parseInt(document.getElementById('age1').value);
    const age2 = parseInt(document.getElementById('age2').value);
    const age3 = parseInt(document.getElementById('age3').value);
    const age4 = parseInt(document.getElementById('age4').value);
    
    config.distributionAge = {
        1: age1,  // 15-24 ans
        2: age2,  // 25-34 ans
        3: age3,  // 35-49 ans
        4: age4   // 50 ans et plus
    };
    
    // Récupérer les pourcentages de qualité
    config.pourcentageCommandeExacte = parseInt(document.getElementById('commandeExacte').value);
    config.pourcentageProbleme = parseInt(document.getElementById('problemeRencontre').value);
    
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
        alert(`La somme des pourcentages d'avis doit être exactement 100% (actuellement ${totalDistribution}%)`);
        return;
    }
    
    // Validation de la distribution des âges
    const totalAge = Object.values(config.distributionAge).reduce((sum, val) => sum + val, 0);
    if (totalAge !== 100) {
        alert(`La somme des pourcentages d'âge doit être exactement 100% (actuellement ${totalAge}%)`);
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
            data.scenarios.forEach((s, i) => {
                html += `
                    <li class="preview-item">
                        <strong>Scénario ${i + 1}</strong><br>
                        Restaurant: ${s.restaurantId}<br>
                        Lieu: ${s.lieuCommande}<br>
                        Consommation: ${s.typeConsommation}<br>
                        Récupération: ${s.lieuRecuperation}<br>
                        Âge: ${s.age}<br>
                        <strong>Notes:</strong><br>`;
                
                // Afficher les notes détaillées si disponibles
                if (s.notesDetaillees) {
                    html += `
                        <div style="margin-left: 20px; font-size: 0.9em;">
                            • Satisfaction globale: ${s.notesDetaillees.satisfaction}<br>
                            • Qualité des produits: ${s.notesDetaillees.qualite}<br>
                            • Amabilité du personnel: ${s.notesDetaillees.amabilite}<br>
                            • Propreté du restaurant: ${s.notesDetaillees.proprete}<br>
                            • Rapidité du service: ${s.notesDetaillees.rapidite}
                        </div>`;
                } else {
                    html += `Note globale: ${s.note}<br>`;
                }
                
                html += `
                        Commande exacte: ${s.commandeExacte ? 'Oui' : 'Non'}<br>
                        Problème rencontré: ${s.problemeRencontre ? 'Oui' : 'Non'}`;
                
                // Afficher la date d'exécution si disponible
                if (data.utiliserPlageHoraire && s.dateExecution) {
                    html += `<br><em>Exécution prévue: ${s.dateExecution}</em>`;
                } else if (data.utiliserPlageHoraire) {
                    html += `<br><em>Exécution: Immédiate</em>`;
                }
                
                html += `
                    </li>
                `;
            });
            html += `</ul>`;
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
        alert(`La somme des pourcentages d'avis doit être exactement 100% (actuellement ${totalDistribution}%)`);
        return;
    }
    
    // Validation de la distribution des âges
    const totalAge = Object.values(config.distributionAge).reduce((sum, val) => sum + val, 0);
    if (totalAge !== 100) {
        alert(`La somme des pourcentages d'âge doit être exactement 100% (actuellement ${totalAge}%)`);
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
                let scenariosEnCoursHTML = '';
                if (data.enCours && data.enCours.length > 0) {
                    scenariosEnCoursHTML = `
                        <div class="scenarios-en-cours" style="margin-bottom: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 6px;">
                            <h4 style="margin-bottom: 0.8rem; color: var(--primary-color);">Scénarios en cours d'exécution:</h4>
                            <div style="max-height: 400px; overflow-y: auto; padding-right: 0.5rem;">
                                <ul style="list-style: none; padding-left: 0; margin: 0;">
                    `;
                    data.enCours.forEach(scenario => {
                        const progressPercent = scenario.progress || 0;
                        scenariosEnCoursHTML += `
                            <li style="padding: 0.8rem; border-left: 3px solid var(--accent-color); margin-bottom: 0.8rem; background: white; border-radius: 4px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                    <strong>Scénario ${scenario.index}/${data.total}</strong>
                                    <span style="font-size: 0.85em; color: #6c757d;">${scenario.dateExecution || ''}</span>
                                </div>
                                <div style="font-size: 0.9em; color: #495057; margin-bottom: 0.5rem;">
                                    <strong>Restaurant:</strong> ${scenario.restaurant}<br>
                                    <strong>Lieu:</strong> ${scenario.lieuCommande}<br>
                                    <strong>Consommation:</strong> ${scenario.typeConsommation}<br>
                                    <strong>Récupération:</strong> ${scenario.lieuRecuperation}
                                </div>
                                <div style="margin-bottom: 0.3rem;">
                                    <div style="background: #e9ecef; border-radius: 10px; height: 20px; overflow: hidden;">
                                        <div style="background: linear-gradient(90deg, var(--accent-color), #2ecc71); height: 100%; width: ${progressPercent}%; transition: width 0.3s ease; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.75em; font-weight: bold;">
                                            ${progressPercent > 15 ? progressPercent + '%' : ''}
                                        </div>
                                    </div>
                                </div>
                                <small style="color: #6c757d; font-style: italic;">${scenario.etape || 'En cours...'}</small>
                            </li>
                        `;
                    });
                    scenariosEnCoursHTML += `
                                </ul>
                            </div>
                        </div>
                    `;
                }
                
                progressStats.innerHTML = `
                    ${planificationHTML}
                    ${scenariosEnCoursHTML}
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
