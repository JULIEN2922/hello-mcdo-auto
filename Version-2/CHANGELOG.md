# Changelog

All notable changes to this project will be documented in this file.

## [2.1.0] - 2024-01-XX

### 🎉 Ajout Majeur : Intégration Tor

#### 🆕 Nouvelles Fonctionnalités
- **Intégration Tor complète** avec IPs françaises différentes par scénario
- **Installation automatique** : Binaires Tor inclus via npm packages
- **Démarrage automatique** : Tor se lance au premier scénario qui en a besoin
- **Renouvellement d'IP** : Circuit Tor renouvelé entre chaque scénario
- **Configuration zero** : Aucune installation manuelle requise

#### 🔧 Modifications Techniques
- Ajout package npm `kmp-tor.resource-exec-tor.all` (binaires Tor)
- Ajout package npm `kmp-tor.resource-geoip` (données géolocalisation)
- Création service `tor-manager.ts` (gestion daemon Tor)
- Suppression service `tor.ts` (remplacé par tor-manager)
- Modification `scenario-executor.ts` (intégration automatique)
- Extension schéma Prisma : Champ `useTor` dans `RestaurantConfig`

#### 📝 Documentation
- Ajout `TOR_INTEGRATION.md` (guide complet)
- Ajout `TOR_REFERENCE.md` (référence technique détaillée)
- Mise à jour `TOR_SETUP.md` (installation automatique)
- Mise à jour `README.md` (section Tor)
- Ajout script de test `test-tor.js`
- Ajout script npm `test:tor`

#### 🎨 UI/UX
- Ajout checkbox "Utiliser Tor" dans RestaurantConfigPage
- Message d'avertissement (sera retiré dans prochaine version)

#### 🔐 Sécurité
- Configuration `ExitNodes {fr}` : IPs françaises uniquement
- Configuration `StrictNodes 1` : Refuse les autres pays
- Authentification cookie automatique (pas de mot de passe en clair)
- Exclusion de nœuds dangereux : Chine, Russie, Iran, Corée du Nord

#### 📊 Performance
- Impact : ~2x plus lent avec Tor (6s → 12s par scénario)
- Délai renouvellement circuit : 5 secondes
- Timeout démarrage Tor : 30 secondes

#### 🗄️ Base de Données
- Migration Prisma appliquée (ajout champ `useTor`)
- Rétrocompatibilité garantie (valeur par défaut : `false`)

#### 🐛 Corrections
- Suppression ancien service `tor.ts` (obsolète)
- Mise à jour imports dans `scenario-executor.ts`
- Configuration `torrc` optimisée (CookieAuthentication)

#### 📦 Dépendances
- `kmp-tor.resource-exec-tor.all@^409.5.1-SNAPSHOT.0`
- `kmp-tor.resource-geoip@^409.5.1-SNAPSHOT.0`

---

## [2.0.0] - 2024-01-XX

### 🎉 Version Initiale

#### ✨ Fonctionnalités Core
- Authentification JWT avec bcrypt
- Gestion des rôles (Admin/User)
- CRUD restaurants avec permissions
- Plannings configurables (jour, horaire, min/max scénarios)
- Vue calendrier Google Agenda
- Exécution automatique selon plannings
- Exécution manuelle à la demande
- Monitoring temps réel (refresh 5s)
- Historique et logs détaillés
- Statistiques de succès

#### 🎨 Stack Technique
- **Frontend** : React 18 + TypeScript + Vite + shadcn/ui + Tailwind
- **Backend** : Express.js + TypeScript + Node.js
- **Database** : SQLite + Prisma ORM
- **Automation** : Puppeteer (11 étapes)
- **UI** : Radix UI + Lucide Icons

#### 📦 Packages Principaux
- `@prisma/client@^5.14.0`
- `axios@^1.7.2`
- `bcryptjs@^2.4.3`
- `cors@^2.8.5`
- `dotenv@^16.4.5`
- `express@^4.19.2`
- `jsonwebtoken@^9.0.2`
- `puppeteer@^22.15.0`
- `react@^18.3.1`
- `react-router-dom@^6.23.1`
- `vite@^5.4.21`

#### 🗄️ Schéma Database
- `User` : id, username, password (hashed), role, createdAt
- `Restaurant` : id, name, code, active, userIds
- `RestaurantConfig` : id, restaurantId, concurrency, delays, headless
- `Planning` : id, restaurantId, dayOfWeek, times, scenarios, active
- `ScenarioLog` : id, restaurantId, timestamp, status, details, duration

#### 📝 Documentation Initiale
- `README.md`
- `QUICKSTART.md`

---

## Format

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

### Types de changements
- `🆕 Ajouté` - pour les nouvelles fonctionnalités
- `🔧 Modifié` - pour les changements dans les fonctionnalités existantes
- `⚠️ Déprécié` - pour les fonctionnalités bientôt retirées
- `🗑️ Retiré` - pour les fonctionnalités maintenant retirées
- `🐛 Corrigé` - pour les corrections de bugs
- `🔐 Sécurité` - en cas de vulnérabilités

---

## Notes de Version

### Comment utiliser Tor (v2.1.0+)

```bash
# 1. S'assurer que les packages sont installés
npm install

# 2. Tester Tor
npm run test:tor

# 3. Lancer l'application
npm run dev

# 4. Dans l'interface :
#    Configuration → Restaurant → ☑️ Utiliser Tor → Sauvegarder
```

### Migration depuis v2.0.0

Aucune action requise ! Le champ `useTor` est ajouté automatiquement avec la valeur par défaut `false`. Les restaurants existants continuent de fonctionner normalement sans Tor.

Pour activer Tor :
1. Ouvrir la configuration du restaurant
2. Cocher "Utiliser Tor"
3. Sauvegarder

Tor se lancera automatiquement au premier scénario.

---

**Contributeurs** : [Votre Nom]
**License** : [License Type]
