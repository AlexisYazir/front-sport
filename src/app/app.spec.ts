import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { HttpTestingController } from '@angular/common/http/testing';
import { componentTestProviders, flushComponentReads } from '../../tests/shared-testing/component-test-bed';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: componentTestProviders(),
    }).compileComponents();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    flushComponentReads(TestBed.inject(HttpTestingController));
    expect(app).toBeTruthy();
  });

  it('renderiza la navegación, el contenido y el pie reales sin el título de la plantilla inicial', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    flushComponentReads(TestBed.inject(HttpTestingController));
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-navbar')).not.toBeNull();
    expect(compiled.querySelector('main router-outlet')).not.toBeNull();
    expect(compiled.querySelector('app-footer')).not.toBeNull();
    expect(compiled.textContent).not.toContain('Hello, ecommerce-app');
  });
});
