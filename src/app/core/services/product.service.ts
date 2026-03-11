import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Product, Category, ProductFilters, ProductSearchResult, Categorie, Marca, Attibute, Orders,InventoryProduct, RecientProduct, ProductVariant } from '../models/product.model';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private http = inject(HttpClient);
  private readonly API_URL = environment.apiUrl;

  // Estado reactivo para productos
  private productsSubject = new BehaviorSubject<Product[]>([]);
  public products$ = this.productsSubject.asObservable();
  
  // Signals para estado de UI
  public isLoading = signal<boolean>(false);
  public searchTerm = signal<string>('');
  public activeFilters = signal<ProductFilters>({});

  constructor() {
    //constructor vacio para evitar cargar productos al inicio, ahora se cargan desde el componente de productos
    // Cargar productos iniciales
    // this.loadProducts().subscribe();
  }

  /* =====================================================
     MAPEO DE RESPUESTA BACKEND → MODELO FRONTEND
  ====================================================== */

  private mapProductFromApi(p: any): Product {
    const firstVariant = p.variantes?.[0];

    return {
      id: p.id_producto,
      nombre: p.producto,
      descripcion: p.descripcion,
      precio: firstVariant?.precio ?? 0,
      imagen: firstVariant?.imagenes?.[0] ?? 'assets/images/no-image.jpg',
      imagenes: firstVariant?.imagenes ?? [],
      categoria: p.categoria,
      stock: firstVariant?.stock ?? 0,
      disponible: (firstVariant?.stock ?? 0) > 0,
      marca: p.marca,
      imagen_marca: p.imagen_marca,
      descuento: 0,
      // Mantener datos originales por si se necesitan
      variantes: p.variantes,
      id_producto: p.id_producto,
      producto: p.producto,
      activo: p.activo,
      fecha_creacion: p.fecha_creacion,
      categoria_padre: p.categoria_padre
    };
  }

    private mapMarcaFromApi(m: any): Marca {
    return {
      id_marca: m.id_marca,
      nombre: m.nombre,
      imagen: m.imagen
    };
  }

    private mapCategoriaFromApi(c: any): Categorie {
    return {
      id_categoria: c.id_categoria,
      nombre: c.nombre,
      id_padre: c.id_padre
    };
  }

  private mapOrdersEmployeeFromApi(c: any): Orders {
    return {
        id_orden: c.id_orden,
        id_usuario: c.id_usuario,
        id_direccion_envio:c.id_direccion_envio,
        estado: c.estado, 
        subtotal: c.subtotal,
        descuento: c.descuento, 
        total: c.total, 
        metodo_pago: c.metodo_pago, 
        fecha_pago: c.fecha_pago,
        fecha_envio: c.fecha_envio, 
        fecha_entrega: c.fecha_entrega, 
        fecha_creacion: c.fecha_creacion
    };
  }

  private mapInventoryProductFromApi(p: any): InventoryProduct {
    return {
      id_producto: p.id_producto,
      producto: p.producto,
      activo: p.activo,
      precio: p.precio,
      stock: p.stock,
      marca: p.marca,
      imagen: p.imagen,
      fecha_creacion: p.fecha_creacion
    }
  }

  private mapAttributeFromApi(a: any): Attibute {
    return {
      id_atributo: a.id_atributo,
      nombre: a.nombre,
      id_padre: a.id_padre
    };
  }

  private mapRecentProductCreatedFromApi(p: any): RecientProduct {
    return {
      id_producto: p.id_producto,
      nombre: p.nombre,
      descripcion: p.descripcion,
      activo: p.activo,
      fecha_creacion: p.fecha_creacion
    }
  }

  private mapProductVariantFromApi(v: any): ProductVariant {
    return {
      id_variante: v.id_variante,
      id_producto: v.id_producto,
      sku: v.sku,
      precio: v.precio,
      stock: v.stock,
      imagenes: v.imagenes,
      atributos: v.atributos
    }
  }

  /**
   * Obtener todos los productos desde la API
   */
  getProducts(): Observable<Product[]> {
    return this.loadProducts();
  }

  /**
   * Cargar productos desde la API
   */
  loadProducts(): Observable<Product[]> {
    this.isLoading.set(true);

    return this.http
      .get<any[]>(`${this.API_URL}/products/get-all-products`)
      .pipe(
        map(response => {
           console.log('📦 RESPUESTA CRUDA DE LA API:', response);
          const mapped = response.map(p => this.mapProductFromApi(p));
          this.productsSubject.next(mapped);
          this.isLoading.set(false);
          console.log("prods", mapped);
          return mapped;
        })
      );
  }

  getMarcas(): Observable<Marca[]> {
    return this.loadMarcas();
  }

  /**
   * Cargar productos desde la API
   */
  loadMarcas(): Observable<Marca[]> {
    this.isLoading.set(true);

    return this.http
      .get<any[]>(`${this.API_URL}/products/get-all-marcas`)
      .pipe(
        map(response => {
          const mapped = response.map(p => this.mapMarcaFromApi(p));
          this.isLoading.set(false);
          return mapped;
        })
      );
  }

  getCategorias(): Observable<Categorie[]> {
    return this.loadCategorias();
  }

  /**
   * Cargar productos desde la API
   */
  loadCategorias(): Observable<Categorie[]> {
    this.isLoading.set(true);

    return this.http
      .get<any[]>(`${this.API_URL}/products/get-all-categories`)
      .pipe(
        map(response => {
          const mappedC = response.map(c => this.mapCategoriaFromApi(c));
          this.isLoading.set(false);
          return mappedC;
        })
      );
  }

    getAttributes(): Observable<Attibute[]> {
    this.isLoading.set(true);

    return this.http
      .get<any[]>(`${this.API_URL}/products/get-all-attributes`)
      .pipe(
        map(response => {
          const mapped = response.map(a => this.mapAttributeFromApi(a));
          this.isLoading.set(false);
          return mapped;
        })
      );
  }

  //funcion para traer productos al inv, con stock 0, inactivos o precio 0, para mostrar en el inventario
    getInventoryProducts(): Observable<InventoryProduct[]> {
    this.isLoading.set(true);

    return this.http
      .get<any[]>(`${this.API_URL}/products/get-inventory-products`)
      .pipe(
        map(response => {
          const mapped = response.map(p => this.mapInventoryProductFromApi(p));
          this.isLoading.set(false);
          return mapped;
        })
      );
  }
getProductVariants(id_producto: number): Observable<ProductVariant[]> {
  this.isLoading.set(true);
  return this.http.get<any[]>(`${this.API_URL}/products/get-variants-by-product/${id_producto}`).pipe(
    map(response => {
      console.log('📦 Respuesta de variantes (SERVICE):', response); // ← Debug
      this.isLoading.set(false);
      return response.map(v => this.mapProductVariantFromApi(v));
    })
  );
}

    getReceientProducts(): Observable<any[]> {
        this.isLoading.set(true);
    
        return this.http
          .get<any[]>(`${this.API_URL}/products/get-recient-products`)
          .pipe(
            map(response => {
              const mapped = response.map(u => this.mapRecentProductCreatedFromApi(u));
              this.isLoading.set(false);
              return mapped;
            })
          );
      }

  getProductsWithoutVariantsAttributes(): Observable<any[]> {
    this.isLoading.set(true);

    return this.http
      .get<any[]>(`${this.API_URL}/products/get-products-without-variants-attributes`)
      .pipe(
        map(response => {
          const mapped = response.map(u => this.mapRecentProductCreatedFromApi(u));
          this.isLoading.set(false);
          return mapped;
        })
      );
  }

  getOrdersEmployee(): Observable<any[]> {
    this.isLoading.set(true);

    return this.http
      .get<any[]>(`${this.API_URL}/products/get-all-orders-employee`)
      .pipe(
        map(response => {
          const mapped = response.map(u => this.mapOrdersEmployeeFromApi(u));
          this.isLoading.set(false);
          return mapped;
        })
      );
  }
  
  /**
   * Obtener producto por ID
   */
  getProductById(id: number): Observable<Product | null> {
    this.isLoading.set(true);
    
    return this.http
      .get<any[]>(`${this.API_URL}/products/get-all-products`)
      .pipe(
        map(products => {
          const found = products.find(p => p.id_producto === id);
          this.isLoading.set(false);
          console.log(found);
          return found ? this.mapProductFromApi(found) : null;
        })
      );
  }

/* =====================================================
    CREACIÓN PASO A PASO (SEGÚN BACKEND)
====================================================== */

/**
 * PASO 1: Crear la base del producto
 * POST: /products/create-product
 */
createBaseProduct(data: { nombre: string, descripcion: string, id_marca: number, id_categoria: number }): Observable<any> {
  this.isLoading.set(true);
  return this.http.post(`${this.API_URL}/products/create-product`, data).pipe(
    map(res => {
      this.isLoading.set(false);
      return res; // Retorna el objeto que contiene el id_producto creado
    })
  );
}

/**
 * PASO 2: Crear la variante del producto
 * POST: /products/create-product-variant
 */
createProductVariant(data: {id_producto: number, sku: string, precio: number, imagenes: string[], atributos: Record<string, any> }): Observable<any> {
  this.isLoading.set(true);
  return this.http
    .post(`${this.API_URL}/products/create-product-variant`, data)
    .pipe(
      map((res) => {
        this.isLoading.set(false);
        return res;
      })
    );
}


createProductVariantValues(data: { id_variante: number, id_atributo: number, valor: string }): Observable<any> {
  this.isLoading.set(true);
  return this.http.post(`${this.API_URL}/products/create-variant-attribute-values`, data).pipe(
    map(res => {
      this.isLoading.set(false);
      return res; // Retorna el objeto creado
    })
  );
}

createInventoryMovement(data: {
  id_variante: number;
  tipo: string;
  cantidad: number;
  costo_unitario: number;
  referencia_tipo: string;
  referencia_id: number;
}): Observable<any> {

  this.isLoading.set(true);

  return this.http.post(`${this.API_URL}/products/create-inventory-movement`, data).pipe(
    map(res => {
      this.isLoading.set(false);
      return res;
    })
  );
}


getInventoryMovements(): Observable<any> {
  this.isLoading.set(true);

  return this.http
    .get(`${this.API_URL}/products/inventory-movements`)
    .pipe(
      map((res) => {
        this.isLoading.set(false);
        return res;
      })
    );
}

createCatetorie(data: { nombre: string, id_padre: number | null }): Observable<any> {
  this.isLoading.set(true);
  //
  return this.http.post(`${this.API_URL}/products/create-categorie`, data).pipe(
    map(res => {
      this.isLoading.set(false);
      return res;
    })
  );
}

updateCatetorie(data: { id_categoria: number, nombre: string, id_padre: number | null }): Observable<any> {
  this.isLoading.set(true);
  //
  return this.http.put(`${this.API_URL}/products/update-categorie`, data).pipe(
    map(res => {
      this.isLoading.set(false);
      return res;
    })
  );
}

updateProductInv(data: { id_producto: number, estado: boolean }): Observable<any> {
  this.isLoading.set(true);
  //
  return this.http.put(`${this.API_URL}/products/update-product-inventory`, data).pipe(
    map(res => {
      this.isLoading.set(false);
      return res;
    })
  );
}

updateProductFull(data: { id_producto: number, id_marca: number, id_categoria: number, nombre: string, descripcion: string}): Observable<any> {
  this.isLoading.set(true);
  //
  return this.http.put(`${this.API_URL}/products/update-product-full`, data).pipe(
    map(res => {
      this.isLoading.set(false);
      return res;
    })
  );
}

updateProductVariant(data: {
  id_producto: number;
  id_variante: number;
  sku: string;
  precio: number;
  imagenes: string[];
  atributos: Record<string, any>;
}): Observable<any> {
  this.isLoading.set(true);
  
  return this.http.put(`${this.API_URL}/products/update-product-variant`, data).pipe(
    map(res => {
      this.isLoading.set(false);
      return res;
    })
  );
}


createMarca(data: { nombre: string, imagen: string }): Observable<any> {
  this.isLoading.set(true);
  
  return this.http.post(`${this.API_URL}/products/create-marca`, data).pipe(
    map(res => {
      this.isLoading.set(false);
      return res;
    })
  );
}

updateMarca(data: { id_marca: number, nombre: string, imagen: string }): Observable<any> {
  this.isLoading.set(true);
  
  return this.http.post(`${this.API_URL}/products/update-marca`, data).pipe(
    map(res => {
      this.isLoading.set(false);
      return res;
    })
  );
}

/**
 * PASO 3: Asignar atributos a la variante
 * POST: /products/create-variant-attribute-values
 */
createVariantAttributeValue(data: { id_variante: number, id_atributo: number, valor: string }): Observable<any> {
  return this.http.post(`${this.API_URL}/products/create-variant-attribute-values`, data);
}

/**
 * Función extra para crear nuevos atributos (Talla, Color, etc)
 * POST: /products/create-attribute
 */
createAttribute(nombre: string): Observable<Attibute> {
  return this.http.post<any>(`${this.API_URL}/products/create-attribute`, { nombre }).pipe(
    map(res => this.mapAttributeFromApi(res))
  );
}

  /**
   * Actualizar un producto existente (PUT a la API)
   */
  updateProduct(id: number, product: Partial<Product>): Observable<Product> {
    this.isLoading.set(true);

    // Convertir formato frontend a formato API
    const apiProduct = {
      producto: product.nombre,
      descripcion: product.descripcion,
      marca: product.marca,
      categoria: product.categoria,
      precio: product.precio,
      stock: product.stock,
    };

    return this.http
      .put<any>(`${this.API_URL}/products/update-product/${id}`, apiProduct)
      .pipe(
        map(response => {
          this.isLoading.set(false);
          // Recargar productos para actualizar la lista
          this.loadProducts().subscribe();
          return this.mapProductFromApi(response);
        })
      );
  }

  /**
   * Eliminar producto por ID (DELETE a la API)
   */
  deleteProduct(id: number): Observable<void> {
    this.isLoading.set(true);

    return this.http
      .delete<void>(`${this.API_URL}/products/delete-product/${id}`)
      .pipe(
        map(() => {
          this.isLoading.set(false);
          // Recargar productos para actualizar la lista
          this.loadProducts().subscribe();
        })
      );
  }

  /**
   * Obtener variantes de un producto específico
   */


  
  /* =====================================================
     BÚSQUEDA Y FILTROS (CLIENT-SIDE SOBRE DATA REAL)
  ====================================================== */

  /**
   * Buscar productos con filtros aplicados
   */
  searchProducts(searchTerm: string, filters: ProductFilters = {}): Observable<ProductSearchResult> {
    this.isLoading.set(true);
    this.searchTerm.set(searchTerm);
    this.activeFilters.set(filters);

    return this.http
      .get<any[]>(`${this.API_URL}/products/get-all-products`)
      .pipe(
        map(response => {
          let products = response.map(p => this.mapProductFromApi(p));

          // Filtro por término de búsqueda
          if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            products = products.filter(product =>
              product.nombre.toLowerCase().includes(term) ||
              product.descripcion.toLowerCase().includes(term) ||
              product.marca?.toLowerCase().includes(term) ||
              product.categoria.toLowerCase().includes(term)
            );
          }

          // Filtro por categoría
          if (filters.categoria && filters.categoria !== 'todos') {
            products = products.filter(p => p.categoria === filters.categoria);
          }

          // Filtro por marca
          if (filters.marca) {
            products = products.filter(p =>
              p.marca?.toLowerCase() === filters.marca?.toLowerCase()
            );
          }

          // Filtro por rango de precio
          if (filters.precioMin !== undefined) {
            products = products.filter(p => p.precio >= filters.precioMin!);
          }

          if (filters.precioMax !== undefined) {
            products = products.filter(p => p.precio <= filters.precioMax!);
          }

          // Filtro por disponibilidad
          if (filters.disponible !== undefined) {
            products = products.filter(p => p.disponible === filters.disponible);
          }

          // Ordenamiento
          if (filters.ordenarPor) {
            switch (filters.ordenarPor) {
              case 'precio-asc':
                products.sort((a, b) => a.precio - b.precio);
                break;
              case 'precio-desc':
                products.sort((a, b) => b.precio - a.precio);
                break;
              case 'nombre':
                products.sort((a, b) => a.nombre.localeCompare(b.nombre));
                break;
            }
          }

          const result: ProductSearchResult = {
            products,
            total: products.length,
            hasResults: products.length > 0
          };

          this.productsSubject.next(products);
          this.isLoading.set(false);

          return result;
        })
      );
  }

  /* =====================================================
     CATEGORÍAS Y MARCAS (DINÁMICAS DESDE API)
  ====================================================== */

  /**
   * Obtener categorías disponibles
   */
  getCategories(): Observable<Category[]> {
    return this.http
      .get<any[]>(`${this.API_URL}/products/get-all-products`)
      .pipe(
        map(products => {
          const uniqueCats = [...new Set(products.map(p => p.categoria))];

          return [
            { id: 'todos', nombre: 'Todos', icono: 'sports' },
            ...uniqueCats.map(cat => ({
              id: cat,
              nombre: cat,
              icono: 'category'
            }))
          ];
        })
      );
  }

  /**
   * Obtener marcas disponibles
   */
  getBrands(): Observable<string[]> {
    return this.http
      .get<any[]>(`${this.API_URL}/products/get-all-products`)
      .pipe(
        map(products =>
          [...new Set(products.map(p => p.marca).filter(Boolean))]
        )
      );
  }

  /* =====================================================
     UTILIDADES
  ====================================================== */

  /**
   * Limpiar filtros y recargar productos
   */
  clearFilters(): void {
    this.searchTerm.set('');
    this.activeFilters.set({});
    this.loadProducts().subscribe();
  }

  /**
   * Obtener precio con descuento aplicado
   */
  getPriceWithDiscount(product: Product): number {
    if (product.descuento && product.descuento > 0) {
      return product.precio * (1 - product.descuento / 100);
    }
    return product.precio;
  }
}