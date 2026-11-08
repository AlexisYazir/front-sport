import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AccountDeletionService } from '../../core/services/account-deletion.service';
import type { DeletionResult, DeletionVerification } from '../../core/services/account-deletion.types';
import { AccountDeletionComponent } from './account-deletion';

const confirmationToken = 'c'.repeat(43);
const operationId = 'd539155c-3bb7-44b6-8d12-d53b9d4ff642';

function verified(): DeletionVerification {
  return {
    status: 'identity_verified', confirmationToken, expiresAt: '2030-01-01T12:10:00.000Z',
    consequences: {
      irreversible: true, endsAllSessions: true, newRegistrationIsSeparate: true,
      retainedCategories: ['orders', 'payments'], requiresAttention: false, reason: null,
      retentionPolicy: { basis: 'Conservación legal de comprobantes', days: 90 },
    },
  };
}

function result(status: DeletionResult['status'] = 'completed'): DeletionResult {
  return { requestId: operationId, status, reason: null, retainedCategories: [], notification: 'not_required' };
}

function mockApi() {
  return {
    stage: signal<'start' | 'code' | 'review' | 'result'>('start'), busy: signal(false),
    error: signal<string | null>(null), challengeExpiresAt: signal<string | null>(null),
    verification: signal<DeletionVerification | null>(null), result: signal<DeletionResult | null>(null),
    outcomeUnknown: signal(false), canStart: signal(true), signedIn: signal(true), hasReceipt: signal(false), receiptUnavailable: signal(false),
    start: jasmine.createSpy('start'), verify: jasmine.createSpy('verify'), confirm: jasmine.createSpy('confirm'),
    refreshResult: jasmine.createSpy('refreshResult'), cancel: jasmine.createSpy('cancel'),
    restartUnconfirmed: jasmine.createSpy('restartUnconfirmed'),
    discardUnavailableReceipt: jasmine.createSpy('discardUnavailableReceipt'),
  };
}

describe('AccountDeletionComponent: explicit, accessible self-service steps', () => {
  let api: ReturnType<typeof mockApi>;
  let fixture: ComponentFixture<AccountDeletionComponent>;
  let component: AccountDeletionComponent;
  const view = () => fixture.nativeElement as HTMLElement;
  const text = () => view().textContent ?? '';
  const button = (label: string) => Array.from(view().querySelectorAll('button')).find(element => element.textContent?.trim() === label);

  beforeEach(async () => {
    api = mockApi();
    await TestBed.configureTestingModule({
      imports: [AccountDeletionComponent],
      providers: [provideRouter([]), { provide: AccountDeletionService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(AccountDeletionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('shows the introduction without requesting, verifying or deleting on construction', () => {
    expect(text()).toContain('Eliminar mi cuenta');
    expect(text()).toContain('todavía no elimina tu cuenta');
    expect(api.start).not.toHaveBeenCalled();
    expect(api.verify).not.toHaveBeenCalled();
    expect(api.confirm).not.toHaveBeenCalled();
  });

  it('starts only after an explicit click and clears transient form values', () => {
    component.codeForm.controls.code.setValue('012345');
    component.confirmationForm.controls.confirmed.setValue(true);
    button('Enviar código de verificación')?.click();
    expect(api.start).toHaveBeenCalledTimes(1);
    expect(component.codeForm.controls.code.value).toBe('');
    expect(component.confirmationForm.controls.confirmed.value).toBeFalse();
    expect(api.confirm).not.toHaveBeenCalled();
  });

  it('offers sign-in with a return route for a visitor rather than asking for an editable email', () => {
    api.canStart.set(false); api.signedIn.set(false); fixture.detectChanges();
    const link = view().querySelector<HTMLAnchorElement>('a.button');
    expect(text()).toContain('Inicia sesión para comenzar');
    expect(link?.getAttribute('href')).toContain('/auth/login');
    expect(link?.getAttribute('href')).toContain('returnUrl=');
    expect(view().querySelector('input[type="email"]')).toBeNull();
    component.start();
    expect(api.start).not.toHaveBeenCalled();
  });

  it('directs a signed-in team account to support without showing the customer start action', () => {
    api.canStart.set(false); fixture.detectChanges();
    expect(text()).toContain('Atención para cuentas del equipo');
    expect(button('Enviar código de verificación')).toBeUndefined();
    expect(view().querySelector<HTMLAnchorElement>('a[href^="mailto:"]')?.href).toContain(component.supportEmail);
  });

  it('keeps all six code digits including a leading zero, then clears the input', () => {
    api.stage.set('code'); fixture.detectChanges();
    const input = view().querySelector<HTMLInputElement>('#deletion-code');
    expect(input?.type).toBe('text');
    expect(input?.inputMode).toBe('numeric');
    expect(input?.autocomplete).toBe('one-time-code');
    component.codeForm.controls.code.setValue('012345');
    component.verifyCode();
    expect(api.verify).toHaveBeenCalledWith('012345');
    expect(component.codeForm.controls.code.value).toBe('');
    expect(api.confirm).not.toHaveBeenCalled();
  });

  for (const code of ['', '12345', '1234567', '12a456', ' 12345']) {
    it(`rejects malformed code ${JSON.stringify(code)} locally`, () => {
      api.stage.set('code'); component.codeForm.controls.code.setValue(code);
      component.verifyCode(); fixture.detectChanges();
      expect(api.verify).not.toHaveBeenCalled();
      expect(view().querySelector('#code-error')?.textContent).toContain('seis dígitos');
      expect(view().querySelector('#deletion-code')?.getAttribute('aria-invalid')).toBe('true');
    });
  }

  it('blocks a double verification while the service is busy', () => {
    api.stage.set('code'); component.codeForm.controls.code.setValue('012345');
    api.verify.and.callFake(() => api.busy.set(true));
    component.verifyCode();
    component.codeForm.controls.code.setValue('123456');
    component.verifyCode();
    expect(api.verify).toHaveBeenCalledTimes(1);
  });

  it('reviews consequences and retention without printing the confirmation credential', () => {
    api.stage.set('review'); api.verification.set(verified()); fixture.detectChanges();
    expect(text()).toContain('La eliminación es irreversible');
    expect(text()).toContain('sin recuperar el historial');
    expect(text()).toContain('Pedidos y comprobantes de compra');
    expect(text()).toContain('Registros de pagos');
    expect(text()).toContain('Conservación legal de comprobantes');
    expect(text()).not.toContain(confirmationToken);
    expect(button('Eliminar mi cuenta')?.disabled).toBeTrue();
  });

  it('requires a separate checked confirmation before the destructive method is called', () => {
    api.stage.set('review'); api.verification.set(verified());
    component.confirmDeletion();
    expect(api.confirm).not.toHaveBeenCalled();
    component.confirmationForm.controls.confirmed.setValue(true);
    component.confirmDeletion();
    expect(api.confirm).toHaveBeenCalledTimes(1);
    expect(component.confirmationForm.controls.confirmed.value).toBeFalse();
  });

  it('does not confirm while busy or after the service invalidates an expired review', () => {
    api.stage.set('review'); api.verification.set(verified());
    component.confirmationForm.controls.confirmed.setValue(true); api.busy.set(true);
    component.confirmDeletion();
    expect(api.confirm).not.toHaveBeenCalled();
    api.busy.set(false); api.verification.set(null); api.stage.set('code');
    component.confirmDeletion();
    expect(api.confirm).not.toHaveBeenCalled();
  });

  it('cancels before confirmation and clears the code and confirmation choice', () => {
    api.stage.set('review'); api.verification.set(verified());
    component.codeForm.controls.code.setValue('012345'); component.confirmationForm.controls.confirmed.setValue(true);
    component.cancel();
    expect(api.cancel).toHaveBeenCalledTimes(1);
    expect(component.codeForm.controls.code.value).toBe('');
    expect(component.confirmationForm.controls.confirmed.value).toBeFalse();
    expect(api.confirm).not.toHaveBeenCalled();
  });

  it('never discards a receipt or starts another deletion from a processing result', () => {
    api.stage.set('result'); api.hasReceipt.set(true); api.result.set(result('in_progress')); fixture.detectChanges();
    component.cancel(); component.start(); component.restartUnconfirmed();
    expect(api.cancel).not.toHaveBeenCalled();
    expect(api.start).not.toHaveBeenCalled();
    expect(api.restartUnconfirmed).not.toHaveBeenCalled();
    expect(button('Iniciar una nueva solicitud')).toBeUndefined();
  });

  for (const status of ['received', 'identity_verified', 'deletion_confirmed', 'in_progress', 'requires_attention', 'error'] as const) {
    it(`does not describe ${status} as a completed deletion`, () => {
      api.stage.set('result'); api.hasReceipt.set(true); api.result.set(result(status)); fixture.detectChanges();
      expect(view().querySelector('#result-title')?.textContent).not.toContain('Tu cuenta fue eliminada');
      expect(api.confirm).not.toHaveBeenCalled();
    });
  }

  it('shows a lost confirmation response as unknown and offers receipt lookup only', () => {
    api.stage.set('result'); api.hasReceipt.set(true); api.outcomeUnknown.set(true); fixture.detectChanges();
    expect(view().querySelector('#result-title')?.textContent).toContain('Aún no confirmamos el resultado');
    expect(button('Eliminar mi cuenta')).toBeUndefined();
    button('Consultar estado')?.click();
    expect(api.refreshResult).toHaveBeenCalledTimes(1);
    expect(api.confirm).not.toHaveBeenCalled();
    expect(api.start).not.toHaveBeenCalled();
  });

  it('shows completion only from a completed response, including a pending email notification', () => {
    api.stage.set('result'); api.hasReceipt.set(true);
    api.result.set({ ...result('completed'), notification: 'pending' }); fixture.detectChanges();
    expect(view().querySelector('#result-title')?.textContent).toContain('Tu cuenta fue eliminada');
    expect(text()).toContain('notificación por correo está pendiente');
    expect(text()).toContain('Un registro futuro creará una cuenta nueva');
  });

  it('shows restricted retained categories and their actual expiry rather than claiming immediate erasure', () => {
    api.stage.set('result'); api.hasReceipt.set(true);
    api.result.set({ ...result(), retainedCategories: ['orders'], retention: {
      until: '2030-01-15T12:00:00.000Z', basis: 'Conservación legal de prueba', identifiersExpired: false,
    } }); fixture.detectChanges();
    expect(text()).toContain('Registros conservados');
    expect(text()).toContain('Conservación legal de prueba');
    expect(text()).toContain('15/01/2030');
  });

  it('maps technical reasons and unknown categories to understandable copy', () => {
    api.stage.set('result'); api.hasReceipt.set(true);
    api.result.set({ ...result('requires_attention'), reason: 'schema_review_required', retainedCategories: ['internal_table_name'] }); fixture.detectChanges();
    expect(text()).not.toContain('schema_review_required');
    expect(text()).not.toContain('internal_table_name');
    expect(text()).toContain('Otros registros sujetos a conservación legal');
  });

  it('allows a fresh request only when the server says the earlier deletion was not confirmed', () => {
    api.stage.set('result'); api.hasReceipt.set(true); api.result.set(result('received')); fixture.detectChanges();
    expect(text()).toContain('todavía no acredita una eliminación confirmada');
    button('Iniciar una nueva solicitud')?.click();
    expect(api.restartUnconfirmed).toHaveBeenCalledTimes(1);
    expect(api.start).not.toHaveBeenCalled();
    api.outcomeUnknown.set(true); component.restartUnconfirmed();
    expect(api.restartUnconfirmed).toHaveBeenCalledTimes(1);
  });

  it('does not query a missing receipt or display a fabricated result', () => {
    api.stage.set('result'); api.hasReceipt.set(false); api.outcomeUnknown.set(true); fixture.detectChanges();
    expect(text()).toContain('No encontramos el comprobante');
    expect(button('Consultar estado')).toBeUndefined();
    expect(api.refreshResult).not.toHaveBeenCalled();
    expect(view().querySelector('#result-title')?.textContent).not.toContain('Tu cuenta fue eliminada');
  });

  it('lets the user close an unavailable receipt without canceling or confirming a deletion', () => {
    api.stage.set('result'); api.hasReceipt.set(true); api.outcomeUnknown.set(true); api.receiptUnavailable.set(true);
    component.codeForm.controls.code.setValue('012345'); component.confirmationForm.controls.confirmed.setValue(true);
    fixture.detectChanges();
    expect(text()).toContain('Cerrar el seguimiento no cancela una solicitud ni acredita que la cuenta se haya eliminado');
    button('Cerrar este seguimiento')?.click();
    expect(api.discardUnavailableReceipt).toHaveBeenCalledTimes(1);
    expect(api.confirm).not.toHaveBeenCalled(); expect(api.cancel).not.toHaveBeenCalled(); expect(api.start).not.toHaveBeenCalled();
    expect(component.codeForm.controls.code.value).toBe('');
    expect(component.confirmationForm.controls.confirmed.value).toBeFalse();
  });

  it('does not discard a valid receipt or any receipt while an operation is busy', () => {
    api.stage.set('result'); api.hasReceipt.set(true);
    component.discardUnavailableReceipt();
    expect(api.discardUnavailableReceipt).not.toHaveBeenCalled();
    api.receiptUnavailable.set(true); api.busy.set(true);
    component.discardUnavailableReceipt();
    expect(api.discardUnavailableReceipt).not.toHaveBeenCalled();
  });

  it('shows progress after consuming the confirmation authorization while awaiting the result', () => {
    api.stage.set('review'); api.busy.set(true); api.verification.set(null); fixture.detectChanges();
    expect(view().querySelector('[role="status"]')?.textContent).toContain('Procesando tu solicitud');
    expect(text()).not.toContain('Tu cuenta fue eliminada');
    expect(api.confirm).not.toHaveBeenCalled();
  });
});
