import { createHash } from 'node:crypto';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function prepareNetlifyShell(root = process.cwd()) {
  const output = path.join(root, 'dist/ecommerce-app');
  const [html, manifestText] = await Promise.all([
    readFile(path.join(output, 'browser/index.html')),
    readFile(path.join(output, 'browser/ngsw.json'), 'utf8'),
  ]);
  const manifest = JSON.parse(manifestText);
  const hash = createHash('sha1').update(html).digest('hex');
  if (manifest.index !== '/index.html' || manifest.hashTable?.[manifest.index] !== hash) {
    throw new Error('index.html no coincide con ngsw.json. No se generó pwa-shell.json.');
  }
  // Netlify modifica HTML incluso en funciones. El transporte JSON evita ese
  // procesado; Angular sigue verificando la huella de los bytes HTML reconstruidos.
  const file = path.join(output, 'browser/pwa-shell.json');
  await writeFile(file, JSON.stringify({ version: 1, encoding: 'base64', html: html.toString('base64') }), 'utf8');
  await rm(path.join(output, 'functions/app-shell.mjs'), { force: true });
  return { file, hash, bytes: html.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  prepareNetlifyShell().then(result => {
    console.log(`HTML offline preparado en pwa-shell.json: ${result.bytes} bytes; SHA-1 ${result.hash}.`);
  }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
