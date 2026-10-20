import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { CompanyService } from '../../../core/services/company.service';
import { ContactPage } from './contact';

describe('Contacto: regreso después del inicio de sesión', () => {
  let component: ContactPage;
  let navigate: jasmine.Spy;
  let sendMessage: jasmine.Spy;

  beforeEach(() => {
    navigate = jasmine.createSpy('navigate');
    sendMessage = jasmine.createSpy('sendContactMessage').and.returnValue(of({}));
    TestBed.configureTestingModule({ providers: [
      { provide: Router, useValue: { navigate } },
      { provide: AuthService, useValue: { currentUser: () => null } },
      { provide: CompanyService, useValue: { sendContactMessage: sendMessage } },
      { provide: ToastrService, useValue: jasmine.createSpyObj('ToastrService', ['warning', 'success', 'error']) },
    ] });
    component = TestBed.runInInjectionContext(() => new ContactPage());
  });

  it('el botón de acceso conserva la ruta real de Contacto como destino de regreso', () => {
    component.goToLogin();
    expect(navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/support/contact' },
    });
  });

  it('al enviar sin sesión solicita acceso y no envía el mensaje', () => {
    component.onSubmit();
    expect(navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/support/contact' },
    });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('conserva el envío normal cuando hay una sesión y datos válidos', () => {
    component.isAuthenticated.set(true);
    component.form = { nombre: 'Cliente', email: 'cliente@example.com', asunto: 'soporte', mensaje: 'Consulta sobre un producto' };
    component.onSubmit();
    expect(sendMessage).toHaveBeenCalledWith(component.form);
    expect(component.submitted).toBeTrue();
    expect(component.isLoading()).toBeFalse();
    expect(navigate).not.toHaveBeenCalled();
  });
});
