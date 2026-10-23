import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Lee únicamente las cadenas de headers.values del bloque global de este proyecto.
// Si cambia su formato, detiene el build en vez de omitir una política de seguridad.
export function readGlobalHeaders(config) {
  const block = config.replace(/\r\n?/g, '\n').split(/^\s*\[\[headers\]\]\s*$/m).slice(1)
    .find(value => /^\s*for\s*=\s*"\/\*"\s*$/m.test(value));
  const values = block?.split(/^\s*\[headers\.values\]\s*$/m)[1];
  if (!values) throw new Error('No se encontraron los headers globales en netlify.toml.');
  const headers = {};
  let remaining = values;
  while (remaining.trim()) {
    remaining = remaining.replace(/^(?:\s+|#[^\r\n]*(?:\r?\n|$))+/, '');
    if (!remaining) break;
    const match = remaining.match(/^([A-Za-z][A-Za-z0-9-]*)\s*=\s*(?:"""([\s\S]*?)"""|"([^"\r\n]*)")[ \t]*(?:#[^\r\n]*)?(?:\r?\n|$)/);
    if (!match) throw new Error('Formato de header no soportado en netlify.toml: ' + remaining.split(/\r?\n/)[0]);
    const name = match[1].toLowerCase();
    if (Object.hasOwn(headers, name)) throw new Error('Header global duplicado: ' + name);
    headers[name] = (match[2] ?? match[3]).replace(/\s+/g, ' ').trim();
    remaining = remaining.slice(match[0].length);
  }
  for (const name of ['content-security-policy', 'permissions-policy', 'cache-control']) {
    if (!headers[name]) throw new Error('Falta el header global ' + name);
  }
  return headers;
}

export async function prepareNetlifyShell(root = process.cwd()) {
  const output = path.join(root, 'dist/ecommerce-app');
  const [html, manifestText, config] = await Promise.all([
    readFile(path.join(output, 'browser/index.html')),
    readFile(path.join(output, 'browser/ngsw.json'), 'utf8'),
    readFile(path.join(root, 'netlify.toml'), 'utf8'),
  ]);
  const manifest = JSON.parse(manifestText);
  const hash = createHash('sha1').update(html).digest('hex');
  if (manifest.index !== '/index.html' || manifest.hashTable?.[manifest.index] !== hash) {
    throw new Error('index.html no coincide con ngsw.json. No se generó la función de Netlify.');
  }
  const headers = {
    ...readGlobalHeaders(config),
    'content-type': 'text/html; charset=utf-8',
    // El HTML es público y fijo para este deploy. Netlify invalida su CDN al publicar otro.
    'netlify-cdn-cache-control': 'public, max-age=31536000, must-revalidate, no-transform',
  };
  // La función contiene los bytes compilados; no depende del disco ni del backend al atender visitas.
  const source = `// Generado por scripts/prepare-netlify-shell.mjs. No editar.\n` +
    `import { Buffer } from 'node:buffer';\n` +
    `const html = Buffer.from(${JSON.stringify(html.toString('base64'))}, 'base64');\n` +
    `const headers = ${JSON.stringify(headers, null, 2)};\n` +
    `export default async function appShell(request) {\n` +
    `  if (request.method !== 'GET' && request.method !== 'HEAD') {\n` +
    `    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' } });\n` +
    `  }\n` +
    `  return new Response(request.method === 'HEAD' ? null : html, { headers });\n` +
    `}\n`;
  const directory = path.join(output, 'functions');
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, 'app-shell.mjs');
  await writeFile(file, source, 'utf8');
  return { file, hash, bytes: html.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  prepareNetlifyShell().then(result => {
    console.log(`HTML de Netlify preparado: ${result.bytes} bytes; SHA-1 ${result.hash}.`);
  }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
