import { TestBed } from '@angular/core/testing';
import { PublicImageOfflineService } from './public-image-offline.service';
import { PwaStorageService } from './pwa-storage.service';

describe('Copias duraderas de imágenes públicas', () => {
  const cacheName = 'sport-center-public-images-v1';
  const url = 'https://res.cloudinary.com/catalogo/producto.jpg';
  let service: PublicImageOfflineService;
  let saved: Map<string, Response>;
  let legacy: Map<string, Response>;
  let storage: jasmine.SpyObj<PwaStorageService>;
  let network: jasmine.Spy;
  let decodable: boolean;
  let sources: string[];
  let deletes: string[];
  let failPut: (key: string) => boolean;
  let staged: string[];
  let scans: number;

  const image = (body = 'imagen válida') => new Response(body, { headers: { 'Content-Type': 'image/jpeg' } });
  const opaque = (body = 'imagen opaca') => ({
    type: 'opaque', ok: false, status: 0, headers: new Headers(),
    marker: body, clone: () => opaque(body),
  }) as unknown as Response;
  const boot = () => {
    TestBed.configureTestingModule({ providers: [{ provide: PwaStorageService, useValue: storage }] });
    service = TestBed.inject(PublicImageOfflineService);
  };

  beforeEach(() => {
    saved = new Map(); legacy = new Map(); sources = []; deletes = []; staged = []; scans = 0;
    decodable = true;
    failPut = () => false;
    storage = jasmine.createSpyObj<PwaStorageService>('PwaStorageService', ['requestPersistence', 'hasCapacity']);
    storage.requestPersistence.and.resolveTo(false);
    storage.hasCapacity.and.resolveTo(true);
    spyOn(caches, 'open').and.callFake(async name => {
      expect(name).toBe(cacheName);
      return {
        match: async (key: string) => saved.get(key)?.clone(),
        put: async (key: string, value: Response) => {
          if (failPut(key)) throw new DOMException('Cuota agotada', 'QuotaExceededError');
          saved.set(key, value.clone());
        },
        delete: async (request: string | Request) => {
          const key = typeof request === 'string' ? request : request.url;
          deletes.push(key); return saved.delete(key);
        },
        keys: async () => { scans++; return [...saved.keys()].map(key => new Request(key)); },
      } as unknown as Cache;
    });
    spyOn(caches, 'match').and.callFake(async request => {
      const key = typeof request === 'string' ? request : (request as Request).url;
      return legacy.get(key)?.clone();
    });
    network = spyOn(window, 'fetch').and.resolveTo(image());
    spyOn(URL, 'createObjectURL').and.returnValue('blob:sport-center-test');
    spyOn(URL, 'revokeObjectURL');
    spyOn(window, 'Image').and.callFake(function () {
      const candidate = {
        naturalWidth: 0, onload: null as (() => void) | null, onerror: null as (() => void) | null,
        set src(value: string) {
          sources.push(value);
          if (value.includes('/pwa-image-validation/')) {
            const response = saved.get(value) as unknown as { marker: string } | undefined;
            if (response) staged.push(response.marker);
          }
          queueMicrotask(() => {
            candidate.naturalWidth = decodable ? 64 : 0;
            candidate.onload?.();
          });
        },
      };
      return candidate as unknown as HTMLImageElement;
    });
    boot();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('conserva una descarga después de crear otra instancia y no vuelve a pedirla', async () => {
    expect(await service.retain(url, true, true, false)).toBeTrue();
    TestBed.resetTestingModule(); boot();
    network.calls.reset();
    expect(await service.has(url)).toBeTrue();
    expect(await service.retain(url, false, false, false)).toBeTrue();
    expect(network).not.toHaveBeenCalled();
    expect(await saved.get(url)!.text()).toBe('imagen válida');
  });

  it('no reemplaza una copia por errores y no aplica caducidad de 365 días', async () => {
    saved.set(url, new Response('descarga anterior', { headers: {
      'Content-Type': 'image/jpeg', Date: 'Sat, 01 Jan 2000 00:00:00 GMT', 'Cache-Control': 'max-age=0',
    } }));
    network.and.rejectWith(new TypeError('Sin red'));
    expect(await service.retain(url, true, true, true)).toBeTrue();
    expect(await saved.get(url)!.text()).toBe('descarga anterior');
    expect(network).not.toHaveBeenCalled();
    expect(deletes).toEqual([]);
  });

  it('has consulta solamente su caché y excluye respuestas HTML', async () => {
    legacy.set(url, image());
    expect(await service.has(url)).toBeFalse();
    saved.set(url, new Response('<html>otra página</html>', { headers: { 'Content-Type': 'text/html' } }));
    expect(await service.has(url)).toBeFalse();
    expect(caches.match).not.toHaveBeenCalled();
  });

  it('migra una copia legible verificada sin red, sin consumir el origen', async () => {
    legacy.set(url, image('copia Angular'));
    expect(await service.retain(url, false, false, true)).toBeTrue();
    expect(await saved.get(url)!.text()).toBe('copia Angular');
    expect(await legacy.get(url)!.text()).toBe('copia Angular');
    expect(network).not.toHaveBeenCalled();
    expect(sources).toEqual(['blob:sport-center-test']);
  });

  it('no migra recursos de otras cachés sin el registro previo de verificación', async () => {
    legacy.set(url, image());
    expect(await service.retain(url, false, true, false)).toBeFalse();
    expect(caches.match).not.toHaveBeenCalled();
    expect(saved.size).toBe(0);
  });

  it('una imagen legible que no se puede decodificar no se declara guardada', async () => {
    decodable = false;
    expect(await service.retain(url, true, true, false)).toBeFalse();
    expect(saved.size).toBe(0);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:sport-center-test');
  });

  it('valida la respuesta opaca exacta mediante una clave temporal y luego la elimina', async () => {
    network.and.callFake(async (_url: string, options: RequestInit) => {
      expect(options.credentials).toBe('omit');
      expect(options.cache).toBe('reload');
      if (options.mode === 'cors') throw new TypeError('Sin CORS');
      return opaque('candidata exacta');
    });
    expect(await service.retain(url, true, true, false)).toBeTrue();
    expect(staged).toEqual(['candidata exacta']);
    expect(sources.length).toBe(1);
    expect(new URL(sources[0]).pathname).toMatch(/^\/pwa-image-validation\/.+/);
    expect(Number(new URL(sources[0]).searchParams.get('createdAt'))).toBeGreaterThan(0);
    expect(sources).not.toContain(url);
    expect(saved.size).toBe(1);
    expect(saved.get(url)!.type).toBe('opaque');
    expect(deletes).toEqual(sources);
    expect(storage.hasCapacity).toHaveBeenCalledWith(2 * 7 * 1024 * 1024);
  });

  it('una respuesta opaca sin controlador no se almacena ni se valida por su URL original', async () => {
    network.and.resolveTo(opaque());
    expect(await service.retain(url, true, false, false)).toBeFalse();
    expect(saved.size).toBe(0);
    expect(sources).toEqual([]);
  });

  it('migra una copia opaca verificada offline mediante la misma validación temporal', async () => {
    legacy.set(url, opaque('antigua verificada'));
    expect(await service.retain(url, false, true, true)).toBeTrue();
    expect(staged).toEqual(['antigua verificada']);
    expect(network).not.toHaveBeenCalled();
    expect(saved.get(url)!.type).toBe('opaque');
    expect(saved.size).toBe(1);
  });

  it('rechaza una opaca no decodificable y limpia exclusivamente la entrada temporal', async () => {
    const other = url + '?otra=1';
    saved.set(other, image('conservar'));
    decodable = false;
    network.and.resolveTo(opaque('error remoto'));
    expect(await service.retain(url, true, true, false)).toBeFalse();
    expect(saved.has(url)).toBeFalse();
    expect(await saved.get(other)!.text()).toBe('conservar');
    expect(saved.size).toBe(1);
    expect(deletes.every(key => key.includes('/pwa-image-validation/'))).toBeTrue();
  });

  it('una cuota insuficiente no borra otras descargas', async () => {
    const other = url + '?otra=1';
    saved.set(other, image('conservar'));
    storage.hasCapacity.and.resolveTo(false);
    expect(await service.retain(url, true, true, false)).toBeFalse();
    expect(service.storageProblem()).toBeTrue();
    expect(saved.size).toBe(1);
    expect(await saved.get(other)!.text()).toBe('conservar');
    expect(deletes).toEqual([]);
  });

  it('limpia la candidata temporal si falla la escritura final por cuota', async () => {
    const other = url + '?otra=1';
    saved.set(other, image('conservar'));
    failPut = key => key === url;
    network.and.resolveTo(opaque());
    expect(await service.retain(url, true, true, false)).toBeFalse();
    expect(service.storageProblem()).toBeTrue();
    expect(saved.size).toBe(1);
    expect(await saved.get(other)!.text()).toBe('conservar');
    expect(deletes.length).toBe(2);
    expect(deletes.every(key => key.includes('/pwa-image-validation/'))).toBeTrue();
  });

  it('coalesce la misma descarga y funciona aunque el navegador deniegue persistencia', async () => {
    const first = service.retain(url, true, true, false);
    expect(service.retain(url, true, true, false)).toBe(first);
    expect(await first).toBeTrue();
    expect(storage.requestPersistence).toHaveBeenCalledTimes(1);
    expect(network).toHaveBeenCalledTimes(1);
    expect(service.storageProblem()).toBeFalse();
  });

  it('serializa estimación y validación opaca sin impedir las descargas paralelas', async () => {
    const other = url + '?segunda=1';
    const validations: { url: string; finish: (valid: boolean) => void }[] = [];
    spyOn<any>(service, 'decodeImage').and.callFake((key: string) => new Promise<boolean>(resolve => {
      validations.push({ url: key, finish: resolve });
    }));
    storage.hasCapacity.and.callFake(async () => {
      // La candidata anterior debe haberse eliminado antes de estimar la siguiente.
      expect([...saved.keys()].filter(key => key.includes('/pwa-image-validation/'))).toEqual([]);
      return true;
    });
    network.and.callFake(async (key: string, options: RequestInit) => {
      if (options.mode === 'cors') throw new TypeError('Sin CORS');
      return opaque(key);
    });
    const waitFor = async (condition: () => boolean) => {
      const deadline = Date.now() + 2_000;
      while (!condition()) {
        if (Date.now() >= deadline) throw new Error('No terminó la operación de prueba');
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    };
    const first = service.retain(url, true, true, false);
    const second = service.retain(other, true, true, false);
    await waitFor(() => validations.length === 1 && network.calls.count() === 4);
    expect(storage.hasCapacity).toHaveBeenCalledTimes(1);
    expect([...saved.keys()]).toEqual([validations[0].url]);
    validations[0].finish(true);
    expect(await first).toBeTrue();
    await waitFor(() => validations.length === 2);
    expect(storage.hasCapacity).toHaveBeenCalledTimes(2);
    expect(saved.has(url)).toBeTrue();
    expect(saved.has(validations[0].url)).toBeFalse();
    expect([...saved.keys()].filter(key => key.includes('/pwa-image-validation/'))).toEqual([validations[1].url]);
    validations[1].finish(true);
    expect(await second).toBeTrue();
    expect([...saved.keys()]).toEqual([url, other]);
  });

  it('continúa la cola de escrituras después de un error inesperado', async () => {
    const other = url + '?segunda=1';
    const original = (service as any).saveOnce.bind(service);
    spyOn<any>(service, 'saveOnce').and.callFake(async (...args: unknown[]) => {
      if (args[1] === url) throw new Error('Operación interrumpida');
      return original(...args);
    });
    const first = service.retain(url, true, true, false);
    const second = service.retain(other, true, true, false);
    expect(await first).toBeFalse();
    expect(await second).toBeTrue();
    expect(saved.has(url)).toBeFalse();
    expect(saved.has(other)).toBeTrue();
  });

  it('limpia sólo alias propios con fecha válida y más de una hora, conservando originales y alias recientes', async () => {
    const temporary = (name: string, createdAt?: string) => {
      const key = new URL(`pwa-image-validation/${name}`, document.baseURI);
      if (createdAt !== undefined) key.searchParams.set('createdAt', createdAt);
      return key.href;
    };
    const now = Date.now();
    const abandoned = temporary('abandonada', String(now - 3_600_001));
    const recent = temporary('pendiente', String(now - 60_000));
    const missingDate = temporary('sin-fecha');
    const invalidDate = temporary('invalida', 'Infinity');
    const future = temporary('futura', String(now + 3_600_000));
    const otherOrigin = new URL(abandoned); otherOrigin.hostname = 'res.cloudinary.com';
    const originalWithDate = url + `?createdAt=${now - 7_200_000}`;
    const keep = [url, recent, missingDate, invalidDate, future, otherOrigin.href, originalWithDate];
    saved.set(abandoned, opaque('alias interrumpido'));
    for (const key of keep) saved.set(key, image('conservar'));
    expect(await service.retain(url, false, false, false)).toBeTrue();
    expect(saved.has(abandoned)).toBeFalse();
    for (const key of keep) expect(saved.has(key)).withContext(key).toBeTrue();
    expect(deletes).toEqual([abandoned]);
    expect(network).not.toHaveBeenCalled();
  });

  it('comparte una sola limpieza por instancia y no la ejecuta al consultar has', async () => {
    const other = url + '?segunda=1';
    saved.set(url, image()); saved.set(other, image());
    expect(await service.has(url)).toBeTrue();
    expect(scans).toBe(0);
    expect(await Promise.all([
      service.retain(url, false, false, false), service.retain(other, false, false, false),
    ])).toEqual([true, true]);
    expect(scans).toBe(1);
    const addedLater = new URL('pwa-image-validation/otra-interrumpida', document.baseURI);
    addedLater.searchParams.set('createdAt', String(Date.now() - 7_200_000));
    saved.set(addedLater.href, opaque());
    expect(await service.retain(url, false, false, false)).toBeTrue();
    expect(scans).toBe(1);
    expect(saved.has(addedLater.href)).toBeTrue();
    expect(deletes).toEqual([]);
  });

  it('no guarda páginas ni errores HTTP aunque respondan a una URL de imagen', async () => {
    network.and.resolveTo(new Response('no es imagen', { headers: { 'Content-Type': 'text/html' } }));
    expect(await service.retain(url, true, true, false)).toBeFalse();
    network.and.resolveTo(new Response('no existe', { status: 404, headers: { 'Content-Type': 'image/jpeg' } }));
    expect(await service.retain(url, true, true, false)).toBeFalse();
    expect(saved.size).toBe(0);
    expect(sources).toEqual([]);
  });
});
