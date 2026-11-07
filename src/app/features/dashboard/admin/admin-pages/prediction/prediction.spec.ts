import { HttpTestingController } from '@angular/common/http/testing';
import { componentTestProviders, flushComponentReads } from '../../../../../../../tests/shared-testing/component-test-bed';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Prediction } from './prediction';

describe('Prediction', () => {
  let component: Prediction;
  let fixture: ComponentFixture<Prediction>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Prediction],
      providers: componentTestProviders()
    })
    .compileComponents();

    fixture = TestBed.createComponent(Prediction);
    component = fixture.componentInstance;
    fixture.detectChanges();
    flushComponentReads(TestBed.inject(HttpTestingController));
    fixture.detectChanges();
  });

  afterEach(() => { fixture.destroy(); TestBed.inject(HttpTestingController).verify(); });

  it('muestra la vista con datos QA y sin mutaciones', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain("Predicción mensual de demanda");
  });
});
