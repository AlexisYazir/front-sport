import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectOfflineFiles } from './prepare-offline-manifest.mjs';

function fixture() {
  const files = ['main.js', 'shared.js', 'home.js', 'home-icons.js', 'admin.js', 'charts.js'];
  const manifest = { hashTable: Object.fromEntries(files.map(file => ['/' + file, 'hash:' + file])),
    assetGroups: [{ name: 'app', urls: ['/index.html', '/main.js'] },
      { name: 'features', urls: files.slice(1).map(file => '/' + file) }] };
  const output = (entryPoint, imports = []) => ({ entryPoint, bytes: 100, imports });
  const dep = (path, kind = 'import-statement') => ({ path, kind });
  const stats = { outputs: {
    'main.js': output('src/main.ts', [dep('./shared.js'), dep('./home.js', 'dynamic-import'), dep('./admin.js', 'dynamic-import')]),
    'shared.js': output(undefined, [dep('./main.js')]),
    'home.js': output('src/app/shared/components/home/home.ts', [dep('./shared.js'), dep('./home-icons.js')]),
    'home-icons.js': output(),
    'admin.js': output('src/app/admin.ts', [dep('./charts.js')]),
    'charts.js': output(),
  } };
  return { manifest, stats, html: '<html><script src="main.js" type="module"></script></html>' };
}

test('guarda el inicio y sus dependencias compartidas sin descargar administración ni gráficas', () => {
  const { manifest, stats, html } = fixture();
  const hashes = structuredClone(manifest.hashTable);
  const result = selectOfflineFiles(manifest, stats, html);
  assert.deepEqual(manifest.assetGroups[0].urls, ['/home-icons.js', '/home.js', '/index.html', '/main.js', '/shared.js']);
  assert.deepEqual(manifest.assetGroups[1].urls, ['/admin.js', '/charts.js']);
  assert.deepEqual(manifest.hashTable, hashes);
  assert.equal(result.prefetchedJsBytes, 400);
  assert.equal(result.lazyJsBytes, 200);
});

test('rechaza dependencias que no conserva el manifiesto en vez de publicar un inicio incompleto', () => {
  const { manifest, stats, html } = fixture();
  delete manifest.hashTable['/shared.js'];
  assert.throws(() => selectOfflineFiles(manifest, stats, html), /Dependencia sin huella/);
});

test('rechaza la ausencia del mapa del inicio y no modifica los grupos existentes', () => {
  const { manifest, stats, html } = fixture();
  delete stats.outputs['home.js'];
  const before = JSON.stringify(manifest);
  assert.throws(() => selectOfflineFiles(manifest, stats, html), /archivos del arranque y del inicio/);
  assert.equal(JSON.stringify(manifest), before);
});

test('admite precargas del HTML, no sigue imports externos y es idempotente', () => {
  const { manifest, stats } = fixture();
  stats.outputs['main.js'].imports.push({ path: 'https://example.com/external.js', external: true });
  const html = '<link href="shared.js" rel="modulepreload"><script src="/main.js?v=1"></script>';
  selectOfflineFiles(manifest, stats, html);
  const once = JSON.stringify(manifest);
  selectOfflineFiles(manifest, stats, html);
  assert.equal(JSON.stringify(manifest), once);
});
