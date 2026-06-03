# Hello McDo Auto

Application de gestion des scénarios Hello McDo avec authentification, gestion des rôles, et planification.

## 🚀 Stack Technique

- **Frontend**: React 18 + TypeScript + Vite + shadcn/ui + TailwindCSS
- **Backend**: Express.js + TypeScript
- **Base de données**: SQLite + Prisma ORM
- **Authentification**: JWT + bcrypt
- **UI Components**: shadcn/ui (composants Radix UI)

## ✨ Fonctionnalités

### Authentification
- ✅ Inscription / Connexion
- ✅ Gestion des sessions avec JWT
- ✅ Protection des routes

### Gestion des Rôles
- **Admin**: Accès complet (gestion restaurants, plannings, utilisateurs)
- **User**: Accès limité aux restaurants autorisés

### Restaurants
- ✅ CRUD restaurants (Admin uniquement)
- ✅ Gestion des accès utilisateurs par restaurant
- ✅ Filtrage automatique selon les permissions

### Plannings
- ✅ Configuration par restaurant et par jour
- ✅ Plages horaires (début/fin)
- ✅ Nombre de scénarios min/max (exemple: 45-55)
- ✅ Sauvegarde en masse
- ✅ Vue calendrier Google Agenda
- ✅ Indicateur de temps réel
- ✅ Dialogues popup pour création/édition

### Exécution des Scénarios
- ✅ Exécution automatique selon les plannings
- ✅ Exécution manuelle à la demande
- ✅ Concurrence configurable (1-20 scénarios simultanés)
- ✅ Délais aléatoires entre scénarios (configurable)
- ✅ Automation Puppeteer complète
- ✅ **Intégration Tor** : IPs françaises différentes par scénario
- ✅ Monitoring en temps réel (refresh toutes les 5s)

### Logs & Statistiques
- ✅ Historique de tous les scénarios exécutés
- ✅ Filtres (restaurant, date, statut)
- ✅ Statistiques (taux de succès, durée moyenne)
- ✅ Pagination

### 🔐 Tor Integration (Nouveau !)

**Exécutez les scénarios avec des IPs françaises différentes** :
- Binaires Tor inclus via npm (pas d'installation manuelle)
- Démarrage automatique au premier lancement
- Renouvellement d'IP entre chaque scénario
- Configuration `ExitNodes {fr}` pour IPs françaises uniquement
- Aucune configuration requise

**Activation** :
1. Aller dans Configuration du restaurant
2. Cocher "Utiliser Tor (IPs françaises différentes...)"
3. Sauvegarder
4. Les scénarios utiliseront automatiquement Tor

Pour plus de détails : [TOR_INTEGRATION.md](TOR_INTEGRATION.md)

## 📦 Installation

### Prérequis
- Node.js 18+ 
- npm ou yarn

### Étapes

1. **Cloner et naviguer dans le dossier**
```bash
cd Version-2
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configurer l'environnement**
```bash
cp .env.example .env
```

Éditez `.env` et modifiez le `JWT_SECRET` :
```env
DATABASE_URL="file:./dev.db"
PORT=4000
NODE_ENV=development
JWT_SECRET=votre-secret-jwt-super-securise-changez-moi
CORS_ORIGIN=http://localhost:5173
```

4. **Initialiser la base de données**
```bash
npm run db:push
```

5. **Créer un utilisateur admin (optionnel)**

Vous pouvez créer un premier utilisateur via l'interface d'inscription, puis le promouvoir en admin via Prisma Studio :

```bash
npm run db:studio
```

Ouvrez `http://localhost:5555`, allez dans la table `User`, et changez le `role` de `USER` à `ADMIN`.

## 🏃 Démarrage

### Mode développement (Frontend + Backend)
```bash
npm run dev
```

Cela lance :
- Backend API sur `http://localhost:4000`
- Frontend sur `http://localhost:5173`

### Lancer uniquement le backend
```bash
npm run server:dev
```

### Lancer uniquement le frontend
```bash
npm run client:dev
```

## 🏗️ Build pour Production

1. **Build complet**
```bash
npm run build
```

2. **Démarrer en production**
```bash
NODE_ENV=production npm start
```

L'application sera accessible sur `http://localhost:4000`

## 📁 Structure du Projet

```
Version-2/
├── prisma/
│   └── schema.prisma          # Schéma de la base de données
├── server/
│   ├── index.ts               # Point d'entrée du serveur
│   ├── middleware/            # Middlewares (auth, erreurs)
│   └── routes/                # Routes API
│       ├── auth.ts            # Authentification
│       ├── restaurants.ts     # Gestion restaurants
│       ├── plannings.ts       # Gestion plannings
│       ├── scenarios.ts       # Logs scénarios
│       └── users.ts           # Gestion utilisateurs
├── src/
│   ├── components/            # Composants React
│   │   ├── ui/                # Composants shadcn/ui
│   │   ├── Layout.tsx         # Layout principal
│   │   └── ProtectedRoute.tsx # Protection routes
│   ├── contexts/              # Contextes React
│   │   └── AuthContext.tsx    # Gestion authentification
│   ├── lib/                   # Utilitaires
│   │   ├── api.ts             # Client API
│   │   └── utils.ts           # Helpers
│   ├── pages/                 # Pages de l'application
│   │   ├── LoginPage.tsx      # Page connexion
│   │   ├── RegisterPage.tsx   # Page inscription
│   │   ├── DashboardPage.tsx  # Tableau de bord
│   │   ├── RestaurantsPage.tsx
│   │   ├── PlanningsPage.tsx
│   │   ├── LogsPage.tsx
│   │   └── UsersPage.tsx
│   ├── App.tsx                # Composant racine
│   ├── main.tsx               # Point d'entrée frontend
│   └── index.css              # Styles globaux
├── .env                       # Variables d'environnement
├── package.json
├── tsconfig.json              # Config TypeScript (client)
├── tsconfig.server.json       # Config TypeScript (server)
├── vite.config.ts             # Config Vite
├── tailwind.config.js         # Config Tailwind
└── README.md
```

## 🔒 Sécurité

- Les mots de passe sont hachés avec bcrypt
- Les tokens JWT expirent après 7 jours
- Les routes API sont protégées par authentification
- Validation des données avec Zod
- CORS configuré

## 🛠️ Base de Données

### Modèles principaux

- **User**: Utilisateurs (Admin/User)
- **Restaurant**: Restaurants McDonald's
- **RestaurantAccess**: Permissions utilisateur/restaurant
- **Planning**: Configuration des plannings
- **ScenarioLog**: Historique des scénarios exécutés
- **ScenarioRule**: Règles de configuration

### Prisma Studio

Pour visualiser/éditer la base de données :
```bash
npm run db:studio
```

## 📡 API Endpoints

### Auth
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `GET /api/auth/me` - Utilisateur actuel

### Restaurants
- `GET /api/restaurants` - Liste (filtrée par accès)
- `POST /api/restaurants` - Créer (Admin)
- `PUT /api/restaurants/:id` - Modifier (Admin)
- `DELETE /api/restaurants/:id` - Supprimer (Admin)
- `POST /api/restaurants/:id/access` - Donner accès (Admin)
- `DELETE /api/restaurants/:id/access/:userId` - Retirer accès (Admin)

### Plannings
- `GET /api/plannings/restaurant/:restaurantId` - Liste par restaurant
- `POST /api/plannings` - Créer (Admin)
- `PUT /api/plannings/:id` - Modifier (Admin)
- `DELETE /api/plannings/:id` - Supprimer (Admin)
- `POST /api/plannings/restaurant/:restaurantId/bulk` - Sauvegarde en masse (Admin)

### Scénarios
- `GET /api/scenarios` - Liste avec filtres
- `POST /api/scenarios` - Créer un log
- `GET /api/scenarios/stats/summary` - Statistiques

### Users (Admin uniquement)
- `GET /api/users` - Liste utilisateurs
- `PATCH /api/users/:id/role` - Changer rôle
- `DELETE /api/users/:id` - Supprimer

## 🎨 Personnalisation UI

L'interface utilise shadcn/ui avec Tailwind CSS. Pour personnaliser les couleurs, éditez `src/index.css` :

```css
:root {
  --primary: 221.2 83.2% 53.3%;
  --secondary: 210 40% 96.1%;
  /* ... */
}
```

## 🐛 Debug

### Vérifier les erreurs
```bash
# Logs serveur
npm run server:dev

# Logs Prisma
DEBUG=prisma:query npm run server:dev
```

### Reset database
```bash
rm dev.db
npm run db:push
```

## 📝 TODO / Améliorations futures

- [ ] Exécution automatique des scénarios (cron jobs)
- [ ] Export des logs (CSV, Excel)
- [ ] Notifications en temps réel
- [ ] Dashboard avec graphiques
- [ ] Support PostgreSQL
- [ ] Tests unitaires et E2E
- [ ] Docker / Docker Compose
- [ ] CI/CD
- [ ] Documentation API (Swagger)

## 📄 Licence

ISC

## 👤 Auteur

Projet Hello McDo Auto
