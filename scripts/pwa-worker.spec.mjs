import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const origin = 'https://sport.example';
const official = readFileSync(new URL('../node_modules/@angular/service-worker/ngsw-worker.js', import.meta.url), 'utf8');
const boot = 'new Driver(scope, adapter, new CacheDatabase(adapter));';
assert.ok(official.includes(boot));
// Solo expone la instancia para el ensayo; el archivo publicado de Angular no se modifica.
const testWorker = official.replace(boot, 'self.testDriver = ' + boot);
const wrapper = readFileSync(new URL('../public/pwa-worker.js', import.meta.url), 'utf8');
const sha1 = bytes => createHash('sha1').update(bytes).digest('hex');
class TestRequest extends Request {
  constructor(input, init) {
    const options = { ...init }, mode = options.mode;
    if (mode === 'navigate') delete options.mode;
    super(typeof input === 'string' ? new URL(input, origin).href : input, options);
    if (mode === 'navigate') Object.defineProperty(this, 'mode', { value: mode });
  }
}
const address = request => typeof request === 'string' ? new URL(request, origin).href : request.url;
class Cache {
  entries = new Map();
  async match(request) { return this.entries.get(address(request))?.clone(); }
  async put(request, response) { this.entries.set(address(request), response.clone()); }
  async delete(request) { return this.entries.delete(address(request)); }
  async keys() { return [...this.entries.keys()].map(url => new TestRequest(url)); }
}
class Storage {
  entries = new Map();
  async open(name) { if (!this.entries.has(name)) this.entries.set(name, new Cache()); return this.entries.get(name); }
  async keys() { return [...this.entries.keys()]; }
  async has(name) { return this.entries.has(name); }
  async delete(name) { return this.entries.delete(name); }
  async match(request) { for (const cache of this.entries.values()) { const found = await cache.match(request); if (found) return found; } }
}
const html = version => '<!doctype html><html><body><app-root>Versión ' + version + ' 🏀</app-root></body></html>';
function manifest(version) {
  return { configVersion: 1, timestamp: version, index: '/index.html',
    assetGroups: [{ name: 'app', installMode: 'prefetch', updateMode: 'prefetch', urls: ['/index.html'], patterns: [], cacheQueryOptions: { ignoreVary: true } }],
    dataGroups: [], hashTable: { '/index.html': sha1(html(version)) },
    navigationUrls: [{ positive: true, regex: '^\\/.*$' }], navigationRequestStrategy: 'performance' };
}
function runtime(storage, network, useWrapper) {
  const requests = [], clients = new Map(), listeners = new Map();
  const scope = {
    registration: { scope: origin + '/', active: null, unregister: async () => true }, caches: storage,
    addEventListener(name, handler) { listeners.set(name, handler); }, skipWaiting: async () => {},
    clients: { claim: async () => {}, matchAll: async () => [...clients.values()], get: async id => clients.get(id) },
    fetch: async request => {
      const url = new URL(request.url); requests.push(url.pathname + url.search);
      if (!network.online) throw new TypeError('Sin red en la prueba');
      if (url.pathname === '/orders' && request.method === 'POST') {
        network.orderBody = await request.text();
        return new Response('ok', { status: 201 });
      }
      if (url.pathname === '/ngsw.json') return new Response(JSON.stringify(manifest(network.version)));
      if (url.pathname === '/pwa-shell.json') return new Response(JSON.stringify({ version: 1, encoding: 'base64',
        html: Buffer.from(html(network.version) + (network.corruptJson ? '<!-- cambiado -->' : '')).toString('base64') }),
        { headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip', 'Content-Length': '999', ETag: 'json' } });
      if (['/index.html', '/home'].includes(url.pathname)) return new Response(html(network.version) +
        (network.alterHtml ? '\n<!-- This site is hosted on Netlify. -->' : ''), { headers: { 'Content-Type': 'text/html' } });
      return new Response('', { status: 404 });
    },
  };
  let context;
  context = vm.createContext({ self: scope, Request: TestRequest, Response, Headers, URL, atob, console, setTimeout, clearTimeout, Client: class {},
    importScripts(file) { assert.equal(file, './ngsw-worker.js'); vm.runInContext(testWorker, context); } });
  vm.runInContext(useWrapper ? wrapper : testWorker, context);
  const driver = scope.testDriver;
  driver.adapter.timeout = () => new Promise(() => {});
  const navigate = async id => {
    let handled;
    clients.set(id, { id, postMessage() {} });
    const event = { request: new TestRequest(origin + '/home', { mode: 'navigate', headers: { Accept: 'text/html' } }),
      clientId: '', resultingClientId: id, waitUntil() {}, respondWith(value) { handled = Promise.resolve(value); } };
    driver.onFetch(event);
    const response = handled ? await handled : await scope.fetch(event.request);
    return { status: response.status, body: Buffer.from(await response.arrayBuffer()), headers: response.headers };
  };
  return { driver, navigate, requests, listeners, scope };
}

test('control: la inyección HTML hace fallar la primera recarga del worker oficial sin el transporte', async () => {
  const network = { online: true, version: 1, alterHtml: true };
  const instance = runtime(new Storage(), network, false);
  await instance.navigate('online'); await instance.driver.idle.execute();
  network.online = false;
  assert.equal((await instance.navigate('offline-1')).status, 504);
});

test('con HTML alterado por el hosting, primera recarga offline tras reiniciar el worker responde desde caché', async () => {
  const storage = new Storage(), network = { online: true, version: 1, alterHtml: true };
  const instance = runtime(storage, network, true);
  const first = await instance.navigate('online');
  assert.deepEqual(first.body, Buffer.from(html(1)));
  assert.equal(first.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(first.headers.get('content-encoding'), null);
  assert.equal(first.headers.get('content-length'), null);
  assert.equal(first.headers.get('etag'), null);
  await instance.driver.idle.execute(); network.online = false;
  const restarted = runtime(storage, network, true);
  for (const id of ['offline-1', 'offline-2']) {
    const response = await restarted.navigate(id);
    assert.equal(response.status, 200); assert.deepEqual(response.body, Buffer.from(html(1)));
  }
  assert.deepEqual(restarted.requests, []);
  assert.ok(restarted.listeners.has('push')); assert.ok(restarted.listeners.has('notificationclick'));
});

test('recupera una caché anterior con actualización fallida sin borrar los datos existentes', async () => {
  const storage = new Storage(), network = { online: true, version: 1, alterHtml: false };
  const old = runtime(storage, network, false);
  await old.navigate('old'); await old.driver.idle.execute();
  network.version = 2; network.alterHtml = true;
  assert.equal(await old.driver.checkForUpdate(), false);
  network.online = false; assert.equal((await old.navigate('failed')).status, 504);
  network.online = true;
  const upgrade = runtime(storage, network, true);
  await upgrade.navigate('upgrade'); await upgrade.driver.idle.execute();
  assert.equal(upgrade.driver.state, 0);
  network.online = false;
  const restarted = runtime(storage, network, true);
  const response = await restarted.navigate('offline-first');
  assert.equal(response.status, 200); assert.deepEqual(response.body, Buffer.from(html(2)));
});

test('Angular sigue rechazando un HTML alterado dentro del JSON; no se omiten las huellas', async () => {
  const storage = new Storage(), network = { online: true, version: 1, alterHtml: true, corruptJson: true };
  const instance = runtime(storage, network, true);
  await instance.navigate('online'); await instance.driver.idle.execute();
  assert.equal(await storage.match(origin + '/index.html'), undefined);
  network.online = false;
  assert.equal((await instance.navigate('offline-first')).status, 504);
});

test('las peticiones POST conservan su cuerpo y no pasan por el transporte del HTML', async () => {
  const network = { online: true, version: 1 };
  const instance = runtime(new Storage(), network, true);
  const response = await instance.scope.fetch(new TestRequest(origin + '/orders', { method: 'POST', body: 'item=123' }));
  assert.equal(response.status, 201);
  assert.equal(network.orderBody, 'item=123');
  assert.deepEqual(instance.requests, ['/orders']);
});

test('recupera también una instalación anterior cuyo index nunca pudo guardarse', async () => {
  const storage = new Storage(), network = { online: true, version: 1, alterHtml: true };
  const broken = runtime(storage, network, false);
  await broken.navigate('broken'); await broken.driver.idle.execute();
  assert.equal(await storage.match(origin + '/index.html'), undefined);
  network.version = 2;
  const upgrade = runtime(storage, network, true);
  await upgrade.navigate('upgrade'); await upgrade.driver.idle.execute();
  assert.equal(upgrade.driver.state, 0);
  network.online = false;
  const restarted = runtime(storage, network, true);
  const first = await restarted.navigate('offline-first');
  assert.equal(first.status, 200); assert.deepEqual(first.body, Buffer.from(html(2)));
});
