import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareNetlifyShell, readGlobalHeaders } from './prepare-netlify-shell.mjs';

const projectConfig = await readFile(new URL('../netlify.toml', import.meta.url), 'utf8');

test('conserva todos los headers globales, incluyendo las políticas multilínea', () => {
  const headers = readGlobalHeaders(projectConfig);
  assert.equal(Object.keys(headers).length, 11);
  assert.match(headers['content-security-policy'], /worker-src 'self' blob:/);
  assert.match(headers['content-security-policy'], /https:\/\/m\.media-amazon\.com/);
  assert.match(headers['permissions-policy'], /microphone=\(self\)/);
  assert.equal(headers['cache-control'], 'public, max-age=0, must-revalidate, no-transform');
  assert.equal(headers['x-frame-options'], 'DENY');
  assert.deepEqual(readGlobalHeaders(projectConfig.replace(/\r\n?/g, '\n')), headers);
  assert.deepEqual(readGlobalHeaders(projectConfig.replace(/\r?\n/g, '\r\n')), headers);
  assert.throws(() => readGlobalHeaders(projectConfig.replace('X-Frame-Options = "DENY"', 'X-Frame-Options = true')), /Formato de header/);
});

test('la función sirve exactamente el HTML validado por Angular en cualquier ruta SPA', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'sport-netlify-shell-'));
  try {
    const browser = path.join(root, 'dist/ecommerce-app/browser');
    await mkdir(browser, { recursive: true });
    const html = Buffer.from('\ufeff<!doctype html>\r\n<html><head><title>Deportés 🏀</title></head><body></body></html>\r\n');
    const expected = createHash('sha1').update(html).digest('hex');
    await writeFile(path.join(browser, 'index.html'), html);
    await writeFile(path.join(browser, 'ngsw.json'), JSON.stringify({ index: '/index.html', hashTable: { '/index.html': expected } }));
    await writeFile(path.join(root, 'netlify.toml'), projectConfig);
    const generated = await prepareNetlifyShell(root);
    const handler = (await import(pathToFileURL(generated.file).href)).default;
    for (const route of ['/', '/index.html', '/home', '/home/', '/products?page=2', '/index.html?ngsw-cache-bust=123']) {
      const response = await handler(new Request('https://sport.example' + route));
      assert.equal(response.status, 200);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), html, route);
      for (const [name, value] of Object.entries(readGlobalHeaders(projectConfig))) {
        assert.equal(response.headers.get(name), value);
      }
      assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
      assert.equal(response.headers.get('set-cookie'), null);
    }
    const head = await handler(new Request('https://sport.example/home', { method: 'HEAD' }));
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    assert.equal(head.headers.get('content-security-policy'), readGlobalHeaders(projectConfig)['content-security-policy']);
    assert.equal((await handler(new Request('https://sport.example/home', { method: 'POST' }))).status, 405);
    assert.deepEqual(await readFile(path.join(browser, 'index.html')), html);
    await writeFile(path.join(browser, 'index.html'), Buffer.concat([html, Buffer.from('<!-- agregado por alojamiento -->')]));
    await assert.rejects(prepareNetlifyShell(root), /no coincide con ngsw.json/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
