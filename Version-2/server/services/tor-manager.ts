import { spawn, ChildProcess } from 'child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync } from 'fs';
import { createGunzip } from 'zlib';
import { createReadStream } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import net from 'net';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Tor configuration
const TOR_SOCKS_PORT = 9050;
const TOR_CONTROL_PORT = 9051;

// Paths
const PROJECT_ROOT = join(__dirname, '..', '..');
const TOR_DIR = join(PROJECT_ROOT, '.tor');
const TOR_DATA_DIR = join(TOR_DIR, 'data');
const TOR_EXE_PATH = join(TOR_DIR, 'tor.exe');
const TOR_DLL_PATH = join(TOR_DIR, 'tor.dll');
const TORRC_PATH = join(PROJECT_ROOT, 'torrc');
const COOKIE_PATH = join(TOR_DATA_DIR, 'control_auth_cookie');

// Platform detection
const ARCH = process.arch === 'x64' ? 'x86_64' : 'x86';
const TOR_PACKAGE_PATH = join(PROJECT_ROOT, 'node_modules', 'kmp-tor.resource-exec-tor.mingw', ARCH);
const GEOIP_PACKAGE_PATH = join(PROJECT_ROOT, 'node_modules', 'kmp-tor.resource-geoip');
const GEOIP_PATH = join(TOR_DIR, 'geoip');
const GEOIP6_PATH = join(TOR_DIR, 'geoip6');

let torProcess: ChildProcess | null = null;
let torBootstrapped = false;

/**
 * Decompress a .gz file
 */
async function decompressGz(source: string, destination: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const gunzip = createGunzip();
    const input = createReadStream(source);
    const output = createWriteStream(destination);

    input
      .pipe(gunzip)
      .pipe(output)
      .on('finish', resolve)
      .on('error', reject);
  });
}

/**
 * Extract Tor binaries if not already extracted
 */
async function extractTorBinaries(): Promise<void> {
  // Create .tor directory if it doesn't exist
  if (!existsSync(TOR_DIR)) {
    mkdirSync(TOR_DIR, { recursive: true });
  }
  if (!existsSync(TOR_DATA_DIR)) {
    mkdirSync(TOR_DATA_DIR, { recursive: true });
  }

  // Check if already extracted
  if (existsSync(TOR_EXE_PATH) && existsSync(TOR_DLL_PATH) && existsSync(GEOIP_PATH) && existsSync(GEOIP6_PATH)) {
    console.log('✅ Tor binaries already extracted');
    return;
  }

  console.log('📦 Extracting Tor binaries...');

  // Extract tor.exe
  const torExeGz = join(TOR_PACKAGE_PATH, 'tor.exe.gz');
  if (existsSync(torExeGz)) {
    await decompressGz(torExeGz, TOR_EXE_PATH);
    console.log('  ✅ tor.exe extracted');
  } else {
    throw new Error(`Tor executable not found: ${torExeGz}`);
  }

  // Extract tor.dll
  const torDllGz = join(TOR_PACKAGE_PATH, 'tor.dll.gz');
  if (existsSync(torDllGz)) {
    await decompressGz(torDllGz, TOR_DLL_PATH);
    console.log('  ✅ tor.dll extracted');
  }

  // Extract GeoIP files
  const geoipGz = join(GEOIP_PACKAGE_PATH, 'geoip.gz');
  if (existsSync(geoipGz)) {
    await decompressGz(geoipGz, GEOIP_PATH);
    console.log('  ✅ geoip extracted');
  } else {
    console.warn('  ⚠️  geoip.gz not found');
  }

  const geoip6Gz = join(GEOIP_PACKAGE_PATH, 'geoip6.gz');
  if (existsSync(geoip6Gz)) {
    await decompressGz(geoip6Gz, GEOIP6_PATH);
    console.log('  ✅ geoip6 extracted');
  } else {
    console.warn('  ⚠️  geoip6.gz not found');
  }

  console.log('✅ Tor binaries extracted successfully');
}

/**
 * Start Tor daemon
 */
export async function startTor(): Promise<void> {
  if (torProcess) {
    console.log('⚠️  Tor is already running');
    // Wait for bootstrap if not ready yet
    if (!torBootstrapped) {
      console.log('⏳ Waiting for Tor to bootstrap...');
      await waitForBootstrap(60000);
    }
    return;
  }

  try {
    // Reset bootstrap status
    torBootstrapped = false;
    
    // Extract binaries if needed
    await extractTorBinaries();

    // Check if torrc exists
    if (!existsSync(TORRC_PATH)) {
      throw new Error(`torrc file not found: ${TORRC_PATH}`);
    }

    console.log('🚀 Starting Tor daemon...');

    // Start Tor process
    torProcess = spawn(TOR_EXE_PATH, ['-f', TORRC_PATH], {
      cwd: TOR_DIR,
      env: {
        ...process.env,
        PATH: `${TOR_DIR};${process.env.PATH}`
      }
    });

    // Handle output
    torProcess.stdout?.on('data', (data) => {
      const message = data.toString().trim();
      if (message.includes('Bootstrapped 100%')) {
        torBootstrapped = true;
        console.log('✅ Tor is fully bootstrapped and ready!');
      } else if (message.includes('Bootstrapped')) {
        console.log(`[Tor] ${message}`);
      } else if (message.includes('notice')) {
        console.log(`[Tor] ${message}`);
      }
    });

    torProcess.stderr?.on('data', (data) => {
      const message = data.toString().trim();
      if (!message.includes('DisableDebuggerAttachment')) {
        console.error(`[Tor Error] ${message}`);
      }
    });

    torProcess.on('error', (error) => {
      console.error('❌ Tor process error:', error);
      torProcess = null;
    });

    torProcess.on('exit', (code, signal) => {
      console.log(`⚠️  Tor process exited with code ${code} (signal: ${signal})`);
      torProcess = null;
      torBootstrapped = false;
    });

    // Wait for Tor to be ready (connection + bootstrap)
    await waitForTor(60000);

  } catch (error) {
    console.error('❌ Failed to start Tor:', error);
    throw error;
  }
}

/**
 * Wait for Tor to be fully bootstrapped
 */
async function waitForBootstrap(timeout: number = 60000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (torBootstrapped) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw new Error('Tor failed to bootstrap within timeout');
}

/**
 * Wait for Tor to be ready (connection + bootstrap)
 */
async function waitForTor(timeout: number = 60000): Promise<void> {
  const startTime = Date.now();

  // First wait for connection
  while (Date.now() - startTime < timeout) {
    const isReady = await checkTorConnection();
    if (isReady) {
      console.log('✅ Tor connection verified');
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  if (Date.now() - startTime >= timeout) {
    throw new Error('Tor failed to start within timeout');
  }
  
  // Then wait for bootstrap
  console.log('⏳ Waiting for Tor to bootstrap (may take 30-60 seconds)...');
  await waitForBootstrap(timeout - (Date.now() - startTime));
}

/**
 * Stop Tor daemon
 */
export function stopTor(): void {
  if (torProcess) {
    console.log('🛑 Stopping Tor daemon...');
    torProcess.kill('SIGTERM');
    torProcess = null;
    torBootstrapped = false;
  }
}

/**
 * Send command to Tor control port
 */
async function sendTorCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let response = '';

    client.connect(TOR_CONTROL_PORT, '127.0.0.1', () => {
      // Authenticate with cookie
      if (existsSync(COOKIE_PATH)) {
        const cookie = readFileSync(COOKIE_PATH);
        const cookieHex = cookie.toString('hex').toUpperCase();
        client.write(`AUTHENTICATE ${cookieHex}\r\n`);
      } else {
        // Try without authentication
        client.write(`AUTHENTICATE\r\n`);
      }
    });

    client.on('data', (data) => {
      response += data.toString();
      
      // Check if authenticated
      if (response.includes('250 OK')) {
        if (command === 'AUTHENTICATE') {
          client.end();
          resolve('authenticated');
        } else if (!response.includes(command)) {
          // Send actual command after authentication
          client.write(`${command}\r\n`);
        } else {
          // Command response received
          client.end();
          resolve(response);
        }
      } else if (response.includes('515')) {
        // Authentication failed
        client.end();
        reject(new Error('Tor authentication failed'));
      }
    });

    client.on('error', (err) => {
      reject(err);
    });

    client.on('close', () => {
      if (response.includes('250 OK')) {
        resolve(response);
      }
    });
  });
}

/**
 * Request new Tor circuit (new IP)
 */
export async function renewTorIP(): Promise<void> {
  try {
    console.log('🔄 Requesting new Tor IP...');
    await sendTorCommand('SIGNAL NEWNYM');
    // Wait for circuit to establish
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('✅ New Tor IP acquired');
  } catch (error) {
    console.error('❌ Failed to renew Tor IP:', error);
    throw error;
  }
}

/**
 * Check if an IP address is IPv6
 */
export function isIPv6(ip: string): boolean {
  return ip.includes(':');
}

/**
 * Get current IP address
 */
export async function getCurrentIP(): Promise<string> {
  try {
    const response = await axios.get('https://api.ipify.org?format=json', {
      timeout: 10000
    });
    return response.data.ip;
  } catch (error) {
    console.error('Failed to get current IP:', error);
    return 'unknown';
  }
}

/**
 * Get Tor proxy configuration for Puppeteer
 */
export function getTorProxyArgs(): string[] {
  return [
    `--proxy-server=socks5://127.0.0.1:${TOR_SOCKS_PORT}`,
    '--host-resolver-rules="MAP * ~NOTFOUND , EXCLUDE 127.0.0.1"',
  ];
}

/**
 * Check if Tor is running and accessible
 */
export async function checkTorConnection(): Promise<boolean> {
  return new Promise((resolve) => {
    const client = new net.Socket();
    
    client.setTimeout(3000);
    
    client.connect(TOR_SOCKS_PORT, '127.0.0.1', () => {
      client.end();
      resolve(true);
    });

    client.on('error', () => {
      resolve(false);
    });

    client.on('timeout', () => {
      client.destroy();
      resolve(false);
    });
  });
}

/**
 * Verify we're using a French IP
 */
export async function verifyFrenchIP(): Promise<{ isFrench: boolean; country: string; ip: string }> {
  try {
    const response = await axios.get('https://ipapi.co/json/', {
      timeout: 10000
    });
    
    const country = response.data.country_code;
    const ip = response.data.ip;
    
    return {
      isFrench: country === 'FR',
      country,
      ip
    };
  } catch (error) {
    console.error('Failed to verify IP location:', error);
    return {
      isFrench: false,
      country: 'unknown',
      ip: 'unknown'
    };
  }
}

/**
 * Check if Tor is running
 */
export function isTorRunning(): boolean {
  return torProcess !== null && !torProcess.killed;
}
