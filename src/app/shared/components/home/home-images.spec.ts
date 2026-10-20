import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideLucideIcons } from '@lucide/angular';
import { ToastrService } from 'ngx-toastr';
import { of } from 'rxjs';
import { CartService } from '../../../core/services/cart.service';
import { CompanyService } from '../../../core/services/company.service';
import { ProductService } from '../../../core/services/product.service';
import { Product } from '../../../core/models/product.model';
import { Home } from './home';
import { SPORT_CENTER_ICONS } from '../../icons/sport-center-icons';

describe('Inicio: imágenes de productos', () => {
  let fixture: ComponentFixture<Home>;
  const product = {
    id: 1, nombre: 'Tenis de prueba', marca: 'Sport Center', precio: 100,
    imagen: 'data:image/png;base64,invalid',
  } as Product;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        provideLucideIcons(...SPORT_CENTER_ICONS),
        { provide: ProductService, useValue: {
          getProducts: () => of([product]), getMarcas: () => of([]),
          getSports: () => of([]), getActiveShippingMethods: () => of([]),
          buildProductDetailRoute: () => ['/product/tenis/1'],
        } },
        { provide: CompanyService, useValue: { getActiveBannerImages: () => of([]) } },
        { provide: CartService, useValue: { cartItems: signal([]) } },
        { provide: ToastrService, useValue: jasmine.createSpyObj('ToastrService', ['error', 'success']) },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
  });

  it('conserva el origen de la imagen del producto mientras no falle', () => {
    const image: HTMLImageElement = fixture.nativeElement.querySelector('img[alt="Tenis de prueba"]');
    expect(image.getAttribute('src')).toBe(product.imagen);
  });

  it('el evento error de la plantilla muestra la alternativa local sin usar una variable global', () => {
    const image: HTMLImageElement = fixture.nativeElement.querySelector('img[alt="Tenis de prueba"]');
    expect(image.hasAttribute('onerror')).toBeFalse();
    expect(() => image.dispatchEvent(new Event('error'))).not.toThrow();
    expect(image.src).toBe(new URL('assets/images/no_imagen.webp', document.baseURI).href);
    expect(image.alt).toBe(product.nombre);
  });

  it('si falla también la alternativa, no inicia solicitudes repetidas', () => {
    const image: HTMLImageElement = fixture.nativeElement.querySelector('img[alt="Tenis de prueba"]');
    image.dispatchEvent(new Event('error'));
    const setter = spyOnProperty(image, 'src', 'set').and.callThrough();
    image.dispatchEvent(new Event('error'));
    expect(setter).not.toHaveBeenCalled();
  });
});
