import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const origin = 'https://sport.example';
const imageA = 'https://res.cloudinary.com/catalogo/a.jpg';
const imageB = 'https://res.cloudinary.com/catalogo/b.jpg';
const imagesCache = 'sport-center-public-images-v1';
// El override permite ejecutar este archivo staged con las dependencias del checkout.
const official = readFileSync(process.env.PWA_TEST_WORKER_FILE ||
  new URL('../node_modules/@angular/service-worker/ngsw-worker.js', import.meta.url), 'utf8');
const boot = 'new Driver(scope, adapter, new CacheDatabase(adapter));';
assert.ok(official.includes(boot), 'La instrumentación debe coincidir con el worker instalado.');
// Sólo la cadena evaluada en VM expone las clases: no se modifica ni publica Angular.
const testWorker = official.replace(boot,
  'self.testClasses = { DataGroup }; self.testDriver = ' + boot);
const wrapper = readFileSync(new URL('../public/pwa-worker.js', import.meta.url), 'utf8');
const config = JSON.parse(readFileSync(new URL('../ngsw-config.json', import.meta.url), 'utf8'));
const sha1 = value => createHash('sha1').update(value).digest('hex');
const html = version => `<!doctype html><app-root>Sport Center ${version}</app-root>`;

class TestRequest extends Request {
  constructor(input, init) {
    const options = { ...init }, mode = options.mode;
    if (mode === 'navigate') delete options.mode;
    super(typeof input === 'string' ? new URL(input, origin).href : input, options);
    if (mode === 'navigate') Object.defineProperty(this, 'mode', { value: mode });
  }
}
// Node no construye respuestas opaque: el doble conserva sus propiedades relevantes.
class OpaqueResponse extends Response {
  constructor(marker) { super(marker); this.marker = marker; }
  get type() { return 'opaque'; }
  get status() { return 0; }
  get ok() { return false; }
  clone() { return new OpaqueResponse(this.marker); }
}
const address = request => typeof request === 'string' ? new URL(request, origin).href : request.url;
class MemoryCache {
  entries = new Map();
  async match(request) { return this.entries.get(address(request))?.clone(); }
  async put(request, response) { this.entries.set(address(request), response.clone()); }
  async delete(request) { return this.entries.delete(address(request)); }
  async keys() { return [...this.entries.keys()].map(url => new TestRequest(url)); }
}
class MemoryStorage {
  entries = new Map();
  deleted = [];
  async open(name) {
    if (!this.entries.has(name)) this.entries.set(name, new MemoryCache());
    return this.entries.get(name);
  }
  async keys() { return [...this.entries.keys()]; }
  async has(name) { return this.entries.has(name); }
  async delete(name) { this.deleted.push(name); return this.entries.delete(name); }
  async match(request) {
    for (const cache of this.entries.values()) {
      const found = await cache.match(request);
      if (found) return found;
    }
  }
}
const imageResponse = body => new Response(body, { headers: { 'Content-Type': 'image/jpeg' } });
function manifest(version, legacyImages = true) {
  return {
    configVersion: 1, timestamp: version, index: '/index.html',
    assetGroups: [{ name: 'app', installMode: 'prefetch', updateMode: 'prefetch',
      urls: ['/index.html'], patterns: [], cacheQueryOptions: { ignoreVary: true } }],
    // Capacidad/edad reducidas para ejercitar los mecanismos reales sin miles de fotos.
    dataGroups: legacyImages ? [{ name: 'public-catalog-images', version: 1, strategy: 'freshness',
      patterns: ['^https://res\\.cloudinary\\.com/catalogo/'], maxSize: 2, maxAge: 1_000,
      timeoutMs: 3_000, cacheOpaqueResponses: false,
      cacheQueryOptions: { ignoreVary: true } }] : [],
    hashTable: { '/index.html': sha1(html(version)) },
    navigationUrls: [{ positive: true, regex: '^\\/.*$' }], navigationRequestStrategy: 'performance',
  };
}
function runtime(storage, network, wrapped = true) {
  const requests = [], clients = new Map(), listeners = new Map();
  const scope = {
    registration: { scope: origin + '/', active: null, unregister: async () => true }, caches: storage,
    addEventListener: (name, handler) => listeners.set(name, handler), skipWaiting: async () => {},
    clients: { claim: async () => {}, matchAll: async () => [...clients.values()], get: async id => clients.get(id) },
    fetch: async (input, init) => {
      const request = input instanceof Request && !init ? input : new TestRequest(input, init);
      const url = new URL(request.url);
      requests.push(request.url);
      if (!network.online) throw new TypeError('Red desconectada en el ensayo');
      if (url.pathname === '/ngsw.json') return new Response(JSON.stringify(manifest(network.version, network.legacyImages !== false)));
      if (url.pathname === '/pwa-shell.json') return new Response(JSON.stringify({
        version: 1, encoding: 'base64', html: Buffer.from(html(network.version)).toString('base64'),
      }), { headers: { 'Content-Type': 'application/json' } });
      if (url.pathname === '/index.html') return new Response(html(network.version));
      if (url.hostname === 'res.cloudinary.com') {
        if (network.imageKind === 'http-error') return new Response('No disponible', { status: 503 });
        if (network.imageKind === 'html') return new Response('<html>Inicio de sesión</html>', {
          headers: { 'Content-Type': 'text/html' },
        });
        if (network.imageKind === 'opaque') return new OpaqueResponse('respuesta opaca nueva no verificada');
        return imageResponse('red:' + url.pathname);
      }
      return new Response('', { status: 404 });
    },
  };
  let context;
  context = vm.createContext({ self: scope, Request: TestRequest, Response, Headers, URL, atob,
    console, setTimeout, clearTimeout, Client: class {},
    importScripts(file) { assert.equal(file, './ngsw-worker.js'); vm.runInContext(testWorker, context); },
  });
  vm.runInContext(wrapped ? wrapper : testWorker, context);
  const driver = scope.testDriver;
  driver.adapter.timeout = () => new Promise(() => {});
  Object.defineProperty(driver.adapter, 'time', { get: () => network.time });
  const fetch = async (url, mode = 'no-cors', id = 'browser') => {
    let response;
    clients.set(id, { id, postMessage() {} });
    const event = { request: new TestRequest(url, { mode,
      headers: mode === 'navigate' ? { Accept: 'text/html' } : {} }),
      clientId: mode === 'navigate' ? '' : id, resultingClientId: mode === 'navigate' ? id : '',
      // El idle se ejecuta explícitamente; su temporizador suspendido no bloquea el ensayo.
      waitUntil() {}, respondWith: value => response = Promise.resolve(value) };
    driver.onFetch(event);
    const result = response ? await response : await scope.fetch(event.request);
    return result;
  };
  const initialize = async () => {
    assert.equal((await fetch(origin + '/home', 'navigate')).status, 200);
    await driver.idle.execute();
  };
  const group = () => driver.versions.get(driver.latestHash).dataGroups[0];
  return { driver, group, initialize, fetch, scope, requests, clients };
}
const network = () => ({ online: true, version: 1, time: 1, imageKind: 'ok' });

test('control Angular real: refrescar una entrada con LRU lleno elimina otra imagen', async () => {
  const instance = runtime(new MemoryStorage(), network(), false);
  await instance.initialize();
  await instance.fetch(imageA); await instance.fetch(imageB);
  const cache = await instance.group().cache;
  assert.ok(await cache.match(imageA)); assert.ok(await cache.match(imageB));
  await instance.fetch(imageB);
  assert.equal(await cache.match(imageA), undefined);
  assert.ok(await cache.match(imageB));
});

test('la copia propia sobrevive a expulsión LRU, vencimiento y reinicio offline del worker real', async () => {
  const storage = new MemoryStorage(), state = network();
  const own = await storage.open(imagesCache);
  await own.put(imageA, imageResponse('A guardada y verificada'));
  const first = runtime(storage, state);
  await first.initialize();
  await first.fetch(imageA); await first.fetch(imageB); await first.fetch(imageB);
  const cache = await first.group().cache;
  assert.equal(await cache.match(imageA), undefined, 'Angular expulsó A por LRU.');
  state.time += 2_000;
  assert.equal(await first.group().loadFromCache(new TestRequest(imageB), await first.group().lru()), null);
  assert.equal(await cache.match(imageB), undefined, 'Angular eliminó B al superar su maxAge.');
  assert.equal(await (await own.match(imageA)).text(), 'A guardada y verificada');
  state.online = false;
  const restarted = runtime(storage, state);
  assert.equal((await restarted.fetch(origin + '/home', 'navigate')).status, 200);
  const response = await restarted.fetch(imageA);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'A guardada y verificada');
  assert.equal(await (await own.match(imageA)).text(), 'A guardada y verificada');
});

test('validación opaca entrega exactamente la candidata sin red y rechaza solicitudes CORS', async () => {
  const storage = new MemoryStorage(), state = network(), instance = runtime(storage, state);
  await instance.initialize();
  const temporary = origin + '/pwa-image-validation/00000000-0000-4000-8000-000000000001';
  const candidate = new OpaqueResponse('bytes únicos de esta candidata');
  await (await storage.open(imagesCache)).put(temporary, candidate);
  instance.requests.length = 0;
  state.online = false;
  const exact = await instance.fetch(temporary);
  assert.equal(exact.type, 'opaque');
  assert.equal(await exact.text(), 'bytes únicos de esta candidata');
  assert.equal((await instance.fetch(temporary, 'cors')).status, 404);
  assert.equal((await instance.fetch(temporary + '-ausente')).status, 404);
  assert.deepEqual(instance.requests, []);
});

test('una imagen verificada responde de caché sin esperar ni volver a pedir la red', async () => {
  const storage = new MemoryStorage(), state = network();
  const own = await storage.open(imagesCache);
  await own.put(imageA, imageResponse('imagen verificada conservada'));
  const instance = runtime(storage, state);
  await instance.initialize();
  instance.requests.length = 0;
  for (const kind of ['http-error', 'html', 'opaque']) {
    state.imageKind = kind;
    const result = await instance.fetch(imageA);
    assert.equal(result.status, 200, kind);
    assert.equal(await result.text(), 'imagen verificada conservada', kind);
    assert.equal(await (await own.match(imageA)).text(), 'imagen verificada conservada', kind);
  }
  assert.deepEqual(instance.requests, []);
});

test('la configuración conserva una sola copia de las imágenes públicas, sin duplicarlas en Angular', async () => {
  assert.equal(config.dataGroups.some(group => group.name === 'public-catalog-images'), false);
  const storage = new MemoryStorage(), state = network();
  const own = await storage.open(imagesCache);
  await own.put(imageA, new OpaqueResponse('opaca previamente validada'));
  state.imageKind = 'opaque';
  state.legacyImages = false;
  const instance = runtime(storage, state);
  await instance.initialize();
  const response = await instance.fetch(imageA);
  assert.equal(response.type, 'opaque');
  assert.equal(await response.text(), 'opaca previamente validada');
  assert.equal(instance.driver.versions.get(instance.driver.latestHash).dataGroups.length, 0);
  assert.equal((await own.keys()).length, 1);
});

test('una copia opaca no se utiliza para contestar una solicitud CORS', async () => {
  const storage = new MemoryStorage(), state = network();
  await (await storage.open(imagesCache)).put(imageA, new OpaqueResponse('copia no-cors'));
  const instance = runtime(storage, state);
  await instance.initialize(); state.online = false;
  await assert.rejects(instance.scope.fetch(new TestRequest(imageA, { mode: 'cors' })), /desconectada/);
  assert.equal(await (await (await storage.open(imagesCache)).match(imageA)).text(), 'copia no-cors');
});

test('actualizar y limpiar Angular elimina versiones antiguas sin borrar las tres cachés públicas', async () => {
  const storage = new MemoryStorage(), state = network(), instance = runtime(storage, state);
  const names = ['sport-center-public-home-v1', 'sport-center-public-info-v1', imagesCache];
  for (const name of names) await (await storage.open(name)).put(origin + '/saved', new Response(name));
  await instance.initialize();
  await instance.fetch(imageA);
  const legacy = (await storage.keys()).filter(name => name.includes('data:public-catalog-images'));
  assert.ok(legacy.length > 0);
  const previousHash = instance.driver.latestHash;
  const obsolete = await instance.driver.adapter.caches.open('unused-version:assets:old:cache');
  await obsolete.put(new TestRequest(origin + '/old'), new Response('versión antigua'));
  state.version = 2;
  state.legacyImages = false;
  assert.equal(await instance.driver.checkForUpdate(), true);
  assert.notEqual(instance.driver.latestHash, previousHash);
  instance.clients.clear();
  await instance.driver.cleanupCaches();
  assert.equal(instance.driver.versions.has(previousHash), false);
  assert.equal(await instance.driver.adapter.caches.has('unused-version:assets:old:cache'), false);
  for (const name of legacy) assert.equal(await storage.has(name), false, 'Sólo se elimina la caché duplicada de Angular.');
  for (const name of names) {
    assert.equal(await storage.has(name), true);
    assert.equal(await (await (await storage.open(name)).match(origin + '/saved')).text(), name);
    assert.equal(storage.deleted.includes(name), false);
  }
});

test('la página y el worker comparten nombre de caché y ruta temporal', () => {
  const page = readFileSync(new URL('../src/app/core/services/public-image-offline.service.ts', import.meta.url), 'utf8');
  const pageCache = page.match(/const CACHE_NAME = '([^']+)'/);
  const workerCache = wrapper.match(/const imagesCache = '([^']+)'/);
  assert.ok(pageCache); assert.ok(workerCache);
  assert.equal(pageCache[1], imagesCache); assert.equal(workerCache[1], imagesCache);
  const pagePath = page.match(/new URL\(`([^`]*?)\$\{crypto\.randomUUID/);
  const workerPath = wrapper.match(/const validationUrl = new URL\('([^']+)'/);
  assert.ok(pagePath); assert.ok(workerPath);
  assert.equal(pagePath[1], 'pwa-image-validation/');
  assert.equal(workerPath[1], pagePath[1]);
});
