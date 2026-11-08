import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { SKIP_AUTH_RETRY } from '../interceptors/auth-request-context';
import { ReviewModerationDetail, ReviewModerationRequest } from '../models/product.model';
import { AuthService } from './auth.service';
import { ProductService } from './product.service';
import { TokenService } from './token.service';

const base = environment.apiUrl + '/products/reviews';
const detail: ReviewModerationDetail = {
  review: { id_review: 7, id_producto: 9, id_usuario: 6, calificacion: 4, comentario: 'Comentario QA', fecha: '2026-01-01T00:00:00Z', retirada: false, revision: 0 },
  reports: [], history: [],
};

describe('ProductService: contrato de moderación', () => {
  let service: ProductService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ProductService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('consulta la cola privada con estado y página y no reutiliza una copia', () => {
    for (let read = 0; read < 2; read++) {
      service.getReviewReports('atendido', 2, 20).subscribe();
      const request = http.expectOne(base + '/admin/reports?estado=atendido&page=2&limit=20');
      expect(request.request.method).toBe('GET');
      request.flush({ items: [], total: 21, page: 2, limit: 20 });
    }
  });

  it('lee detalle e historial sin caché y conserva el error 403', () => {
    let status = 0;
    service.getReviewModeration(7).subscribe({ error: error => { status = error.status; } });
    http.expectOne(base + '/admin/7/moderation').flush({}, { status: 403, statusText: 'Forbidden' });
    expect(status).toBe(403);
    service.getReviewModeration(7).subscribe(value => expect(value).toEqual(detail));
    http.expectOne(base + '/admin/7/moderation').flush(detail);
  });

  it('no conserva la lista administrativa en la caché compartida', () => {
    for (let read = 0; read < 2; read++) {
      service.getAllReviewsAdmin().subscribe();
      http.expectOne(base + '/admin/all').flush([detail.review]);
    }
  });

  it('envía sólo decisión, motivo, revisión y folio; actor y fecha quedan en servidor', () => {
    const input: ReviewModerationRequest = { accion: 'retirar', motivo: '  Revisión del reporte  ', revision_esperada: 0, id_mensaje: 31 };
    Object.assign(input, { id_administrador: 999, fecha: 'no-enviar', retirada: false });
    service.moderateReview(7, input).subscribe();
    const request = http.expectOne(base + '/admin/7/moderation');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ accion: 'retirar', motivo: 'Revisión del reporte', revision_esperada: 0, id_mensaje: 31 });
    expect(request.request.context.get(SKIP_AUTH_RETRY)).toBeTrue();
    expect(request.request.headers.has('X-Auth-Retry')).toBeFalse();
    request.flush({ ...detail, review: { ...detail.review, retirada: true, revision: 1 } });
  });

  it('invalida la lectura pública y administrativa después de una decisión aceptada', () => {
    service.getProductReviews(9).subscribe();
    http.expectOne(base + '/product/9').flush({ reviews: [detail.review], summary: { total: 1, promedio: 4 } });
    service.getAllReviewsAdmin().subscribe();
    http.expectOne(base + '/admin/all').flush([detail.review]);
    service.moderateReview(7, { accion: 'retirar', motivo: 'Motivo QA', revision_esperada: 0 }).subscribe();
    http.expectOne(base + '/admin/7/moderation').flush({ ...detail, review: { ...detail.review, retirada: true, revision: 1 } });
    service.getProductReviews(9).subscribe(value => expect(value).toEqual({ reviews: [], summary: { total: 0, promedio: 0 } }));
    http.expectOne(base + '/product/9').flush({ reviews: [], summary: { total: 0, promedio: 0 } });
    service.getAllReviewsAdmin().subscribe();
    http.expectOne(base + '/admin/all').flush([]);
  });

  it('entrega el 409 sin reenviar la decisión', () => {
    let status = 0;
    service.moderateReview(7, { accion: 'conservar', motivo: 'Motivo QA', revision_esperada: 0 }).subscribe({ error: error => { status = error.status; } });
    http.expectOne(base + '/admin/7/moderation').flush({}, { status: 409, statusText: 'Conflict' });
    expect(status).toBe(409);
    http.expectNone(base + '/admin/7/moderation');
  });
});

describe('Moderación: integración con el interceptor de sesión', () => {
  let service: ProductService;
  let http: HttpTestingController;
  let auth: jasmine.SpyObj<AuthService>;
  let navigate: jasmine.Spy;
  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['isLoggedIn', 'shouldRefreshSoon', 'refreshAccessToken', 'logout', 'captureSession', 'isCurrentSession']);
    auth.captureSession.and.returnValue({userId:3,sessionId:'moderation-session',epoch:1});
    auth.isCurrentSession.and.returnValue(true);
    auth.isLoggedIn.and.returnValue(true); auth.shouldRefreshSoon.and.returnValue(false);
    auth.refreshAccessToken.and.returnValue(of('token-renovado-qa'));
    navigate = jasmine.createSpy('navigate');
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
      { provide: AuthService, useValue: auth },
      { provide: TokenService, useValue: { getAccessToken: () => 'token-inicial-qa' } },
      { provide: Router, useValue: { navigate } },
      { provide: ToastrService, useValue: { error: jasmine.createSpy('error') } },
    ] });
    service = TestBed.inject(ProductService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function usePreemptiveHttpRefresh(): void {
    auth.shouldRefreshSoon.and.returnValue(true);
    auth.refreshAccessToken.and.callFake(() => TestBed.inject(HttpClient)
      .post<{ accessToken: string }>(environment.apiUrl + '/users/refresh-token', {}, { withCredentials: true })
      .pipe(map(response => response.accessToken)));
  }

  it('conserva el conflicto del único POST después de renovar antes del envío', () => {
    usePreemptiveHttpRefresh();
    let received: HttpErrorResponse | undefined;
    service.moderateReview(7, { accion: 'retirar', motivo: 'Motivo QA', revision_esperada: 0 })
      .subscribe({ error: (error: HttpErrorResponse) => { received = error; } });
    http.expectNone(base + '/admin/7/moderation');
    http.expectOne(environment.apiUrl + '/users/refresh-token').flush({ accessToken: 'token-renovado-qa' });
    const decision = http.expectOne(base + '/admin/7/moderation');
    expect(decision.request.method).toBe('POST');
    expect(decision.request.headers.get('Authorization')).toBe('Bearer token-renovado-qa');
    const conflict = { message: 'La reseña cambió durante la revisión.' };
    decision.flush(conflict, { status: 409, statusText: 'Conflict' });
    expect(received instanceof HttpErrorResponse).toBeTrue();
    expect(received?.status).toBe(409);
    expect(received?.error).toBe(conflict);
    expect(auth.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(auth.logout).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    http.expectNone(base + '/admin/7/moderation');
  });

  it('conserva el fallo de red del único POST después de renovar antes del envío', () => {
    usePreemptiveHttpRefresh();
    let received: HttpErrorResponse | undefined;
    service.moderateReview(7, { accion: 'retirar', motivo: 'Motivo QA', revision_esperada: 0 })
      .subscribe({ error: (error: HttpErrorResponse) => { received = error; } });
    http.expectNone(base + '/admin/7/moderation');
    http.expectOne(environment.apiUrl + '/users/refresh-token').flush({ accessToken: 'token-renovado-qa' });
    const decision = http.expectOne(base + '/admin/7/moderation');
    expect(decision.request.method).toBe('POST');
    const networkFailure = new ProgressEvent('error');
    decision.error(networkFailure);
    expect(received instanceof HttpErrorResponse).toBeTrue();
    expect(received?.status).toBe(0);
    expect(received?.error).toBe(networkFailure);
    expect(auth.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(auth.logout).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    http.expectNone(base + '/admin/7/moderation');
  });

  it('mantiene el cierre de sesión si la renovación previa falla y no envía la decisión', () => {
    usePreemptiveHttpRefresh();
    let received: Error | undefined;
    service.moderateReview(7, { accion: 'retirar', motivo: 'Motivo QA', revision_esperada: 0 })
      .subscribe({ error: (error: Error) => { received = error; } });
    http.expectOne(environment.apiUrl + '/users/refresh-token')
      .flush({}, { status: 503, statusText: 'Service Unavailable' });
    expect(received?.message).toBe('Unable to refresh session');
    expect(auth.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(auth.logout).toHaveBeenCalledOnceWith(false);
    expect(navigate).toHaveBeenCalledOnceWith(['/auth/login']);
    http.expectNone(base + '/admin/7/moderation');
  });

  it('no renueva ni repite el POST de moderación si responde 401', () => {
    let status = 0;
    service.moderateReview(7, { accion: 'retirar', motivo: 'Motivo QA', revision_esperada: 0 }).subscribe({ error: error => { status = error.status; } });
    const request = http.expectOne(base + '/admin/7/moderation');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token-inicial-qa');
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.headers.has('X-Auth-Retry')).toBeFalse();
    request.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(status).toBe(401); expect(auth.refreshAccessToken).not.toHaveBeenCalled();
    http.expectNone(base + '/admin/7/moderation');
  });

  it('conserva la renovación existente de un GET ordinario sin el contexto especial', () => {
    service.getReviewModeration(7).subscribe();
    http.expectOne(base + '/admin/7/moderation').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.refreshAccessToken).toHaveBeenCalledTimes(1);
    const retry = http.expectOne(base + '/admin/7/moderation');
    expect(retry.request.method).toBe('GET');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer token-renovado-qa');
    retry.flush(detail);
  });
});
