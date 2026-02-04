#!/usr/bin/env node
/**
 * HarmonyOS Build & Deploy CLI
 * Cross-platform tool for building and deploying HarmonyOS apps
 * 
 * Usage:
 *   npx harmonyos-deploy
 *   npx harmonyos-deploy --release --launch
 *   npx harmonyos-deploy --all -b test
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
  dim: '\x1b[2m',
};

const log = {
  info: (msg) => console.log(`${colors.cyan}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
};

// Diagnose common build errors and suggest fixes
function diagnoseBuildError(errorOutput) {
  if (!errorOutput) return;
  
  const diagnostics = [];
  const errStr = typeof errorOutput === 'string' ? errorOutput : String(errorOutput);
  
  // Hvigor version mismatch
  if (errStr.includes('Unsupported modelVersion')) {
    diagnostics.push({
      issue: 'Hvigor version mismatch',
      fix: 'Use DevEco Studio built-in hvigorw, or update hvigor-config.json5 modelVersion',
    });
  }
  
  // DEVECO_SDK_HOME
  if (errStr.includes('DEVECO_SDK_HOME')) {
    diagnostics.push({
      issue: 'DEVECO_SDK_HOME not set or invalid',
      fix: 'Set environment variable: $env:DEVECO_SDK_HOME = "C:\\Program Files\\Huawei\\DevEco Studio\\sdk"',
    });
  }
  
  // Signing error
  if (errStr.includes('sign') || errStr.includes('signature') || errStr.includes('SignProfile')) {
    diagnostics.push({
      issue: 'Signing configuration error',
      fix: 'Check build-profile.json5 signing config, or re-sign in DevEco Studio (Build → Generate Key and CSR)',
    });
  }
  
  // SDK version
  if (errStr.includes('compileSdkVersion') || errStr.includes('compatibleSdkVersion')) {
    diagnostics.push({
      issue: 'SDK version mismatch',
      fix: 'Check compileSdkVersion in build-profile.json5 matches your installed SDK',
    });
  }
  
  // ArkTS syntax
  if (errStr.includes('ArkTS') || errStr.includes('ets(') || errStr.includes('.ets:')) {
    diagnostics.push({
      issue: 'ArkTS compilation error',
      fix: 'Check the file and line number in the error above',
    });
  }
  
  // Missing dependency
  if (errStr.includes('Cannot find module') || errStr.includes('ohpm') || errStr.includes('oh_modules')) {
    diagnostics.push({
      issue: 'Missing dependency',
      fix: 'Run: ohpm install',
    });
  }
  
  // atomicService limitation
  if (errStr.includes('atomicService') || errStr.includes('atomic_service')) {
    diagnostics.push({
      issue: 'API not supported in atomicService mode',
      fix: 'Change bundleType to "app" in AppScope/app.json5, or use supported APIs',
    });
  }
  
  // Install type conflict
  if (errStr.includes('9568296') || errStr.includes('error bundle type')) {
    diagnostics.push({
      issue: 'Bundle type conflict (atomicService vs app)',
      fix: 'Uninstall the old app first: use --uninstall flag, or run: hdc uninstall <bundleName>',
    });
  }
  
  if (diagnostics.length > 0) {
    console.log('');
    log.info('Diagnosis:');
    diagnostics.forEach((d, i) => {
      console.log(`  ${i + 1}. ${colors.yellow}${d.issue}${colors.reset}`);
      console.log(`     → ${d.fix}`);
    });
  }
}

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
    all: false,  // 全量编译
    uninstall: false,  // 安装前卸载旧应用
    product: 'default',  // 产品名称（对应 build-profile.json5 中的 product 配置）
    listProducts: false,  // 列出可用产品
    listBuildModes: false,  // 列出可用构建模式
    debuggable: null,  // null = auto (release→false, else→true), true/false = override
    showLog: false,  // 安装启动后显示实时日志
    logOnly: false,  // 仅查看日志，不编译不安装
    logFilter: '',  // 日志过滤 tag
    listDevices: false,  // 列出所有已连接设备
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
        options.buildMode = args[++i];
        break;
      case '--release':
        options.buildMode = 'release';
        break;
      case '--debug':
        options.buildMode = 'debug';
        break;
      case '--test':
        options.buildMode = 'test';
        break;
      case '--debuggable':
        options.debuggable = true;
        break;
      case '--no-debuggable':
        options.debuggable = false;
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
      case '-a':
      case '--all':
        options.all = true;
        break;
      case '-u':
      case '--uninstall':
        options.uninstall = true;
        break;
      case '-p':
      case '--product':
        options.product = args[++i];
        break;
      case '--list-products':
        options.listProducts = true;
        break;
      case '--list-build-modes':
        options.listBuildModes = true;
        break;
      case '--log':
        options.showLog = true;
        break;
      case '--log-only':
        options.logOnly = true;
        break;
      case '--filter':
        options.logFilter = args[++i];
        break;
      case '--list-devices':
        options.listDevices = true;
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
  -a, --all                  Build all modules (recommended for multi-module projects)
  -m, --module <name>        Build specific module only (default: entry)
  -p, --product <name>       Product flavor from build-profile.json5 (default: default)
      --list-products        List all available products and exit
  -b, --build-mode <mode>    Build mode (default: debug). Supports: debug, release, test, or custom
      --release              Shorthand for --build-mode release
      --debug                Shorthand for --build-mode debug
      --test                 Shorthand for --build-mode test
      --list-build-modes     List all available build modes from build-profile.json5
      --debuggable           Force debuggable=true (default: auto based on build mode)
      --no-debuggable        Force debuggable=false
  -d, --device <id>          Target device ID (auto-select if not specified)
      --list-devices         List all connected devices with details
  -s, --skip-build           Skip build, install existing HAP only
  -l, --launch               Launch app after installation
  -c, --clean                Clean before build
  -u, --uninstall            Uninstall existing app before install
      --log                  Show real-time device log after deploy (Ctrl+C to stop)
      --log-only             Only show device log, skip build and install
      --filter <tag>         Filter log by tag (used with --log or --log-only)
  -h, --help                 Show this help message

Examples:
  npx harmonyos-deploy                              # Build entry module and install
  npx harmonyos-deploy --all --launch               # Build all, install, and launch
  npx harmonyos-deploy --all -u --launch            # Uninstall first, build all + install + launch
  npx harmonyos-deploy --all -p cheng_tu_test       # Build with specific product flavor
  npx harmonyos-deploy --list-products              # Show available product flavors
  npx harmonyos-deploy --all --release              # Build all in release mode
  npx harmonyos-deploy --all -b test                # Build all in test mode
  npx harmonyos-deploy --all -b custom_mode         # Build with custom build mode
  npx harmonyos-deploy --list-build-modes           # Show available build modes
  npx harmonyos-deploy -c --all                     # Clean and build all
  npx harmonyos-deploy --all --launch --log         # Build + install + launch + tail log
  npx harmonyos-deploy --log-only                   # Just show device log
  npx harmonyos-deploy --log-only --filter MyTag    # Show log filtered by tag
  npx harmonyos-deploy --list-devices               # List connected devices with info

Note: Use --all for projects with shared libraries/modules.
      Use --product to select environments (test/debug/release) with different signing configs.
      Build modes: debug (debuggable=true), release (debuggable=false), test, or custom.
      Use --debuggable / --no-debuggable to override automatic debuggable detection.
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
    // Capture stdout and stderr for error reporting
    if (error.stdout) error.stdout = error.stdout.toString();
    if (error.stderr) error.stderr = error.stderr.toString();
    throw error;
  }
}

// Parse JSON5 file (simple parser for oh-package.json5)
function parseJson5(filePath) {
  if (!fs.existsSync(filePath)) return null;
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Remove single-line comments (including those with non-ASCII characters)
    content = content.replace(/\/\/[^\n]*/g, '');
    
    // Remove multi-line comments
    content = content.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Remove trailing commas before } or ]
    content = content.replace(/,(\s*[}\]])/g, '$1');
    
    // Handle unquoted keys - be careful with colons in URLs
    // Only quote keys that are at the start of a line or after { or ,
    content = content.replace(/(^|[{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*):/gm, '$1"$2"$3:');
    
    // Handle single quotes -> double quotes (but not inside strings)
    content = content.replace(/'([^']*)'/g, '"$1"');
    
    return JSON.parse(content);
  } catch (e) {
    // If parsing fails, return null
    return null;
  }
}

// Read available products from build-profile.json5
function getAvailableProducts() {
  const buildProfile = parseJson5('build-profile.json5');
  if (!buildProfile) return [];
  
  const products = [];
  
  // Products are defined in app.products array
  if (buildProfile.app && Array.isArray(buildProfile.app.products)) {
    for (const p of buildProfile.app.products) {
      if (p.name) {
        products.push({
          name: p.name,
          signingConfig: p.signingConfig || '',
          bundleName: p.bundleName || '',
          // Extract any other useful info
          compatibleSdkVersion: p.compatibleSdkVersion || '',
          targetSdkVersion: p.targetSdkVersion || '',
        });
      }
    }
  }
  
  return products;
}

// Show available products
function showProducts() {
  const products = getAvailableProducts();
  
  if (products.length === 0) {
    log.warn('No products found in build-profile.json5');
    log.info('Products are defined in build-profile.json5 > app > products[]');
    return;
  }
  
  log.info(`Found ${products.length} product(s) in build-profile.json5:\n`);
  
  for (const p of products) {
    let info = `  ${colors.green}${p.name}${colors.reset}`;
    if (p.signingConfig) info += `  (signing: ${p.signingConfig})`;
    if (p.bundleName) info += `  [${p.bundleName}]`;
    console.log(info);
  }
  
  console.log('');
  log.info('Usage: npx harmonyos-deploy --all -p <product_name> --launch');
}

// Get available build modes from build-profile.json5
function getAvailableBuildModes() {
  const buildProfile = parseJson5('build-profile.json5');
  if (!buildProfile) return [];
  
  const modes = [];
  
  // buildModeSet is defined in app.buildModeSet array
  if (buildProfile.app && Array.isArray(buildProfile.app.buildModeSet)) {
    for (const m of buildProfile.app.buildModeSet) {
      if (m.name) {
        modes.push({
          name: m.name,
          hasBuildOption: !!(m.buildOption && Object.keys(m.buildOption).length > 0),
          debuggable: m.buildOption && m.buildOption.debuggable,
        });
      }
    }
  }
  
  // If no buildModeSet configured, show defaults
  if (modes.length === 0) {
    modes.push({ name: 'debug', hasBuildOption: false, debuggable: undefined });
    modes.push({ name: 'release', hasBuildOption: false, debuggable: undefined });
  }
  
  return modes;
}

// Show available build modes
function showBuildModes() {
  const modes = getAvailableBuildModes();
  
  log.info(`Available build mode(s):\n`);
  
  for (const m of modes) {
    const debugInfo = m.debuggable === true ? 'debuggable' :
                      m.debuggable === false ? 'non-debuggable' :
                      m.name === 'release' ? 'non-debuggable (auto)' : 'debuggable (auto)';
    let info = `  ${colors.green}${m.name}${colors.reset}`;
    info += `  (${debugInfo})`;
    if (m.hasBuildOption) info += '  [custom buildOption]';
    console.log(info);
  }
  
  // Always mention test mode
  const hasTest = modes.some(m => m.name === 'test');
  if (!hasTest) {
    console.log(`  ${colors.dim || ''}test${colors.reset}  (implicit, used by test framework)`);
  }
  
  console.log('');
  log.info('Usage: npx harmonyos-deploy --all -b <build_mode> --launch');
  log.info('Shortcuts: --debug, --release, --test');
}

// Resolve debuggable value based on buildMode and user override
function resolveDebuggable(buildMode, userDebuggable) {
  // User explicitly set --debuggable or --no-debuggable
  if (userDebuggable !== null && userDebuggable !== undefined) {
    return userDebuggable;
  }
  // Auto-detect: release → false, everything else → true
  return buildMode !== 'release';
}

// Validate build mode against build-profile.json5
function validateBuildMode(buildMode) {
  const buildProfile = parseJson5('build-profile.json5');
  if (!buildProfile) return; // Can't validate, skip
  
  if (buildProfile.app && Array.isArray(buildProfile.app.buildModeSet)) {
    const knownModes = buildProfile.app.buildModeSet.map(m => m.name);
    // debug, release, test are always valid even if not in buildModeSet
    const allValid = [...new Set([...knownModes, 'debug', 'release', 'test'])];
    
    if (!allValid.includes(buildMode)) {
      log.warn(`Build mode "${buildMode}" is not defined in build-profile.json5`);
      log.info(`Known modes: ${allValid.join(', ')}`);
      log.info('Proceeding anyway - hvigor may accept custom build modes');
    }
  }
}

// Detect build mode from compiler-generated BuildProfile.ets
// Path pattern: {module}/build/{product}/generated/profile/default/BuildProfile.ets
function detectBuildProfile(moduleName, product) {
  // Search in multiple possible locations
  const searchPaths = [
    path.join(moduleName, 'build', product, 'generated', 'profile', 'default', 'BuildProfile.ets'),
    path.join(moduleName, 'build', 'default', 'generated', 'profile', 'default', 'BuildProfile.ets'),
  ];
  
  // Also scan for any BuildProfile.ets under {module}/build/
  const moduleBuildDir = path.join(moduleName, 'build');
  if (fs.existsSync(moduleBuildDir)) {
    try {
      const walkForBuildProfile = (dir, depth = 0) => {
        if (depth > 5) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isFile() && entry.name === 'BuildProfile.ets') {
            searchPaths.push(fullPath);
          } else if (entry.isDirectory() && entry.name !== 'node_modules') {
            walkForBuildProfile(fullPath, depth + 1);
          }
        }
      };
      walkForBuildProfile(moduleBuildDir);
    } catch (e) { /* ignore scan errors */ }
  }
  
  for (const filePath of searchPaths) {
    if (!fs.existsSync(filePath)) continue;
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const result = {};
      
      // Extract BUILD_MODE_NAME = 'debug' | 'release' | ...
      const modeMatch = content.match(/BUILD_MODE_NAME\s*=\s*'([^']+)'/);
      if (modeMatch) result.buildMode = modeMatch[1];
      
      // Extract PRODUCT_NAME
      const productMatch = content.match(/PRODUCT_NAME\s*=\s*'([^']+)'/);
      if (productMatch) result.product = productMatch[1];
      
      // Extract DEBUG = true/false
      const debugMatch = content.match(/export\s+const\s+DEBUG\s*=\s*(true|false)/);
      if (debugMatch) result.debug = debugMatch[1] === 'true';
      
      // Extract buildTime
      const timeMatch = content.match(/buildTime\s*=\s*'([^']+)'/);
      if (timeMatch) result.buildTime = timeMatch[1];
      
      // Extract VERSION_NAME
      const versionMatch = content.match(/VERSION_NAME\s*=\s*'([^']+)'/);
      if (versionMatch) result.version = versionMatch[1];
      
      if (result.buildMode) return result;
    } catch (e) { /* ignore read errors */ }
  }
  
  return null;
}

// Find all modules in the project by scanning directories
function findAllModules() {
  const modules = [];
  
  const visited = new Set();
  
  function scanDirectory(dir, depth = 0) {
    if (depth > 5 || visited.has(dir)) return; // Increase depth limit
    visited.add(dir);
    
    const ohPkgPath = path.join(dir, 'oh-package.json5');
    
    if (fs.existsSync(ohPkgPath)) {
      const ohPkg = parseJson5(ohPkgPath);
      if (ohPkg) {
        // Use name from package or directory name as fallback
        const modName = ohPkg.name || path.basename(dir);
        
        // Determine module type from module.json5 (most reliable)
        let modType = 'hsp'; // default to hsp for shared modules
        const moduleJsonPath = path.join(dir, 'src', 'main', 'module.json5');
        
        if (fs.existsSync(moduleJsonPath)) {
          // Use regex to extract module type - more robust than full JSON5 parse
          // Match "type": "entry|feature|har|shared" near top of file
          const moduleContent = fs.readFileSync(moduleJsonPath, 'utf8');
          const typeMatch = moduleContent.match(/["']?type["']?\s*:\s*["'](entry|feature|har|shared)["']/);
          
          if (typeMatch) {
            const type = typeMatch[1].toLowerCase();
            if (type === 'entry' || type === 'feature') {
              modType = 'hap';
            } else if (type === 'shared') {
              modType = 'hsp';
            } else if (type === 'har') {
              modType = 'har';
            }
          }
        } else {
          // Fallback: check hvigorfile.ts
          const hvigorPath = path.join(dir, 'hvigorfile.ts');
          if (fs.existsSync(hvigorPath)) {
            const hvigorContent = fs.readFileSync(hvigorPath, 'utf8');
            if (hvigorContent.includes('hapTasks') || hvigorContent.includes('HapTasks')) {
              modType = 'hap';
            } else if (hvigorContent.includes('hspTasks') || hvigorContent.includes('HspTasks')) {
              modType = 'hsp';
            } else if (hvigorContent.includes('harTasks') || hvigorContent.includes('HarTasks')) {
              modType = 'har';
            }
          }
        }
        
        // Skip root project package - only skip if it's the root directory
        // Check if it has a src directory (real modules have src)
        const hasSrcDir = fs.existsSync(path.join(dir, 'src'));
        const isRoot = dir === '.';
        
        if (!isRoot && hasSrcDir) {
          modules.push({
            name: modName,
            path: dir,
            dependencies: ohPkg.dependencies || {},
            type: modType
          });
        }
      }
    }
    
    // Scan subdirectories
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      try {
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
          // Skip hidden dirs, node_modules, build, etc.
          if (entry.startsWith('.') || 
              entry === 'node_modules' || 
              entry === 'build' || 
              entry === 'oh_modules' ||
              entry === 'AppScope' ||
              entry === 'hvigor' ||
              entry === 'libs') {
            continue;
          }
          
          const fullPath = path.join(dir, entry);
          try {
            if (fs.statSync(fullPath).isDirectory()) {
              scanDirectory(fullPath, depth + 1);
            }
          } catch (e) {
            // Skip inaccessible directories
          }
        }
      } catch (e) {
        // Ignore permission errors
      }
    }
  }
  
  scanDirectory('.');
  
  // Debug: log found modules
  if (modules.length > 0) {
    log.info(`Scanned modules: ${modules.map(m => `${m.name}(${m.type})`).join(', ')}`);
  } else {
    log.warn('No modules found! Check if oh-package.json5 files exist in module directories.');
  }
  
  return modules;
}

// Build dependency graph and return topologically sorted order
function getModuleBuildOrder(modules) {
  const moduleMap = new Map();
  modules.forEach(m => moduleMap.set(m.name, m));
  
  // Build adjacency list (module -> modules that depend on it)
  const graph = new Map();
  const inDegree = new Map();
  
  modules.forEach(m => {
    graph.set(m.name, []);
    inDegree.set(m.name, 0);
  });
  
  // Parse dependencies
  modules.forEach(m => {
    const deps = Object.keys(m.dependencies);
    deps.forEach(dep => {
      // Check if this is a local module dependency (file:../)
      if (moduleMap.has(dep)) {
        graph.get(dep).push(m.name);
        inDegree.set(m.name, inDegree.get(m.name) + 1);
      }
    });
  });
  
  // Kahn's algorithm for topological sort
  const queue = [];
  const result = [];
  
  inDegree.forEach((degree, name) => {
    if (degree === 0) queue.push(name);
  });
  
  while (queue.length > 0) {
    const current = queue.shift();
    result.push(current);
    
    graph.get(current).forEach(neighbor => {
      inDegree.set(neighbor, inDegree.get(neighbor) - 1);
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    });
  }
  
  // Check for cycles
  if (result.length !== modules.length) {
    log.warn('Circular dependency detected, falling back to default order');
    return modules;
  }
  
  // Return modules in build order
  return result.map(name => moduleMap.get(name)).filter(m => m);
}

// Get module build command based on type
// hvigor 6.x uses different parameter format
function getModuleBuildCommand(hvigorCmd, module, buildMode, product = 'default', debuggable = true, hvigorV6 = false) {
  const modType = module.type || 'hsp';
  
  // Determine build task based on module type
  let task;
  if (modType === 'har') {
    task = 'assembleHar';
  } else if (modType === 'hsp') {
    task = 'assembleHsp';
  } else {
    task = 'assembleHap';
  }
  
  return buildCommand(hvigorCmd, task, { module: `${module.name}@default`, product, buildMode, debuggable }, hvigorV6);
}

// Generate hvigor build command, adapting to hvigor version
function buildCommand(hvigorCmd, task, params = {}, hvigorV6 = false) {
  const parts = [hvigorCmd];
  
  if (hvigorV6) {
    // Hvigor 6.x: simplified command, no --mode module or -p parameters
    // Just: hvigorw assembleHap --no-daemon
    parts.push(task);
    parts.push('--no-daemon');
  } else {
    // Hvigor 5.x: full parameter format
    if (params.module) {
      parts.push('--mode module');
      parts.push(`-p module=${params.module}`);
    }
    if (params.product) {
      parts.push(`-p product=${params.product}`);
    }
    if (params.buildMode) {
      parts.push(`-p buildMode=${params.buildMode}`);
    }
    if (params.debuggable !== undefined) {
      parts.push(`-p debuggable=${params.debuggable}`);
    }
    
    parts.push(task);
    parts.push('--no-daemon');
  }
  
  return parts.join(' ');
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
// Priority: project local → DevEco Studio built-in → global
function findHvigor() {
  const isWindows = os.platform() === 'win32';
  
  // 1. Check local hvigorw (project root)
  if (isWindows && fs.existsSync('hvigorw.bat')) {
    return '.\\hvigorw.bat';
  }
  if (!isWindows && fs.existsSync('hvigorw')) {
    return './hvigorw';
  }
  
  // 2. Check DevEco Studio built-in hvigorw
  if (isWindows) {
    const programFiles = [
      process.env['ProgramFiles'] || 'C:\\Program Files',
      process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
    ];
    for (const pf of programFiles) {
      try {
        // Scan for DevEco Studio installations (e.g. "DevEco Studio6.0.1", "DevEco Studio")
        const entries = fs.readdirSync(path.join(pf, 'Huawei')).filter(d => d.startsWith('DevEco'));
        for (const deveco of entries.sort().reverse()) { // prefer latest version
          const hvigorPath = path.join(pf, 'Huawei', deveco, 'DevEco Studio', 'tools', 'hvigor', 'bin', 'hvigorw.bat');
          if (fs.existsSync(hvigorPath)) {
            log.info(`Found DevEco Studio hvigorw: ${hvigorPath}`);
            return `"${hvigorPath}"`;
          }
        }
      } catch (e) { /* scan error, continue */ }
    }
  } else {
    // macOS: /Applications/DevEco-Studio.app/Contents/tools/hvigor/bin/hvigorw
    const macPaths = [
      '/Applications/DevEco-Studio.app/Contents/tools/hvigor/bin/hvigorw',
    ];
    for (const p of macPaths) {
      if (fs.existsSync(p)) {
        log.info(`Found DevEco Studio hvigorw: ${p}`);
        return `"${p}"`;
      }
    }
  }
  
  // 3. Check global hvigorw
  if (commandExists('hvigorw')) {
    return 'hvigorw';
  }
  
  return null;
}

// Detect hvigor model version from hvigor-config.json5
function getHvigorVersion() {
  const configPaths = [
    path.join('hvigor', 'hvigor-config.json5'),
    'hvigor-config.json5',
  ];
  for (const configPath of configPaths) {
    if (!fs.existsSync(configPath)) continue;
    try {
      const content = fs.readFileSync(configPath, 'utf8');
      const match = content.match(/["']?modelVersion["']?\s*:\s*["']([^"']+)["']/);
      if (match) return match[1];
    } catch (e) { /* ignore */ }
  }
  return null;
}

// Check if hvigor version is 6.x or above (requires different command format)
function isHvigorV6(version) {
  if (!version) return false;
  const major = parseInt(version.split('.')[0], 10);
  return major >= 6;
}

// Setup DEVECO_SDK_HOME if not already set
function ensureDevEcoSdkHome() {
  if (process.env.DEVECO_SDK_HOME && fs.existsSync(process.env.DEVECO_SDK_HOME)) {
    return; // already set and valid
  }
  
  const isWindows = os.platform() === 'win32';
  const candidates = [];
  
  if (isWindows) {
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    // Scan for DevEco Studio installations
    try {
      const huaweiDir = path.join(programFiles, 'Huawei');
      if (fs.existsSync(huaweiDir)) {
        const entries = fs.readdirSync(huaweiDir).filter(d => d.startsWith('DevEco'));
        for (const deveco of entries.sort().reverse()) {
          candidates.push(path.join(huaweiDir, deveco, 'DevEco Studio', 'sdk'));
        }
      }
    } catch (e) { /* ignore */ }
    candidates.push(path.join(os.homedir(), 'AppData', 'Local', 'Huawei', 'sdk'));
    candidates.push(path.join(os.homedir(), 'AppData', 'Local', 'OpenHarmony', 'Sdk'));
  } else {
    candidates.push(path.join(os.homedir(), 'Library', 'Huawei', 'sdk'));
    candidates.push(path.join(os.homedir(), 'Library', 'OpenHarmony', 'Sdk'));
    candidates.push('/Applications/DevEco-Studio.app/Contents/sdk');
  }
  
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      process.env.DEVECO_SDK_HOME = p;
      log.info(`Auto-detected DEVECO_SDK_HOME: ${p}`);
      return;
    }
  }
  // Not found, let hvigor handle it (may fail with its own error)
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

// Get device detail info (model, os version, etc.)
function getDeviceInfo(deviceId) {
  const info = {};
  try {
    info.model = execSilent(`hdc -t ${deviceId} shell param get const.product.model`) || 'Unknown';
    info.brand = execSilent(`hdc -t ${deviceId} shell param get const.product.brand`) || '';
    info.osVersion = execSilent(`hdc -t ${deviceId} shell param get const.product.software.version`) || '';
    info.apiVersion = execSilent(`hdc -t ${deviceId} shell param get const.ohos.apiversion`) || '';
  } catch (e) { /* ignore */ }
  return info;
}

// List devices with details
function showDeviceList() {
  if (!commandExists('hdc')) {
    log.error('Cannot find hdc tool');
    return;
  }
  
  const devices = getDevices();
  if (devices.length === 0) {
    log.info('No devices connected');
    return;
  }
  
  log.info(`Found ${devices.length} device(s):\n`);
  devices.forEach((deviceId, i) => {
    const info = getDeviceInfo(deviceId);
    const label = [info.brand, info.model].filter(Boolean).join(' ') || 'Unknown device';
    const osInfo = info.osVersion ? ` | OS: ${info.osVersion}` : '';
    const apiInfo = info.apiVersion ? ` | API: ${info.apiVersion}` : '';
    console.log(`  [${i + 1}] ${deviceId}`);
    console.log(`      ${label}${osInfo}${apiInfo}`);
  });
  console.log('');
  log.info('To use a specific device:');
  log.info(`  npx harmonyos-deploy --all --launch -d ${devices[0]}`);
}

// Start real-time log streaming
function startLogStream(device, bundleName, filter) {
  log.info('');
  log.info('=== Real-time Device Log (Ctrl+C to stop) ===');
  log.info('');
  
  // Build hilog command with filter
  let logCmd = `hdc -t ${device} shell hilog`;
  
  // Use hilog filter if bundleName available
  const filterParts = [];
  if (bundleName) {
    filterParts.push(bundleName);
  }
  if (filter) {
    filterParts.push(filter);
  }
  
  if (filterParts.length > 0) {
    // Use grep to filter (hilog's own filter is limited)
    logCmd = `hdc -t ${device} shell "hilog | grep -E '${filterParts.join('|')}'"`;
  }
  
  try {
    // Use spawn for streaming (exec would buffer the entire output)
    const { spawn } = require('child_process');
    const isWindows = os.platform() === 'win32';
    
    let child;
    if (isWindows) {
      child = spawn('cmd', ['/c', logCmd], { stdio: 'inherit' });
    } else {
      child = spawn('sh', ['-c', logCmd], { stdio: 'inherit' });
    }
    
    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      child.kill();
      console.log('');
      log.info('Log streaming stopped');
      process.exit(0);
    });
    
    child.on('close', (code) => {
      if (code !== 0 && code !== null) {
        log.warn('Log stream ended');
      }
    });
    
    // Keep process alive
    return new Promise(() => {}); // never resolves, wait for Ctrl+C
  } catch (error) {
    log.error(`Failed to start log stream: ${error.message}`);
  }
}

// Simple performance timer
function createTimer() {
  const steps = [];
  let current = null;
  const startTime = Date.now();
  
  return {
    start(name) {
      if (current) {
        current.end = Date.now();
        steps.push(current);
      }
      current = { name, start: Date.now(), end: null };
    },
    stop() {
      if (current) {
        current.end = Date.now();
        steps.push(current);
        current = null;
      }
    },
    summary() {
      this.stop();
      const totalMs = Date.now() - startTime;
      
      log.info('');
      log.info('=== Performance Stats ===');
      for (const step of steps) {
        const ms = step.end - step.start;
        const sec = (ms / 1000).toFixed(1);
        const bar = '█'.repeat(Math.max(1, Math.round(ms / totalMs * 20)));
        console.log(`  ${step.name.padEnd(16)} ${sec.padStart(6)}s  ${bar}`);
      }
      console.log(`  ${'─'.repeat(36)}`);
      console.log(`  ${'Total'.padEnd(16)} ${(totalMs / 1000).toFixed(1).padStart(6)}s`);
    }
  };
}

// Find built package file (.hap or .hsp) for a module
// Product affects output path: build/{product}/outputs/{product}/
function findPackageFile(modulePath, moduleName, ext, product = 'default') {
  // HarmonyOS build output structure:
  //   build/{product}/outputs/default/{moduleName}-default-signed.{ext}
  // The second-level dir is always "default" (target name), file prefix is also "default"
  
  // Build search paths: product-specific first, then fallback to 'default'
  const searchProducts = product !== 'default' ? [product, 'default'] : ['default'];
  
  for (const prod of searchProducts) {
    // Primary path: build/{product}/outputs/default/
    const searchDirs = [
      path.join(modulePath, 'build', prod, 'outputs', 'default'),
      path.join(modulePath, 'build', prod, 'outputs', prod),
    ];
    
    for (const outDir of searchDirs) {
      if (!fs.existsSync(outDir)) continue;
      
      // Try common file name patterns
      const candidates = [
        `${moduleName}-default-signed.${ext}`,
        `${moduleName}-${prod}-signed.${ext}`,
        `${moduleName}-default-unsigned.${ext}`,
        `${moduleName}-${prod}-unsigned.${ext}`,
      ];
      
      for (const candidate of candidates) {
        const fullPath = path.join(outDir, candidate);
        if (fs.existsSync(fullPath)) {
          return { path: fullPath, signed: candidate.includes('-signed') };
        }
      }
      
      // Fallback: any matching file in this dir
      try {
        const files = fs.readdirSync(outDir);
        // Prefer signed
        const signed = files.find(f => f.endsWith(`-signed.${ext}`));
        if (signed) return { path: path.join(outDir, signed), signed: true };
        
        const any = files.find(f => f.endsWith(`.${ext}`));
        if (any) return { path: path.join(outDir, any), signed: any.includes('signed') };
      } catch (e) { /* skip */ }
    }
  }
  
  return null;
}

// Find HAP file (backward compatible wrapper)
function findHapFile(module, product = 'default') {
  return findPackageFile(module, module, 'hap', product);
}

// Find all HSP files for multi-module install
function findAllHspFiles(modules, product = 'default') {
  const hspFiles = [];
  for (const mod of modules) {
    if (mod.type === 'hsp') {
      const hsp = findPackageFile(mod.path, mod.name, 'hsp', product);
      if (hsp) {
        hspFiles.push({ ...hsp, module: mod.name });
      }
    }
  }
  return hspFiles;
}

// Read bundle name - prefer product-specific bundleName from build-profile.json5
function getBundleName(product = 'default') {
  // First try build-profile.json5 for product-specific bundleName
  if (product !== 'default') {
    const buildProfile = parseJson5('build-profile.json5');
    if (buildProfile && buildProfile.app && Array.isArray(buildProfile.app.products)) {
      const prod = buildProfile.app.products.find(p => p.name === product);
      if (prod && prod.bundleName) {
        return prod.bundleName;
      }
    }
  }
  
  // Fallback: read from AppScope/app.json5
  const appJsonPath = path.join('AppScope', 'app.json5');
  if (!fs.existsSync(appJsonPath)) return null;
  
  const content = fs.readFileSync(appJsonPath, 'utf8');
  const match = content.match(/"bundleName"\s*:\s*"([^"]+)"/);
  return match ? match[1] : null;
}

// Read bundle type from AppScope/app.json5 (e.g. "app", "atomicService")
function getBundleType() {
  const appJsonPath = path.join('AppScope', 'app.json5');
  if (!fs.existsSync(appJsonPath)) return null;
  
  const content = fs.readFileSync(appJsonPath, 'utf8');
  const match = content.match(/"bundleType"\s*:\s*"([^"]+)"/);
  return match ? match[1] : null;
}

// Check if installed app's bundleType conflicts with the one being installed
function checkBundleTypeConflict(device, bundleName, localBundleType) {
  if (!bundleName || !localBundleType) return false;
  
  try {
    // Use bm dump to check installed app info
    const result = execSilent(`hdc -t ${device} shell bm dump -n ${bundleName}`);
    if (!result || result.includes('error')) return false;
    
    // Check if the installed type differs
    const isInstalledAtomicService = result.includes('"atomicService"') || result.includes('bundleType.*atomicService');
    const isLocalAtomicService = localBundleType === 'atomicService';
    
    if ((isInstalledAtomicService && !isLocalAtomicService) || (!isInstalledAtomicService && isLocalAtomicService)) {
      return true; // type conflict
    }
  } catch (e) { /* not installed or query failed, no conflict */ }
  
  return false;
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
  
  if (options.listProducts) {
    showProducts();
    process.exit(0);
  }
  
  if (options.listBuildModes) {
    showBuildModes();
    process.exit(0);
  }
  
  if (options.listDevices) {
    showDeviceList();
    process.exit(0);
  }
  
  // --log-only: just show device log, skip everything else
  if (options.logOnly) {
    if (!commandExists('hdc')) {
      log.error('Cannot find hdc tool');
      process.exit(1);
    }
    const devices = getDevices();
    if (devices.length === 0) {
      log.error('No device connected');
      process.exit(1);
    }
    const device = options.device || devices[0];
    const bundleName = fs.existsSync('build-profile.json5') ? getBundleName(options.product) : null;
    await startLogStream(device, bundleName, options.logFilter);
    return;
  }
  
  // Performance timer
  const timer = createTimer();
  
  log.info(`Working directory: ${process.cwd()}`);
  
  // Check if HarmonyOS project
  if (!fs.existsSync('build-profile.json5')) {
    log.error('Not a valid HarmonyOS project (missing build-profile.json5)');
    process.exit(1);
  }
  
  // Auto-detect DEVECO_SDK_HOME if not set
  ensureDevEcoSdkHome();
  
  // Find hvigor
  const hvigorCmd = findHvigor();
  if (!hvigorCmd) {
    log.error('Cannot find hvigorw build tool');
    log.info('Make sure hvigorw exists in project root or install globally:');
    log.info('  npm install -g @ohos/hvigor-cli');
    log.info('Or install DevEco Studio which includes hvigorw');
    process.exit(1);
  }
  log.info(`Using build tool: ${hvigorCmd}`);
  
  // Detect hvigor version for command compatibility
  const hvigorVersion = getHvigorVersion();
  const hvigorV6 = isHvigorV6(hvigorVersion);
  if (hvigorVersion) {
    log.info(`Hvigor modelVersion: ${hvigorVersion}${hvigorV6 ? ' (v6+)' : ''}`);
  }
  
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
    timer.start('Clean');
    log.info('Cleaning build cache...');
    try {
      exec(`${hvigorCmd} clean --no-daemon`, { silent: true, ignoreError: true });
    } catch {}
  }
  
  // Build
  if (!options.skipBuild) {
    // First, install dependencies
    timer.start('Dependencies');
    log.info('Installing dependencies (ohpm install)...');
    try {
      exec('ohpm install', { silent: false });
      log.success('Dependencies installed');
    } catch (error) {
      log.warn('ohpm install failed, continuing anyway...');
    }
    log.info('');
    
    let buildCmd;
    
    // Validate and resolve build mode
    validateBuildMode(options.buildMode);
    const debuggable = resolveDebuggable(options.buildMode, options.debuggable);
    
    // Show build configuration
    if (options.product !== 'default') {
      log.info(`Product: ${options.product}`);
    }
    log.info(`Build mode: ${options.buildMode} (debuggable=${debuggable})`);
    
    timer.start('Build');
    
    if (options.all) {
      // 全量编译：自动解析依赖顺序
      log.info('Analyzing module dependencies...');
      const modules = findAllModules();
      
      if (modules.length === 0) {
        log.warn('No modules found in build-profile.json5, falling back to single module build');
        log.info(`Building module "${options.module}" (mode: ${options.buildMode})...`);
        buildCmd = buildCommand(hvigorCmd, 'assembleHap', { module: `${options.module}@default`, product: options.product, buildMode: options.buildMode, debuggable }, hvigorV6);
        log.info(`Executing: ${buildCmd}`);
        
        try {
          exec(buildCmd);
          log.success('Build completed');
        } catch (error) {
          log.error('Build failed');
          if (error.stderr && error.stderr.trim()) {
            console.log(error.stderr);
          }
          diagnoseBuildError(error.stderr || error.stdout || error.message);
          process.exit(1);
        }
      } else {
        const buildOrder = getModuleBuildOrder(modules);
        
        log.info(`Found ${buildOrder.length} modules:`);
        buildOrder.forEach((m, i) => {
          console.log(`  ${i + 1}. ${m.name} (${m.type || 'entry'})`);
        });
        log.info('');
        
        // Build all modules - same as Jenkins CI/CD pipeline:
        // 1. assembleHap --mode module for entry HAP
        // 2. assembleHsp --mode module for all HSP modules
        log.info(`Building all modules (mode: ${options.buildMode})...`);
        
        // Build HAP first
        buildCmd = buildCommand(hvigorCmd, 'assembleHap', { product: options.product, buildMode: options.buildMode, debuggable }, hvigorV6);
        log.info(`Executing: ${buildCmd}`);
        
        try {
          exec(buildCmd);
        } catch (error) {
          log.error('HAP build failed');
          diagnoseBuildError(error.stderr || error.stdout || error.message);
          process.exit(1);
        }
        
        // Build HSP modules
        const hspModules = buildOrder.filter(m => m.type === 'hsp');
        if (hspModules.length > 0) {
          const hspCmd = buildCommand(hvigorCmd, 'assembleHsp', { product: options.product, buildMode: options.buildMode, debuggable }, hvigorV6);
          log.info(`Executing: ${hspCmd}`);
          
          try {
            exec(hspCmd);
          } catch (error) {
            log.error('HSP build failed');
            diagnoseBuildError(error.stderr || error.stdout || error.message);
            process.exit(1);
          }
        }
        
        log.success('All modules built successfully!');
      }
    } else {
      // 单模块编译
      log.info(`Building module "${options.module}" (mode: ${options.buildMode})...`);
      buildCmd = buildCommand(hvigorCmd, 'assembleHap', { module: `${options.module}@default`, product: options.product, buildMode: options.buildMode, debuggable }, hvigorV6);
      log.info(`Executing: ${buildCmd}`);
      
      try {
        exec(buildCmd);
        log.success('Build completed');
      } catch (error) {
        log.error('Build failed');
        if (error.stderr && error.stderr.trim()) {
          console.log(error.stderr);
        }
        diagnoseBuildError(error.stderr || error.stdout || error.message);
        log.info('');
        log.warn('TIP: For multi-module projects, try: --all to build all modules with correct dependency order');
        process.exit(1);
      }
    }
    
  } else {
    // --skip-build: detect existing build mode from BuildProfile.ets (compiler-generated)
    // Path: {module}/build/{product}/generated/profile/default/BuildProfile.ets
    const buildProfileInfo = detectBuildProfile(options.module, options.product);
    if (buildProfileInfo) {
      if (buildProfileInfo.buildMode && buildProfileInfo.buildMode !== options.buildMode) {
        log.error(`Build mode mismatch: existing build is "${buildProfileInfo.buildMode}", but you requested "${options.buildMode}"`);
        log.info('');
        log.info(`You have two options:`);
        log.info(`  1. Install the existing ${buildProfileInfo.buildMode} build:`);
        log.info(`     node harmonyos-deploy.js --all -b ${buildProfileInfo.buildMode} --skip-build`);
        log.info(`  2. Build and install with ${options.buildMode} mode:`);
        log.info(`     node harmonyos-deploy.js --all -b ${options.buildMode}`);
        process.exit(1);
      } else {
        const timeInfo = buildProfileInfo.buildTime ? ` (built: ${buildProfileInfo.buildTime})` : '';
        log.info(`Using existing ${buildProfileInfo.buildMode} build${timeInfo}`);
      }
      if (buildProfileInfo.product && buildProfileInfo.product !== options.product) {
        log.error(`Product mismatch: existing build product is "${buildProfileInfo.product}", but you requested "${options.product}"`);
        log.info('');
        log.info(`You have two options:`);
        log.info(`  1. Install the existing ${buildProfileInfo.product} build:`);
        log.info(`     node harmonyos-deploy.js --all -p ${buildProfileInfo.product} --skip-build`);
        log.info(`  2. Build and install with ${options.product} product:`);
        log.info(`     node harmonyos-deploy.js --all -p ${options.product}`);
        process.exit(1);
      }
    }
  }
  
  // Find HAP file
  let hapModule = options.module; // default: entry
  
  // In --all mode, find the entry/hap module
  const modules = options.all ? findAllModules() : [];
  if (options.all) {
    const hapModules = modules.filter(m => m.type === 'hap' || m.name === 'entry');
    if (hapModules.length > 0) {
      hapModule = hapModules[0].name;
    }
  }
  
  // Uninstall existing app before install (if --uninstall flag is set)
  // Also auto-uninstall if bundleType conflict detected
  timer.start('Install');
  {
    const bundleName = getBundleName(options.product);
    const localBundleType = getBundleType();
    
    if (bundleName && localBundleType && !options.uninstall) {
      // Check bundleType conflict (e.g. atomicService vs app)
      if (checkBundleTypeConflict(device, bundleName, localBundleType)) {
        log.warn(`Bundle type conflict detected: device has different type than local "${localBundleType}"`);
        log.info('Auto-uninstalling to resolve type conflict...');
        try {
          const result = execSilent(`hdc -t ${device} uninstall ${bundleName}`);
          if (result.includes('successfully')) {
            log.success('Uninstall completed (type conflict resolved)');
          }
        } catch { /* ignore */ }
      }
    }
  }
  
  if (options.uninstall) {
    const bundleName = getBundleName(options.product);
    if (bundleName) {
      log.info(`Uninstalling existing app: ${bundleName}...`);
      try {
        const result = execSilent(`hdc -t ${device} uninstall ${bundleName}`);
        if (result.includes('successfully')) {
          log.success('Uninstall completed');
        } else {
          log.info('App not installed or already removed');
        }
      } catch {
        log.info('App not installed or already removed');
      }
    } else {
      log.warn('Cannot read bundleName from AppScope/app.json5, skip uninstall');
    }
  }
  
  // Always force-stop the running app before install to avoid silent install failures
  {
    const bundleName = getBundleName(options.product);
    if (bundleName) {
      try {
        execSilent(`hdc -t ${device} shell aa force-stop ${bundleName}`);
        log.info(`Stopped running app: ${bundleName}`);
      } catch {
        // App may not be running, ignore
      }
    }
  }
  
  // In --all mode, collect HSP + HAP files and install via bm install
  if (options.all && modules.length > 0) {
    log.info('');
    log.info('Collecting built packages for installation...');
    
    const buildOrder = getModuleBuildOrder(modules);
    const installFiles = []; // {path, type, module}
    const missingHsp = [];
    
    // Collect HSP files first (dependency order)
    for (const mod of buildOrder) {
      if (mod.type === 'hsp') {
        const hsp = findPackageFile(mod.path, mod.name, 'hsp', options.product);
        if (hsp) {
          installFiles.push({ ...hsp, type: 'hsp', module: mod.name });
          log.info(`  Found HSP: ${mod.name} -> ${hsp.path}`);
        } else {
          missingHsp.push(mod.name);
        }
      }
    }
    
    // Collect third-party HSP dependencies from build cache
    // These are ohpm packages (e.g. from .tgz) that produce separate .hsp files
    // Location: build/cache/{product}/remote_hsp/
    const remoteHspSearchDirs = [
      path.join('build', 'cache', options.product, 'remote_hsp'),
      ...(options.product !== 'default' ? [path.join('build', 'cache', 'default', 'remote_hsp')] : []),
    ];
    
    for (const remoteHspDir of remoteHspSearchDirs) {
    if (fs.existsSync(remoteHspDir)) {
      try {
        const remoteDirs = fs.readdirSync(remoteHspDir);
        for (const dir of remoteDirs) {
          const fullDir = path.join(remoteHspDir, dir);
          if (!fs.statSync(fullDir).isDirectory()) continue;
          
          // Look for signed .hsp files
          try {
            const files = fs.readdirSync(fullDir);
            const signedHsp = files.find(f => f.endsWith('-signed.hsp'));
            const unsignedHsp = files.find(f => f.endsWith('.hsp') && !f.includes('-signed'));
            const hspFile = signedHsp || unsignedHsp;
            
            if (hspFile) {
              const hspPath = path.join(fullDir, hspFile);
              const modName = hspFile.replace('-signed.hsp', '').replace('.hsp', '');
              
              // Skip if already collected (same module name)
              if (!installFiles.find(f => f.module === modName)) {
                installFiles.push({ path: hspPath, signed: !!signedHsp, type: 'hsp', module: modName });
                log.info(`  Found HSP (3rd-party): ${modName} -> ${hspPath}`);
              }
            }
          } catch (e) { /* skip */ }
        }
      } catch (e) { /* ignore */ }
    }
    }  // end for remoteHspSearchDirs
    
    // Collect HAP file last
    const hapModuleInfo = modules.find(m => m.name === hapModule);
    const hapModulePath = hapModuleInfo ? hapModuleInfo.path : hapModule;
    const hap = findPackageFile(hapModulePath, hapModule, 'hap', options.product);
    
    // Check if no packages found at all (likely no build for this product)
    if (!hap && installFiles.length === 0) {
      log.error(`No built packages found for product "${options.product}"`);
      
      // Detect what products have been built before
      const entryBuildDir = path.join(hapModulePath, 'build');
      if (fs.existsSync(entryBuildDir)) {
        try {
          const builtProducts = fs.readdirSync(entryBuildDir)
            .filter(d => {
              const fullPath = path.join(entryBuildDir, d);
              return fs.statSync(fullPath).isDirectory() && d !== 'cache' && d !== '.cxx';
            });
          
          if (builtProducts.length > 0) {
            log.info('');
            log.info(`Found existing builds for other product(s): ${builtProducts.join(', ')}`);
            log.info('');
            log.info('Options:');
            log.info(`  1. Build with this product first:  node harmonyos-deploy.js --all -p ${options.product} --launch`);
            log.info(`  2. Install existing build:         node harmonyos-deploy.js --all -p ${builtProducts[0]} --skip-build --launch`);
          } else {
            log.info('');
            log.info(`No previous builds found. Remove --skip-build to build first:`);
            log.info(`  node harmonyos-deploy.js --all -p ${options.product} --launch`);
          }
        } catch (e) {
          log.info(`Remove --skip-build to build first:`);
          log.info(`  node harmonyos-deploy.js --all -p ${options.product} --launch`);
        }
      } else {
        log.info('No build directory found. Remove --skip-build to build first:');
        log.info(`  node harmonyos-deploy.js --all -p ${options.product} --launch`);
      }
      process.exit(1);
    }
    
    if (!hap) {
      log.error(`Cannot find HAP file for module: ${hapModule}`);
      log.info(`Expected path: ${hapModulePath}/build/${options.product}/outputs/default/`);
      process.exit(1);
    }
    
    // Show missing HSP summary (after we know if it's a total failure or partial)
    if (missingHsp.length > 0 && installFiles.length > 0) {
      // Some found, some missing — likely HAR modules, just warn
      for (const name of missingHsp) {
        log.warn(`  HSP not found: ${name} (may be HAR or bundled inline)`);
      }
    }
    
    installFiles.push({ ...hap, type: 'hap', module: hapModule });
    log.info(`  Found HAP: ${hapModule} -> ${hap.path}`);
    
    // Step 1: Push all files to device temp directory
    const deviceTmpDir = 'data/local/tmp';
    log.info('');
    log.info(`Pushing ${installFiles.length} packages to device ${device}...`);
    log.info(`  (${installFiles.filter(f=>f.type==='hsp').length} HSP + ${installFiles.filter(f=>f.type==='hap').length} HAP)`);
    
    const devicePaths = [];
    for (let i = 0; i < installFiles.length; i++) {
      const pkg = installFiles[i];
      const fileName = path.basename(pkg.path);
      const devicePath = `${deviceTmpDir}/${fileName}`;
      const label = `[${i + 1}/${installFiles.length}]`;
      
      try {
        execSync(`hdc -t ${device} file send "${pkg.path}" "${devicePath}"`, { encoding: 'utf8', stdio: 'pipe' });
        devicePaths.push(devicePath);
        log.info(`  ${label} Pushed: ${pkg.module} (${pkg.type.toUpperCase()})`);
      } catch (error) {
        log.error(`  ${label} Failed to push: ${pkg.module}`);
        const output = (error.stdout || '') + (error.stderr || '');
        if (output.trim()) log.error(`         ${output.trim()}`);
        process.exit(1);
      }
    }
    
    // Step 2: Use bm install to install all files at once
    // bm install -p path1 -p path2 ... installs all modules atomically
    const bmPaths = devicePaths.map(p => `-p "${p}"`).join(' ');
    log.info('');
    log.info('Installing via bundle manager (bm install)...');
    
    try {
      const result = execSync(`hdc -t ${device} shell bm install ${bmPaths}`, { encoding: 'utf8', stdio: 'pipe' }).trim();
      log.info(`bm install result: ${result}`);
      
      if (result.includes('successfully') && !result.includes('error:') && !result.includes('failed')) {
        log.success(`All ${installFiles.length} packages installed successfully!`);
      } else {
        log.error('Install failed');
        console.log(result);
        log.info('');
        log.info('TIP: If signature mismatch (e.g. debug->release), try:');
        log.info(`  node harmonyos-deploy.js --all --release -u --launch`);
        process.exit(1);
      }
    } catch (error) {
      const output = (error.stdout || '') + (error.stderr || '');
      log.info(`bm install result: ${output.trim()}`);
      if (output.includes('successfully') && !output.includes('error:') && !output.includes('failed')) {
        log.success(`All ${installFiles.length} packages installed successfully!`);
      } else {
        log.error('Install failed');
        if (output.trim()) console.log(output.trim());
        log.info('');
        log.info('TIP: If signature mismatch (e.g. debug->release), try:');
        log.info(`  node harmonyos-deploy.js --all --release -u --launch`);
        process.exit(1);
      }
    }
    
    // Step 3: Clean up temp files on device
    for (const dp of devicePaths) {
      try {
        execSync(`hdc -t ${device} shell rm -rf "${dp}"`, { encoding: 'utf8', stdio: 'pipe' });
      } catch (e) { /* ignore cleanup errors */ }
    }
    
  } else {
    // Single module mode - install only the HAP
    log.info(`Looking for HAP in module: ${hapModule}`);
    const hap = findHapFile(hapModule, options.product);
    if (!hap) {
      log.error(`Cannot find HAP file for product "${options.product}"`);
      log.info(`Expected path: ${hapModule}/build/${options.product}/outputs/default/`);
      log.info('');
      
      // Detect existing builds
      const buildDir = path.join(hapModule, 'build');
      if (fs.existsSync(buildDir)) {
        try {
          const builtProducts = fs.readdirSync(buildDir)
            .filter(d => {
              const fullPath = path.join(buildDir, d);
              return fs.statSync(fullPath).isDirectory() && d !== 'cache' && d !== '.cxx';
            });
          
          if (builtProducts.length > 0) {
            log.info(`Found existing builds for: ${builtProducts.join(', ')}`);
            log.info('');
            log.info('Options:');
            log.info(`  1. Build first:            node harmonyos-deploy.js -p ${options.product} --launch`);
            log.info(`  2. Use existing build:     node harmonyos-deploy.js -p ${builtProducts[0]} --skip-build --launch`);
          } else {
            log.info('Remove --skip-build to build first:');
            log.info(`  node harmonyos-deploy.js -p ${options.product} --launch`);
          }
        } catch (e) {
          log.info('Remove --skip-build to build first:');
          log.info(`  node harmonyos-deploy.js -p ${options.product} --launch`);
        }
      } else {
        log.info('No build directory found. Remove --skip-build to build first:');
        log.info(`  node harmonyos-deploy.js -p ${options.product} --launch`);
      }
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
      if (error.stderr && error.stderr.trim()) {
        console.log(error.stderr);
      }
      diagnoseBuildError(error.stderr || error.stdout || error.message);
      process.exit(1);
    }
  }
  
  // Launch
  if (options.launch) {
    timer.start('Launch');
    const bundleName = getBundleName(options.product);
    const abilityName = getAbilityName(hapModule);
    
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
  
  // Performance summary
  timer.summary();
  
  log.success('Deploy completed!');
  
  // Real-time log (--log flag)
  if (options.showLog) {
    const bundleName = getBundleName(options.product);
    await startLogStream(device, bundleName, options.logFilter);
  }
}

main().catch(error => {
  log.error(error.message);
  process.exit(1);
});
