import { createHash } from 'node:crypto';

// Solo consulta archivos públicos; no cambia el despliegue ni el almacenamiento.
async function main() {
  const input = process.argv[2];
  if (!input) throw new Error('Uso: npm run verify:pwa -- https://tu-sitio.netlify.app');
  const base = new URL(input);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
    throw new Error('Indica una dirección HTTP o HTTPS sin credenciales.');
  }
  base.search = '';
  base.hash = '';
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  const cacheBust = Date.now().toString();

  const download = async (file) => {
    const url = new URL(file, base);
    if (url.origin !== base.origin) throw new Error(`Recurso fuera del sitio: ${file}`);
    url.searchParams.set('ngsw-bypass', 'true');
    url.searchParams.set('pwa-check', cacheBust);
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
    if (new URL(response.url).origin !== base.origin) {
      throw new Error(`${file}: redirección fuera del sitio.`);
    }
    return { bytes: Buffer.from(await response.arrayBuffer()), headers: response.headers };
  };

  console.log(`Comprobando ${base.href}`);
  const { bytes: manifestBytes } = await download('ngsw.json');
  let manifest;
  try {
    manifest = JSON.parse(manifestBytes.toString('utf8'));
  } catch {
    throw new Error('ngsw.json no contiene JSON. Revisa la carpeta de publicación y las redirecciones.');
  }
  if (!manifest.hashTable?.[manifest.index]) {
    throw new Error('El índice de la PWA no tiene una huella de integridad válida.');
  }

  const resources = Object.entries(manifest.hashTable);
  const failures = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, resources.length) }, async () => {
    while (next < resources.length) {
      const [file, expected] = resources[next++];
      try {
        const { bytes } = await download(file);
        const actual = createHash('sha1').update(bytes).digest('hex');
        if (actual !== expected) {
          let hint = '';
          if (file === manifest.index && bytes.toString('utf8').includes('This site is hosted on Netlify')) {
            hint = ' El HTML incluye un comentario añadido por el alojamiento. Revisa la inyección de HTML en Netlify.';
          }
          failures.push(`${file}: la huella no coincide.${hint}`);
        }
      } catch (error) {
        failures.push(error.message);
      }
    }
  }));

  const { headers } = await download('ngsw-worker.js?v=2');
  const policies = (headers.get('content-security-policy') || '').split(',').filter(Boolean);
  // Son proveedores utilizados actualmente por imágenes y fuentes del catálogo.
  const providers = [
    'https://res.cloudinary.com', 'https://http2.mlstatic.com',
    'https://imgs.search.brave.com', 'https://images.seeklogo.com',
    'https://operadorapalermo.com.mx', 'https://ui-avatars.com',
    'https://fonts.googleapis.com', 'https://fonts.gstatic.com',
  ];
  for (const policy of policies) {
    const directives = new Map(policy.split(';').map(value => {
      const [name, ...sources] = value.trim().split(/\s+/);
      return [name, sources];
    }));
    const connections = directives.get('connect-src') ?? directives.get('default-src');
    if (!connections) continue;
    const missing = providers.filter(provider =>
      !connections.includes(provider) && !connections.includes('https:') && !connections.includes('*'),
    );
    if (missing.length) failures.push(`La CSP del worker bloquea estos proveedores: ${missing.join(', ')}`);
  }

  if (failures.length) {
    for (const failure of failures) console.error(`ERROR: ${failure}`);
    throw new Error('La publicación todavía requiere ajustes. No se modificó ningún archivo.');
  }
  console.log(`OK: ${resources.length} archivos coinciden con ngsw.json.`);
  console.log('OK: el worker responde y su CSP permite los proveedores comprobados.');
  console.log('Continúa con las pruebas de imágenes, actualización y modo sin conexión en el navegador.');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
