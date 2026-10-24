import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { PwaStorageService } from './pwa-storage.service';

const CACHE_NAME = 'sport-center-public-images-v1';
// Chrome añade padding a las respuestas opacas; la validación utiliza dos entradas brevemente.
const OPAQUE_COPY_BYTES = 2 * 7 * 1024 * 1024;

/** Copias verificadas de imágenes públicas, independientes de la edad y el LRU de Angular. */
@Injectable({ providedIn: 'root' })
export class PublicImageOfflineService {
  private readonly storage = inject(PwaStorageService);
  private readonly pending = new Map<string, Promise<boolean>>();
  private saving: Promise<void> = Promise.resolve();
  private cleanupAttempt: Promise<void> | null = null;
  private catalog = new Set<string>();
  private observing = false;
  private budgetBlocked = false;
  readonly storageProblem = signal(false);

  private readonly imageLoaded = (event: Event) => {
    if (event.target instanceof HTMLImageElement) this.retainDisplayed(event.target);
  };

  constructor() {
    inject(DestroyRef).onDestroy(() => document.removeEventListener('load', this.imageLoaded, true));
  }

  trackCatalog(urls: readonly string[]): void {
    this.catalog = new Set(urls.map(url => new URL(url, document.baseURI).href));
    if (!this.observing) {
      this.observing = true;
      document.addEventListener('load', this.imageLoaded, true);
    }
    for (const image of Array.from(document.images)) this.retainDisplayed(image);
  }

  private retainDisplayed(image: HTMLImageElement): void {
    const url = image.currentSrc || image.src;
    if (!image.complete || image.naturalWidth < 1 || !this.catalog.has(url)) return;
    void this.retain(url, navigator.onLine, !!navigator.serviceWorker?.controller, false);
  }

  async has(url: string): Promise<boolean> {
    try {
      return this.usable(await (await caches.open(CACHE_NAME)).match(url));
    } catch { return false; }
  }

  retain(url: string, allowNetwork: boolean, controlled: boolean, knownVerified: boolean): Promise<boolean> {
    const existing = this.pending.get(url);
    if (existing) return existing;
    const attempt = this.retainOnce(url, allowNetwork, controlled, knownVerified)
      .finally(() => this.pending.delete(url));
    this.pending.set(url, attempt);
    return attempt;
  }

  private async retainOnce(url: string, allowNetwork: boolean, controlled: boolean, knownVerified: boolean): Promise<boolean> {
    try {
      const parsed = new URL(url, document.baseURI);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return false;
      url = parsed.href;
      await this.cleanupTemporary();
      const cache = await caches.open(CACHE_NAME);
      // Una copia ya verificada no se reemplaza por una descarga ni desaparece por antigüedad.
      if (this.usable(await cache.match(url))) return true;
      await this.storage.requestPersistence();
      if (knownVerified) {
        const previous = await caches.match(url, { ignoreVary: true });
        if (previous && await this.save(cache, url, previous, controlled)) return true;
      }
      if (!allowNetwork || this.budgetBlocked) return false;
      if (!await this.storage.hasCapacity(0)) {
        this.budgetBlocked = true;
        this.storageProblem.set(true);
        return false;
      }
      for (const mode of ['cors', 'no-cors'] as const) {
        try {
          const response = await fetch(url, {
            mode, credentials: 'omit', cache: 'reload', signal: AbortSignal.timeout(25_000),
          });
          if (await this.save(cache, url, response, controlled)) return true;
          if (this.budgetBlocked) break;
        } catch { /* Un proveedor sin CORS puede admitir una imagen normal. */ }
      }
      return false;
    } catch {
      this.storageProblem.set(true);
      return false;
    }
  }

  private usable(response: Response | undefined): boolean {
    return !!response && (response.type === 'opaque' ||
      response.ok && !!response.headers.get('Content-Type')?.toLowerCase().startsWith('image/'));
  }

  private cleanupTemporary(): Promise<void> {
    if (this.cleanupAttempt) return this.cleanupAttempt;
    const attempt = this.saving.then(async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        const prefix = new URL('pwa-image-validation/', document.baseURI);
        const now = Date.now();
        for (const request of await cache.keys()) {
          const url = new URL(request.url);
          const createdAt = Number(url.searchParams.get('createdAt'));
          // Sólo candidatas abandonadas: nunca imágenes originales ni validaciones recientes.
          if (url.origin === prefix.origin && url.pathname.startsWith(prefix.pathname) &&
              Number.isFinite(createdAt) && createdAt > 0 && now - createdAt > 3_600_000) {
            await cache.delete(request);
          }
        }
      } catch { /* La limpieza auxiliar no bloquea lecturas ni descargas. */ }
    });
    this.saving = attempt.then(() => undefined, () => undefined);
    this.cleanupAttempt = attempt.catch(() => undefined);
    return this.cleanupAttempt;
  }

  private save(cache: Cache, url: string, response: Response, controlled: boolean): Promise<boolean> {
    // La estimación y las dos escrituras opacas comparten una sección crítica.
    // Las descargas siguen en paralelo, pero no reservan padding simultáneamente.
    const attempt = this.saving.then(() => this.saveOnce(cache, url, response, controlled));
    this.saving = attempt.then(() => undefined, () => undefined);
    return attempt;
  }

  private async saveOnce(cache: Cache, url: string, response: Response, controlled: boolean): Promise<boolean> {
    if (this.budgetBlocked) return false;
    if (!this.usable(response)) return false;
    let temporary: string | null = null;
    let objectUrl: string | null = null;
    try {
      if (response.type === 'opaque') {
        if (!controlled) return false;
        if (!await this.storage.hasCapacity(OPAQUE_COPY_BYTES)) {
          this.budgetBlocked = true;
          this.storageProblem.set(true);
          return false;
        }
        const candidateUrl = new URL(`pwa-image-validation/${crypto.randomUUID()}`, document.baseURI);
        candidateUrl.searchParams.set('createdAt', String(Date.now()));
        temporary = candidateUrl.href;
        await cache.put(temporary, response.clone());
        // El worker entrega exactamente la candidata. Image(url) podría leer otra copia en memoria.
        if (!await this.decodeImage(temporary)) return false;
      } else {
        const blob = await response.clone().blob();
        if (!await this.storage.hasCapacity(blob.size)) {
          this.budgetBlocked = true;
          this.storageProblem.set(true);
          return false;
        }
        objectUrl = URL.createObjectURL(blob);
        if (!await this.decodeImage(objectUrl)) return false;
      }
      await cache.put(url, response.clone());
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') this.budgetBlocked = true;
      this.storageProblem.set(true);
      return false;
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (temporary) {
        try { await cache.delete(temporary); }
        catch { this.storageProblem.set(true); }
      }
    }
  }

  private decodeImage(url: string): Promise<boolean> {
    return new Promise(resolve => {
      const image = new Image();
      const finish = (valid: boolean) => {
        clearTimeout(timer);
        image.onload = image.onerror = null;
        resolve(valid);
      };
      const timer = setTimeout(() => finish(false), 25_000);
      image.onload = () => finish(image.naturalWidth > 0);
      image.onerror = () => finish(false);
      image.src = url;
    });
  }
}
