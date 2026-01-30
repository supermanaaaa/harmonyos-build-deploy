#!/usr/bin/env node

/**
 * HarmonyOS Build & Deploy CLI
 * Cross-platform tool for building and deploying HarmonyOS apps
 * 
 * Usage:
 *   npx harmonyos-deploy
 *   npx harmonyos-deploy --release --launch
 *   npx harmonyos-deploy --skip-build
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.cyan}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    module: 'entry',
    buildMode: 'debug',
    device: '',
    skipBuild: false,
    launch: false,
    clean: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '-m':
      case '--module':
        options.module = args[++i];
        break;
      case '-b':
      case '--build-mode':
      case '--release':
        options.buildMode = arg === '--release' ? 'release' : args[++i];
        break;
      case '-d':
      case '--device':
        options.device = args[++i];
        break;
      case '-s':
      case '--skip-build':
        options.skipBuild = true;
        break;
      case '-l':
      case '--launch':
        options.launch = true;
        break;
      case '-c':
      case '--clean':
        options.clean = true;
        break;
      case '-h':
      case '--help':
        options.help = true;
        break;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
HarmonyOS Build & Deploy CLI

Usage: npx harmonyos-deploy [options]

Options:
  -m, --module <name>     Module name (default: entry)
  -b, --build-mode <mode> Build mode: debug or release (default: debug)
      --release           Shorthand for --build-mode release
  -d, --device <id>       Target device ID (auto-select if not specified)
  -s, --skip-build        Skip build, install existing HAP only
  -l, --launch            Launch app after installation
  -c, --clean             Clean before build
  -h, --help              Show this help message

Examples:
  npx harmonyos-deploy                    # Build and install (debug)
  npx harmonyos-deploy --release --launch # Release build, then launch
  npx harmonyos-deploy -s -l              # Skip build, install and launch
  npx harmonyos-deploy -c                 # Clean build
`);
}

// Execute command and return output
function exec(cmd, options = {}) {
  try {
    return execSync(cmd, { 
      encoding: 'utf8', 
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options 
    });
  } catch (error) {
    if (options.ignoreError) return '';
    throw error;
  }
}

// Execute command and return output silently
function execSilent(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch (error) {
    return '';
  }
}

// Check if command exists
function commandExists(cmd) {
  try {
    const checkCmd = os.platform() === 'win32' ? `where ${cmd}` : `which ${cmd}`;
    execSync(checkCmd, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// Find hvigor command
function findHvigor() {
  const isWindows = os.platform() === 'win32';
  
  // Check local hvigorw
  if (isWindows && fs.existsSync('hvigorw.bat')) {
    return '.\\hvigorw.bat';
  }
  if (!isWindows && fs.existsSync('hvigorw')) {
    return './hvigorw';
  }
  
  // Check global hvigorw
  if (commandExists('hvigorw')) {
    return 'hvigorw';
  }
  
  return null;
}

// Get connected devices
function getDevices() {
  const output = execSilent('hdc list targets');
  if (!output) return [];
  
  return output
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('[') && line.toLowerCase() !== 'empty');
}

// Find HAP file
function findHapFile(module) {
  const hapDir = path.join(module, 'build', 'default', 'outputs', 'default');
  
  // Priority: signed > unsigned > any hap
  const signedHap = path.join(hapDir, `${module}-default-signed.hap`);
  const unsignedHap = path.join(hapDir, `${module}-default-unsigned.hap`);
  
  if (fs.existsSync(signedHap)) {
    return { path: signedHap, signed: true };
  }
  
  if (fs.existsSync(unsignedHap)) {
    return { path: unsignedHap, signed: false };
  }
  
  // Search for any HAP file
  if (fs.existsSync(hapDir)) {
    const files = fs.readdirSync(hapDir);
    const hapFile = files.find(f => f.endsWith('.hap'));
    if (hapFile) {
      return { path: path.join(hapDir, hapFile), signed: hapFile.includes('signed') };
    }
  }
  
  return null;
}

// Read bundle name from app.json5
function getBundleName() {
  const appJsonPath = path.join('AppScope', 'app.json5');
  if (!fs.existsSync(appJsonPath)) return null;
  
  const content = fs.readFileSync(appJsonPath, 'utf8');
  const match = content.match(/"bundleName"\s*:\s*"([^"]+)"/);
  return match ? match[1] : null;
}

// Read ability name from module.json5
function getAbilityName(module) {
  const moduleJsonPath = path.join(module, 'src', 'main', 'module.json5');
  if (!fs.existsSync(moduleJsonPath)) return 'EntryAbility';
  
  const content = fs.readFileSync(moduleJsonPath, 'utf8');
  const match = content.match(/"name"\s*:\s*"([^"]*Ability[^"]*)"/);
  return match ? match[1] : 'EntryAbility';
}

// Main function
async function main() {
  const options = parseArgs();
  
  if (options.help) {
    showHelp();
    process.exit(0);
  }
  
  log.info(`Working directory: ${process.cwd()}`);
  
  // Check if HarmonyOS project
  if (!fs.existsSync('build-profile.json5')) {
    log.error('Not a valid HarmonyOS project (missing build-profile.json5)');
    process.exit(1);
  }
  
  // Find hvigor
  const hvigorCmd = findHvigor();
  if (!hvigorCmd) {
    log.error('Cannot find hvigorw build tool');
    log.info('Make sure hvigorw exists in project root or install globally:');
    log.info('  npm install -g @ohos/hvigor-cli');
    process.exit(1);
  }
  log.info(`Using build tool: ${hvigorCmd}`);
  
  // Check hdc
  if (!commandExists('hdc')) {
    log.error('Cannot find hdc tool');
    log.info('Add HarmonyOS SDK toolchains to your PATH');
    process.exit(1);
  }
  
  // Get devices
  log.info('Checking connected devices...');
  const devices = getDevices();
  
  if (devices.length === 0) {
    log.error('No device connected');
    log.info('Please check:');
    log.info('  1. Device connected via USB');
    log.info('  2. USB debugging enabled (Settings → System → Developer Options)');
    log.info('  3. Computer authorized for debugging');
    process.exit(1);
  }
  
  // Select device
  let device = options.device;
  if (!device) {
    device = devices[0];
    if (devices.length > 1) {
      log.warn(`Multiple devices found, using first: ${device}`);
      log.info('Available devices:');
      devices.forEach(d => console.log(`  - ${d}`));
    }
  }
  log.info(`Target device: ${device}`);
  
  // Clean
  if (options.clean) {
    log.info('Cleaning build cache...');
    try {
      exec(`${hvigorCmd} clean --no-daemon`, { silent: true, ignoreError: true });
    } catch {}
  }
  
  // Build
  if (!options.skipBuild) {
    log.info(`Building project (mode: ${options.buildMode})...`);
    
    const buildCmd = `${hvigorCmd} assembleHap --mode module -p module=${options.module}@default -p product=default -p buildMode=${options.buildMode} --no-daemon`;
    log.info(`Executing: ${buildCmd}`);
    
    try {
      exec(buildCmd);
      log.success('Build completed');
    } catch (error) {
      log.error('Build failed');
      process.exit(1);
    }
  }
  
  // Find HAP file
  const hap = findHapFile(options.module);
  if (!hap) {
    log.error('Cannot find HAP file');
    log.info(`Expected path: ${options.module}/build/default/outputs/default/`);
    process.exit(1);
  }
  
  if (!hap.signed) {
    log.warn('Using unsigned HAP, may fail on real device');
  }
  log.info(`HAP file: ${hap.path}`);
  
  // Install
  log.info(`Installing to device ${device}...`);
  try {
    exec(`hdc -t ${device} install "${hap.path}"`);
    log.success('Install completed!');
  } catch (error) {
    log.error('Install failed');
    log.info('Common causes:');
    log.info('  1. Signature mismatch');
    log.info('  2. Device not authorized');
    log.info('  3. Version conflict (try: hdc -t ' + device + ' uninstall <bundleName>)');
    process.exit(1);
  }
  
  // Launch
  if (options.launch) {
    const bundleName = getBundleName();
    const abilityName = getAbilityName(options.module);
    
    if (bundleName) {
      log.info(`Launching app: ${bundleName} / ${abilityName}`);
      try {
        exec(`hdc -t ${device} shell aa start -a ${abilityName} -b ${bundleName}`, { silent: true });
      } catch {
        log.warn('Launch failed, please open app manually');
      }
    } else {
      log.warn('Cannot get bundle name, skip launch');
    }
  }
  
  log.success('Deploy completed!');
}

main().catch(error => {
  log.error(error.message);
  process.exit(1);
});
