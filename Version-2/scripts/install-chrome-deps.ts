/**
 * install-chrome-deps.ts
 * Télécharge les librairies système manquantes pour Chrome/Puppeteer
 * Utilise apt-get download (pas besoin de root) - compatible Pterodactyl
 * 
 * Usage: npx tsx scripts/install-chrome-deps.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const LIBS_DIR = path.join(process.env.HOME || '/home/container', 'chrome-libs');

// Paquets Debian/Ubuntu nécessaires pour Chrome headless
const PACKAGES = [
  'libatk1.0-0',
  'libatk-bridge2.0-0',
  'libatspi2.0-0',
  'libcups2',
  'libdrm2',
  'libgbm1',
  'libgtk-3-0',
  'libnspr4',
  'libnss3',
  'libxcomposite1',
  'libxdamage1',
  'libxkbcommon0',
  'libxrandr2',
  'libasound2',
  'libpango-1.0-0',
  'libpangocairo-1.0-0',
  'libcairo2',
  'libx11-6',
  'libxcb1',
  'libxext6',
  'libxfixes3',
  'libdbus-1-3',
  'libexpat1',
  'libfreetype6',
  'libfontconfig1',
  'libavahi-common3',
  'libavahi-client3',
];

function run(cmd: string): { ok: boolean; stdout: string; stderr: string } {
  try {
    const stdout = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe', timeout: 30000 });
    return { ok: true, stdout: stdout.trim(), stderr: '' };
  } catch (err: any) {
    return { ok: false, stdout: err.stdout?.trim() || '', stderr: err.stderr?.trim() || '' };
  }
}

function extractDeb(debPath: string, extractDir: string): boolean {
  if (!fs.existsSync(extractDir)) fs.mkdirSync(extractDir, { recursive: true });

  let result = run(`dpkg-deb -x "${debPath}" "${extractDir}"`);
  if (result.ok) return true;

  result = run(`cd "${extractDir}" && ar x "${debPath}" data.tar.xz && tar xf data.tar.xz`);
  if (result.ok) return true;

  result = run(`cd "${extractDir}" && ar x "${debPath}" data.tar.zst && tar xf data.tar.zst`);
  if (result.ok) return true;

  return false;
}

function copySoFiles(extractDir: string): number {
  const soDirs = [
    path.join(extractDir, 'usr/lib/x86_64-linux-gnu'),
    path.join(extractDir, 'usr/lib'),
    path.join(extractDir, 'lib/x86_64-linux-gnu'),
    path.join(extractDir, 'lib'),
  ];

  let copied = 0;
  for (const dir of soDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.so') || f.includes('.so.'));
      for (const file of files) {
        const src = path.join(dir, file);
        const dest = path.join(LIBS_DIR, file);
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(src, dest);
          copied++;
        }
      }
    } catch {}
  }
  return copied;
}

async function main() {
  console.log('🔧 Installation des dépendances Chrome pour Puppeteer');
  console.log('═══════════════════════════════════════════════════════\n');

  if (!fs.existsSync(LIBS_DIR)) {
    fs.mkdirSync(LIBS_DIR, { recursive: true });
  }

  let installed = 0;
  let failed = 0;

  for (const pkgName of PACKAGES) {
    const doneFile = path.join(LIBS_DIR, `.${pkgName}.done`);

    if (fs.existsSync(doneFile)) {
      console.log(`   ✅ ${pkgName} (déjà installé)`);
      installed++;
      continue;
    }

    const tmpDir = path.join('/tmp', `deb_${pkgName}`);

    try {
      console.log(`   ⬇️  ${pkgName}...`);
      let extracted = false;

      // Méthode 1: apt-get download (ne nécessite PAS root)
      const aptResult = run(`apt-get download ${pkgName}`);
      if (aptResult.ok) {
        const cwdFiles = fs.readdirSync(process.cwd()).filter(f => f.startsWith(pkgName) && f.endsWith('.deb'));
        if (cwdFiles.length > 0) {
          const srcDeb = path.join(process.cwd(), cwdFiles[0]);
          if (extractDeb(srcDeb, tmpDir)) {
            fs.unlinkSync(srcDeb);
            extracted = true;
          }
        }
      }

      // Méthode 2: chercher dans le cache apt
      if (!extracted) {
        const cacheResult = run(`find /var/cache/apt/archives/ -name "${pkgName}_*.deb" 2>/dev/null | head -1`);
        if (cacheResult.ok && cacheResult.stdout) {
          if (extractDeb(cacheResult.stdout, tmpDir)) {
            extracted = true;
          }
        }
      }

      if (!extracted) {
        throw new Error(`apt-get download échoué`);
      }

      const copied = copySoFiles(tmpDir);
      console.log(`   ✅ ${pkgName} (${copied} .so)`);
      fs.writeFileSync(doneFile, new Date().toISOString());
      installed++;

    } catch (err: any) {
      console.log(`   ⚠️  ${pkgName}: ${err.message}`);
      failed++;
    } finally {
      try { if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true }); } catch {}
    }
  }

  console.log(`\n📊 ${installed} installés, ${failed} échoués`);
  console.log(`📁 ${LIBS_DIR}`);

  // Vérifier les .so manquants
  const chromeResult = run(`find ~/.cache/puppeteer/chrome -name chrome -type f 2>/dev/null | head -1`);
  const chromePath = chromeResult.stdout;

  if (chromePath) {
    console.log(`\n🔍 ldd "${chromePath}"...`);
    const lddResult = run(`LD_LIBRARY_PATH="${LIBS_DIR}:$LD_LIBRARY_PATH" ldd "${chromePath}" 2>&1 | grep "not found" || echo "✅ Aucune librairie manquante !"`);
    console.log(lddResult.stdout || lddResult.stderr || '✅ OK');
  }

  if (installed > 0) {
    console.log(`\n✅ LD_LIBRARY_PATH est dans start:prod, tout est prêt !`);
  }
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
