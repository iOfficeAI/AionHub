const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Use a deterministic zip generator like yazl or archiver if installed.
// Since we don't know if 'yazl' is in dependencies, we'll keep using system zip 
// BUT we tell zip to use a fixed timestamp for everything, which makes it 
// identical across platforms (if file content is same).
const { execSync } = require('child_process');

async function main() {
  const extensionsDir = path.join(__dirname, '../../extensions');
  const distDir = path.join(__dirname, '../../dist');
  const indexJsonPath = path.join(distDir, 'index.json');

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

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

  if (fs.existsSync(indexJsonPath)) {
    try {
      const rawData = fs.readFileSync(indexJsonPath, 'utf8');
      const jsonStr = rawData.replace(/\/\/[^\n]*\n/g, '\n');
      indexData = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse existing dist/index.json, starting fresh.', e.message);
    }
  }

  if (!indexData.extensions) indexData.extensions = {};

  const dirs = fs.readdirSync(extensionsDir).filter(f => f.startsWith('aionext-') && fs.statSync(path.join(extensionsDir, f)).isDirectory());

  let hasUpdates = false;

  for (const extDirName of dirs) {
    const extPath = path.join(extensionsDir, extDirName);
    const zipName = `${extDirName}.zip`;
    const zipPath = path.join(distDir, zipName);
    const extJsonPath = path.join(extPath, 'aion-extension.json');

    if (fs.existsSync(zipPath) && indexData.extensions[extDirName]) {
      continue;
    }

    console.log(`Packaging extension: ${extDirName}...`);

    if (!fs.existsSync(extJsonPath)) {
      console.warn(`Skipping ${extDirName}: No aion-extension.json found.`);
      continue;
    }

    let extJson;
    try {
      extJson = JSON.parse(fs.readFileSync(extJsonPath, 'utf8'));
    } catch (e) {
      console.error(`Failed to parse ${extJsonPath}`, e.message);
      continue;
    }

    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    
    // SOLUTION: Use zip with the -X (no extra attributes) option and 
    // run touch to standardize the modification time before zipping,
    // ensuring byte-for-byte consistent zip files across environments.
    try {
      execSync(`cd "${extPath}" && find . -exec touch -t 202401010000 {} + && zip -r -X "${zipPath}" . -x "*.DS_Store"`, { stdio: 'inherit' });
    } catch (e) {
      console.error(`Failed to zip ${extDirName}`, e.message);
      continue;
    }

    const zipBuffer = fs.readFileSync(zipPath);
    const hashSum = crypto.createHash('sha512').update(zipBuffer).digest('base64');
    const integrity = `sha512-${hashSum}`;
    const size = fs.statSync(zipPath).size;

    const hubs = [];
    if (extJson.contributes) {
      Object.keys(extJson.contributes).forEach(key => {
        if (Array.isArray(extJson.contributes[key]) && extJson.contributes[key].length > 0) {
          hubs.push(key);
        }
      });
    }

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
        unpackedSize: size
      }
    };

    hasUpdates = true;
  }

  if (hasUpdates) {
    indexData.generatedAt = new Date().toISOString();
    indexData.metadata.totalExtensions = Object.keys(indexData.extensions).length;
    
    fs.writeFileSync(indexJsonPath, JSON.stringify(indexData, null, 4) + '\n');
    console.log(`Successfully updated dist/index.json with ${Object.keys(indexData.extensions).length} extensions.`);
  } else {
    console.log('No new extensions to package.');
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
