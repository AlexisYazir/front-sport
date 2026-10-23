import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { HttpRequest, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { PublicHomeOfflineService } from './public-home-offline.service';
import { environment } from '../../../environments/environment';

describe('Copia pública del inicio', () => {
  let service: PublicHomeOfflineService;
  let http: HttpTestingController;
  let online: boolean;
  let saved: Map<string, Response>;
  const api = environment.apiUrl.replace(/\/$/, '');
  const url = api + '/products/get-all-products';
  const products = [{ id_producto: 1, producto: 'Tenis', variantes: [{ imagenes: ['https://m.media-amazon.com/a.jpg'] }] }];
  const settle = () => new Promise(resolve => setTimeout(resolve, 0));
  const pendingRequest = async () => {
    const deadline = Date.now() + 2_000;
    do {
      const requests = http.match(url);
      if (requests.length) {
        expect(requests.length).toBe(1);
        return requests[0];
      }
      await settle();
    } while (Date.now() < deadline);
    throw Error('No se inició la lectura pública');
  };
  const request = () => new HttpRequest('GET', url);
  const boot = () => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([() => { throw Error('No debe usar la sesión para copias públicas'); }])),
      provideHttpClientTesting(),
    ] });
    service = TestBed.inject(PublicHomeOfflineService);
    http = TestBed.inject(HttpTestingController);
  };
  beforeEach(() => {
    online = true;
    saved = new Map();
    spyOnProperty(navigator, 'onLine', 'get').and.callFake(() => online);
    spyOn(caches, 'open').and.callFake(async () => ({
      match: async (key: string) => saved.get(key)?.clone(),
      put: async (key: string, response: Response) => { saved.set(key, response.clone()); },
    }) as unknown as Cache);
    boot();
  });
  afterEach(() => http.verify());

  it('solo admite los cinco GET públicos exactos, excluyendo sesiones, pedidos, escrituras y consultas', () => {
    expect(service.handles(request())).toBeTrue();
    expect(service.handles(new HttpRequest('GET', api + '/company/banner'))).toBeTrue();
    for (const path of ['/users/session', '/orders', '/company/banner/admin', '/products/get-all-products?private=true']) {
      expect(service.handles(new HttpRequest('GET', api + path))).toBeFalse();
    }
    expect(service.handles(new HttpRequest('POST', url, {}))).toBeFalse();
    expect(service.handles(new HttpRequest('GET', 'https://example.com/products/get-all-products'))).toBeFalse();
  });

  it('deduplica solicitudes, las realiza sin token ni cookies y conserva la respuesta pública', async () => {
    const first = firstValueFrom(service.intercept(request()));
    const second = firstValueFrom(service.intercept(request()));
    const pending = await pendingRequest();
    expect(pending.request.withCredentials).toBeFalse();
    expect(pending.request.headers.has('Authorization')).toBeFalse();
    pending.flush(products);
    await Promise.all([first, second]);
    expect((await saved.get(url)!.json()).data).toEqual(products);
  });

  it('recupera el catálogo después de reiniciar, sin solicitar red cuando no hay conexión', async () => {
    saved.set(url, new Response(JSON.stringify({ schema: 1, savedAt: Date.now(), data: products })));
    TestBed.resetTestingModule();
    online = false;
    boot();
    const response: any = await firstValueFrom(service.intercept(request()));
    expect(response.body).toEqual(products);
    http.expectNone(url);
  });

  it('un fallo de red conserva la última copia válida', async () => {
    saved.set(url, new Response(JSON.stringify({ schema: 1, data: products })));
    const response = firstValueFrom(service.intercept(request()));
    (await pendingRequest()).error(new ProgressEvent('error'));
    expect((await response as any).body).toEqual(products);
    expect((await saved.get(url)!.json()).data).toEqual(products);
  });

  it('rechaza respuestas inválidas y no reemplaza una copia válida', async () => {
    saved.set(url, new Response(JSON.stringify({ schema: 1, data: products })));
    const response = firstValueFrom(service.intercept(request()));
    (await pendingRequest()).flush({ session: 'no guardar' });
    expect((await response as any).body).toEqual(products);
    expect((await saved.get(url)!.json()).data).toEqual(products);
  });

  it('no declara disponibilidad si falla el almacenamiento, pero permite usar la respuesta online', async () => {
    (caches.open as jasmine.Spy).and.rejectWith(Error('Cuota agotada'));
    const response = firstValueFrom(service.intercept(request()));
    (await pendingRequest()).flush(products);
    expect((await response as any).body).toEqual(products);
    expect(service.storageProblem()).toBeTrue();
    expect(service.homeReady()).toBeFalse();
  });

  it('sin copia conserva el error de red en lugar de inventar productos', async () => {
    const response = firstValueFrom(service.intercept(request()));
    const rejection = expectAsync(response).toBeRejected();
    (await pendingRequest()).error(new ProgressEvent('error'));
    await rejection;
    expect(saved.size).toBe(0);
  });

  it('sin conexión y sin copia responde de inmediato sin intentar una descarga de un minuto', async () => {
    online = false;
    await expectAsync(firstValueFrom(service.intercept(request()))).toBeRejected();
    http.expectNone(url);
  });

  it('conserva la última respuesta en una pestaña abierta aunque falle el almacenamiento', async () => {
    (caches.open as jasmine.Spy).and.rejectWith(Error('Almacenamiento no disponible'));
    const first = firstValueFrom(service.intercept(request()));
    (await pendingRequest()).flush(products);
    await first;
    online = false;
    const response: any = await firstValueFrom(service.intercept(request()));
    expect(response.body).toEqual(products);
    http.expectNone(url);
    expect(service.homeReady()).toBeFalse();
  });

  it('recupera la copia al cortar la conexión durante una consulta pendiente', async () => {
    saved.set(url, new Response(JSON.stringify({ schema: 1, data: products })));
    service.start();
    const result = firstValueFrom(service.intercept(request()));
    const pending = await pendingRequest();
    http.match(() => true);
    online = false;
    window.dispatchEvent(new Event('offline'));
    const response: any = await result;
    expect(response.body).toEqual(products);
    expect(pending.cancelled).toBeTrue();
  });

  it('recurre a la copia tras tres segundos si onLine no detecta la caída de red', fakeAsync(() => {
    // Cache sin streams para controlar exactamente los microtasks de este caso.
    (caches.open as jasmine.Spy).and.resolveTo({ match: async () => ({ json: async () => ({ schema: 1, data: products }) }) });
    let result: any;
    firstValueFrom(service.intercept(request())).then(value => result = value);
    flushMicrotasks();
    const pending = http.expectOne(url);
    tick(3_000);
    flushMicrotasks();
    expect(result.body).toEqual(products);
    expect(pending.cancelled).toBeTrue();
  }));

  it('anuncia la recuperación de datos públicos para reponer secciones sin recargar la página', async () => {
    const updated = jasmine.createSpy('updated');
    service.dataUpdated.subscribe(updated);
    const response = firstValueFrom(service.intercept(request()));
    (await pendingRequest()).flush(products);
    await response;
    expect(updated).toHaveBeenCalledOnceWith(url);
  });
});
