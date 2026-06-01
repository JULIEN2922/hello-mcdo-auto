/**
 * Script pour la page d'historique des logs
 */

let currentPage = 0;
const itemsPerPage = 50;
let totalLogs = 0;
let currentFilters = {};

// Charger les statistiques
async function chargerStatistiques() {
    try {
        const response = await fetch('/api/logs/stats');
        const stats = await response.json();
        
        document.getElementById('statTotal').textContent = stats.total || 0;
        document.getElementById('statReussis').textContent = stats.reussis || 0;
        document.getElementById('statEchecs').textContent = stats.echecs || 0;
        
        if (stats.duree_moyenne) {
            const dureeSec = (stats.duree_moyenne / 1000).toFixed(1);
            document.getElementById('statDureeMoyenne').textContent = dureeSec + 's';
        } else {
            document.getElementById('statDureeMoyenne').textContent = '-';
        }
    } catch (error) {
        console.error('Erreur lors du chargement des statistiques:', error);
    }
}

// Charger les logs
async function chargerLogs() {
    try {
        const params = new URLSearchParams({
            limit: itemsPerPage,
            offset: currentPage * itemsPerPage,
            ...currentFilters
        });
        
        const response = await fetch(`/api/logs?${params}`);
        const data = await response.json();
        
        totalLogs = data.total;
        afficherLogs(data.logs);
        mettreAJourPagination();
        
    } catch (error) {
        console.error('Erreur lors du chargement des logs:', error);
        document.getElementById('logsTableBody').innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem; color: #dc3545;">
                    Erreur lors du chargement des logs
                </td>
            </tr>
        `;
    }
}

// Afficher les logs dans le tableau
function afficherLogs(logs) {
    const tbody = document.getElementById('logsTableBody');
    
    if (logs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem;">
                    Aucun scénario trouvé
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = logs.map(log => {
        const date = new Date(log.date_execution);
        const dateFormatee = date.toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const statusClass = log.success ? 'status-success' : 'status-error';
        const statusText = log.success ? 'Réussi' : 'Échec';
        
        const duree = log.duree_ms ? `${(log.duree_ms / 1000).toFixed(1)}s` : '-';
        
        // Mapper l'âge
        const ageLabels = {
            1: '15-24 ans',
            2: '25-34 ans',
            3: '35-49 ans',
            4: '50 ans et plus'
        };
        const ageLabel = ageLabels[log.age] || log.age;
        
        // Mapper la note
        const noteLabels = {
            1: '5/5',
            2: '4/5',
            3: '3/5',
            4: '2/5',
            5: '1/5'
        };
        const noteLabel = noteLabels[log.note] || log.note;
        
        // Détails des notes
        let notesDetailsHTML = '';
        if (log.notes_detaillees) {
            notesDetailsHTML = `
                <div class="notes-details">
                    Satisfaction: ${noteLabels[log.notes_detaillees.satisfaction]},
                    Qualité: ${noteLabels[log.notes_detaillees.qualite]},
                    Amabilité: ${noteLabels[log.notes_detaillees.amabilite]},
                    Propreté: ${noteLabels[log.notes_detaillees.proprete]},
                    Rapidité: ${noteLabels[log.notes_detaillees.rapidite]}
                </div>
            `;
        }
        
        const parcoursText = `${log.lieu_commande} / ${log.type_consommation} / ${log.lieu_recuperation}`;
        
        return `
            <tr>
                <td>
                    ${dateFormatee}
                    ${log.date_prevue ? `<div class="notes-details">Prévu: ${log.date_prevue}</div>` : ''}
                </td>
                <td>${log.restaurant_id}</td>
                <td>
                    ${parcoursText}
                    <div class="notes-details">
                        Commande exacte: ${log.commande_exacte ? 'Oui' : 'Non'} |
                        Problème: ${log.probleme_rencontre ? 'Oui' : 'Non'}
                    </div>
                </td>
                <td>${ageLabel}</td>
                <td>
                    ${noteLabel}
                    ${notesDetailsHTML}
                </td>
                <td>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                    ${log.error ? `<div class="notes-details" style="color: #dc3545;">${log.error}</div>` : ''}
                </td>
                <td>${duree}</td>
            </tr>
        `;
    }).join('');
}

// Mettre à jour la pagination
function mettreAJourPagination() {
    const totalPages = Math.ceil(totalLogs / itemsPerPage);
    const pageInfo = document.getElementById('pageInfo');
    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');
    
    pageInfo.textContent = `Page ${currentPage + 1} / ${totalPages || 1}`;
    btnPrev.disabled = currentPage === 0;
    btnNext.disabled = currentPage >= totalPages - 1;
}

// Changer de page
function changerPage(direction) {
    const totalPages = Math.ceil(totalLogs / itemsPerPage);
    const newPage = currentPage + direction;
    
    if (newPage >= 0 && newPage < totalPages) {
        currentPage = newPage;
        chargerLogs();
    }
}

// Appliquer les filtres
function appliquerFiltres() {
    currentFilters = {};
    
    const success = document.getElementById('filterSuccess').value;
    if (success) {
        currentFilters.success = success;
    }
    
    const restaurant = document.getElementById('filterRestaurant').value.trim();
    if (restaurant) {
        currentFilters.restaurant = restaurant;
    }
    
    const dateDebut = document.getElementById('filterDateDebut').value;
    if (dateDebut) {
        currentFilters.dateDebut = new Date(dateDebut).toISOString();
    }
    
    const dateFin = document.getElementById('filterDateFin').value;
    if (dateFin) {
        currentFilters.dateFin = new Date(dateFin).toISOString();
    }
    
    currentPage = 0;
    chargerLogs();
}

// Réinitialiser les filtres
function reinitialiserFiltres() {
    document.getElementById('filterSuccess').value = '';
    document.getElementById('filterRestaurant').value = '';
    document.getElementById('filterDateDebut').value = '';
    document.getElementById('filterDateFin').value = '';
    
    currentFilters = {};
    currentPage = 0;
    chargerLogs();
}

// Auto-refresh toutes les 10 secondes
setInterval(() => {
    chargerStatistiques();
    chargerLogs();
}, 10000);

// Charger les données au démarrage
document.addEventListener('DOMContentLoaded', () => {
    chargerStatistiques();
    chargerLogs();
});
