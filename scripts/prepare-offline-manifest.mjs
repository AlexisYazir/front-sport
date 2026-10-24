import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** Mantiene el inicio completo offline; las demás pantallas se guardan al utilizarlas. */
export function selectOfflineFiles(manifest, stats, html) {
  const outputs = stats.outputs;
  if (!outputs) throw new Error('Falta el mapa de dependencias de la compilación.');
  const app = manifest.assetGroups.find(group => group.name === 'app');
  const features = manifest.assetGroups.find(group => group.name === 'features');
  if (!app || !features) throw new Error('Faltan los grupos app y features de la PWA.');
  const startup = [...html.matchAll(/(?:src|href)="([^"?#]+\.js)(?:[?#][^"]*)?"/g)]
    .map(match => match[1].replace(/^\//, ''));
  const home = Object.keys(outputs).filter(file =>
    outputs[file].entryPoint?.replaceAll('\\', '/') === 'src/app/shared/components/home/home.ts');
  if (!startup.length || home.length !== 1) throw new Error('No se identificaron los archivos del arranque y del inicio.');
  const needed = new Set();
  const visit = file => {
    file = file.replace(/^\//, '');
    if (needed.has('/' + file)) return;
    const output = outputs[file];
    if (!output || !manifest.hashTable['/' + file]) throw new Error(`Dependencia sin huella: ${file}`);
    needed.add('/' + file);
    for (const dependency of output.imports || []) {
      if (dependency.external || dependency.kind === 'dynamic-import') continue;
      const resolved = new URL(dependency.path, 'https://build.invalid/' + file).pathname.slice(1);
      if (/\.m?js$/.test(resolved)) visit(resolved);
    }
  };
  for (const file of [...startup, ...home]) visit(file);
  app.urls = [...new Set([...app.urls, ...needed])].sort();
  features.urls = features.urls.filter(file => !needed.has(file));
  return {
    prefetchedFiles: app.urls.length, prefetchedJs: needed.size, lazyJs: features.urls.length,
    prefetchedJsBytes: [...needed].reduce((sum, file) => sum + outputs[file.slice(1)].bytes, 0),
    lazyJsBytes: features.urls.reduce((sum, file) => sum + (outputs[file.slice(1)]?.bytes || 0), 0),
  };
}

export async function prepareOfflineManifest(root = process.cwd()) {
  const output = path.join(root, 'dist/ecommerce-app');
  const [manifestText, statsText, html] = await Promise.all([
    readFile(path.join(output, 'browser/ngsw.json'), 'utf8'),
    readFile(path.join(output, 'stats.json'), 'utf8'),
    readFile(path.join(output, 'browser/index.html'), 'utf8'),
  ]);
  const manifest = JSON.parse(manifestText);
  const summary = selectOfflineFiles(manifest, JSON.parse(statsText), html);
  // Sólo cambia la política de descarga. Se conservan todas las huellas originales.
  await writeFile(path.join(output, 'browser/ngsw.json'), JSON.stringify(manifest, null, 2));
  return summary;
}
