# Hello McDo Auto - Interface Web

Automatisation du formulaire Hello McDo avec interface web de configuration.

## 🚀 Démarrage rapide

### Installation

```bash
npm install
```

### Lancement

```bash
npm start
```

L'interface web sera accessible sur: **http://localhost:3000**

## ⚙️ Configuration

Via l'interface web, vous pouvez configurer:

- **Numéro de restaurant** (obligatoire)
- **Nombre de scénarios** à exécuter
- **Plage horaire** avec sélection de date et heure de début/fin
- **Lieux de commande** (Borne, Comptoir, Drive, Click & Collect, etc.)
- **Type d'avis** (Excellent, Bon, Moyen, Mauvais, Aléatoire)
- **Options avancées**:
  - Mode headless (sans interface graphique)
  - Mode debug (captures d'écran)
  - Concurrence (nombre de scénarios en parallèle)
  - Délai aléatoire entre scénarios (min/max en secondes)

## 📁 Structure

- `server.js` - Serveur Express
- `auto-hello-mcdo-advanced.js` - Moteur d'automatisation Puppeteer
- `public/` - Interface web
  - `index.html` - Page principale
  - `script.js` - Logique frontend
  - `styles.css` - Styles McDonald's

## 🔧 Technologies

- **Node.js** - Runtime
- **Express** - Serveur web
- **Puppeteer** - Automatisation navigateur
