import { HttpTestingController } from '@angular/common/http/testing';
import { componentTestProviders, flushComponentReads } from '../../../../../tests/shared-testing/component-test-bed';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductList } from './product-list';

describe('ProductList', () => {
  let component: ProductList;
  let fixture: ComponentFixture<ProductList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductList],
      providers: componentTestProviders()
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductList);
    component = fixture.componentInstance;
    fixture.detectChanges();
    flushComponentReads(TestBed.inject(HttpTestingController));
    fixture.detectChanges();
  });

  afterEach(() => { fixture.destroy(); TestBed.inject(HttpTestingController).verify(); });

  it('muestra la vista con datos QA y sin mutaciones', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain("Catálogo de Productos");
  });
});
