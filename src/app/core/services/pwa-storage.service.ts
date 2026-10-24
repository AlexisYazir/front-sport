import { DestroyRef, Injectable, inject } from '@angular/core';

const RESERVED_BYTES = 8 * 1024 * 1024;
// Un catálogo no debe crecer hasta agotar la cuota que pueda conceder el navegador.
const MAX_OFFLINE_BYTES = 64 * 1024 * 1024;

/** Protege las copias offline sin borrar recursos ni bloquear el inicio. */
@Injectable({ providedIn: 'root' })
export class PwaStorageService {
  private readonly destroyRef = inject(DestroyRef);
  private persistenceAttempt: Promise<boolean> | null = null;
  private started = false;
  private destroyed = false;

  private readonly retryAfterGesture = () => {
    this.removeGestureListeners();
    if (this.destroyed) return;
    // El navegador puede conceder persistencia después de una interacción.
    this.persistenceAttempt = null;
    void this.requestPersistence();
  };

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.removeGestureListeners();
    });
  }

  start(): void {
    if (this.started || this.destroyed) return;
    this.started = true;
    void this.requestPersistence().then(granted => {
      if (granted || this.destroyed) return;
      window.addEventListener('pointerdown', this.retryAfterGesture, { passive: true });
      window.addEventListener('keydown', this.retryAfterGesture);
    });
  }

  requestPersistence(): Promise<boolean> {
    this.persistenceAttempt ??= this.tryPersistence();
    return this.persistenceAttempt;
  }

  async hasCapacity(additionalBytes: number): Promise<boolean> {
    try {
      const storage = navigator.storage;
      if (typeof storage?.estimate !== 'function') return true;
      const { quota, usage } = await storage.estimate();
      if (typeof quota !== 'number' || !Number.isFinite(quota) || quota < 0 ||
          typeof usage !== 'number' || !Number.isFinite(usage) || usage < 0) return true;
      const downloadBytes = Number.isFinite(additionalBytes) ? Math.max(0, additionalBytes) : 0;
      return Math.min(quota, MAX_OFFLINE_BYTES) - usage >= downloadBytes + RESERVED_BYTES;
    } catch {
      // La escritura sigue teniendo que capturar errores de cuota si no hay estimación.
      return true;
    }
  }

  private async tryPersistence(): Promise<boolean> {
    try {
      const storage = navigator.storage;
      if (!storage) return false;
      if (typeof storage.persisted === 'function' && await storage.persisted()) return true;
      return typeof storage.persist === 'function' ? !!await storage.persist() : false;
    } catch {
      return false;
    }
  }

  private removeGestureListeners(): void {
    window.removeEventListener('pointerdown', this.retryAfterGesture);
    window.removeEventListener('keydown', this.retryAfterGesture);
  }
}
