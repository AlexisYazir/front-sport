import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const root = path.resolve('dist/ecommerce-app/browser');
// Reproduce la CSP de producción para detectar también sus bloqueos durante las pruebas.
const netlifyConfig = await readFile('netlify.toml', 'utf8');
const csp = netlifyConfig.match(/Content-Security-Policy = """([\s\S]*?)"""/)?.[1]
  .replace(/upgrade-insecure-requests;/g, '').replace(/\s+/g, ' ').trim();
const portIndex = process.argv.indexOf('--port');
const port = Number(portIndex >= 0 ? process.argv[portIndex + 1] : 4200);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Indica un puerto válido con --port.');
}

try {
  await stat(path.join(root, 'ngsw.json'));
} catch {
  console.error('Primero genera la versión PWA con npm run build:prod.');
  process.exit(1);
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405).end();
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let file = path.resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    // Las rutas de Angular abren la misma aplicación; los archivos inexistentes dan 404.
    if (!path.extname(pathname)) file = path.join(root, 'index.html');
    const data = await readFile(file);
    const extension = path.extname(file);
    const compress = /\bgzip\b/.test(request.headers['accept-encoding'] || '') &&
      ['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg'].includes(extension);
    const body = compress ? gzipSync(data) : data;
    response.writeHead(200, {
      'Content-Type': mimeTypes[extension] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache',
      'Vary': 'Accept-Encoding',
      ...(csp ? { 'Content-Security-Policy': csp } : {}),
      ...(compress ? { 'Content-Encoding': 'gzip' } : {}),
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Archivo no encontrado.');
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`El puerto ${port} está ocupado. Detén npm start con Ctrl+C antes de iniciar la vista previa PWA.`);
  } else {
    console.error(error.message);
  }
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Sport Center PWA: http://localhost:${port}/home`);
  console.log('Mantén esta terminal abierta. Ctrl+C detiene la vista previa.');
});
