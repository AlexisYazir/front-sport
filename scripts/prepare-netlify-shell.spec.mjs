import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { prepareNetlifyShell } from './prepare-netlify-shell.mjs';

test('el transporte JSON preserva los bytes, su huella y el HTML compilado original', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'sport-netlify-shell-'));
  try {
    const browser = path.join(root, 'dist/ecommerce-app/browser');
    const legacy = path.join(root, 'dist/ecommerce-app/functions/app-shell.mjs');
    await mkdir(browser, { recursive: true });
    await mkdir(path.dirname(legacy), { recursive: true });
    await writeFile(legacy, '// función anterior');
    const html = Buffer.from('\ufeff<!doctype html>\r\n<html><head><title>Deportés 🏀</title></head><body></body></html>\r\n');
    const expected = createHash('sha1').update(html).digest('hex');
    await writeFile(path.join(browser, 'index.html'), html);
    await writeFile(path.join(browser, 'ngsw.json'), JSON.stringify({ index: '/index.html', hashTable: { '/index.html': expected } }));
    const generated = await prepareNetlifyShell(root);
    const transport = await readFile(generated.file, 'utf8');
    const payload = JSON.parse(transport);
    assert.equal(payload.version, 1);
    assert.equal(payload.encoding, 'base64');
    assert.deepEqual(Buffer.from(payload.html, 'base64'), html);
    assert.equal(generated.hash, expected);
    assert.equal(transport.includes('<html>'), false);
    assert.deepEqual(await readFile(path.join(browser, 'index.html')), html);
    await assert.rejects(stat(legacy), { code: 'ENOENT' });
    await writeFile(path.join(browser, 'index.html'), Buffer.concat([html, Buffer.from('<!-- alterado -->')]));
    await assert.rejects(prepareNetlifyShell(root), /no coincide con ngsw.json/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
