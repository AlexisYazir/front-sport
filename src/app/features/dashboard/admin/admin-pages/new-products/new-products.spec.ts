import { HttpTestingController } from '@angular/common/http/testing';
import { componentTestProviders, flushComponentReads } from '../../../../../../../tests/shared-testing/component-test-bed';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewProducts } from './new-products';

describe('NewProducts', () => {
  let component: NewProducts;
  let fixture: ComponentFixture<NewProducts>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewProducts],
      providers: componentTestProviders()
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewProducts);
    component = fixture.componentInstance;
    fixture.detectChanges();
    flushComponentReads(TestBed.inject(HttpTestingController));
    fixture.detectChanges();
  });

  afterEach(() => { fixture.destroy(); TestBed.inject(HttpTestingController).verify(); });

  it('muestra la vista con datos QA y sin mutaciones', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain("Productos Nuevos");
  });
});
