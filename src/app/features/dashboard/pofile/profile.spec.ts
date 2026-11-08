import { HttpTestingController } from '@angular/common/http/testing';
import { componentTestProviders, flushComponentReads } from '../../../../../tests/shared-testing/component-test-bed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Profile } from './profile';

describe('Profile', () => {
  let component: Profile;
  let fixture: ComponentFixture<Profile>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Profile],
      providers: componentTestProviders()
    })
    .compileComponents();

    fixture = TestBed.createComponent(Profile);
    component = fixture.componentInstance;
    fixture.detectChanges();
    flushComponentReads(TestBed.inject(HttpTestingController));
    fixture.detectChanges();
  });

  afterEach(() => { fixture.destroy(); TestBed.inject(HttpTestingController).verify(); });

  it('muestra la vista con datos QA y sin mutaciones', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain("Mi Perfil");
  });

  it('ofrece la eliminación sin ejecutar una solicitud al abrir el perfil', () => {
    const link = fixture.nativeElement.querySelector('a[href="/account/delete"]') as HTMLAnchorElement | null;
    expect(link?.textContent).toContain('Eliminar cuenta');
    TestBed.inject(HttpTestingController).expectNone(request => request.method !== 'GET');
  });
});
