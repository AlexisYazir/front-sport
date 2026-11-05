import { HttpTestingController } from '@angular/common/http/testing';
import { componentTestProviders, flushComponentReads } from '../../../../tests/shared-testing/component-test-bed';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Offers } from './offers';

describe('Offers', () => {
  let component: Offers;
  let fixture: ComponentFixture<Offers>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Offers],
      providers: componentTestProviders()
    })
    .compileComponents();

    fixture = TestBed.createComponent(Offers);
    component = fixture.componentInstance;
    fixture.detectChanges();
    flushComponentReads(TestBed.inject(HttpTestingController));
    fixture.detectChanges();
  });

  afterEach(() => { fixture.destroy(); TestBed.inject(HttpTestingController).verify(); });

  it('muestra la vista con datos QA y sin mutaciones', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain("Ofertas");
  });
});
