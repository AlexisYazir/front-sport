import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PublicInfoOfflineService } from './public-info-offline.service';

describe('PublicInfoOfflineService', () => {
  let service: PublicInfoOfflineService;
  let http: HttpTestingController;
  let online: boolean;
  let saved: Map<string, Response>;
  let openCache: jasmine.Spy;
  const company = { nombre: 'Sport Center', mision: 'Deporte para todos', rfc: 'NO-GUARDAR' };
  const faq = { id_faq: 1, pregunta: '¿Cómo comprar?', respuesta: 'Desde la tienda.',
    activo: true, seccion: 'Compras', palabras_clave: ['pedido'], creado_por: 99 };
  const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0));
  async function waitForCopy() {
    const deadline = Date.now() + 1_000;
    while (service.company.data() === null && Date.now() < deadline) await settle();
    expect(service.company.data()).not.toBeNull();
  }

  function boot() {
    TestBed.configureTestingModule({ providers: [
      // Las lecturas públicas deben omitir los interceptores de sesión.
      provideHttpClient(withInterceptors([() => { throw new Error('No debe renovar la sesión'); }])),
      provideHttpClientTesting(),
    ] });
    service = TestBed.inject(PublicInfoOfflineService);
    http = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    online = true;
    saved = new Map();
    spyOnProperty(navigator, 'onLine', 'get').and.callFake(() => online);
    openCache = spyOn(caches, 'open').and.callFake(async () => ({
      match: async (url: string) => saved.get(url)?.clone(),
      put: async (url: string, response: Response) => { saved.set(url, response.clone()); },
    }) as unknown as Cache);
    boot();
  });
  afterEach(() => http.verify());

  it('descarga ambos contenidos al iniciar sin duplicar peticiones y guarda solo campos públicos', async () => {
    service.start();
    service.start();
    void service.refreshCompany();
    await settle();
    const info = http.expectOne(service.company.url);
    const questions = http.expectOne(service.faqs.url);
    expect(info.request.method).toBe('GET');
    expect(info.request.headers.has('Authorization')).toBeFalse();
    expect(info.request.withCredentials).toBeFalse();
    info.flush(company);
    questions.flush([faq, { ...faq, id_faq: 2, activo: false }]);
    await Promise.all([service.company.inFlight, service.faqs.inFlight]);
    expect(saved.size).toBe(2);
    expect(openCache).toHaveBeenCalledWith('sport-center-public-info-v1');
    const storedCompany = await saved.get(service.company.url)!.json();
    const storedFaqs = await saved.get(service.faqs.url)!.json();
    expect(storedCompany.data.rfc).toBeUndefined();
    expect(storedFaqs.data.length).toBe(1);
    expect(storedFaqs.data[0].creado_por).toBeUndefined();
  });

  it('recupera ambos contenidos sin red después de reiniciar la aplicación', async () => {
    service.start();
    await settle();
    http.expectOne(service.company.url).flush(company);
    http.expectOne(service.faqs.url).flush([faq]);
    await Promise.all([service.company.inFlight, service.faqs.inFlight]);
    http.verify();
    TestBed.resetTestingModule();
    online = false;
    boot();
    service.start();
    await Promise.all([service.company.inFlight, service.faqs.inFlight]);
    expect(service.company.data()?.mision).toBe(company.mision);
    expect(service.faqs.data()?.[0].respuesta).toBe(faq.respuesta);
    expect(service.company.error()).toBeNull();
    expect(service.faqs.error()).toBeNull();
    http.expectNone(() => true);
  });

  it('indica que falta la primera descarga si no hay red ni copia', async () => {
    online = false;
    service.start();
    await Promise.all([service.company.inFlight, service.faqs.inFlight]);
    expect(service.company.error()).toBe('offline-empty');
    expect(service.faqs.error()).toBe('offline-empty');
    expect(service.company.loading()).toBeFalse();
    http.expectNone(() => true);
  });

  it('muestra inmediatamente la copia y la conserva si el servidor falla', async () => {
    saved.set(service.company.url, new Response(JSON.stringify({ schema: 1, savedAt: 1, data: company })));
    const pending = service.refreshCompany();
    await waitForCopy();
    expect(service.company.data()?.nombre).toBe('Sport Center');
    http.expectOne(service.company.url).flush('Error', { status: 500, statusText: 'Error' });
    await pending;
    expect(service.company.data()?.mision).toBe(company.mision);
    expect(service.company.error()).toBeNull();
    expect((await saved.get(service.company.url)!.json()).savedAt).toBe(1);
  });

  it('no reemplaza una copia válida por una respuesta inválida', async () => {
    saved.set(service.company.url, new Response(JSON.stringify({ schema: 1, savedAt: 1, data: company })));
    const pending = service.refreshCompany();
    await waitForCopy();
    http.expectOne(service.company.url).flush({ error: 'Error interno' });
    await pending;
    expect(service.company.data()?.nombre).toBe('Sport Center');
    expect((await saved.get(service.company.url)!.json()).savedAt).toBe(1);
  });

  it('ignora una copia corrupta y distingue un listado vacío válido', async () => {
    online = false;
    saved.set(service.company.url, new Response('contenido roto'));
    saved.set(service.faqs.url, new Response(JSON.stringify({ schema: 1, savedAt: 1, data: [] })));
    service.start();
    await Promise.all([service.company.inFlight, service.faqs.inFlight]);
    expect(service.company.error()).toBe('offline-empty');
    expect(service.faqs.data()).toEqual([]);
    expect(service.faqs.error()).toBeNull();
  });

  it('descarga automáticamente al recuperar la conexión', async () => {
    online = false;
    service.start();
    await Promise.all([service.company.inFlight, service.faqs.inFlight]);
    online = true;
    window.dispatchEvent(new Event('online'));
    await settle();
    http.expectOne(service.company.url).flush(company);
    http.expectOne(service.faqs.url).flush([faq]);
    await Promise.all([service.company.inFlight, service.faqs.inFlight]);
    expect(service.company.error()).toBeNull();
    expect(service.faqs.data()?.length).toBe(1);
  });

  it('reintenta aunque la conexión regrese mientras se cancelan las peticiones', async () => {
    service.start();
    await settle();
    const info = http.expectOne(service.company.url);
    const questions = http.expectOne(service.faqs.url);
    online = false;
    window.dispatchEvent(new Event('offline'));
    online = true;
    window.dispatchEvent(new Event('online'));
    await settle();
    expect(info.cancelled).toBeTrue();
    expect(questions.cancelled).toBeTrue();
    http.expectOne(service.company.url).flush(company);
    http.expectOne(service.faqs.url).flush([faq]);
    await Promise.all([service.company.inFlight, service.faqs.inFlight]);
    expect(service.company.data()?.nombre).toBe('Sport Center');
  });

  it('funciona en línea si el navegador bloquea el almacenamiento', async () => {
    openCache.and.rejectWith(new Error('Almacenamiento bloqueado'));
    spyOn(console, 'warn');
    const pending = service.refreshCompany();
    await settle();
    http.expectOne(service.company.url).flush(company);
    await pending;
    expect(service.company.data()?.nombre).toBe('Sport Center');
    expect(service.company.error()).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });

  it('distingue un error del servidor de un fallo de conexión cuando no hay copia', async () => {
    const failedServer = service.refreshCompany();
    await settle();
    http.expectOne(service.company.url).flush('Error', { status: 500, statusText: 'Error' });
    await failedServer;
    expect(service.company.error()).toBe('load-failed');
    const failedNetwork = service.refreshCompany();
    await settle();
    http.expectOne(service.company.url).error(new ProgressEvent('error'));
    await failedNetwork;
    expect(service.company.error()).toBe('offline-empty');
  });
});
