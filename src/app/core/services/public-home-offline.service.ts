import { DestroyRef, Injectable, computed, inject, isDevMode, signal } from '@angular/core';
import { HttpBackend, HttpClient, HttpErrorResponse, HttpEvent, HttpRequest, HttpResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, defer, firstValueFrom, takeUntil, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { catalogMedia } from './public-catalog-media';
import { PublicImageOfflineService } from './public-image-offline.service';

const PATHS = [
  '/products/get-all-products', '/products/get-all-marcas', '/products/menu/sports',
  '/company/banner', '/products/shipping-methods',
] as const;

/** Copias de cinco GET públicos. Las sesiones, pedidos y operaciones de escritura quedan fuera. */
@Injectable({ providedIn: 'root' })
export class PublicHomeOfflineService {
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly destroyRef = inject(DestroyRef);
  private readonly images = inject(PublicImageOfflineService);
  private readonly api = environment.apiUrl.replace(/\/$/, '');
  private readonly cacheName = 'sport-center-public-home-v1';
  private readonly requests = new Map<string, Promise<HttpResponse<unknown>>>();
  private readonly copies = new Map<string, any[]>();
  private readonly persisted = new Set<string>();
  private readonly offlineRequests = new Subject<void>();
  readonly dataUpdated = new Subject<string>();
  private started = false;
  private destroyed = false;
  private warming = false;
  private warmAgain = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private verified: Record<string, number> = {};
  private readonly mediaRecordUrl = new URL('pwa-media-status', document.baseURI).href;

  readonly online = signal(navigator.onLine);
  readonly preparing = signal(false);
  readonly dataReady = signal(false);
  readonly homeReady = signal(false);
  readonly savedImages = signal(0);
  readonly totalImages = signal(0);
  readonly failedImages = signal(0);
  readonly storageProblem = signal(false);
  readonly statusMessage = computed(() => {
    if (!this.online()) return this.homeReady()
      ? 'Sin conexión. Estás viendo la última información guardada del inicio.'
      : 'Sin conexión. La copia del inicio aún no está completa; se preparará automáticamente cuando vuelva internet.';
    if (this.storageProblem()) return 'No se pudo completar el guardado sin conexión en este navegador.';
    if (this.preparing()) return `${this.homeReady() ? 'Inicio disponible sin conexión. ' : ''}Guardando imágenes: ${this.savedImages()} de ${this.totalImages()}.`;
    if (this.failedImages()) return `Quedan ${this.failedImages()} imágenes por guardar. Se volverá a intentar automáticamente.`;
    if (this.homeReady()) return `Inicio y ${this.savedImages()} imágenes disponibles sin conexión.`;
    return 'Preparando el inicio para usarlo sin conexión…';
  });

  private readonly onOffline = () => {
    this.online.set(false);
    this.offlineRequests.next();
  };
  private readonly onOnline = () => {
    this.online.set(true);
    // La señal online puede llegar antes de que termine la cancelación offline.
    void Promise.allSettled([...this.requests.values()]).then(() => {
      if (!this.destroyed && navigator.onLine) void this.refresh();
    });
  };

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      if (this.timer) clearTimeout(this.timer);
      window.removeEventListener('offline', this.onOffline);
      window.removeEventListener('online', this.onOnline);
      this.offlineRequests.complete();
      this.dataUpdated.complete();
    });
  }

  handles(req: HttpRequest<unknown>): boolean {
    if (req.method !== 'GET' || req.responseType !== 'json') return false;
    try {
      const url = new URL(req.urlWithParams, document.baseURI);
      return !url.search && PATHS.some(path => url.href === this.api + path);
    } catch { return false; }
  }

  intercept(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    return defer(() => this.load(req.urlWithParams));
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    window.addEventListener('offline', this.onOffline);
    window.addEventListener('online', this.onOnline);
    void this.refresh();
  }

  private async refresh(): Promise<void> {
    await Promise.allSettled(PATHS.map(path => this.load(this.api + path)));
    if (!this.destroyed && !isDevMode()) await this.prepareImages();
    if (!this.destroyed && navigator.onLine && !this.dataReady()) this.retryLater();
  }

  private load(url: string): Promise<HttpResponse<unknown>> {
    const current = this.requests.get(url);
    if (current) return current;
    const pending = this.loadOnce(url).finally(() => this.requests.delete(url));
    this.requests.set(url, pending);
    return pending;
  }

  private async loadOnce(url: string): Promise<HttpResponse<unknown>> {
    // La última respuesta válida también protege una pestaña abierta si falla CacheStorage.
    let stored: any[] | null = this.copies.get(url) ?? null;
    try {
      const response = await (await caches.open(this.cacheName)).match(url);
      const record = response ? await response.json() : null;
      if (record?.schema === 1 && this.valid(url, record.data)) {
        stored = record.data;
        this.copies.set(url, stored!);
        this.persisted.add(url);
      }
    } catch { /* El sitio sigue funcionando aunque el almacenamiento esté deshabilitado. */ }
    if (!navigator.onLine) {
      if (stored) return new HttpResponse({ body: stored, status: 200, url });
      throw new HttpErrorResponse({ status: 0, statusText: 'Sin conexión y sin copia pública', url });
    }
    try {
      const response = await firstValueFrom(this.http.get<unknown>(url, { observe: 'response', withCredentials: false })
        .pipe(timeout(stored ? 3_000 : 60_000), takeUntil(this.offlineRequests), takeUntilDestroyed(this.destroyRef)));
      if (!this.valid(url, response.body)) throw new Error('Contenido público inválido');
      this.copies.set(url, response.body as any[]);
      try {
        await (await caches.open(this.cacheName)).put(url, new Response(JSON.stringify({
          schema: 1, savedAt: Date.now(), data: response.body,
        }), { headers: { 'Content-Type': 'application/json' } }));
        this.persisted.add(url);
      } catch { this.storageProblem.set(true); }
      this.dataReady.set(PATHS.every(path => this.persisted.has(this.api + path)));
      this.dataUpdated.next(url);
      return response;
    } catch (error) {
      if (stored) return new HttpResponse({ body: stored, status: 200, url });
      throw error;
    }
  }

  private valid(url: string, value: unknown): value is any[] {
    if (!Array.isArray(value)) return false;
    return value.every(item => item && typeof item === 'object' && (
      url.endsWith('/get-all-products') ? Number.isInteger(item.id_producto) && typeof item.producto === 'string' && Array.isArray(item.variantes) :
      url.endsWith('/get-all-marcas') || url.endsWith('/sports') ? typeof item.nombre === 'string' :
      url.endsWith('/banner') ? typeof item.url_imagen === 'string' && typeof item.activo === 'boolean' : true
    ));
  }

  private async prepareImages(): Promise<void> {
    if (this.warming) { this.warmAgain = true; return; }
    this.dataReady.set(PATHS.every(path => this.persisted.has(this.api + path)));
    if (!this.dataReady() || this.destroyed) return;
    this.warming = true;
    this.preparing.set(true);
    try {
      const get = (path: typeof PATHS[number]) => this.copies.get(this.api + path) || [];
      const media = catalogMedia(get(PATHS[0]), get(PATHS[1]), get(PATHS[2]), get(PATHS[3]));
      this.totalImages.set(media.home.length);
      this.failedImages.set(0);
      const record = await (await caches.open(this.cacheName)).match(this.mediaRecordUrl);
      // Un reintento no descarta el historial guardado por ejecuciones anteriores.
      if (record) this.verified = { ...this.verified, ...(await record.json()).verified };
      const saved = new Set<string>();
      for (const url of media.home) {
        if (await this.images.has(url) || this.verified[url] && await caches.match(url, { ignoreVary: true })) saved.add(url);
      }
      this.savedImages.set(saved.size);
      // El arranque básico se descarga primero; las fotos no forman parte de su instalación.
      const controlled = navigator.onLine ? await this.waitForController() : !!navigator.serviceWorker?.controller;
      this.images.trackCatalog(media.all);
      const checkHome = async () => {
        const shell = await caches.match(new URL('index.html', document.baseURI).href, { ignoreVary: true });
        this.homeReady.set(controlled && !!shell && media.home.every(url => saved.has(url)));
      };
      const prepare = async (url: string, allowNetwork: boolean) => {
        if (this.destroyed) return;
        const ok = await this.images.retain(url, allowNetwork, controlled, !!this.verified[url]);
        if (this.images.storageProblem()) this.storageProblem.set(true);
        if (ok) {
          if (media.home.includes(url)) saved.add(url);
          this.verified[url] ||= Date.now();
        } else {
          // Si migrar o descargar falla, conserva una copia anterior que aún exista.
          if (!this.verified[url] || !await caches.match(url, { ignoreVary: true })) saved.delete(url);
          if (media.home.includes(url)) this.failedImages.update(value => value + 1);
        }
        this.savedImages.set(saved.size);
      };
      const batch = async (urls: string[], allowNetwork: boolean) => {
        let index = 0;
        await Promise.all(Array.from({ length: Math.min(3, urls.length) }, async () => {
          while (index < urls.length && !this.destroyed) await prepare(urls[index++], allowNetwork);
        }));
      };
      await batch(media.home, navigator.onLine);
      await checkHome();
      // Migra descargas antiguas que ya existan; no descarga galerías sin abrirlas.
      for (const url of Object.keys(this.verified).filter(url => !media.home.includes(url))) {
        if (!await this.images.has(url) && await caches.match(url, { ignoreVary: true })) await prepare(url, false);
      }
      await checkHome();
      await (await caches.open(this.cacheName)).put(this.mediaRecordUrl,
        new Response(JSON.stringify({ verified: this.verified, pending: media.home.filter(url => !saved.has(url)) }), { headers: { 'Content-Type': 'application/json' } }));
    } catch { this.storageProblem.set(true); }
    finally {
      this.warming = false;
      this.preparing.set(false);
      if (!this.destroyed && navigator.onLine && !this.storageProblem() && (this.failedImages() || this.warmAgain || !this.homeReady())) {
        this.warmAgain = false;
        this.retryLater();
      }
    }
  }

  private retryLater(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; void this.refresh(); }, 60_000);
  }

  private async waitForController(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) return false;
    if (navigator.serviceWorker.controller) return true;
    return new Promise(resolve => {
      const finish = () => {
        clearTimeout(timer);
        navigator.serviceWorker.removeEventListener('controllerchange', finish);
        resolve(!!navigator.serviceWorker.controller);
      };
      const timer = setTimeout(finish, 30_000);
      navigator.serviceWorker.addEventListener('controllerchange', finish);
    });
  }

}
