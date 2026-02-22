import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewProducts } from './new-products';

describe('NewProducts', () => {
  let component: NewProducts;
  let fixture: ComponentFixture<NewProducts>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewProducts]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewProducts);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
