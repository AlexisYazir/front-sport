import { DestroyRef, Injectable, InjectionToken, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

type NotificationWindow = Window & typeof globalThis;
type ConnectivityNavigator = Navigator & { connection?: EventTarget };

export const PWA_NOTIFICATION_WINDOW = new InjectionToken<NotificationWindow>('PWA notification window', {
  providedIn: 'root', factory: () => window,
});

/** Avisos del dispositivo independientes de la campana y de la sesión de Sport Center. */
@Injectable({ providedIn: 'root' })
export class PwaNotificationsService {
  private readonly browser = inject(PWA_NOTIFICATION_WINDOW);
  private readonly destroyRef = inject(DestroyRef);
  private readonly permissionHandledKey = 'sc_pwa_notification_permission_handled';
  private readonly networkInfo = (this.browser.navigator as ConnectivityNavigator).connection;
  private registration: ServiceWorkerRegistration | null = null;
  private started = false;
  private destroyed = false;
  private permissionPending = false;
  private permissionHandled = false;
  private permissionAttempts = 0;
  private automaticPermissionHandled = false;
  private interactionPermissionAttempted = false;
  private offline = false;
  private wasOffline = false;
  private connectionCycle = 0;
  private notifiedCycle: number | null = null;
  private notificationPendingCycle: number | null = null;
  private notificationAttempts = 0;
  private notificationRetry: number | null = null;
  private connectionCheck: AbortController | null = null;
  private checkTimeout: number | null = null;
  private monitorTimer: number | null = null;
  private failedChecks = 0;
  private receivedRemoteResponse = false;

  // Describe esta ventana; una app instalada también puede abrirse en una pestaña.
  get displayMode(): 'standalone' | 'browser' {
    const navigator = this.browser.navigator as Navigator & { standalone?: boolean };
    return navigator.standalone || this.browser.matchMedia?.(
      '(display-mode: standalone), (display-mode: minimal-ui), (display-mode: window-controls-overlay)',
    ).matches ? 'standalone' : 'browser';
  }

  private readonly onPermissionInteraction = (event: Event) => {
    // Algunos navegadores solo admiten el diálogo durante una acción real del usuario.
    if (!event.isTrusted || this.interactionPermissionAttempted) return;
    if (event instanceof KeyboardEvent && !['Enter', ' '].includes(event.key)) return;
    // No compite con formularios, pagos, micrófono ni ubicación dentro de sus botones.
    if (event.target instanceof Element && event.target.closest('button,input,textarea,select,[contenteditable]')) return;
    void this.requestPermissionOnOpen(true);
  };

  private readonly onConnectionChange = () => {
    if (!this.browser.navigator.onLine) {
      this.cancelConnectionCheck();
      this.setOffline(true);
      this.queueConnectionCheck(10_000);
    } else if (this.offline) {
      // Una señal "online" no borra el estado sin conexión hasta comprobar acceso real.
      this.failedChecks = 0;
      this.cancelConnectionCheck();
      this.queueConnectionCheck(0);
    }
  };

  private readonly onNetworkInfoChange = () => {
    if (!this.browser.navigator.onLine) this.onConnectionChange();
    else this.queueConnectionCheck(0, true);
  };

  private readonly onWindowReady = (event?: Event) => {
    if (this.browser.document.visibilityState !== 'visible') {
      this.cancelConnectionCheck();
      this.failedChecks = 0;
      return;
    }
    void this.requestPermissionOnOpen();
    this.onConnectionChange();
    this.notifyCurrentConnection();
    this.queueConnectionCheck(event ? 0 : 10_000, !!event);
  };

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.cancelConnectionCheck();
      this.browser.removeEventListener('online', this.onConnectionChange);
      this.browser.removeEventListener('offline', this.onConnectionChange);
      this.browser.removeEventListener('focus', this.onWindowReady);
      this.browser.document.removeEventListener('visibilitychange', this.onWindowReady);
      this.browser.removeEventListener('pageshow', this.onWindowReady);
      this.removePermissionListeners();
      if (this.notificationRetry !== null) this.browser.clearTimeout(this.notificationRetry);
      this.networkInfo?.removeEventListener('change', this.onNetworkInfoChange);
    });
  }

  start(): void {
    if (this.started || !this.browser.isSecureContext || !this.browser.Notification ||
      !this.browser.navigator.serviceWorker) return;
    this.started = true;
    this.offline = !this.browser.navigator.onLine;
    this.wasOffline = this.offline;
    this.browser.addEventListener('online', this.onConnectionChange);
    this.browser.addEventListener('offline', this.onConnectionChange);
    this.browser.addEventListener('focus', this.onWindowReady);
    this.browser.document.addEventListener('visibilitychange', this.onWindowReady);
    this.browser.addEventListener('pageshow', this.onWindowReady);
    this.browser.document.addEventListener('click', this.onPermissionInteraction);
    this.browser.document.addEventListener('keydown', this.onPermissionInteraction);
    this.networkInfo?.addEventListener('change', this.onNetworkInfoChange);
    void this.prepareWorker();
    this.onWindowReady();
  }

  private async prepareWorker(): Promise<void> {
    try {
      const registration = await this.browser.navigator.serviceWorker.ready;
      if (this.destroyed) return;
      this.registration = registration;
      this.notifyCurrentConnection();
      this.queueConnectionCheck(this.offline && this.browser.navigator.onLine ? 0 : 10_000);
    } catch {
      if (!this.destroyed) console.warn('No se pudieron preparar los avisos de conexión.');
    }
  }

  private removePermissionListeners(): void {
    this.browser.document.removeEventListener('click', this.onPermissionInteraction);
    this.browser.document.removeEventListener('keydown', this.onPermissionInteraction);
  }

  private async requestPermissionOnOpen(fromInteraction = false): Promise<void> {
    if (this.destroyed || this.browser.document.visibilityState !== 'visible' ||
      !this.browser.document.hasFocus()) return;
    const notifications = this.browser.Notification;
    if (notifications.permission !== 'default') this.removePermissionListeners();
    if (notifications.permission === 'default' && !this.permissionHandled && !this.permissionPending) {
      try {
        const stored = this.browser.sessionStorage.getItem(this.permissionHandledKey);
        if (stored === 'dismissed') {
          this.permissionHandled = true;
          this.removePermissionListeners();
          return;
        }
        this.automaticPermissionHandled ||= !!stored;
      } catch {
        // El control en memoria también funciona con el almacenamiento bloqueado.
      }
      if (fromInteraction ? this.interactionPermissionAttempted :
        this.automaticPermissionHandled || this.permissionAttempts >= 2) return;
      this.permissionPending = true;
      if (fromInteraction) this.interactionPermissionAttempted = true;
      else this.permissionAttempts++;
      try {
        const result = await notifications.requestPermission();
        this.automaticPermissionHandled = true;
        this.permissionHandled = result !== 'default' || fromInteraction;
        if (this.permissionHandled) this.removePermissionListeners();
        // Un resultado automático "default" puede significar que no se mostró el diálogo.
        // Conserva una oportunidad durante una interacción, incluso con la marca antigua "1".
        try { this.browser.sessionStorage.setItem(this.permissionHandledKey,
          result === 'default' && fromInteraction ? 'dismissed' : 'auto'); } catch {}
      } catch {
        if (!this.destroyed) console.warn('El navegador no permitió solicitar notificaciones al abrir Sport Center.');
      } finally {
        this.permissionPending = false;
      }
    }
    if (!this.destroyed) {
      this.notifyCurrentConnection();
      this.queueConnectionCheck(10_000);
    }
  }

  private setOffline(offline: boolean): void {
    if (this.offline !== offline) {
      this.offline = offline;
      this.wasOffline ||= offline;
      this.connectionCycle++;
      this.notificationAttempts = 0;
      if (this.notificationRetry !== null) this.browser.clearTimeout(this.notificationRetry);
      this.notificationRetry = null;
    }
    this.notifyCurrentConnection();
  }

  private notifyCurrentConnection(): void {
    if (this.destroyed || !this.registration || this.browser.Notification.permission !== 'granted' ||
      this.notifiedCycle === this.connectionCycle || this.notificationPendingCycle === this.connectionCycle ||
      this.notificationAttempts >= 3 || this.notificationRetry !== null) return;
    if ((this.offline && (!this.browser.navigator.onLine || this.failedChecks >= 2)) ||
      (!this.offline && this.wasOffline)) {
      void this.showConnectionNotification(this.offline, this.connectionCycle);
    }
  }

  private cancelConnectionCheck(): void {
    this.connectionCheck?.abort();
    this.connectionCheck = null;
    if (this.checkTimeout !== null) this.browser.clearTimeout(this.checkTimeout);
    if (this.monitorTimer !== null) this.browser.clearTimeout(this.monitorTimer);
    this.checkTimeout = null;
    this.monitorTimer = null;
  }

  private queueConnectionCheck(delay: number, replaceTimer = false): void {
    if (this.destroyed || !this.registration || this.browser.document.visibilityState !== 'visible' ||
      this.browser.Notification.permission !== 'granted' || this.connectionCheck) return;
    if (this.monitorTimer !== null) {
      if (!replaceTimer) return;
      this.browser.clearTimeout(this.monitorTimer);
      this.monitorTimer = null;
    }
    if (delay === 0) void this.checkConnection();
    else this.monitorTimer = this.browser.setTimeout(() => {
      this.monitorTimer = null;
      void this.checkConnection();
    }, delay);
  }

  private async checkConnection(): Promise<void> {
    if (this.destroyed || !this.registration || this.connectionCheck ||
      this.browser.document.visibilityState !== 'visible' || this.browser.Notification.permission !== 'granted') return;
    if (!this.browser.navigator.onLine) {
      this.setOffline(true);
      this.queueConnectionCheck(10_000);
      return;
    }
    const controller = new this.browser.AbortController();
    this.connectionCheck = controller;
    let timedOut = false;
    let receivedResponse = false;
    let local = false;
    this.checkTimeout = this.browser.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 4_000);
    try {
      const scope = new URL(this.registration.scope);
      local = scope.hostname === 'localhost' || scope.hostname.endsWith('.localhost') ||
        scope.hostname.startsWith('127.') || scope.hostname === '[::1]';
      // localhost sigue respondiendo sin Wi-Fi: allí se consulta el GET público existente mediante HEAD.
      const url = local
        ? new URL(`${environment.apiUrl.replace(/\/$/, '')}/company/info`)
        : new URL('manifest.webmanifest', scope);
      url.searchParams.set('ngsw-bypass', 'true');
      const response = await this.browser.fetch(url.href, {
        method: local ? 'HEAD' : 'GET', mode: local ? 'no-cors' : 'same-origin',
        cache: 'no-store', credentials: 'omit', redirect: 'error', signal: controller.signal,
      });
      receivedResponse = true;
      if (this.connectionCheck !== controller || this.destroyed) return;
      this.receivedRemoteResponse = true;
      this.failedChecks = 0;
      // Una respuesta HTTP de error prueba que hay red; no se anuncia una desconexión por un 500.
      let connected = local && (response.type === 'opaque' || response.status > 0 || response.ok);
      if (!local && response.ok) {
        const manifest: unknown = await response.json();
        connected = !!manifest && typeof manifest === 'object' && 'name' in manifest &&
          typeof manifest.name === 'string' && 'icons' in manifest && Array.isArray(manifest.icons);
      }
      if (!controller.signal.aborted && this.connectionCheck === controller && connected) this.setOffline(false);
    } catch {
      if (this.connectionCheck === controller && !this.destroyed && !receivedResponse) {
        // El primer arranque lento de Render no se presenta como falta de internet.
        if (!timedOut || !local || this.receivedRemoteResponse) this.failedChecks++;
        if (this.failedChecks >= 2) this.setOffline(true);
      }
    } finally {
      if (this.connectionCheck === controller) {
        if (this.checkTimeout !== null) this.browser.clearTimeout(this.checkTimeout);
        this.checkTimeout = null;
        this.connectionCheck = null;
        this.queueConnectionCheck(this.failedChecks === 1 ? 1_000 : 10_000);
      }
    }
  }

  private isCurrentCycle(offline: boolean, cycle: number): boolean {
    return !this.destroyed && this.offline === offline && this.connectionCycle === cycle &&
      (offline ? !this.browser.navigator.onLine || this.failedChecks >= 2 : this.browser.navigator.onLine) &&
      this.browser.Notification.permission === 'granted';
  }

  private async showConnectionNotification(offline: boolean, cycle: number): Promise<void> {
    if (!this.registration || !this.isCurrentCycle(offline, cycle) || this.notifiedCycle === cycle ||
      this.notificationPendingCycle === cycle) return;
    this.notificationPendingCycle = cycle;
    this.notificationAttempts++;
    const tag = offline ? 'sport-center-offline' : 'sport-center-online';
    const previousTag = offline ? 'sport-center-online' : 'sport-center-offline';
    try {
      // La limpieza es opcional: su falta de soporte no debe impedir el aviso nuevo.
      try {
        const previous = await this.registration.getNotifications?.({ tag: previousTag });
        if (!this.isCurrentCycle(offline, cycle)) return;
        previous?.forEach(notification => notification.close());
      } catch { /* Continúa con showNotification aunque no se puedan consultar avisos. */ }
      if (!this.isCurrentCycle(offline, cycle)) return;
      const options: NotificationOptions & { renotify: boolean } = {
        body: offline
          ? 'Puedes consultar las páginas que ya estén guardadas en este dispositivo.'
          : 'La conexión con Sport Center se ha restablecido.',
        icon: new URL('icons/icon-192.png', this.registration.scope).href,
        lang: 'es-MX', tag, renotify: true,
        data: {
          displayMode: this.displayMode,
          onActionClick: {
            default: {
              operation: 'focusLastFocusedOrOpen',
              url: new URL('info/nosotros', this.registration.scope).href,
            },
          },
        },
      };
      await this.registration.showNotification(
        offline ? 'Sport Center — Sin conexión' : 'Sport Center — Conexión restablecida', options,
      );
      if (this.connectionCycle === cycle) this.notifiedCycle = cycle;
    } catch {
      if (!this.destroyed) console.warn('El dispositivo no permitió mostrar el aviso de conexión.');
      if (this.isCurrentCycle(offline, cycle) && this.notificationAttempts < 3) {
        this.notificationRetry = this.browser.setTimeout(() => {
          this.notificationRetry = null;
          this.notifyCurrentConnection();
        }, 3_000);
      }
    } finally {
      if (this.notificationPendingCycle === cycle) this.notificationPendingCycle = null;
    }
  }
}
