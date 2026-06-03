# 🎯 Tor Intégré - Installation Automatique

## ✨ Fonctionnalités

- ✅ **Binaires Tor inclus** : Tor est automatiquement installé via npm
- ✅ **Démarrage automatique** : Tor démarre quand nécessaire
- ✅ **IPs françaises uniquement** : Configuration `ExitNodes {fr}`
- ✅ **Renouvellement d'IP** : Chaque scénario utilise une IP différente
- ✅ **Pas de configuration manuelle** : Tout est géré par le code

## 📦 Ce qui est inclus

```
node_modules/
  kmp-tor.resource-exec-tor.mingw/    # Binaires Tor (Windows)
  kmp-tor.resource-geoip/             # Fichiers GeoIP

.tor/                                  # Créé au premier lancement
  tor.exe                              # Binaire extrait
  tor.dll                              # Librairie
  data/                                # Données Tor (circuits, etc.)

torrc                                  # Configuration Tor
```

## 🚀 Utilisation

### 1. Activer Tor dans l'interface

1. Aller sur `http://localhost:5173`
2. Menu **Configuration** → Sélectionner un restaurant
3. Cocher **"Utiliser Tor (IPs françaises...)"**
4. **Sauvegarder**

### 2. Lancer un scénario

Lors de la première exécution avec Tor activé :

```
📦 Extracting Tor binaries...
  ✅ tor.exe extracted
  ✅ tor.dll extracted
🚀 Starting Tor daemon...
[Tor] Bootstrapped 0% (starting): Starting
[Tor] Bootstrapped 10% (conn_done): Connected to relay
[Tor] Bootstrapped 100% (done): Done
✅ Tor is ready!
✅ Tor connection verified
🌐 Using IP: 91.XX.XX.XX (FR)
```

### 3. Vérifier dans les logs

Chaque scénario affiche :
- L'IP utilisée
- Le pays (devrait être FR)
- Le renouvellement d'IP entre scénarios

## 🔧 Configuration

Le fichier [`torrc`](torrc) contient :

```ini
# Répertoire de données
DataDirectory data

# Ports
SocksPort 9050              # Pour Puppeteer
ControlPort 9051            # Pour renouveler l'IP

# Authentification automatique
CookieAuthentication 1

# IPs françaises uniquement
ExitNodes {fr}
StrictNodes 1

# Performance optimisée
NumEntryGuards 8
CircuitBuildTimeout 30
```

**Pas besoin de modification !**

## 📊 Flux d'exécution

```
Scénario 1
  ↓ Démarrage Tor (si pas déjà lancé)
  ↓ Vérification connexion
  ↓ Vérification IP française
  ↓ Exécution avec IP A
  
Scénario 2  
  ↓ Renouvellement circuit (5s)
  ↓ Exécution avec IP B
  
Scénario 3
  ↓ Renouvellement circuit (5s)
  ↓ Exécution avec IP C
```

## ⚡ Performance

| Mode | Temps moyen | Impact |
|------|-------------|--------|
| Sans Tor | ~5-8 secondes | Baseline |
| Avec Tor | ~10-15 secondes | +2x |

Le ralentissement vient de :
- Réseau Tor (routage multi-nœuds)
- Renouvellement de circuit (5s entre scénarios)

## 🛠️ Dépannage

### Tor ne démarre pas

**Vérifier l'extraction :**
```cmd
dir .tor\tor.exe
```

Si absent :
```cmd
rmdir /s /q .tor
# Relancer le serveur
```

**Vérifier les ports :**
```cmd
netstat -an | findstr "9050 9051"
```

Si occupés, fermer l'autre processus Tor.

### IP pas française

**Attendre 30 secondes** que Tor établisse les circuits français.

Si le problème persiste :
1. Vérifier les logs : `[Tor] Bootstrapped 100%`
2. Tester manuellement :
   ```cmd
   curl --socks5 127.0.0.1:9050 https://ipapi.co/json/
   ```

**Assouplir les règles** (dans torrc) :
```ini
# Commenter cette ligne pour accepter d'autres pays en backup
# StrictNodes 1
```

### "Tor failed to start within timeout"

**Causes possibles :**
- Firewall Windows bloque Tor
- Antivirus bloque tor.exe
- Réseau Tor lent

**Solutions :**
1. Ajouter exception firewall pour tor.exe
2. Ajouter exception antivirus pour `.tor/`
3. Augmenter timeout (dans tor-manager.ts) :
   ```typescript
   await waitForTor(60000); // 60 secondes
   ```

## 🧹 Désinstallation

Pour retirer Tor complètement :

```cmd
# Supprimer packages npm
npm uninstall kmp-tor.resource-exec-tor.all kmp-tor.resource-geoip

# Supprimer dossier d'extraction
rmdir /s /q .tor
```

## 📝 Architecture

```
server/services/
  tor-manager.ts          # Gestion du daemon Tor
    ├─ extractTorBinaries()   # Décompresse .gz → .tor/
    ├─ startTor()             # Lance tor.exe
    ├─ renewTorIP()           # SIGNAL NEWNYM
    └─ verifyFrenchIP()       # Vérifie pays
    
  scenario-executor.ts    # Utilise Tor
    └─ executeScenario()
         ├─ Vérifie useTor
         ├─ Démarre Tor si nécessaire
         ├─ Configure proxy Puppeteer
         └─ Vérifie IP française
```

## 🎓 En savoir plus

- [Tor Project](https://www.torproject.org/)
- [kmp-tor Resources](https://github.com/05nelsonm/kmp-tor-resource)
- [Puppeteer Proxy](https://pptr.dev/guides/proxy)

## ⚠️ Avertissement

Ce système est conçu pour :
- ✅ Tests de satisfaction client
- ✅ Anonymisation des retours
- ✅ Diversification des IPs sources

**Ne pas utiliser pour :**
- ❌ Contournement de restrictions
- ❌ Activités malveillantes
- ❌ Spam ou abus

Respectez les conditions d'utilisation de Medallia et du réseau Tor.
