const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

const extensionsDir = path.join(__dirname, '../../extensions');
const distDir = path.join(__dirname, '../../dist');
const indexJsonPath = path.join(distDir, 'index.json');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Default index.json structure based on the provided format
let indexData = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  extensions: {},
  metadata: {
    totalExtensions: 0,
    generatedBy: "Aion Extension Builder v1.0.0",
    repository: "https://github.com/iOfficeAI/AionHub/"
  }
};

// Load existing index.json if it exists (and is valid JSON)
if (fs.existsSync(indexJsonPath)) {
  try {
    const rawData = fs.readFileSync(indexJsonPath, 'utf8');
    // Simple regex to strip single-line comments before parsing if any exist
    const jsonStr = rawData.replace(/\/\/[^\n]*\n/g, '\n');
    indexData = JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse existing dist/index.json, starting fresh.', e.message);
  }
}

if (!indexData.extensions) indexData.extensions = {};

const dirs = fs.readdirSync(extensionsDir).filter(f => f.startsWith('aionext-') && fs.statSync(path.join(extensionsDir, f)).isDirectory());

let hasUpdates = false;

dirs.forEach(extDirName => {
  const extPath = path.join(extensionsDir, extDirName);
  const zipName = `${extDirName}.zip`;
  const zipPath = path.join(distDir, zipName);
  const extJsonPath = path.join(extPath, 'aion-extension.json');

  // Skip if zip already exists and is in the index
  if (fs.existsSync(zipPath) && indexData.extensions[extDirName]) {
    return;
  }

  console.log(`Packaging extension: ${extDirName}...`);

  if (!fs.existsSync(extJsonPath)) {
    console.warn(`Skipping ${extDirName}: No aion-extension.json found.`);
    return;
  }

  let extJson;
  try {
    extJson = JSON.parse(fs.readFileSync(extJsonPath, 'utf8'));
  } catch (e) {
    console.error(`Failed to parse ${extJsonPath}`, e.message);
    return;
  }

  // 1. Create Zip file (using JS archiver or standard zip tool)
  // Clean up any existing stale zip before creating a new one
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  
  // Create zip using system zip command
  try {
    execSync(`cd "${extPath}" && zip -r "${zipPath}" . -x "*.DS_Store"`, { stdio: 'inherit' });
  } catch (e) {
    console.error(`Failed to zip ${extDirName}`, e.message);
    return;
  }

  // 2. Calculate file size and integrity (SHA-512)
  const zipBuffer = fs.readFileSync(zipPath);
  const hashSum = crypto.createHash('sha512').update(zipBuffer).digest('base64');
  const integrity = `sha512-${hashSum}`;
  const size = fs.statSync(zipPath).size;

  // 3. Determine "hubs" based on contributes array
  const hubs = [];
  if (extJson.contributes) {
    Object.keys(extJson.contributes).forEach(key => hubs.push(key));
  }

  // 4. Update the index data
  indexData.extensions[extDirName] = {
    name: extJson.name,
    displayName: extJson.displayName || extDirName,
    version: extJson.version || '1.0.0',
    description: extJson.description || '',
    author: extJson.author || 'Aionui Official',
    icon: extJson.icon || undefined,
    engines: extJson.engine || {},
    hubs: hubs,
    dist: {
      tarball: `dist/${zipName}`,
      integrity: integrity,
      unpackedSize: size // actually zip size for now, exact unpacked size is harder to compute generically
    }
  };

  hasUpdates = true;
});

if (hasUpdates) {
  indexData.generatedAt = new Date().toISOString();
  indexData.metadata.totalExtensions = Object.keys(indexData.extensions).length;
  
  fs.writeFileSync(indexJsonPath, JSON.stringify(indexData, null, 4) + '\n');
  console.log(`Successfully updated dist/index.json with ${Object.keys(indexData.extensions).length} extensions.`);
} else {
  console.log('No new extensions to package.');
}
