importScripts('./ngsw-worker.js');

(() => {
  'use strict';
  const networkFetch = self.fetch.bind(self);
  const indexUrl = new URL('index.html', self.registration.scope);
  const shellUrl = new URL('pwa-shell.json', self.registration.scope);
  const imagesCache = 'sport-center-public-images-v1';
  const validationUrl = new URL('pwa-image-validation/', self.registration.scope);

  // Esta caché contiene solo imágenes públicas verificadas por la aplicación.
  // No pertenece al namespace de Angular y conserva sus entradas entre versiones.
  const fetchPublicImage = async (input, init, url) => {
    const request = input instanceof Request && !init ? input : new Request(input, init);
    let saved;
    try {
      saved = await (await self.caches.open(imagesCache)).match(url.href, { ignoreVary: true });
    } catch { /* Sin almacenamiento, el sitio puede seguir usando la red. */ }
    if (url.origin === validationUrl.origin && url.pathname.startsWith(validationUrl.pathname)) {
      // Image sin crossOrigin permite probar exactamente una candidata opaca.
      return request.mode === 'no-cors' && saved ? saved : new Response('', { status: 404 });
    }
    if (saved?.type === 'opaque' && request.mode !== 'no-cors') saved = undefined;
    // Las copias fueron decodificadas antes de guardarse. No esperan una red caída
    // ni se vuelven a descargar en cada navegación.
    if (saved) return saved;
    return networkFetch(input, init);
  };

  // El HTML versionado conserva la caché, las actualizaciones y la comprobación
  // SHA-1 del worker oficial. Las imágenes públicas tienen una copia independiente.
  self.fetch = async (input, init) => {
    const isRequest = input instanceof Request;
    const url = new URL(isRequest ? input.url : input, self.registration.scope);
    const method = (init?.method || (isRequest ? input.method : 'GET')).toUpperCase();
    // No reconstruir las demás Request: podría consumir el cuerpo de un POST.
    if (method !== 'GET') {
      return networkFetch(input, init);
    }
    if (url.origin !== indexUrl.origin || url.pathname !== indexUrl.pathname) {
      return fetchPublicImage(input, init, url);
    }

    const request = new Request(input, init);
    const transport = new URL(shellUrl);
    transport.search = url.search;
    const response = await networkFetch(new Request(transport, {
      method: 'GET', mode: 'same-origin', credentials: 'same-origin',
      cache: request.cache, signal: request.signal, redirect: 'error',
      headers: { Accept: 'application/json' },
    }));
    if (!response.ok) return response;
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('pwa-shell.json no respondió como JSON.');
    }
    const payload = await response.json();
    if (payload.version !== 1 || payload.encoding !== 'base64' || typeof payload.html !== 'string') {
      throw new Error('Formato inválido de pwa-shell.json.');
    }
    const bytes = Uint8Array.from(atob(payload.html), character => character.charCodeAt(0));
    const headers = new Headers(response.headers);
    headers.set('Content-Type', 'text/html; charset=utf-8');
    // fetch ya descomprimió el JSON; el nuevo cuerpo contiene otros bytes.
    for (const name of ['Content-Encoding', 'Content-Length', 'ETag']) headers.delete(name);
    return new Response(bytes, { status: 200, headers });
  };
})();
