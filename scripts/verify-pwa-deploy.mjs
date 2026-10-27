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

  const download = async (file, bypass = true) => {
    const url = new URL(file, base);
    if (url.origin !== base.origin) throw new Error(`Recurso fuera del sitio: ${file}`);
    if (bypass) {
      url.searchParams.set('ngsw-bypass', 'true');
      url.searchParams.set('pwa-check', cacheBust);
    }
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
  if (!manifest.hashTable['/pwa-worker.js']) {
    throw new Error('El deploy no incluye pwa-worker.js. Debe publicarse la nueva compilación completa.');
  }
  const readShell = async (bypass) => {
    const { bytes, headers } = await download('pwa-shell.json', bypass);
    if (!headers.get('content-type')?.includes('application/json')) {
      throw new Error('Falta pwa-shell.json o responde como HTML. Revisa el build de producción.');
    }
    const payload = JSON.parse(bytes.toString('utf8'));
    if (payload.version !== 1 || payload.encoding !== 'base64' || typeof payload.html !== 'string') {
      throw new Error('pwa-shell.json no contiene el formato esperado.');
    }
    return Buffer.from(payload.html, 'base64');
  };
  const shellBytes = await readShell(true);
  if (createHash('sha1').update(shellBytes).digest('hex') !== manifest.hashTable[manifest.index]) {
    throw new Error('El HTML de pwa-shell.json no coincide con la huella de index.html.');
  }

  const resources = Object.entries(manifest.hashTable);
  const failures = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, resources.length) }, async () => {
    while (next < resources.length) {
      const [file, expected] = resources[next++];
      try {
        const bytes = file === manifest.index ? shellBytes : (await download(file)).bytes;
        const actual = createHash('sha1').update(bytes).digest('hex');
        if (actual !== expected) {
          failures.push(`${file}: la huella no coincide.`);
        }
      } catch (error) {
        failures.push(error.message);
      }
    }
  }));

  // El worker obtiene el HTML de JSON y verifica su huella. La navegación inicial
  // puede llevar comentarios del proveedor, pero debe cargar los mismos JS y CSS.
  const startupFiles = [...shellBytes.toString('utf8').matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)]
    .map(match => match[1]);
  if (!startupFiles.length) failures.push('El HTML no contiene los archivos de arranque de Angular.');
  for (const route of ['/', '/index.html', '/home', '/home/']) {
    try {
      const { bytes, headers } = await download(route, false);
      const html = bytes.toString('utf8');
      if (!html.includes('<app-root') || startupFiles.some(file => !html.includes('"' + file + '"'))) {
        failures.push(`${route}: el HTML online no carga los archivos de esta compilación.`);
      }
      if (!headers.get('content-type')?.includes('text/html')) {
        failures.push(`${route}: la navegación no responde como HTML.`);
      }
    } catch (error) {
      failures.push(error.message);
    }
  }
  const canonicalShell = await readShell(false);
  if (!canonicalShell.equals(shellBytes)) failures.push('pwa-shell.json cambia según los parámetros de consulta.');

  const { bytes: workerBytes, headers } = await download('pwa-worker.js?v=1');
  const policies = (headers.get('content-security-policy') || '').split(',').filter(Boolean);
  // Son proveedores utilizados actualmente por imágenes y fuentes del catálogo.
  const providers = [
    'https://res.cloudinary.com', 'https://http2.mlstatic.com', 'https://m.media-amazon.com',
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

  if (manifest.dataGroups?.some(group => group.name === 'public-catalog-images')) {
    failures.push('La publicación todavía duplica las imágenes públicas en la caché de Angular.');
  }
  const workerCode = workerBytes.toString('utf8');
  if (!workerCode.includes("const imagesCache = 'sport-center-public-images-v1'") ||
      !workerCode.includes('pwa-image-validation/')) failures.push('Falta la caché estable de imágenes verificadas.');
  const app = manifest.assetGroups?.find(group => group.name === 'app');
  const features = manifest.assetGroups?.find(group => group.name === 'features');
  if (!app?.urls.includes(manifest.index) || features?.installMode !== 'lazy') {
    failures.push('Falta la política de descarga del inicio y las pantallas bajo demanda.');
  }

  if (failures.length) {
    for (const failure of failures) console.error(`ERROR: ${failure}`);
    throw new Error('La publicación todavía requiere ajustes. No se modificó ningún archivo.');
  }
  console.log(`OK: ${resources.length} archivos coinciden con ngsw.json.`);
  console.log('OK: el HTML offline de pwa-shell.json conserva la huella de index.html.');
  console.log('OK: /, /index.html, /home y /home/ cargan los archivos de esta compilación.');
  console.log('OK: el worker responde y su CSP permite los proveedores comprobados.');
  console.log('Continúa con las pruebas de imágenes, actualización y modo sin conexión en el navegador.');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
