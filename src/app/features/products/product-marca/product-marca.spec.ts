import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductMarca } from './product-marca';

describe('ProductMarca', () => {
  let component: ProductMarca;
  let fixture: ComponentFixture<ProductMarca>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductMarca]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductMarca);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
