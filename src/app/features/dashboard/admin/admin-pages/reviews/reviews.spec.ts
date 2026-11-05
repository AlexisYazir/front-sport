import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideLucideIcons } from '@lucide/angular';
import { ToastrService } from 'ngx-toastr';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../../../../environments/environment';
import { ReviewModerationDetail, ReviewReport } from '../../../../../core/models/product.model';
import { SPORT_CENTER_ICONS } from '../../../../../shared/icons/sport-center-icons';
import { AuthService } from '../../../../../core/services/auth.service';
import { User, UserRole } from '../../../../../core/models/user.model';
import { ReviewsPage } from './reviews';

const base = environment.apiUrl + '/products/reviews';
const report: ReviewReport = { id_mensaje: 31, nombre: 'Cliente QA', email: 'qa@example.invalid', asunto: 'Reporte de reseña #7', mensaje: 'Revisar este comentario QA', created_at: '2026-01-01T00:00:00Z', leido: false, respondido: false, id_review: 7, id_producto: 9, referencia_valida: true, estado_atencion: 'pendiente' };
const initial: ReviewModerationDetail = {
  review: { id_review: 7, id_producto: 9, id_usuario: 6, usuario: 'Autor QA', producto: 'Balón QA', calificacion: 4, comentario: 'Comentario QA', fecha: '2026-01-01T00:00:00Z', retirada: false, revision: 0 },
  reports: [report], history: [],
};

describe('ReviewsPage: moderación con plantilla y HTTP reales', () => {
  let fixture: ComponentFixture<ReviewsPage>;
  let component: ReviewsPage;
  let http: HttpTestingController;
  let toastr: jasmine.SpyObj<ToastrService>;
  let users: BehaviorSubject<User | null>;
  const reportRequest = (state = 'pendiente', page = 1): TestRequest => http.expectOne(base + `/admin/reports?estado=${state}&page=${page}&limit=20`);
  const boot = () => {
    fixture.detectChanges();
    http.expectOne(base + '/admin/all').flush([initial.review]);
    reportRequest().flush({ items: [report], total: 1, page: 1, limit: 20 });
    fixture.detectChanges();
  };
  const open = (detail = initial) => {
    component.openReport(report);
    http.expectOne(base + '/admin/7/moderation').flush(detail);
    fixture.detectChanges();
  };
  const save = (action: 'conservar' | 'retirar' | 'restaurar', reason = 'Revisión de la reseña QA') => {
    component.decisionAction.set(action); component.decisionReason.set(reason);
    component.saveModeration(); fixture.detectChanges();
    return http.expectOne(base + '/admin/7/moderation');
  };
  const afterDecision = (detail: ReviewModerationDetail) => {
    http.expectOne(base + '/admin/all').flush([detail.review]);
    reportRequest().flush({ items: [], total: 0, page: 1, limit: 20 });
    fixture.detectChanges();
  };

  beforeEach(async () => {
    toastr = jasmine.createSpyObj<ToastrService>('ToastrService', ['success', 'error']);
    users = new BehaviorSubject<User | null>({ id: 77, nombre: 'Admin QA', aPaterno: 'QA', aMaterno: 'QA', email: 'admin@example.invalid', telefono: '0000000000', rol: UserRole.ADMIN, activo: 1 });
    await TestBed.configureTestingModule({ imports: [ReviewsPage], providers: [
      provideHttpClient(), provideHttpClientTesting(), provideLucideIcons(...SPORT_CENTER_ICONS),
      { provide: ToastrService, useValue: toastr },
      { provide: AuthService, useValue: { currentUser$: () => users.asObservable() } },
    ] }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ReviewsPage); component = fixture.componentInstance;
  });
  afterEach(() => { fixture.destroy(); http.verify({ ignoreCancelled: true }); });

  it('muestra la cola, pagina y cambia el filtro sin guardar una decisión', () => {
    boot();
    expect(fixture.nativeElement.textContent).toContain('Folio #31');
    component.reportTotal.set(21); component.loadReports(2);
    reportRequest('pendiente', 2).flush({ items: [], total: 21, page: 2, limit: 20 });
    component.changeReportFilter('atendido');
    reportRequest('atendido').flush({ items: [], total: 0, page: 1, limit: 20 });
    expect(component.reportPage()).toBe(1); expect(component.reportFilter()).toBe('atendido');
    http.expectNone(request => request.method === 'POST');
  });

  it('abre el folio correcto y muestra estado e historial sin editar actor ni fecha', () => {
    boot(); open();
    expect(component.selectedReportId()).toBe(31);
    expect(fixture.nativeElement.textContent).toContain('Visible · Revisión 0');
    expect(fixture.nativeElement.textContent).toContain('todavía no tiene decisiones');
    expect(fixture.nativeElement.querySelector('input[name="id_administrador"]')).toBeNull();
    const label = fixture.nativeElement.querySelector('label[for="decision-reason"]');
    expect(label.textContent).toContain('Motivo');
  });

  it('impide un folio inválido y la publicación con motivo vacío, espacios o más de 1000 caracteres', () => {
    boot();
    component.openReport({ ...report, referencia_valida: false });
    http.expectNone(base + '/admin/7/moderation');
    open();
    for (const reason of ['', '   ', 'x'.repeat(1001)]) {
      component.decisionReason.set(reason); component.saveModeration(); expect(component.canSave()).toBeFalse();
    }
    http.expectNone(request => request.method === 'POST');
  });

  it('retira con revisión esperada, evita doble envío y muestra el evento del servidor', () => {
    boot(); open();
    component.decisionAction.set('retirar'); component.decisionReason.set('  Decisión QA  ');
    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    component.saveModeration(); fixture.detectChanges();
    const request = http.expectOne(base + '/admin/7/moderation');
    expect(request.request.body).toEqual({ accion: 'retirar', motivo: 'Decisión QA', revision_esperada: 0, id_mensaje: 31 });
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBeTrue();
    const updated: ReviewModerationDetail = { ...initial, review: { ...initial.review, retirada: true, revision: 1 }, history: [{ id_evento: 5, id_review: 7, id_mensaje: 31, accion: 'retirar', motivo: 'Decisión QA', id_administrador: 77, fecha: '2026-01-02T00:00:00Z', retirada_anterior: false, retirada_nueva: true, revision: 1 }] };
    request.flush(updated); afterDecision(updated);
    expect(component.isSaving()).toBeFalse(); expect(component.decisionReason()).toBe('');
    expect(fixture.nativeElement.textContent).toContain('Retirada de la vista pública');
    expect(fixture.nativeElement.textContent).toContain('Administrador #77');
    expect(fixture.nativeElement.textContent).toContain('Visible → Retirada');
    expect(toastr.success).toHaveBeenCalledTimes(1);
  });

  it('conservar una reseña retirada no la restaura; restaurar requiere decisión explícita', () => {
    boot(); open({ ...initial, review: { ...initial.review, retirada: true, revision: 2 } });
    const request = save('conservar');
    expect(request.request.body.accion).toBe('conservar');
    const kept = { ...initial, review: { ...initial.review, retirada: true, revision: 3 } };
    request.flush(kept); afterDecision(kept);
    expect(component.moderation()?.review.retirada).toBeTrue();
    const restore = save('restaurar');
    expect(restore.request.body.revision_esperada).toBe(3);
    const restored = { ...initial, review: { ...initial.review, retirada: false, revision: 4 } };
    restore.flush(restored); afterDecision(restored);
    expect(component.moderation()?.review.retirada).toBeFalse();
  });

  it('conserva el 409, bloquea otro envío y exige recargar la revisión antes de decidir', () => {
    boot(); open(); save('retirar').flush({}, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(component.decisionNeedsReload()).toBeTrue(); expect(component.canSave()).toBeFalse();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('reseña cambió');
    component.saveModeration(); http.expectNone(base + '/admin/7/moderation');
    component.reloadModeration();
    http.expectOne(base + '/admin/7/moderation').flush({ ...initial, review: { ...initial.review, retirada: true, revision: 8 } });
    expect(component.decisionNeedsReload()).toBeFalse();
    component.decisionAction.set('restaurar'); component.decisionReason.set('Revisado el historial');
    component.saveModeration();
    const next = http.expectOne(base + '/admin/7/moderation');
    expect(next.request.body.revision_esperada).toBe(8);
    next.flush({}, { status: 409, statusText: 'Conflict' });
    expect(toastr.success).not.toHaveBeenCalled();
  });

  it('un error de red en una decisión no produce éxito ni reintento automático', () => {
    boot(); open(); save('retirar').error(new ProgressEvent('network'));
    fixture.detectChanges();
    expect(component.decisionNeedsReload()).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('No pudimos confirmar');
    http.expectNone(base + '/admin/7/moderation'); expect(toastr.success).not.toHaveBeenCalled();
  });

  it('403 descarta datos privados, invalida la selección y no admite una decisión', () => {
    boot(); open(); save('retirar').flush({}, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(component.accessDenied()).toBeTrue(); expect(component.reviews()).toEqual([]);
    expect(component.reports()).toEqual([]); expect(component.moderation()).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('qa@example.invalid');
    expect(fixture.nativeElement.textContent).toContain('No tienes permiso');
    component.saveModeration(); component.openReport(report); http.expectNone(base + '/admin/7/moderation');
  });

  it('no muestra confirmación de actualización si falla la lectura de reportes', () => {
    boot(); component.loadReports(); reportRequest().flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No fue posible cargar los reportes');
    expect(toastr.success).not.toHaveBeenCalled();
  });

  it('no inventa revisión cero si falta el endpoint o la respuesta no tiene revisión', () => {
    boot(); component.openReport(report);
    http.expectOne(base + '/admin/7/moderation').flush({}, { status: 404, statusText: 'Not Found' });
    expect(component.canSave()).toBeFalse(); expect(component.moderation()).toBeNull();
    component.reloadModeration();
    http.expectOne(base + '/admin/7/moderation').flush({ review: { id_review: 7, retirada: false }, reports: [], history: [] });
    component.decisionReason.set('Motivo QA'); component.saveModeration();
    expect(component.canSave()).toBeFalse(); expect(component.moderation()).toBeNull();
    http.expectNone(request => request.method === 'POST');
  });

  it('no desvincula silenciosamente el folio si el detalle ya no lo contiene', () => {
    boot(); open({ ...initial, reports: [] });
    component.decisionReason.set('Motivo QA'); component.saveModeration();
    expect(component.selectedReportId()).toBe(31); expect(component.canSave()).toBeFalse();
    expect(component.moderationError()).toContain('folio');
    http.expectNone(request => request.method === 'POST');
  });

  it('no convierte una respuesta incompatible de escritura en una confirmación', () => {
    boot(); open(); save('retirar').flush(initial);
    expect(component.decisionNeedsReload()).toBeTrue(); expect(component.canSave()).toBeFalse();
    expect(toastr.success).not.toHaveBeenCalled();
    http.expectNone(request => request.url === base + '/admin/all');
  });

  it('borra los datos al cerrar o cambiar la sesión y cancela lecturas pendientes', () => {
    boot(); open(); component.reloadModeration();
    const pending = http.expectOne(base + '/admin/7/moderation');
    users.next(null); fixture.detectChanges();
    expect(pending.cancelled).toBeTrue();
    expect(component.reports()).toEqual([]); expect(component.reviews()).toEqual([]);
    expect(component.moderation()).toBeNull(); expect(component.canSave()).toBeFalse();
    expect(fixture.nativeElement.textContent).not.toContain('qa@example.invalid');
    component.refresh(); http.expectNone(request => request.url.startsWith(base));
  });
});
