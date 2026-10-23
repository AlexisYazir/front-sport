import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { PublicHomeOfflineService } from './public-home-offline.service';
import { PublicImageOfflineService } from './public-image-offline.service';
import { environment } from '../../../environments/environment';

describe('Conservación del registro de descargas del inicio', () => {
  const image = 'https://res.cloudinary.com/catalogo/tenis.jpg';
  const previous = 'https://res.cloudinary.com/catalogo/anterior.jpg';
  const api = environment.apiUrl.replace(/\/$/, '');
  const recordUrl = new URL('pwa-media-status', document.baseURI).href;
  const oldDate = Date.now() - 400 * 86400_000;
  let saved: Map<string, Response>;
  let images: jasmine.SpyObj<PublicImageOfflineService>;
  let service: PublicHomeOfflineService;
  let online: boolean;

  beforeEach(() => {
    online = false;
    saved = new Map([[recordUrl, new Response(JSON.stringify({ verified: { [image]: oldDate, [previous]: oldDate } }))]]);
    images = jasmine.createSpyObj('PublicImageOfflineService', ['has', 'retain'], { storageProblem: signal(false) });
    images.has.and.resolveTo(true);
    images.retain.and.resolveTo(true);
    spyOnProperty(navigator, 'onLine', 'get').and.callFake(() => online);
    spyOn(caches, 'open').and.resolveTo({
      match: async (key: string) => saved.get(key)?.clone(),
      put: async (key: string, value: Response) => { saved.set(key, value.clone()); },
    } as unknown as Cache);
    spyOn(caches, 'match').and.callFake(async key => {
      const url = typeof key === 'string' ? key : (key as Request).url;
      return url.endsWith('/index.html') ? new Response('shell') : saved.get(url)?.clone();
    });
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: PublicImageOfflineService, useValue: images }] });
    service = TestBed.inject(PublicHomeOfflineService);
    const internal = service as any;
    for (const path of ['/products/get-all-products', '/products/get-all-marcas', '/products/menu/sports',
      '/company/banner', '/products/shipping-methods']) {
      internal.persisted.add(api + path);
      internal.copies.set(api + path, path.endsWith('/get-all-products')
        ? [{ id_producto: 1, producto: 'Tenis', variantes: [{ imagenes: [image] }] }] : []);
    }
  });
  afterEach(() => TestBed.resetTestingModule());

  it('conserva los registros anteriores y no vence una descarga de más de un año', async () => {
    await (service as any).prepareImages();
    const record = await saved.get(recordUrl)!.json();
    expect(record.verified[image]).toBe(oldDate);
    expect(record.verified[previous]).toBe(oldDate);
    expect(record.pending).toEqual([]);
    expect(service.savedImages()).toBe(1);
    expect(images.retain).toHaveBeenCalledWith(image, false, jasmine.any(Boolean), true);
  });

  it('un intento fallido conserva el historial y los bytes de la copia anterior', async () => {
    images.has.and.resolveTo(false);
    images.retain.and.resolveTo(false);
    saved.set(image, new Response('imagen anterior'));
    await (service as any).prepareImages();
    const record = await saved.get(recordUrl)!.json();
    expect(record.verified).toEqual({ [image]: oldDate, [previous]: oldDate });
    expect(await saved.get(image)!.text()).toBe('imagen anterior');
    expect(service.savedImages()).toBe(1);
  });

  it('no reinicia el contador a cero mientras termina de preparar una copia existente', async () => {
    let finish!: (saved: boolean) => void;
    const started = new Promise<void>(resolve => images.retain.and.callFake(() => {
      resolve(); return new Promise<boolean>(done => { finish = done; });
    }));
    service.savedImages.set(1);
    const preparing = (service as any).prepareImages();
    await started;
    expect(service.savedImages()).toBe(1);
    finish(true);
    await preparing;
  });

  it('si falla escribir el registro no reemplaza la copia que ya estaba guardada', async () => {
    const before = await saved.get(recordUrl)!.clone().text();
    (caches.open as jasmine.Spy).and.resolveTo({
      match: async (key: string) => saved.get(key)?.clone(),
      put: async () => { throw new DOMException('Sin espacio', 'QuotaExceededError'); },
    });
    await (service as any).prepareImages();
    expect(await saved.get(recordUrl)!.text()).toBe(before);
    expect(service.storageProblem()).toBeTrue();
  });
});
