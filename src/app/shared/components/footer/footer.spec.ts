import { HttpTestingController } from '@angular/common/http/testing';
import { componentTestProviders, flushComponentReads, qaUser } from '../../../../../tests/shared-testing/component-test-bed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '../../../core/services/auth.service';
import { UserRole } from '../../../core/models/user.model';

import { Footer } from './footer';

describe('Footer', () => {
  let component: Footer;
  let fixture: ComponentFixture<Footer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Footer],
      providers: componentTestProviders()
    })
    .compileComponents();

    fixture = TestBed.createComponent(Footer);
    component = fixture.componentInstance;
    fixture.detectChanges();
    flushComponentReads(TestBed.inject(HttpTestingController));
    fixture.detectChanges();
  });

  afterEach(() => { fixture.destroy(); TestBed.inject(HttpTestingController).verify(); });

  it('oculta el pie público para administración', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.querySelector('footer')).toBeNull();
  });

  it('muestra los enlaces de empresa y privacidad para la cuenta de cliente', () => {
    TestBed.inject(AuthService).currentUser.set({ ...qaUser, rol: UserRole.USUARIO });
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Sport Center QA');
    expect(element.querySelector('a[href="/legal/privacy"]')).not.toBeNull();
    expect(element.querySelector('a[href="/info/nosotros"]')).not.toBeNull();
  });
});
