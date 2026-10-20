import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../../environments/environment';
import { Product } from '../../../core/models/product.model';
import { ProductService } from '../../../core/services/product.service';
import { ProductMarca } from './product-marca';

describe('Productos por marca: imágenes en cualquier dominio', () => {
  let component: ProductMarca;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      { provide: ActivatedRoute, useValue: {} },
      { provide: Router, useValue: {} },
      { provide: ProductService, useValue: {} },
      { provide: ToastrService, useValue: {} },
    ] });
    component = TestBed.runInInjectionContext(() => new ProductMarca());
  });

  it('carga una imagen relativa del backend sin apuntar al equipo del visitante', () => {
    const image = component.getProductImage({ imagen: '/uploads/tenis.png' } as Product);
    expect(image).toBe(`${environment.apiUrl}/uploads/tenis.png`);
    expect(image).not.toContain('localhost');
  });

  it('resuelve también las imágenes relativas de las variantes', () => {
    const product = { imagen: 'uploads/principal.png', variantes: [
      { imagenes: [] }, { imagenes: ['uploads/variante.png'] },
    ] } as unknown as Product;
    expect(component.getProductImage(product)).toBe(`${environment.apiUrl}/uploads/variante.png`);
  });

  it('conserva la URL completa y la prioridad de la imagen de una variante', () => {
    const product = { imagen: 'https://images.example/principal.png', variantes: [
      { imagenes: ['https://images.example/variante.png'] },
    ] } as unknown as Product;
    expect(component.getProductImage(product)).toBe('https://images.example/variante.png');
  });

  it('conserva las imágenes públicas del frontend', () => {
    for (const image of ['assets/images/no_imagen.webp', '/assets/images/no_imagen.webp']) {
      expect(component.getProductImage({ imagen: image } as Product)).toBe(image);
    }
  });

  it('acepta una imagen de CDN que omite el protocolo', () => {
    expect(component.getProductImage({ imagen: '//images.example/tenis.png' } as Product))
      .toBe('https://images.example/tenis.png');
  });

  it('conserva las imágenes de datos y las URL temporales ya resueltas', () => {
    for (const image of ['data:image/png;base64,AAAA', 'blob:https://sport.example/imagen']) {
      expect(component.getProductImage({ variantes: [{ imagenes: [image] }] } as unknown as Product)).toBe(image);
    }
  });

  it('mantiene la imagen alternativa cuando no hay una imagen utilizable', () => {
    for (const image of ['', 'null']) {
      const result = component.getProductImage({ nombre: 'Tenis & ropa', imagen: image } as Product);
      expect(result).toContain('https://ui-avatars.com/api/?name=Tenis%20%26%20ropa');
    }
  });
});
