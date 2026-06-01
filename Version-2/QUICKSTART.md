# 🚀 Guide de Démarrage Rapide - Hello McDo Auto

## Installation en 5 minutes

### 1. Installer les dépendances
```bash
cd Version-2
npm install
```

### 2. Initialiser la base de données
```bash
npm run db:push
```

### 3. Créer les utilisateurs de test (optionnel mais recommandé)
```bash
npm run db:seed
```

Cela créera :
- **Admin** : `admin@hellomcdo.com` / `admin123`
- **User** : `user@hellomcdo.com` / `user123`
- 3 restaurants de démonstration

### 4. Lancer l'application
```bash
npm run dev
```

✅ L'application est accessible sur http://localhost:5173

## 🎯 Premiers pas

### Connexion en tant qu'admin
1. Ouvrez http://localhost:5173
2. Connectez-vous avec `admin@hellomcdo.com` / `admin123`
3. Vous avez accès à toutes les fonctionnalités

### Tester les fonctionnalités

#### 1. Gérer les restaurants
- Menu **Restaurants**
- Créer un nouveau restaurant (code, nom, adresse, ville)
- Modifier / Supprimer

#### 2. Configurer un planning
- Menu **Plannings**
- Sélectionner un restaurant
- Ajouter des plannings par jour :
  - Jour de la semaine
  - Plage horaire (ex: 09:00 - 18:00)
  - Nombre de scénarios min/max (ex: 45-55)
- Cliquer sur "Sauvegarder tout"

#### 3. Voir les logs
- Menu **Logs**
- Filtrer par restaurant, statut, date
- Paginer les résultats

#### 4. Gérer les utilisateurs
- Menu **Utilisateurs**
- Changer les rôles (Admin ↔ User)
- Supprimer des utilisateurs

## 🔐 Gestion des Permissions

### Rôle Admin
- ✅ Voir tous les restaurants
- ✅ Créer/Modifier/Supprimer des restaurants
- ✅ Gérer les plannings
- ✅ Gérer les utilisateurs
- ✅ Voir tous les logs

### Rôle User
- ✅ Voir uniquement les restaurants autorisés
- ❌ Ne peut pas créer/modifier de restaurants
- ❌ Ne peut pas modifier les plannings
- ❌ Ne peut pas gérer les utilisateurs
- ✅ Voir les logs de ses restaurants

### Donner l'accès à un restaurant
En tant qu'admin :
1. Aller dans **Restaurants**
2. Cliquer sur un restaurant
3. Ajouter l'utilisateur

## 🛠️ Commandes utiles

```bash
# Démarrage
npm run dev                    # Frontend + Backend
npm run server:dev             # Backend uniquement
npm run client:dev             # Frontend uniquement

# Base de données
npm run db:push                # Synchroniser le schéma
npm run db:studio              # Interface graphique (http://localhost:5555)
npm run db:seed                # Créer les données de test

# Build
npm run build                  # Build complet
npm start                      # Démarrer en production
```

## 📊 Prisma Studio

Pour visualiser/modifier la base de données directement :
```bash
npm run db:studio
```

Ouvrez http://localhost:5555 et vous pouvez :
- Voir toutes les tables
- Modifier les données
- Changer le rôle d'un utilisateur
- Supprimer des entrées

## 🐛 Problèmes courants

### Erreur "Port 4000 already in use"
```bash
# Windows
netstat -ano | findstr :4000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:4000 | xargs kill -9
```

### Reset complet de la base
```bash
rm dev.db
npm run db:push
npm run db:seed
```

### Erreur JWT_SECRET
Assurez-vous que `.env` existe et contient :
```env
JWT_SECRET=votre-secret-securise
```

## 📱 API Testing (Postman/Thunder Client)

### Login
```http
POST http://localhost:4000/api/auth/login
Content-Type: application/json

{
  "email": "admin@hellomcdo.com",
  "password": "admin123"
}
```

Réponse :
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "email": "admin@hellomcdo.com",
    "role": "ADMIN"
  }
}
```

### Get Restaurants (avec token)
```http
GET http://localhost:4000/api/restaurants
Authorization: Bearer <votre-token>
```

## 🎨 Personnalisation

### Changer le port
Éditez `.env` :
```env
PORT=4000
CORS_ORIGIN=http://localhost:5173
```

Et `vite.config.ts` :
```ts
proxy: {
  '/api': {
    target: 'http://localhost:4000',
    // ...
  }
}
```

### Changer les couleurs
Éditez `src/index.css` :
```css
:root {
  --primary: 221.2 83.2% 53.3%;  /* Bleu */
  --secondary: 210 40% 96.1%;    /* Gris clair */
  /* ... */
}
```

## ⚡ Mode Production

1. Build :
```bash
npm run build
```

2. Variables d'environnement :
```env
NODE_ENV=production
JWT_SECRET=super-secret-production-key
DATABASE_URL="file:./prod.db"
PORT=4000
```

3. Démarrer :
```bash
npm start
```

## 📞 Support

Consultez le [README.md](./README.md) complet pour plus d'informations.
