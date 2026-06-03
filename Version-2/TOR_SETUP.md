# Configuration de Tor pour Hello McDo Auto

## ✨ Installation Automatique (Recommandé)

**Bonne nouvelle !** Tor est maintenant inclus automatiquement dans le projet via npm. Plus besoin d'installation manuelle !

### 📦 Les binaires Tor sont déjà installés

Lors de l'installation des dépendances npm (`npm install`), les binaires Tor ont été téléchargés automatiquement dans :
```
node_modules/kmp-tor.resource-exec-tor.mingw/
```

### 🚀 Démarrage Automatique

Tor démarre automatiquement lors de la première exécution d'un scénario avec l'option Tor activée :

1. **Activer Tor pour un restaurant**
   - Aller dans "Configuration" du restaurant
   - Cocher "Utiliser Tor (IPs françaises différentes pour chaque scénario)"
   - Sauvegarder

2. **Lancer un scénario**
   - Au premier scénario, Tor se lancera automatiquement
   - Les binaires seront extraits dans le dossier `.tor/`
   - Tor démarrera avec la configuration `torrc`

3. **Vérifier les logs**
   - Vous verrez : "🚀 Starting Tor daemon automatically..."
   - Puis : "✅ Tor is ready!"
   - Enfin : "🌐 Using IP: XXX.XXX.XXX.XXX (FR)"

### ⚙️ Configuration

Le fichier [torrc](torrc) contient la configuration Tor avec :
- **ExitNodes {fr}** : Force les nœuds de sortie français uniquement
- **StrictNodes 1** : Refuse les sorties non-françaises
- Port SOCKS : 9050
- Port Control : 9051

**Vous n'avez rien à modifier !** La configuration est déjà optimale.

---

## 🔧 Dépannage

### Tor ne démarre pas

1. **Vérifier les permissions**
   ```cmd
   dir .tor\tor.exe
   ```
   Si absent, supprimer le dossier `.tor` et relancer

2. **Port déjà utilisé**
   - Vérifier qu'aucun autre Tor ne tourne :
   ```cmd
   netstat -an | findstr "9050"
   ```
   - Si occupé, tuer le processus ou changer les ports dans `torrc`

3. **Logs d'erreur**
   - Regarder les logs serveur pour les messages d'erreur Tor
   - Vérifier le fichier torrc (encodage, syntaxe)

### IP pas française

- Attendre 30 secondes que Tor trouve des circuits français
- Si persistant après plusieurs essais, modifier `torrc` :
  ```
  # Retirer cette ligne si trop strict
  StrictNodes 1
  ```

### "Tor failed to start within timeout"

- Augmenter le timeout dans `tor-manager.ts` (ligne `await waitForTor(30000)`)
- Vérifier le firewall Windows
- Vérifier que les ports 9050 et 9051 sont disponibles

---

## 📊 Performance

- **Avec Tor** : ~10-15 secondes par scénario
- **Sans Tor** : ~5-8 secondes par scénario
- **Impact** : Environ 2x plus lent mais avec anonymisation

Chaque scénario utilise une IP française différente grâce au renouvellement automatique de circuit.

---

## ⚠️ Notes Importantes

- **Installation automatique** : Les binaires sont extraits au premier lancement
- **Gestion automatique** : Tor démarre et s'arrête automatiquement
- **IPs françaises garanties** : Grâce à `ExitNodes {fr}` dans torrc
- **Pas de configuration manuelle** : Tout est géré par le code
- **Volume** : ~50 MB de binaires dans node_modules (acceptable)

---

## 🗑️ Désinstallation (si nécessaire)

Si vous voulez retirer Tor complètement :

```cmd
# Supprimer les packages npm
npm uninstall kmp-tor.resource-exec-tor.all kmp-tor.resource-geoip

# Supprimer le dossier d'extraction
rmdir /s /q .tor
```

---

## 📖 Installation Manuelle (Non Recommandée)

<details>
<summary>Cliquer pour voir l'ancienne méthode d'installation manuelle</summary>

Si vous préférez installer Tor manuellement plutôt que d'utiliser les binaires npm (non recommandé) :

### Télécharger Tor Expert Bundle

1. **Télécharger Tor Expert Bundle**
   - Aller sur: https://www.torproject.org/download/tor/
   - Télécharger "Expert Bundle" pour Windows (x64)
   - Exemple: `tor-win64-0.4.8.10.zip`

2. **Extraire dans un dossier**
   ```
   C:\tor\
   ```

3. **Copier le fichier de configuration**
   - Copier le fichier `torrc` depuis ce projet vers `C:\tor\Data\Tor\torrc`
   - Ou créer manuellement le fichier avec le contenu suivant:

   ```
   # Port SOCKS (pour Puppeteer)
   SocksPort 9050

   # Port de contrôle (pour renouveler l'IP)
   ControlPort 9051

   # Mot de passe de contrôle
   HashedControlPassword 16:872860B76453A77D60CA2BB8C1A7042072093276A3D701AD684053EC4C

   # Forcer les nœuds de sortie français uniquement
   ExitNodes {fr}
   StrictNodes 1

   # Éviter certains pays
   ExcludeNodes {cn},{ru},{ir},{kp}

   # Performance
   NumEntryGuards 8
   CircuitBuildTimeout 30
   ```

4. **Générer un nouveau mot de passe (optionnel)**
   ```cmd
   cd C:\tor\Tor
   tor.exe --hash-password VOTRE_MOT_DE_PASSE
   ```
   
   Remplacer `HashedControlPassword` dans `torrc` avec le hash généré.
   
   ⚠️ Si vous changez le mot de passe, mettez à jour aussi la constante `TOR_CONTROL_PASSWORD` dans `server/services/tor.ts`

5. **Lancer Tor**
   ```cmd
   cd C:\tor\Tor
   tor.exe -f ..\Data\Tor\torrc
   ```

   Vous devriez voir:
   ```
   [notice] Bootstrapped 100% (done): Done
   [notice] Opened Socks listener connection on 127.0.0.1:9050
   [notice] Opened Control listener connection on 127.0.0.1:9051
   ```

### Option 2: Tor Browser Bundle

1. **Télécharger Tor Browser**
   - https://www.torproject.org/download/
   - Installer normalement

2. **Localiser tor.exe**
   - Généralement dans: `C:\Users\VOTRE_NOM\Desktop\Tor Browser\Browser\TorBrowser\Tor\`

3. **Créer torrc**
   - Dans le même dossier, créer `torrc` avec le contenu ci-dessus

4. **Lancer Tor**
   ```cmd
   cd "C:\Users\VOTRE_NOM\Desktop\Tor Browser\Browser\TorBrowser\Tor"
   tor.exe -f torrc
   ```

## 🚀 Créer un service Windows (optionnel)

Pour que Tor démarre automatiquement:

1. **Installer NSSM (Non-Sucking Service Manager)**
   - Télécharger: https://nssm.cc/download
   - Extraire dans `C:\nssm\`

2. **Créer le service**
   ```cmd
   cd C:\nssm\win64
   nssm.exe install TorService "C:\tor\Tor\tor.exe" "-f C:\tor\Data\Tor\torrc"
   ```

3. **Démarrer le service**
   ```cmd
   nssm.exe start TorService
   ```

4. **Vérifier le statut**
   ```cmd
   nssm.exe status TorService
   ```

## ✅ Vérifier que Tor fonctionne

### Test 1: Vérifier les ports
```cmd
netstat -an | findstr "9050 9051"
```

Vous devriez voir:
```
TCP    127.0.0.1:9050         0.0.0.0:0              LISTENING
TCP    127.0.0.1:9051         0.0.0.0:0              LISTENING
```

### Test 2: Tester avec curl
```cmd
curl --socks5 127.0.0.1:9050 https://api.ipify.org?format=json
```

Devrait retourner une IP différente de votre IP normale.

### Test 3: Vérifier l'IP française
```cmd
curl --socks5 127.0.0.1:9050 https://ipapi.co/json/
```

Le champ `country_code` devrait être `"FR"`.

## 🔧 Configuration dans Hello McDo Auto

1. **Activer Tor pour un restaurant**
   - Aller dans "Configuration" du restaurant
   - Activer la case "Utiliser Tor (IPs françaises)"
   - Sauvegarder

2. **Lancer un test**
   - Aller sur le Dashboard
   - Lancer un scénario manuellement
   - Vérifier les logs pour voir l'IP utilisée

## 🐛 Dépannage

### Tor ne démarre pas
- Vérifier que le port 9050 n'est pas déjà utilisé
- Essayer avec un autre port dans `torrc`: `SocksPort 9150`
- Mettre à jour `TOR_SOCKS_PORT` dans `server/services/tor.ts`

### Pas d'IP française
- Attendre quelques minutes que Tor trouve des nœuds français
- Vérifier les logs Tor pour voir les circuits établis
- Si persistant, retirer `StrictNodes 1` du torrc (acceptera d'autres pays en backup)

### "Tor is not running" dans les logs
- Vérifier que tor.exe est lancé
- Tester la connexion: `telnet 127.0.0.1 9050`
- Vérifier le firewall Windows

### IP ne change pas entre scénarios
- Le renouvellement d'IP prend 5 secondes
- Vérifier les logs pour confirmer "New Tor IP acquired"
- Augmenter le délai dans `tor.ts` si nécessaire

## 📊 Performance

- **Avec Tor**: ~10-15 secondes par scénario (navigation + délais réseau)
- **Sans Tor**: ~5-8 secondes par scénario
- **Impact**: Environ 2x plus lent mais avec anonymisation

## ⚠️ Important

- **Tor utilise le réseau Tor** : respectez les bonnes pratiques
- **Les IPs françaises sont limitées** : si trop de demandes, les circuits peuvent être lents
- **Utilisez avec modération** : évitez de surcharger le réseau Tor
- **Testing uniquement** : ce système est conçu pour des tests, pas pour de l'usage malveillant
