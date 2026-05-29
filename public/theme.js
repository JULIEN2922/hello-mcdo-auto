/**
 * Gestion du thème clair/sombre
 */

// Charger le thème sauvegardé ou utiliser le thème système par défaut
function chargerTheme() {
    const themeSauvegarde = localStorage.getItem('theme');
    
    if (themeSauvegarde) {
        document.documentElement.setAttribute('data-theme', themeSauvegarde);
        return themeSauvegarde;
    }
    
    // Détecter la préférence système
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
        return 'dark';
    }
    
    return 'light';
}

// Basculer entre les thèmes
function togglerTheme() {
    const themeActuel = document.documentElement.getAttribute('data-theme') || 'light';
    const nouveauTheme = themeActuel === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', nouveauTheme);
    localStorage.setItem('theme', nouveauTheme);
    
    // Mettre à jour l'icône du bouton
    mettreAJourIconeTheme(nouveauTheme);
}

// Mettre à jour l'icône du bouton de thème
function mettreAJourIconeTheme(theme) {
    const boutonTheme = document.getElementById('toggleTheme');
    if (boutonTheme) {
        boutonTheme.innerHTML = theme === 'dark' ? '☀️' : '🌙';
        boutonTheme.title = theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre';
    }
}

// Initialiser le thème au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    const themeActuel = chargerTheme();
    mettreAJourIconeTheme(themeActuel);
    
    // Écouter le bouton de toggle
    const boutonTheme = document.getElementById('toggleTheme');
    if (boutonTheme) {
        boutonTheme.addEventListener('click', togglerTheme);
    }
});

// Écouter les changements de préférence système
if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        // Ne changer que si aucun thème n'est sauvegardé
        if (!localStorage.getItem('theme')) {
            const nouveauTheme = e.matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', nouveauTheme);
            mettreAJourIconeTheme(nouveauTheme);
        }
    });
}
