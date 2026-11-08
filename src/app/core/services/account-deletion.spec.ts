import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { ACCOUNT_DELETION_API_URL, AccountDeletionService } from './account-deletion.service';
import { AuthService } from './auth.service';
import type { DeletionResult, DeletionVerification } from './account-deletion.types';

const BASE = '/local-api/users/account-deletion';
const ID = '90a5d6ef-54a9-4ad4-949b-a94c9de4c997';
const RECEIPT = 'r'.repeat(43);
const AUTHORIZATION = 'a'.repeat(43);
const KEY = 'sc_account_deletion_receipt_v1';
const expiresAt = () => new Date(Date.now() + 600000).toISOString();
const verified = (): DeletionVerification => ({
  status: 'identity_verified', confirmationToken: AUTHORIZATION, expiresAt: expiresAt(),
  consequences: { irreversible: true, endsAllSessions: true, newRegistrationIsSeparate: true,
    retainedCategories: [], requiresAttention: false, reason: null, retentionPolicy: null },
});
const completed = (): DeletionResult => ({ requestId: ID, status: 'completed', reason: null,
  retainedCategories: [], notification: 'sent' });

describe('Eliminación web: contrato y seguridad de la solicitud', () => {
  let service: AccountDeletionService;
  let http: HttpTestingController;
  let epoch: number;
  let user: { id: number; rol: number } | null;
  let auth: {
    currentUser: ReturnType<typeof signal<{ id: number; rol: number } | null>>;
    isAuthenticated: ReturnType<typeof signal<boolean>>;
    getAuthState: jasmine.Spy;
    captureSession: jasmine.Spy;
    isCurrentSession: jasmine.Spy;
    clearDeletedAccountSession: jasmine.Spy;
    shouldRefreshSoon: jasmine.Spy;
    refreshAccessToken: jasmine.Spy;
    getToken: jasmine.Spy;
  };
  let state: BehaviorSubject<{ user: typeof user }>;
  let intercepted: number;

  function configure(): void {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([(req, next) => { intercepted++; return next(req); }])),
      provideHttpClientTesting(), { provide: AuthService, useValue: auth },
      { provide: ACCOUNT_DELETION_API_URL, useValue: '/local-api/' },
    ] });
    service = TestBed.inject(AccountDeletionService);
    http = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    sessionStorage.removeItem(KEY);
    epoch = 1; user = { id: 7, rol: 1 }; intercepted = 0;
    state = new BehaviorSubject<{ user: { id: number; rol: number } | null }>({ user });
    auth = {
      currentUser: signal(user), isAuthenticated: signal(true),
      getAuthState: jasmine.createSpy().and.callFake(() => state.asObservable()),
      captureSession: jasmine.createSpy().and.callFake(() => user ? { userId: user.id, sessionId: 'session-a', epoch } : null),
      isCurrentSession: jasmine.createSpy().and.callFake(value => value.epoch === epoch && value.userId === user?.id),
      clearDeletedAccountSession: jasmine.createSpy().and.callFake(() => {
        epoch++; user = null; auth.currentUser.set(null); auth.isAuthenticated.set(false); state.next({ user });
      }),
      shouldRefreshSoon: jasmine.createSpy().and.returnValue(false),
      refreshAccessToken: jasmine.createSpy().and.returnValue(of('refreshed-a')),
      getToken: jasmine.createSpy().and.returnValue('access-a'),
    };
    configure();
  });

  afterEach(() => { http.verify(); expect(intercepted).toBe(0); sessionStorage.removeItem(KEY); });

  function start(): void {
    service.start();
    http.expectOne(BASE + '/requests').flush({ requestId: ID, receiptToken: RECEIPT, status: 'received', expiresAt: expiresAt() });
  }
  function review(): void {
    start(); service.verify('012345');
    http.expectOne(BASE + '/requests/' + ID + '/verify').flush(verified());
  }

  it('no hace solicitudes ni mutaciones al entrar y no guarda OTP ni autorizaciones', () => {
    expect(service.stage()).toBe('start'); expect(service.canStart()).toBeTrue();
    expect(sessionStorage.getItem(KEY)).toBeNull(); http.expectNone(() => true);
    review();
    expect(sessionStorage.getItem(KEY)).toBeNull();
    expect(service.stage()).toBe('review'); expect(auth.clearDeletedAccountSession).not.toHaveBeenCalled();
  });

  it('solicita por JSON sólo para la identidad de la sesión y bloquea doble envío', () => {
    service.start(); service.start();
    const request = http.expectOne(BASE + '/requests');
    expect(request.request.method).toBe('POST'); expect(request.request.body).toEqual({});
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-a');
    expect(request.request.headers.get('Content-Type')).toBe('application/json');
    expect(request.request.headers.keys().map(key => key.toLowerCase()).sort()).toEqual(['accept', 'authorization', 'content-type']);
    expect(request.request.withCredentials).toBeTrue();
    request.flush({ requestId: ID, receiptToken: RECEIPT, status: 'received', expiresAt: expiresAt() });
    expect(service.stage()).toBe('code');
  });

  it('acepta seis dígitos ASCII con cero inicial y no reusa el código de recuperación', () => {
    start();
    for (const code of ['12345', '1234567', '１２３４５６', '12 345', 'abcdef']) service.verify(code);
    http.expectNone(() => true);
    service.verify('012345');
    const request = http.expectOne(BASE + '/requests/' + ID + '/verify');
    expect(request.request.body).toEqual({ code: '012345' }); request.flush(verified());
    expect(service.stage()).toBe('review'); http.expectNone(req => req.url.includes('verify-email'));
  });

  it('verificar identidad no confirma ni cierra la sesión', () => {
    review(); http.expectNone(req => req.url.endsWith('/confirm'));
    expect(auth.clearDeletedAccountSession).not.toHaveBeenCalled(); expect(service.result()).toBeNull();
  });

  it('conserva el recibo antes de confirmar, envía consentimiento explícito y retira sesión sólo al confirmar', () => {
    review(); service.confirm(); service.confirm();
    const stored = sessionStorage.getItem(KEY)!;
    expect(JSON.parse(stored)).toEqual({ requestId: ID, receiptToken: RECEIPT, ownerId: 7 });
    expect(stored).not.toContain(AUTHORIZATION); expect(stored).not.toContain('012345');
    const request = http.expectOne(BASE + '/requests/' + ID + '/confirm');
    expect(request.request.body).toEqual({ confirmationToken: AUTHORIZATION, confirmed: true });
    request.flush(completed());
    expect(service.result()?.status).toBe('completed'); expect(auth.clearDeletedAccountSession).toHaveBeenCalledTimes(1);
    expect(service.verification()).toBeNull(); expect(service.busy()).toBeFalse();
  });

  it('una respuesta perdida consulta sólo el recibo sin JWT, sin refresh y sin reconfirmar', () => {
    review(); service.confirm();
    http.expectOne(BASE + '/requests/' + ID + '/confirm').error(new ProgressEvent('error'));
    const request = http.expectOne(BASE + '/requests/' + ID + '/result');
    expect(request.request.method).toBe('POST'); expect(request.request.body).toEqual({ receiptToken: RECEIPT });
    expect(request.request.headers.has('Authorization')).toBeFalse(); expect(request.request.withCredentials).toBeFalse();
    expect(request.request.url).not.toContain(RECEIPT);
    request.flush(completed());
    expect(service.result()?.status).toBe('completed'); expect(auth.refreshAccessToken).not.toHaveBeenCalled();
    http.expectNone(req => req.url.endsWith('/confirm')); service.confirm(); http.expectNone(() => true);
  });

  it('un 401 al confirmar no navega ni reenvía; recupera el estado sin autenticación', () => {
    review(); service.confirm();
    http.expectOne(BASE + '/requests/' + ID + '/confirm').flush({}, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(BASE + '/requests/' + ID + '/result').flush({ ...completed(), status: 'in_progress' });
    expect(service.result()?.status).toBe('in_progress'); expect(auth.refreshAccessToken).not.toHaveBeenCalled();
  });

  it('si confirmación y consulta fallan conserva estado incierto y recibo para seguimiento', () => {
    review(); service.confirm();
    http.expectOne(BASE + '/requests/' + ID + '/confirm').flush({}, { status: 503, statusText: 'Unavailable' });
    http.expectOne(BASE + '/requests/' + ID + '/result').error(new ProgressEvent('error'));
    expect(service.stage()).toBe('result'); expect(service.outcomeUnknown()).toBeTrue();
    expect(service.result()).toBeNull(); expect(sessionStorage.getItem(KEY)).toContain(RECEIPT);
    expect(service.error()).toContain('no acredita');
  });

  it('recarga el seguimiento sin repetir solicitudes de eliminación ni necesitar sesión', () => {
    review(); service.confirm(); http.expectOne(BASE + '/requests/' + ID + '/confirm').flush(completed());
    TestBed.resetTestingModule(); configure();
    expect(service.stage()).toBe('result'); http.expectNone(() => true);
    service.refreshResult(); http.expectOne(BASE + '/requests/' + ID + '/result').flush(completed());
    expect(service.result()?.status).toBe('completed');
  });

  it('un servicio apagado informa indisponibilidad sin afirmar eliminación ni cerrar sesión', () => {
    service.start(); http.expectOne(BASE + '/requests').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(service.stage()).toBe('start'); expect(service.error()).toContain('no está disponible');
    expect(service.result()).toBeNull(); expect(auth.clearDeletedAccountSession).not.toHaveBeenCalled();
  });

  it('no repite automáticamente un código ni una solicitud limitada por el servidor', () => {
    service.start(); http.expectOne(BASE + '/requests').flush({}, { status: 429, statusText: 'Too Many Requests' });
    expect(service.error()).toContain('Espera'); http.expectNone(() => true);
    start(); service.verify('012345');
    http.expectOne(BASE + '/requests/' + ID + '/verify').flush({}, { status: 400, statusText: 'Bad Request' });
    expect(service.stage()).toBe('code'); expect(service.error()).toContain('incorrecto');
    http.expectNone(() => true);
  });

  it('una renovación previa se ejecuta una vez y no repite una confirmación fallida', () => {
    review(); auth.shouldRefreshSoon.and.returnValue(true); service.confirm();
    const request = http.expectOne(BASE + '/requests/' + ID + '/confirm');
    expect(request.request.headers.get('Authorization')).toBe('Bearer refreshed-a');
    request.flush({}, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(BASE + '/requests/' + ID + '/result').flush(completed());
    expect(auth.refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('no envía confirmación si falla la renovación previa y verifica que siga sin confirmarse', () => {
    review(); auth.shouldRefreshSoon.and.returnValue(true);
    auth.refreshAccessToken.and.returnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    service.confirm(); http.expectNone(req => req.url.endsWith('/confirm'));
    http.expectOne(BASE + '/requests/' + ID + '/result').flush({ ...completed(), status: 'identity_verified' });
    expect(service.result()?.status).toBe('identity_verified');
    service.restartUnconfirmed(); expect(service.stage()).toBe('start'); expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('reemplaza el desafío al pedir otro código y cancela sin eliminar', () => {
    start(); service.start();
    http.expectOne(BASE + '/requests').flush({ requestId: ID, receiptToken: 'n'.repeat(43), status: 'received', expiresAt: expiresAt() });
    service.cancel(); expect(service.stage()).toBe('start'); service.confirm(); http.expectNone(() => true);
    expect(auth.clearDeletedAccountSession).not.toHaveBeenCalled();
  });

  it('rechaza una respuesta corrupta de inicio sin avanzar', () => {
    service.start(); http.expectOne(BASE + '/requests').flush({ requestId: '../wrong', receiptToken: RECEIPT, status: 'received', expiresAt: expiresAt() });
    expect(service.stage()).toBe('start'); expect(service.error()).toBeTruthy(); expect(service.busy()).toBeFalse();
  });

  it('rechaza consecuencias incompletas y no permite confirmar', () => {
    start(); service.verify('012345');
    http.expectOne(BASE + '/requests/' + ID + '/verify').flush({ ...verified(), consequences: {} });
    expect(service.stage()).toBe('code'); service.confirm(); http.expectNone(() => true);
  });

  it('no presenta éxito si el resultado corresponde a otra solicitud', () => {
    review(); service.confirm();
    http.expectOne(BASE + '/requests/' + ID + '/confirm').flush({ ...completed(), requestId: 'wrong' });
    http.expectOne(BASE + '/requests/' + ID + '/result').flush({ ...completed(), requestId: 'wrong' });
    expect(service.result()).toBeNull(); expect(service.outcomeUnknown()).toBeTrue();
  });

  it('no confirma con código o autorización vencidos', () => {
    service.start(); http.expectOne(BASE + '/requests').flush({ requestId: ID, receiptToken: RECEIPT, status: 'received', expiresAt: new Date(0).toISOString() });
    service.verify('012345'); http.expectNone(() => true);
    start(); service.verify('012345');
    http.expectOne(BASE + '/requests/' + ID + '/verify').flush({ ...verified(), expiresAt: new Date(0).toISOString() });
    service.confirm(); http.expectNone(() => true); expect(service.error()).toContain('venció');
  });

  it('cambio de usuario invalida desafío y bloquea sus respuestas tardías', () => {
    service.start(); const request = http.expectOne(BASE + '/requests');
    epoch++; user = { id: 8, rol: 1 }; auth.currentUser.set(user); state.next({ user });
    expect(request.cancelled).toBeTrue(); expect(service.stage()).toBe('start');
    service.verify('012345'); service.confirm(); http.expectNone(() => true);
  });

  it('descarta un desafío tardío cuando comienza otra autenticación sin evento de usuario todavía', () => {
    service.start(); const request = http.expectOne(BASE + '/requests');
    epoch++;
    request.flush({ requestId: ID, receiptToken: RECEIPT, status: 'received', expiresAt: expiresAt() });
    expect(service.stage()).toBe('start'); expect(service.error()).toBeTruthy();
    service.verify('012345'); http.expectNone(() => true);
  });

  it('otra cuenta no puede heredar el recibo del navegador', () => {
    review(); service.confirm(); const request = http.expectOne(BASE + '/requests/' + ID + '/confirm');
    epoch++; user = { id: 8, rol: 1 }; auth.currentUser.set(user); state.next({ user });
    expect(request.cancelled).toBeTrue(); expect(sessionStorage.getItem(KEY)).toBeNull();
    expect(auth.clearDeletedAccountSession).not.toHaveBeenCalled(); expect(service.result()).toBeNull();
  });

  it('cuentas de personal y visitantes no inician eliminación por autoservicio', () => {
    user = { id: 7, rol: 3 }; auth.currentUser.set(user); service.start(); http.expectNone(() => true);
    user = null; auth.currentUser.set(null); auth.isAuthenticated.set(false); service.start(); http.expectNone(() => true);
  });

  it('conserva la atención especial como pendiente y no permite iniciar otra eliminación', () => {
    review(); service.confirm();
    http.expectOne(BASE + '/requests/' + ID + '/confirm').flush({ ...completed(), status: 'requires_attention', reason: 'pending_orders', retainedCategories: ['orders'] });
    expect(service.result()?.status).toBe('requires_attention'); service.restartUnconfirmed(); service.start();
    expect(service.stage()).toBe('result'); http.expectNone(() => true);
  });

  it('rechaza un plazo de conservación inválido sin mostrar una finalización falsa', () => {
    review(); service.confirm();
    const invalid = { ...completed(), retention: { until: 'wrong-date', basis: 'Base documentada', identifiersExpired: false } };
    http.expectOne(BASE + '/requests/' + ID + '/confirm').flush(invalid);
    http.expectOne(BASE + '/requests/' + ID + '/result').flush(invalid);
    expect(service.result()).toBeNull(); expect(service.outcomeUnknown()).toBeTrue();
  });

  it('una política de conservación incompleta no habilita el paso irreversible', () => {
    start(); service.verify('012345');
    const value = verified();
    Object.assign(value.consequences, { retentionPolicy: { basis: 'Base', days: -1 } });
    http.expectOne(BASE + '/requests/' + ID + '/verify').flush(value);
    expect(service.stage()).toBe('code'); service.confirm(); http.expectNone(() => true);
  });

  it('si el navegador bloquea storage conserva seguimiento en memoria y avisa la limitación', () => {
    review(); spyOn(sessionStorage, 'setItem').and.throwError('Storage denied');
    service.confirm(); http.expectOne(BASE + '/requests/' + ID + '/confirm').flush(completed());
    expect(service.result()?.status).toBe('completed'); expect(service.error()).toContain('página abierta');
    service.refreshResult(); http.expectOne(BASE + '/requests/' + ID + '/result').flush(completed());
    expect(service.error()).toContain('página abierta');
  });

  it('un recibo vencido no afirma eliminación y permite cerrar explícitamente sólo el seguimiento local', () => {
    sessionStorage.setItem(KEY, JSON.stringify({ requestId: ID, receiptToken: RECEIPT, ownerId: 7 }));
    TestBed.resetTestingModule(); configure();
    service.refreshResult();
    http.expectOne(BASE + '/requests/' + ID + '/result').flush({}, { status: 404, statusText: 'Not Found' });
    expect(service.receiptUnavailable()).toBeTrue(); expect(service.result()).toBeNull();
    expect(service.outcomeUnknown()).toBeTrue(); service.start(); http.expectNone(() => true);
    service.discardUnavailableReceipt();
    expect(service.stage()).toBe('start'); expect(service.hasReceipt()).toBeFalse();
    expect(sessionStorage.getItem(KEY)).toBeNull(); expect(auth.clearDeletedAccountSession).not.toHaveBeenCalled();
    service.confirm(); http.expectNone(() => true);
  });

  it('un fallo transitorio de consulta no habilita descartar un seguimiento pendiente', () => {
    review(); service.confirm(); http.expectOne(BASE + '/requests/' + ID + '/confirm').flush({ ...completed(), status: 'in_progress' });
    service.refreshResult(); http.expectOne(BASE + '/requests/' + ID + '/result').flush({}, { status: 503, statusText: 'Unavailable' });
    service.discardUnavailableReceipt();
    expect(service.hasReceipt()).toBeTrue(); expect(service.stage()).toBe('result');
  });
});
