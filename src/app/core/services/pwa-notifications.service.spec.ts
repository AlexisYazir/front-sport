import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { PWA_NOTIFICATION_WINDOW, PwaNotificationsService } from './pwa-notifications.service';
import { environment } from '../../../environments/environment';

describe('PwaNotificationsService', () => {
  let service: PwaNotificationsService;
  let browser: Window & typeof globalThis;
  let documentEvents: EventTarget;
  let networkInfo: EventTarget;
  let permission: NotificationPermission;
  let online: boolean;
  let visibility: DocumentVisibilityState;
  let focused: boolean;
  let requestPermission: jasmine.Spy;
  let showNotification: jasmine.Spy;
  let getStored: jasmine.Spy;
  let fetchCheck: jasmine.Spy;
  let getNotifications: jasmine.Spy;
  let registrationReady: Promise<ServiceWorkerRegistration>;
  let registration: ServiceWorkerRegistration;
  const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0));

  function boot() {
    TestBed.configureTestingModule({ providers: [{ provide: PWA_NOTIFICATION_WINDOW, useValue: browser }] });
    service = TestBed.inject(PwaNotificationsService);
  }

  function changeConnection(connected: boolean) {
    online = connected;
    browser.dispatchEvent(new Event(connected ? 'online' : 'offline'));
  }

  beforeEach(() => {
    permission = 'default';
    online = true;
    visibility = 'visible';
    focused = true;
    const stored = new Map<string, string>();
    getStored = jasmine.createSpy('getItem').and.callFake((key: string) => stored.get(key) ?? null);
    requestPermission = jasmine.createSpy('requestPermission').and.callFake(async () => {
      permission = 'granted';
      return permission;
    });
    showNotification = jasmine.createSpy('showNotification').and.resolveTo();
    getNotifications = jasmine.createSpy('getNotifications').and.resolveTo([]);
    fetchCheck = jasmine.createSpy('fetch').and.callFake(async () => ({
      ok: true, json: async () => ({ name: 'Sport Center', icons: [] }),
    }));
    registration = { scope: 'https://sport-center.example/', showNotification, getNotifications } as unknown as ServiceWorkerRegistration;
    registrationReady = Promise.resolve(registration);
    documentEvents = new EventTarget();
    networkInfo = new EventTarget();
    Object.defineProperty(documentEvents, 'visibilityState', { get: () => visibility });
    Object.assign(documentEvents, { hasFocus: () => focused });
    browser = Object.assign(new EventTarget(), {
      isSecureContext: true,
      Notification: { get permission() { return permission; }, requestPermission },
      navigator: { get onLine() { return online; }, connection: networkInfo,
        serviceWorker: { get ready() { return registrationReady; } } },
      document: documentEvents,
      fetch: fetchCheck,
      AbortController,
      setTimeout: window.setTimeout.bind(window),
      clearTimeout: window.clearTimeout.bind(window),
      sessionStorage: {
        getItem: getStored,
        setItem: (key: string, value: string) => stored.set(key, value),
      },
    }) as unknown as Window & typeof globalThis;
    boot();
  });

  it('solicita directamente el permiso al abrir sin necesitar un clic ni duplicarlo', async () => {
    service.start();
    service.start();
    expect(requestPermission).toHaveBeenCalledTimes(1);
    await settle();
    expect(showNotification).not.toHaveBeenCalled();
    expect(fetchCheck).not.toHaveBeenCalled();
  });

  it('no vuelve a preguntar si ya se aceptó el permiso', async () => {
    permission = 'granted';
    service.start();
    await settle();
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('respeta un permiso bloqueado y no genera avisos al desconectarse', async () => {
    permission = 'denied';
    service.start();
    await settle();
    changeConnection(false);
    await settle();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('no repite una pregunta descartada al recargar la misma ventana', async () => {
    requestPermission.and.resolveTo('default');
    service.start();
    await settle();
    TestBed.resetTestingModule();
    boot();
    service.start();
    await settle();
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it('espera a que la ventana esté visible antes de solicitar el permiso', async () => {
    visibility = 'hidden';
    service.start();
    await settle();
    expect(requestPermission).not.toHaveBeenCalled();
    visibility = 'visible';
    documentEvents.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it('tolera que el navegador exija interacción y rechace la solicitud automática', async () => {
    spyOn(console, 'warn');
    requestPermission.and.rejectWith(new DOMException('Requiere interacción', 'NotAllowedError'));
    service.start();
    await settle();
    changeConnection(false);
    await settle();
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(showNotification).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });

  it('genera un aviso sin conexión por transición, usando el worker y el icono existentes', async () => {
    service.start();
    await settle();
    changeConnection(false);
    changeConnection(false);
    await settle();
    expect(showNotification).toHaveBeenCalledTimes(1);
    const [title, options] = showNotification.calls.mostRecent().args;
    expect(title).toBe('Sport Center — Sin conexión');
    expect(options.icon).toBe('https://sport-center.example/icons/icon-192.png');
    expect(options.tag).toBe('sport-center-offline');
    expect(options.renotify).toBeFalse();
    expect(options.data.onActionClick.default.operation).toBe('focusLastFocusedOrOpen');
    changeConnection(true);
    await settle();
    expect(showNotification).toHaveBeenCalledTimes(2);
    expect(showNotification.calls.mostRecent().args[0]).toBe('Sport Center — Conexión restablecida');
    changeConnection(false);
    await settle();
    expect(showNotification).toHaveBeenCalledTimes(3);
  });

  it('avisa si la aplicación se abre sin conexión y el permiso ya está concedido', async () => {
    online = false;
    permission = 'granted';
    service.start();
    await settle();
    expect(showNotification).toHaveBeenCalledTimes(1);
  });

  it('espera al permiso si la desconexión sucede mientras la pregunta está abierta', async () => {
    let grant!: (value: NotificationPermission) => void;
    requestPermission.and.returnValue(new Promise<NotificationPermission>(resolve => { grant = resolve; }));
    service.start();
    await settle();
    changeConnection(false);
    await settle();
    expect(showNotification).not.toHaveBeenCalled();
    permission = 'granted';
    grant('granted');
    await settle();
    expect(showNotification).toHaveBeenCalledTimes(1);
  });

  it('no muestra un aviso sin conexión atrasado cuando el worker queda preparado', async () => {
    let ready!: (worker: ServiceWorkerRegistration) => void;
    registrationReady = new Promise(resolve => { ready = resolve; });
    service.start();
    changeConnection(false);
    changeConnection(true);
    ready(registration);
    await settle();
    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification.calls.mostRecent().args[0]).toBe('Sport Center — Conexión restablecida');
  });

  it('no confunde un evento sin cambio de red con una desconexión', async () => {
    service.start();
    await settle();
    browser.dispatchEvent(new Event('offline'));
    await settle();
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('funciona aunque el navegador bloquee el almacenamiento de sesión', async () => {
    getStored.and.throwError('Almacenamiento bloqueado');
    service.start();
    await settle();
    documentEvents.dispatchEvent(new Event('visibilitychange'));
    changeConnection(false);
    await settle();
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(showNotification).toHaveBeenCalledTimes(1);
  });

  it('tolera un fallo del sistema de notificaciones sin insistir durante la misma desconexión', async () => {
    spyOn(console, 'warn');
    showNotification.and.rejectWith(new Error('Avisos bloqueados por el sistema'));
    service.start();
    await settle();
    changeConnection(false);
    await settle();
    documentEvents.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalled();
  });

  it('se mantiene inactivo si faltan las APIs de notificaciones', async () => {
    Reflect.deleteProperty(browser, 'Notification');
    service.start();
    changeConnection(false);
    await settle();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('no solicita permisos en una conexión insegura', async () => {
    Object.defineProperty(browser, 'isSecureContext', { value: false });
    service.start();
    await settle();
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('deja de escuchar los cambios de conexión al destruirse', async () => {
    service.start();
    await settle();
    TestBed.resetTestingModule();
    changeConnection(false);
    await settle();
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('espera al foco de la ventana instalada aunque su documento ya esté visible', async () => {
    focused = false;
    service.start();
    await settle();
    documentEvents.dispatchEvent(new Event('visibilitychange'));
    expect(requestPermission).not.toHaveBeenCalled();
    focused = true;
    browser.dispatchEvent(new Event('focus'));
    await settle();
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it('no duplica una solicitud pendiente cuando coinciden foco y visibilidad', async () => {
    let decide!: (value: NotificationPermission) => void;
    requestPermission.and.returnValue(new Promise<NotificationPermission>(resolve => { decide = resolve; }));
    service.start();
    browser.dispatchEvent(new Event('focus'));
    documentEvents.dispatchEvent(new Event('visibilitychange'));
    expect(requestPermission).toHaveBeenCalledTimes(1);
    decide('default');
    await settle();
    browser.dispatchEvent(new Event('focus'));
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it('no guarda un intento fallido como respuesta y reintenta una sola vez al recuperar el foco', async () => {
    spyOn(console, 'warn');
    requestPermission.and.rejectWith(new DOMException('Ventana no lista', 'NotAllowedError'));
    service.start();
    await settle();
    expect(browser.sessionStorage.getItem('sc_pwa_notification_permission_handled')).toBeNull();
    browser.dispatchEvent(new Event('focus'));
    await settle();
    browser.dispatchEvent(new Event('focus'));
    await settle();
    expect(requestPermission).toHaveBeenCalledTimes(2);
  });

  it('confirma el regreso usando el sitio propio sin caché, cookies ni servidor de cuentas', async () => {
    service.start();
    await settle();
    changeConnection(false);
    await settle();
    changeConnection(true);
    await settle();
    const [address, options] = fetchCheck.calls.mostRecent().args;
    const url = new URL(address);
    expect(url.origin).toBe('https://sport-center.example');
    expect(url.pathname).toBe('/manifest.webmanifest');
    expect(url.searchParams.has('ngsw-bypass')).toBeTrue();
    expect(options.cache).toBe('no-store');
    expect(options.credentials).toBe('omit');
    expect(showNotification.calls.mostRecent().args[0]).toBe('Sport Center — Conexión restablecida');
    browser.dispatchEvent(new Event('online'));
    browser.dispatchEvent(new Event('focus'));
    await settle();
    expect(fetchCheck).toHaveBeenCalledTimes(2);
    expect(showNotification).toHaveBeenCalledTimes(2);
  });

  it('retira la notificación del estado anterior antes de mostrar el estado nuevo', async () => {
    const closePrevious = jasmine.createSpy('close');
    getNotifications.and.resolveTo([{ close: closePrevious }]);
    service.start();
    await settle();
    changeConnection(false);
    await settle();
    expect(getNotifications).toHaveBeenCalledWith({ tag: 'sport-center-online' });
    changeConnection(true);
    await settle();
    expect(getNotifications).toHaveBeenCalledWith({ tag: 'sport-center-offline' });
    expect(closePrevious).toHaveBeenCalledTimes(2);
    expect(showNotification.calls.mostRecent().args[1].tag).toBe('sport-center-online');
  });

  it('reintenta la comprobación si la red tarda en tener acceso real al sitio', fakeAsync(() => {
    fetchCheck.and.rejectWith(new TypeError('Sin acceso a internet'));
    service.start();
    flushMicrotasks();
    changeConnection(false);
    flushMicrotasks();
    changeConnection(true);
    flushMicrotasks();
    expect(showNotification).toHaveBeenCalledTimes(1);
    fetchCheck.and.resolveTo({ ok: true, json: async () => ({ name: 'Sport Center', icons: [] }) });
    tick(1_000);
    flushMicrotasks();
    expect(fetchCheck).toHaveBeenCalledTimes(2);
    expect(showNotification.calls.mostRecent().args[0]).toBe('Sport Center — Conexión restablecida');
    TestBed.resetTestingModule();
  }));

  it('espacia las comprobaciones fallidas y no anuncia internet por una señal de red solamente', fakeAsync(() => {
    fetchCheck.and.rejectWith(new TypeError('Red sin acceso'));
    service.start();
    flushMicrotasks();
    changeConnection(false);
    flushMicrotasks();
    changeConnection(true);
    flushMicrotasks();
    tick(10_000);
    flushMicrotasks();
    expect(fetchCheck).toHaveBeenCalledTimes(2);
    expect(showNotification).toHaveBeenCalledTimes(1);
    TestBed.resetTestingModule();
  }));

  it('ignora una respuesta de portal Wi-Fi o error del servidor', fakeAsync(() => {
    fetchCheck.and.resolveTo({ ok: true, json: async () => ({ portal: 'Inicia sesión en Wi-Fi' }) });
    service.start();
    flushMicrotasks();
    changeConnection(false);
    flushMicrotasks();
    changeConnection(true);
    flushMicrotasks();
    tick(10_000);
    expect(showNotification).toHaveBeenCalledTimes(1);
    TestBed.resetTestingModule();
  }));

  it('cancela una recuperación sin confirmar, ignora su respuesta tardía y evita duplicar el aviso offline', async () => {
    let resolveCheck!: (response: unknown) => void;
    fetchCheck.and.returnValue(new Promise(resolve => { resolveCheck = resolve; }));
    service.start();
    await settle();
    changeConnection(false);
    await settle();
    changeConnection(true);
    const signal: AbortSignal = fetchCheck.calls.mostRecent().args[1].signal;
    changeConnection(false);
    resolveCheck({ ok: true, json: async () => ({ name: 'Sport Center', icons: [] }) });
    await settle();
    expect(signal.aborted).toBeTrue();
    expect(showNotification.calls.allArgs().map(args => args[0]))
      .toEqual(['Sport Center — Sin conexión']);
  });

  it('descarta un aviso atrasado si cambia el estado mientras se consultan los avisos anteriores', async () => {
    let previousReady!: (items: unknown[]) => void;
    getNotifications.and.returnValue(new Promise(resolve => { previousReady = resolve; }));
    service.start();
    await settle();
    changeConnection(false);
    changeConnection(true);
    previousReady([]);
    await settle();
    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification.calls.mostRecent().args[0]).toBe('Sport Center — Conexión restablecida');
  });

  it('detiene una comprobación que tarda demasiado y limpia los reintentos al cerrar', fakeAsync(() => {
    fetchCheck.and.callFake((_address: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal!.addEventListener('abort', () => reject(new DOMException('Cancelado', 'AbortError')));
    }));
    service.start();
    flushMicrotasks();
    changeConnection(false);
    flushMicrotasks();
    changeConnection(true);
    flushMicrotasks();
    const signal: AbortSignal = fetchCheck.calls.mostRecent().args[1].signal;
    tick(5_000);
    expect(signal.aborted).toBeTrue();
    TestBed.resetTestingModule();
    tick(10_000);
    expect(fetchCheck).toHaveBeenCalledTimes(1);
    expect(showNotification).toHaveBeenCalledTimes(1);
  }));

  it('detecta y recupera la conexión aunque onLine siga en true y no haya eventos del navegador', fakeAsync(() => {
    Object.assign(registration, { scope: 'http://localhost:4200/' });
    fetchCheck.and.resolveTo({ type: 'opaque', status: 0, ok: false });
    service.start();
    flushMicrotasks();
    tick(10_000);
    fetchCheck.and.rejectWith(new TypeError('Wi-Fi apagado'));
    tick(10_000);
    expect(showNotification).not.toHaveBeenCalled();
    tick(1_000);
    expect(online).toBeTrue();
    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification.calls.mostRecent().args[0]).toBe('Sport Center — Sin conexión');
    tick(10_000);
    expect(showNotification).toHaveBeenCalledTimes(1);
    fetchCheck.and.resolveTo({ type: 'opaque', status: 0, ok: false });
    tick(10_000);
    expect(showNotification).toHaveBeenCalledTimes(2);
    expect(showNotification.calls.mostRecent().args[0]).toBe('Sport Center — Conexión restablecida');
    TestBed.resetTestingModule();
  }));

  it('consulta un destino remoto del proyecto desde localhost, sin credenciales ni descarga de contenido', fakeAsync(() => {
    Object.assign(registration, { scope: 'http://localhost:4200/' });
    fetchCheck.and.resolveTo({ type: 'opaque', status: 0, ok: false });
    service.start();
    flushMicrotasks();
    tick(10_000);
    const [address, options] = fetchCheck.calls.mostRecent().args;
    const url = new URL(address);
    expect(url.origin).toBe(new URL(environment.apiUrl).origin);
    expect(url.pathname).toBe('/company/info');
    expect(url.searchParams.has('ngsw-bypass')).toBeTrue();
    expect(options.method).toBe('HEAD');
    expect(options.mode).toBe('no-cors');
    expect(options.cache).toBe('no-store');
    expect(options.credentials).toBe('omit');
    expect(options.headers).toBeUndefined();
    expect(showNotification).not.toHaveBeenCalled();
    TestBed.resetTestingModule();
  }));

  it('no anuncia una desconexión por un único fallo pasajero', fakeAsync(() => {
    service.start();
    flushMicrotasks();
    fetchCheck.and.rejectWith(new TypeError('Cambio de red'));
    tick(10_000);
    fetchCheck.and.resolveTo({ ok: true, json: async () => ({ name: 'Sport Center', icons: [] }) });
    tick(1_000);
    expect(showNotification).not.toHaveBeenCalled();
    TestBed.resetTestingModule();
  }));

  it('usa los cambios del adaptador como señal adicional cuando la API está disponible', fakeAsync(() => {
    service.start();
    flushMicrotasks();
    fetchCheck.and.rejectWith(new TypeError('Adaptador sin acceso'));
    networkInfo.dispatchEvent(new Event('change'));
    flushMicrotasks();
    expect(fetchCheck).toHaveBeenCalledTimes(1);
    tick(1_000);
    expect(showNotification.calls.mostRecent().args[0]).toBe('Sport Center — Sin conexión');
    TestBed.resetTestingModule();
    networkInfo.dispatchEvent(new Event('change'));
    tick(20_000);
    expect(fetchCheck).toHaveBeenCalledTimes(2);
  }));

  it('pausa las comprobaciones al ocultar la app y comprueba inmediatamente al volver', fakeAsync(() => {
    service.start();
    flushMicrotasks();
    tick(10_000);
    expect(fetchCheck).toHaveBeenCalledTimes(1);
    visibility = 'hidden';
    documentEvents.dispatchEvent(new Event('visibilitychange'));
    fetchCheck.and.rejectWith(new TypeError('Wi-Fi apagado'));
    tick(60_000);
    expect(fetchCheck).toHaveBeenCalledTimes(1);
    expect(showNotification).not.toHaveBeenCalled();
    visibility = 'visible';
    documentEvents.dispatchEvent(new Event('visibilitychange'));
    flushMicrotasks();
    tick(1_000);
    expect(showNotification.calls.mostRecent().args[0]).toBe('Sport Center — Sin conexión');
    TestBed.resetTestingModule();
  }));

  it('cancela una comprobación pendiente al ocultarse e ignora su respuesta tardía', fakeAsync(() => {
    let complete!: (value: unknown) => void;
    fetchCheck.and.returnValue(new Promise(resolve => { complete = resolve; }));
    service.start();
    flushMicrotasks();
    tick(10_000);
    const signal: AbortSignal = fetchCheck.calls.mostRecent().args[1].signal;
    visibility = 'hidden';
    documentEvents.dispatchEvent(new Event('visibilitychange'));
    expect(signal.aborted).toBeTrue();
    complete({ ok: true, json: async () => ({ name: 'Sport Center', icons: [] }) });
    flushMicrotasks();
    tick(30_000);
    expect(fetchCheck).toHaveBeenCalledTimes(1);
    expect(showNotification).not.toHaveBeenCalled();
    TestBed.resetTestingModule();
  }));

  it('no presenta un error HTTP 500 del servidor como pérdida de internet', fakeAsync(() => {
    fetchCheck.and.resolveTo({ ok: false, status: 500 });
    service.start();
    flushMicrotasks();
    tick(30_000);
    expect(showNotification).not.toHaveBeenCalled();
    TestBed.resetTestingModule();
  }));

  it('no confunde los primeros timeouts de arranque de Render con falta de internet', fakeAsync(() => {
    Object.assign(registration, { scope: 'http://localhost:4200/' });
    fetchCheck.and.callFake((_address: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal!.addEventListener('abort', () => reject(new DOMException('Timeout', 'AbortError')));
    }));
    service.start();
    flushMicrotasks();
    tick(10_000);
    tick(4_000);
    tick(10_000);
    tick(4_000);
    expect(fetchCheck).toHaveBeenCalledTimes(2);
    expect(showNotification).not.toHaveBeenCalled();
    TestBed.resetTestingModule();
  }));

  it('detecta dos timeouts después de haber confirmado previamente una conexión real', fakeAsync(() => {
    Object.assign(registration, { scope: 'http://localhost:4200/' });
    fetchCheck.and.resolveTo({ type: 'opaque', status: 0, ok: false });
    service.start();
    flushMicrotasks();
    tick(10_000);
    fetchCheck.and.callFake((_address: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal!.addEventListener('abort', () => reject(new DOMException('Timeout', 'AbortError')));
    }));
    tick(10_000);
    tick(4_000);
    tick(1_000);
    tick(4_000);
    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification.calls.mostRecent().args[0]).toBe('Sport Center — Sin conexión');
    TestBed.resetTestingModule();
  }));

  it('no realiza comprobaciones periódicas si las notificaciones están bloqueadas', fakeAsync(() => {
    permission = 'denied';
    service.start();
    flushMicrotasks();
    tick(60_000);
    expect(fetchCheck).not.toHaveBeenCalled();
    expect(showNotification).not.toHaveBeenCalled();
    TestBed.resetTestingModule();
  }));

  it('también detecta que onLine pasó a false aunque se pierda el evento offline', fakeAsync(() => {
    service.start();
    flushMicrotasks();
    online = false;
    tick(10_000);
    expect(fetchCheck).not.toHaveBeenCalled();
    expect(showNotification.calls.mostRecent().args[0]).toBe('Sport Center — Sin conexión');
    TestBed.resetTestingModule();
  }));
});
