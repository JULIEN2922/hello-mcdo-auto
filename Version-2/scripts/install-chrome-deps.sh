#!/bin/bash
# install-chrome-deps.sh
# Télécharge et extrait les librairies nécessaires pour Chrome/Puppeteer
# Sans besoin de root - pour conteneurs Pterodactyl
set -e

LIBS_DIR="$HOME/chrome-libs"
mkdir -p "$LIBS_DIR"

# Ubuntu 22.04 (Jammy) package base URL
BASE_URL="http://archive.ubuntu.com/ubuntu/pool/main"
BASE_URL_UNIVERSE="http://archive.ubuntu.com/ubuntu/pool/universe"

echo "📦 Téléchargement des dépendances Chrome..."

# Liste des paquets et leurs URLs (Ubuntu 22.04 Jammy amd64)
download_and_extract() {
  local name="$1"
  local url="$2"
  local deb="$name.deb"
  
  if [ -f "$LIBS_DIR/$name.done" ]; then
    echo "   ✅ $name (déjà installé)"
    return
  fi
  
  echo "   ⬇️  $name..."
  curl -sL "$url" -o "/tmp/$deb" 2>/dev/null
  
  # Extraire avec ar (si dispo) ou avec dpkg-deb
  if command -v dpkg-deb &>/dev/null; then
    dpkg-deb -x "/tmp/$deb" "/tmp/${name}_extracted" 2>/dev/null
  elif command -v ar &>/dev/null; then
    mkdir -p "/tmp/${name}_extracted"
    cd "/tmp/${name}_extracted"
    ar x "/tmp/$deb" data.tar.xz 2>/dev/null && tar xf data.tar.xz 2>/dev/null
    cd - >/dev/null
  else
    # Méthode manuelle : télécharger le data.tar.xz directement
    echo "      (méthode alternative...)"
  fi
  
  # Copier les .so dans le dossier libs
  if [ -d "/tmp/${name}_extracted/usr/lib/x86_64-linux-gnu" ]; then
    cp -n /tmp/${name}_extracted/usr/lib/x86_64-linux-gnu/*.so* "$LIBS_DIR/" 2>/dev/null || true
  fi
  if [ -d "/tmp/${name}_extracted/usr/lib" ]; then
    cp -n /tmp/${name}_extracted/usr/lib/*.so* "$LIBS_DIR/" 2>/dev/null || true
  fi
  
  rm -f "/tmp/$deb"
  rm -rf "/tmp/${name}_extracted"
  touch "$LIBS_DIR/$name.done"
  echo "   ✅ $name"
}

# Paquets essentiels pour Chrome headless
download_and_extract "libatk1.0-0"       "$BASE_URL/a/atk1.0/libatk1.0-0_2.36.0-3_amd64.deb"
download_and_extract "libatk-bridge2.0-0" "$BASE_URL/a/at-spi2-atk/libatk-bridge2.0-0_2.38.0-3_amd64.deb"
download_and_extract "libcups2"           "$BASE_URL/c/cups/libcups2_2.4.1op1-1ubuntu4_amd64.deb"
download_and_extract "libdrm2"            "$BASE_URL/libd/libdrm/libdrm2_2.4.113-2_amd64.deb"
download_and_extract "libgbm1"            "$BASE_URL/m/mesa/libgbm1_23.2.1-1ubuntu3_amd64.deb"
download_and_extract "libgtk-3-0"         "$BASE_URL/g/gtk+3.0/libgtk-3-0_3.24.33-1ubuntu2_amd64.deb"
download_and_extract "libnspr4"           "$BASE_URL/n/nspr/libnspr4_4.35-0ubuntu1_amd64.deb"
download_and_extract "libnss3"            "$BASE_URL/n/nss/libnss3_3.87.1-1_amd64.deb"
download_and_extract "libxcomposite1"     "$BASE_URL/libx/libxcomposite/libxcomposite1_0.4.5-1build2_amd64.deb"
download_and_extract "libxdamage1"        "$BASE_URL/libx/libxdamage/libxdamage1_1.1.5-2build2_amd64.deb"
download_and_extract "libxkbcommon0"      "$BASE_URL/libx/libxkbcommon/libxkbcommon0_1.3.1-1_amd64.deb"
download_and_extract "libxrandr2"         "$BASE_URL/libx/libxrandr/libxrandr2_1.5.2-1build2_amd64.deb"
download_and_extract "libasound2"         "$BASE_URL/a/alsa-lib/libasound2_1.2.6.1-1ubuntu1_amd64.deb"
download_and_extract "libpango-1.0-0"     "$BASE_URL/p/pango1.0/libpango-1.0-0_1.50.6+ds-2_amd64.deb"
download_and_extract "libpangocairo-1.0-0" "$BASE_URL/p/pango1.0/libpangocairo-1.0-0_1.50.6+ds-2_amd64.deb"
download_and_extract "libcairo2"          "$BASE_URL/c/cairo/libcairo2_1.16.0-5ubuntu2_amd64.deb"

echo ""
echo "✅ Toutes les dépendances sont dans: $LIBS_DIR"
echo ""
echo "📍 Ajoute cette ligne AVANT de lancer le serveur :"
echo "   export LD_LIBRARY_PATH=\"$LIBS_DIR:\$LD_LIBRARY_PATH\""
echo ""
