import { HttpTestingController } from '@angular/common/http/testing';
import { componentTestProviders, flushComponentReads } from '../../../../../tests/shared-testing/component-test-bed';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductMarca } from './product-marca';

describe('ProductMarca', () => {
  let component: ProductMarca;
  let fixture: ComponentFixture<ProductMarca>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductMarca],
      providers: componentTestProviders({ nombre: 'Marca QA' })
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductMarca);
    component = fixture.componentInstance;
    fixture.detectChanges();
    flushComponentReads(TestBed.inject(HttpTestingController));
    fixture.detectChanges();
  });

  afterEach(() => { fixture.destroy(); TestBed.inject(HttpTestingController).verify(); });

  it('muestra la vista con datos QA y sin mutaciones', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain("Marca QA");
  });
});
