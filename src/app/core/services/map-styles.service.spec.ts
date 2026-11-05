import { DOCUMENT } from '@angular/common';
import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { getVersion } from 'maplibre-gl';
import { MAP_STYLES_ASSET, MapStylesDocument, MapStylesService } from './map-styles.service';

describe('MapStylesService: CSS local diferido', () => {
  let service: MapStylesService;
  let head: HTMLHeadElement;

  beforeEach(() => {
    head = document.createElement('head');
    const page: MapStylesDocument = {
      baseURI: 'https://sport-center.test/tienda/', head,
      createElement: document.createElement.bind(document),
    };
    TestBed.configureTestingModule({ providers: [{ provide: DOCUMENT, useValue: page }] });
    service = TestBed.inject(MapStylesService);
  });

  const link = () => head.querySelector<HTMLLinkElement>('link')!;

  it('no solicita CSS al inyectar y resuelve el asset versionado desde baseURI', async () => {
    expect(head.children.length).toBe(0);
    expect(MAP_STYLES_ASSET).toBe(`assets/maplibre/${getVersion()}/maplibre-gl.css`);
    const pending = service.ensureLoaded();
    await Promise.resolve();
    expect(link().href).toBe('https://sport-center.test/tienda/' + MAP_STYLES_ASSET);
    expect(link().rel).toBe('stylesheet');
    // El head de prueba está desconectado: no se solicita ningún recurso por red.
    expect(link().isConnected).toBeFalse();
    link().dispatchEvent(new Event('load'));
    await pending;
  });

  it('comparte la espera concurrente y conserva la carga aprobada sin duplicar enlaces', async () => {
    const first = service.ensureLoaded(), second = service.ensureLoaded();
    expect(first).toBe(second);
    await Promise.resolve();
    expect(head.children.length).toBe(1);
    link().dispatchEvent(new Event('load'));
    await first;
    expect(service.ensureLoaded()).toBe(first);
    expect(head.children.length).toBe(1);
    expect(link().dataset['maplibreStyles']).toBe('loaded');
  });

  it('coordina también instancias que comparten el mismo documento', async () => {
    const other = TestBed.runInInjectionContext(() => new MapStylesService());
    const first = service.ensureLoaded(), second = other.ensureLoaded();
    await Promise.resolve();
    expect(head.children.length).toBe(1);
    link().dispatchEvent(new Event('load'));
    await Promise.all([first, second]);
    const third = TestBed.runInInjectionContext(() => new MapStylesService());
    await third.ensureLoaded();
    expect(head.children.length).toBe(1);
  });

  it('rechaza el error real del enlace, lo retira y permite un único reintento compartido', async () => {
    const failed = service.ensureLoaded();
    const outcome = failed.then(() => 'loaded', () => 'error');
    await Promise.resolve();
    const previous = link();
    previous.dispatchEvent(new Event('error'));
    expect(await outcome).toBe('error');
    expect(head.children.length).toBe(0);
    const retry = service.ensureLoaded();
    expect(service.ensureLoaded()).toBe(retry);
    expect(retry).not.toBe(failed);
    await Promise.resolve();
    expect(link()).not.toBe(previous);
    expect(head.children.length).toBe(1);
    link().dispatchEvent(new Event('load'));
    await retry;
  });

  it('libera una carga sin respuesta al vencer el límite y no deja el error cacheado', fakeAsync(() => {
    let rejected = false;
    const first = service.ensureLoaded();
    void first.catch(() => { rejected = true; });
    flushMicrotasks();
    tick(15_000);
    expect(rejected).toBeTrue();
    expect(head.children.length).toBe(0);
    const retry = service.ensureLoaded();
    expect(retry).not.toBe(first);
    flushMicrotasks();
    link().dispatchEvent(new Event('load'));
    flushMicrotasks();
  }));
});
