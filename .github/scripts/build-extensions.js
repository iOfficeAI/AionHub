/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const YAML = require('yaml');

/**
 * Recursively collect all file paths under `dir`, sorted for deterministic ordering.
 * Skips: node_modules, .git, .DS_Store, __MACOSX
 */
function getAllFiles(dir) {
  const results = [];
  const SKIP = new Set(['node_modules', '.git', '.DS_Store', '__MACOSX']);

  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIP.has(entry.name)) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results.sort();
}

/**
 * Compute a deterministic SHA-256 hash of all file contents in an extension directory.
 * Hash input: sorted sequence of (relative_path, file_content) pairs.
 */
function computeContentHash(extPath) {
  const hash = crypto.createHash('sha256');
  const files = getAllFiles(extPath);
  for (const file of files) {
    // Normalize to forward slashes for cross-platform determinism.
    const rel = path.relative(extPath, file).split(path.sep).join('/');
    hash.update(rel);
    hash.update(fs.readFileSync(file));
  }
  return hash.digest('hex');
}

async function main() {
  const extensionsDir = path.join(__dirname, '../../extensions');
  const distDir = path.join(__dirname, '../../dist');
  const indexJsonPath = path.join(distDir, 'index.json');

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const indexData = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    extensions: {},
    metadata: {
      totalExtensions: 0,
      generatedBy: "Aion Extension Builder v1.0.0",
      repository: "https://github.com/iOfficeAI/AionHub/"
    }
  };

  const dirs = fs.readdirSync(extensionsDir).filter(f => f.startsWith('aionext-') && fs.statSync(path.join(extensionsDir, f)).isDirectory());

  for (const extDirName of dirs) {
    const extPath = path.join(extensionsDir, extDirName);
    const zipName = `${extDirName}.zip`;
    const zipPath = path.join(distDir, zipName);
    const extJsonPath = path.join(extPath, 'aion-extension.json');

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
      execSync(`cd "${extPath}" && find . -exec touch -t 202401010000 {} + && zip -r -X "${zipPath}" . -x "*.DS_Store" -x "*.git*" -x "__MACOSX/*" -x "node_modules/*"`, { stdio: 'inherit' });
    } catch (e) {
      console.error(`Failed to zip ${extDirName}`, e.message);
      continue;
    }

    const contentHash = computeContentHash(extPath);
    const integrity = `sha256-${contentHash}`;
    const size = fs.statSync(zipPath).size;

    const hubs = [];
    const contributesSummary = {};
    
    if (extJson.contributes) {
      Object.keys(extJson.contributes).forEach(key => {
        const items = extJson.contributes[key];
        if (Array.isArray(items) && items.length > 0) {
          hubs.push(key);
          // Extract the 'id' field from each contribution item
          contributesSummary[key] = items.map(item => item.id).filter(id => id !== undefined);
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
      contributes: contributesSummary,
      dist: {
        tarball: zipName,
        integrity: integrity,
        unpackedSize: size
      }
    };
  }
  // Process skillpacks (knowledge packages with manifest.yaml)
  const skillpacksDir = path.join(__dirname, '../../skillpacks');
  if (fs.existsSync(skillpacksDir)) {
    const packDirs = fs.readdirSync(skillpacksDir).filter(f => fs.statSync(path.join(skillpacksDir, f)).isDirectory());
    for (const packDirName of packDirs) {
      const packPath = path.join(skillpacksDir, packDirName);
      const manifestPath = fs.existsSync(path.join(packPath, 'manifest.yaml'))
        ? path.join(packPath, 'manifest.yaml')
        : path.join(packPath, 'manifest.yml');

      if (!fs.existsSync(manifestPath)) {
        console.warn(`Skipping skillpack ${packDirName}: No manifest.yaml found.`);
        continue;
      }

      console.log(`Packaging skillpack: ${packDirName}...`);

      let manifest;
      try {
        manifest = YAML.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch (e) {
        console.error(`Failed to parse ${manifestPath}:`, e.message);
        continue;
      }

      const zipName = `${packDirName}.zip`;
      const zipPath = path.join(distDir, zipName);
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

      try {
        execSync(`cd "${packPath}" && find . -exec touch -t 202401010000 {} + && zip -r -X "${zipPath}" . -x "*.DS_Store" -x "*.git*" -x "__MACOSX/*" -x "node_modules/*"`, { stdio: 'inherit' });
      } catch (e) {
        console.error(`Failed to zip skillpack ${packDirName}:`, e.message);
        continue;
      }

      const contentHash = computeContentHash(packPath);
      const integrity = `sha256-${contentHash}`;
      const size = fs.statSync(zipPath).size;

      const hubsSet = new Set(Array.isArray(manifest.hubs) ? manifest.hubs : ['skills', 'knowledge']);
      const contributesSummary = {};

      if (manifest.contributes && typeof manifest.contributes === 'object') {
        Object.keys(manifest.contributes).forEach(key => {
          hubsSet.add(key);
          const items = manifest.contributes[key];
          if (Array.isArray(items)) {
            contributesSummary[key] = items.map(item => (typeof item === 'object' ? item.id : item)).filter(Boolean);
          }
        });
      } else {
        contributesSummary['skills'] = [manifest.name || packDirName];
      }

      indexData.extensions[packDirName] = {
        name: manifest.name || packDirName,
        displayName: manifest.displayName || manifest.display_name || manifest.name || packDirName,
        version: manifest.version || '0.1.0',
        description: manifest.description || '',
        author: manifest.author || 'Aion Official',
        hubs: Array.from(hubsSet),
        contributes: contributesSummary,
        dist: {
          tarball: zipName,
          integrity: integrity,
          unpackedSize: size
        }
      };
    }
  }

  indexData.metadata.totalExtensions = Object.keys(indexData.extensions).length;

  if (indexData.metadata.totalExtensions > 0) {
    fs.writeFileSync(indexJsonPath, JSON.stringify(indexData, null, 4) + '\n');
    console.log(`Successfully built dist/index.json with ${indexData.metadata.totalExtensions} extensions.`);
  } else {
    console.log('No extensions found to package.');
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
