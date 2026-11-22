import { DestroyRef, Injectable, WritableSignal, inject, signal } from '@angular/core';
import { HttpBackend, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, firstValueFrom, takeUntil, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { CompanyFaq, CompanyInfo } from './company.service';

export type PublicCompanyInfo = Pick<CompanyInfo,
  'nombre' | 'mision' | 'vision' | 'valores' | 'email' | 'telefono' | 'sitio_web' |
  'horario_atencion' | 'facebook' | 'instagram' | 'twitter' | 'tiktok' | 'youtube'>;
export type PublicFaq = Pick<CompanyFaq,
  'id_faq' | 'pregunta' | 'respuesta' | 'seccion' | 'palabras_clave' | 'contador_util' | 'activo'>;
type LoadError = 'offline-empty' | 'load-failed' | null;

interface PublicDataset<T> {
  url: string;
  data: WritableSignal<T | null>;
  loading: WritableSignal<boolean>;
  error: WritableSignal<LoadError>;
  decode: (value: unknown) => T;
  inFlight: Promise<void> | null;
}

function dataset<T>(url: string, decode: (value: unknown) => T): PublicDataset<T> {
  return { url, decode, data: signal<T | null>(null), loading: signal(false),
    error: signal<LoadError>(null), inFlight: null };
}

function publicCompany(value: unknown): PublicCompanyInfo {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Información de empresa inválida');
  }
  const source = value as Record<string, unknown>;
  if (typeof source['nombre'] !== 'string' || !source['nombre'].trim()) {
    throw new Error('Nombre de empresa inválido');
  }
  const result: PublicCompanyInfo = { nombre: source['nombre'] };
  const fields = ['mision', 'vision', 'email', 'telefono', 'sitio_web', 'horario_atencion',
    'facebook', 'instagram', 'twitter', 'tiktok', 'youtube'] as const;
  for (const field of fields) {
    if (typeof source[field] === 'string' || source[field] === null) {
      result[field] = source[field] as string | null;
    }
  }
  if (Array.isArray(source['valores']) && source['valores'].every(v => typeof v === 'string')) {
    result.valores = [...source['valores']];
  }
  return result;
}

function publicFaqs(value: unknown): PublicFaq[] {
  if (!Array.isArray(value) || value.some(item => !item || typeof item !== 'object' ||
    !Number.isInteger(item.id_faq) || typeof item.pregunta !== 'string' ||
    typeof item.respuesta !== 'string' || typeof item.activo !== 'boolean')) {
    throw new Error('Preguntas frecuentes inválidas');
  }
  return value.filter(item => item.activo).map(item => ({
    id_faq: item.id_faq, pregunta: item.pregunta, respuesta: item.respuesta, activo: true,
    seccion: typeof item.seccion === 'string' ? item.seccion : null,
    palabras_clave: Array.isArray(item.palabras_clave)
      ? item.palabras_clave.filter((word: unknown) => typeof word === 'string') : [],
    contador_util: typeof item.contador_util === 'number' && Number.isFinite(item.contador_util)
      ? item.contador_util : 0,
  }));
}

/** Copia local exclusivamente de los dos contenidos públicos; no guarda sesiones ni peticiones privadas. */
@Injectable({ providedIn: 'root' })
export class PublicInfoOfflineService {
  private readonly destroyRef = inject(DestroyRef);
  // Estos GET públicos no necesitan tokens ni deben activar la renovación de la sesión.
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly cacheName = 'sport-center-public-info-v1';
  private readonly offlineRequests = new Subject<void>();
  private started = false;
  private destroyed = false;
  private readonly api = environment.apiUrl.replace(/\/$/, '');

  readonly company = dataset(`${this.api}/company/info`, publicCompany);
  readonly faqs = dataset(`${this.api}/company/faqs?activo=true`, publicFaqs);

  private readonly onOffline = () => this.offlineRequests.next();
  private readonly onOnline = () => {
    // Si vuelve la conexión mientras se cancela una petición, espera y vuelve a intentar.
    void Promise.allSettled([this.company.inFlight, this.faqs.inFlight]).then(() => {
      if (!this.destroyed && navigator.onLine) this.refreshBoth();
    });
  };

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      window.removeEventListener('online', this.onOnline);
      window.removeEventListener('offline', this.onOffline);
      this.offlineRequests.next();
      this.offlineRequests.complete();
    });
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    window.addEventListener('online', this.onOnline);
    window.addEventListener('offline', this.onOffline);
    this.refreshBoth();
  }

  refreshCompany(): Promise<void> { return this.refresh(this.company); }
  refreshFaqs(): Promise<void> { return this.refresh(this.faqs); }

  private refreshBoth(): void {
    void this.refreshCompany();
    void this.refreshFaqs();
  }

  private refresh<T>(entry: PublicDataset<T>): Promise<void> {
    if (entry.inFlight) return entry.inFlight;
    entry.loading.set(true);
    entry.error.set(null);
    entry.inFlight = this.load(entry).finally(() => {
      entry.loading.set(false);
      entry.inFlight = null;
    });
    return entry.inFlight;
  }

  private async load<T>(entry: PublicDataset<T>): Promise<void> {
    if (entry.data() === null) {
      const stored = await this.read(entry);
      if (this.destroyed) return;
      if (stored !== null) entry.data.set(stored);
    }
    if (!navigator.onLine) {
      if (entry.data() === null) entry.error.set('offline-empty');
      return;
    }
    try {
      const response = await firstValueFrom(this.http.get<unknown>(entry.url, { withCredentials: false }).pipe(
        // Permite el arranque del servidor alojado; perder la conexión cancela de inmediato.
        timeout(60_000), takeUntil(this.offlineRequests), takeUntilDestroyed(this.destroyRef),
      ));
      if (this.destroyed) return;
      const data = entry.decode(response);
      entry.data.set(data);
      await this.save(entry.url, data);
    } catch (error) {
      // Un fallo de red o del servidor nunca reemplaza una copia válida.
      if (this.destroyed || entry.data() !== null) return;
      entry.error.set(!navigator.onLine || error instanceof HttpErrorResponse && error.status === 0
        ? 'offline-empty' : 'load-failed');
    }
  }

  private async read<T>(entry: PublicDataset<T>): Promise<T | null> {
    try {
      const cache = await caches.open(this.cacheName);
      const response = await cache.match(entry.url);
      if (!response) return null;
      const stored = await response.json();
      if (stored.schema !== 1 || typeof stored.savedAt !== 'number') return null;
      return entry.decode(stored.data);
    } catch {
      return null;
    }
  }

  private async save<T>(url: string, data: T): Promise<void> {
    try {
      const cache = await caches.open(this.cacheName);
      await cache.put(url, new Response(JSON.stringify({ schema: 1, savedAt: Date.now(), data }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }));
    } catch {
      console.warn('No se pudo guardar la copia sin conexión de la información pública.');
    }
  }
}
