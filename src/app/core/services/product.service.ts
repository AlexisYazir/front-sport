import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { map, catchError, finalize } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Product, Category, ProductFilters, ProductSearchResult, Categorie, Marca, Attibute, Orders,InventoryProduct, RecientProduct, ProductVariant } from '../models/product.model';
import { RequestCacheService } from './request-cache.service';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private http = inject(HttpClient);
  private cache = inject(RequestCacheService);
  private readonly API_URL = environment.apiUrl;
  private readonly CACHE_TTL = 60_000;
  private readonly SHORT_CACHE_TTL = 20_000;

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
      categoria_padre: p.categoria_padre,
      deportes: Array.isArray(p.deportes) ? p.deportes : []
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
      imagen: p.imagen_producto || p.imagen,
      imagen_marca: p.imagen_marca || p.imagen,
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

    return this.cache
      .getOrSet(
        'products:list',
        () => this.http.get<any[]>(`${this.API_URL}/products/get-all-products`),
        this.CACHE_TTL,
      )
      .pipe(
        map(response => {
          const mapped = response.map(p => this.mapProductFromApi(p));
          this.productsSubject.next(mapped);
          return mapped;
        }),
        finalize(() => this.isLoading.set(false))
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

    return this.cache
      .getOrSet(
        'products:marcas',
        () => this.http.get<any[]>(`${this.API_URL}/products/get-all-marcas`),
        this.CACHE_TTL,
      )
      .pipe(
        map(response => {
          const mapped = response.map(p => this.mapMarcaFromApi(p));
          return mapped;
        }),
        finalize(() => this.isLoading.set(false))
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

    return this.cache
      .getOrSet(
        'products:categorias',
        () => this.http.get<any[]>(`${this.API_URL}/products/get-all-categories`),
        this.CACHE_TTL,
      )
      .pipe(
        map(response => {
          const mappedC = response.map(c => this.mapCategoriaFromApi(c));
          return mappedC;
        }),
        finalize(() => this.isLoading.set(false))
      );
  }

    getAttributes(): Observable<Attibute[]> {
    this.isLoading.set(true);

    return this.cache
      .getOrSet(
        'products:attributes',
        () => this.http.get<any[]>(`${this.API_URL}/products/get-all-attributes`),
        this.CACHE_TTL,
      )
      .pipe(
        map(response => {
          const mapped = response.map(a => this.mapAttributeFromApi(a));
          return mapped;
        }),
        finalize(() => this.isLoading.set(false))
      );
  }

  //funcion para traer productos al inv, con stock 0, inactivos o precio 0, para mostrar en el inventario
    getInventoryProducts(): Observable<InventoryProduct[]> {
    this.isLoading.set(true);

    return this.cache
      .getOrSet(
        'products:inventory',
        () => this.http.get<any[]>(`${this.API_URL}/products/get-inventory-products`),
        this.SHORT_CACHE_TTL,
      )
      .pipe(
        map(response => {
          const mapped = response.map(p => this.mapInventoryProductFromApi(p));
          return mapped;
        }),
        finalize(() => this.isLoading.set(false))
      );
  }
getProductVariants(id_producto: number): Observable<ProductVariant[]> {
  this.isLoading.set(true);
  return this.cache.getOrSet(
    `products:variants:${id_producto}`,
    () => this.http.get<any[]>(`${this.API_URL}/products/get-variants-by-product/${id_producto}`),
    this.SHORT_CACHE_TTL,
  ).pipe(
    map(response => {
      return response.map(v => this.mapProductVariantFromApi(v));
    }),
    finalize(() => this.isLoading.set(false))
  );
}

    getReceientProducts(): Observable<any[]> {
        this.isLoading.set(true);
    
        return this.cache
          .getOrSet(
            'products:recent',
            () => this.http.get<any[]>(`${this.API_URL}/products/get-recient-products`),
            this.SHORT_CACHE_TTL,
          )
          .pipe(
            map(response => {
              const mapped = response.map(u => this.mapRecentProductCreatedFromApi(u));
              return mapped;
            }),
            finalize(() => this.isLoading.set(false))
          );
      }

  getProductsWithoutVariantsAttributes(): Observable<any[]> {
    this.isLoading.set(true);

    return this.cache
      .getOrSet(
        'products:without-variants-attributes',
        () => this.http.get<any[]>(`${this.API_URL}/products/get-products-without-variants-attributes`),
        this.SHORT_CACHE_TTL,
      )
      .pipe(
        map(response => {
          const mapped = response.map(u => this.mapRecentProductCreatedFromApi(u));
          return mapped;
        }),
        finalize(() => this.isLoading.set(false))
      );
  }

  getOrdersEmployee(): Observable<any[]> {
    this.isLoading.set(true);

    return this.cache
      .getOrSet(
        'products:orders',
        () => this.http.get<any[]>(`${this.API_URL}/products/get-all-orders`),
        this.SHORT_CACHE_TTL,
      )
      .pipe(
        map(response => {
          const mapped = response.map(u => this.mapOrdersEmployeeFromApi(u));
          return mapped;
        }),
        finalize(() => this.isLoading.set(false))
      );
  }
  
  /**
   * Obtener producto por ID
   */
// product.service.ts

/**
 * Obtener producto por ID usando el endpoint específico
 */
getProductById(id: number): Observable<Product | null> {
  this.isLoading.set(true);
  
  // Usar el endpoint específico en lugar de filtrar todos los productos
  return this.cache
    .getOrSet(
      `products:detail:${id}`,
      () => this.http.get<any>(`${this.API_URL}/products/get-product-details/${id}`),
      this.SHORT_CACHE_TTL,
    )
    .pipe(
      map(response => {
        // Si el endpoint devuelve un array con un solo producto
        if (Array.isArray(response) && response.length > 0) {
          return this.mapProductFromApi(response[0]);
        }
        // Si devuelve un objeto directamente
        else if (response && typeof response === 'object') {
          return this.mapProductFromApi(response);
        }
        
        return null;
      }),
      catchError(error => {
        console.error('Error fetching product details:', error);
        return of(null); // Retorna null en caso de error
      }),
      finalize(() => this.isLoading.set(false))
    );
}

// product.service.ts

/**
 * Genera un slug amigable para URL
 */
generateSlug(nombre: string): string {
  if (!nombre) return '';
  
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

normalizeGenderSlug(value: string): string {
  const slug = this.generateSlug(value);
  const genderMap: Record<string, string> = {
    hombre: 'hombre',
    hombres: 'hombre',
    mujer: 'mujer',
    mujeres: 'mujer',
    nino: 'nino',
    ninos: 'nino',
    nina: 'nina',
    ninas: 'nina',
    unisex: 'unisex'
  };

  return genderMap[slug] || slug;
}

buildProductRouteId(id: number): string {
  const safeId = Number(id);
  if (!Number.isInteger(safeId) || safeId <= 0) {
    return '';
  }

  const stablePrefix = ((safeId * 7919) % 9000) + 1000;
  return `${stablePrefix}${safeId}`;
}

extractRealProductId(routeId: string | number): number | null {
  const value = String(routeId ?? '').trim();

  if (!/^\d+$/.test(value)) {
    return null;
  }

  if (value.length <= 4) {
    const directId = Number(value);
    return Number.isInteger(directId) && directId > 0 ? directId : null;
  }

  const extractedId = Number(value.slice(4));
  return Number.isInteger(extractedId) && extractedId > 0 ? extractedId : null;
}

buildProductDetailRoute(product: Pick<Product, 'id' | 'id_producto' | 'nombre' | 'producto'>): string[] {
  const id = Number(product.id_producto ?? product.id);
  const name = product.nombre || product.producto || 'producto';
  return ['/product', this.generateSlug(name), this.buildProductRouteId(id)];
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
      this.invalidateProductCaches();
      return res; // Retorna el objeto que contiene el id_producto creado
    }),
    finalize(() => this.isLoading.set(false))
  );
}

assignProductSports(data: { id_producto: number, ids_deportes: number[] }): Observable<any> {
  this.isLoading.set(true);
  return this.http.post(`${this.API_URL}/products/assign-product-sports`, data).pipe(
    map(res => {
      this.invalidateProductCaches(data.id_producto);
      return res;
    }),
    finalize(() => this.isLoading.set(false))
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
        this.invalidateProductCaches(data.id_producto);
        return res;
      }),
      finalize(() => this.isLoading.set(false))
    );
}

uploadProductImage(file: File, folder = 'sport-center/products'): Observable<any> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  return this.http.post(`${this.API_URL}/products/upload-image`, formData);
}


createProductVariantValues(data: { id_variante: number, id_atributo: number, valor: string }): Observable<any> {
  this.isLoading.set(true);
  return this.http.post(`${this.API_URL}/products/create-variant-attribute-values`, data).pipe(
    map(res => {
      this.cache.invalidate(`products:variants:`);
      return res; // Retorna el objeto creado
    }),
    finalize(() => this.isLoading.set(false))
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
      this.invalidateInventoryCaches();
      return res;
    }),
    finalize(() => this.isLoading.set(false))
  );
}

// Importación masiva desde Excel
bulkCreateInventoryMovements(movements: any[]): Observable<any> {
  this.isLoading.set(true);
  return this.http.post(`${this.API_URL}/products/inventory-movements/bulk`, { movements }).pipe(
    map(res => {
      this.invalidateInventoryCaches();
      return res;
    }),
    finalize(() => this.isLoading.set(false))
  );
}


getInventoryMovements(): Observable<any> {
  this.isLoading.set(true);

    return this.cache
      .getOrSet(
        'products:inventory-movements',
        () => this.http.get(`${this.API_URL}/products/inventory-movements`),
        this.SHORT_CACHE_TTL,
      )
      .pipe(
        map((res) => {
          return res;
        }),
        finalize(() => this.isLoading.set(false))
      );
}

getVariantsForInventoryMovement(): Observable<any[]> {
  return this.cache.getOrSet(
    'products:inventory-movement-variants',
    () => this.http.get<any[]>(`${this.API_URL}/products/inventory-movements/variants`),
    this.SHORT_CACHE_TTL,
  );
}

createCatetorie(data: { nombre: string, id_padre: number | null }): Observable<any> {
  this.isLoading.set(true);
  //
  return this.http.post(`${this.API_URL}/products/create-categorie`, data).pipe(
    map(res => {
      this.invalidateCategoryCaches();
      return res;
    }),
    finalize(() => this.isLoading.set(false))
  );
}

updateCatetorie(data: { id_categoria: number, nombre: string, id_padre: number | null }): Observable<any> {
  this.isLoading.set(true);
  //
  return this.http.put(`${this.API_URL}/products/update-categorie`, data).pipe(
    map(res => {
      this.invalidateCategoryCaches();
      return res;
    }),
    finalize(() => this.isLoading.set(false))
  );
}

updateProductInv(data: { id_producto: number, estado: boolean }): Observable<any> {
  this.isLoading.set(true);
  //
  return this.http.put(`${this.API_URL}/products/update-product-inventory`, data).pipe(
    map(res => {
      this.invalidateProductCaches(data.id_producto);
      this.invalidateInventoryCaches();
      return res;
    }),
    finalize(() => this.isLoading.set(false))
  );
}

updateProductFull(data: { id_producto: number, id_marca: number, id_categoria: number, nombre: string, descripcion: string}): Observable<any> {
  this.isLoading.set(true);
  //
  return this.http.put(`${this.API_URL}/products/update-product-full`, data).pipe(
    map(res => {
      this.invalidateProductCaches(data.id_producto);
      return res;
    }),
    finalize(() => this.isLoading.set(false))
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
      this.invalidateProductCaches(data.id_producto);
      return res;
    }),
    finalize(() => this.isLoading.set(false))
  );
}


createMarca(data: { nombre: string, imagen: string }): Observable<any> {
  this.isLoading.set(true);
  
  return this.http.post(`${this.API_URL}/products/create-marca`, data).pipe(
    map(res => {
      this.invalidateBrandCaches();
      return res;
    }),
    finalize(() => this.isLoading.set(false))
  );
}

updateMarca(data: { id_marca: number, nombre: string, imagen: string }): Observable<any> {
  this.isLoading.set(true);
  
  return this.http.post(`${this.API_URL}/products/update-marca`, data).pipe(
    map(res => {
      this.invalidateBrandCaches();
      return res;
    }),
    finalize(() => this.isLoading.set(false))
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
    map(res => {
      this.cache.invalidate('products:attributes');
      return this.mapAttributeFromApi(res);
    })
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
          this.invalidateProductCaches(id);
          // Recargar productos para actualizar la lista
          this.loadProducts().subscribe();
          return this.mapProductFromApi(response);
        }),
        finalize(() => this.isLoading.set(false))
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
          this.invalidateProductCaches(id);
          // Recargar productos para actualizar la lista
          this.loadProducts().subscribe();
        }),
        finalize(() => this.isLoading.set(false))
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
            const categorySlug = this.generateSlug(filters.categoria);
            products = products.filter(p => this.generateSlug(p.categoria || '') === categorySlug);
          }

          if (filters.categoriaPadre) {
            const parentSlug = this.generateSlug(filters.categoriaPadre);
            products = products.filter(p =>
              this.generateSlug(p.categoria_padre || '') === parentSlug
            );
          }

          if (filters.subcategoria) {
            const subcategorySlug = this.generateSlug(filters.subcategoria);
            products = products.filter(p =>
              this.generateSlug(p.categoria || '') === subcategorySlug
            );
          }

          // Filtro por marca
          if (filters.marca) {
            products = products.filter(p =>
              p.marca?.toLowerCase() === filters.marca?.toLowerCase()
            );
          }

          if (filters.deporte) {
            const sportSlug = this.generateSlug(filters.deporte);
            products = products.filter(p =>
              (p.deportes || []).some(deporte => this.generateSlug(deporte) === sportSlug) ||
              (p.variantes || []).some(variant => {
                const atributos = variant.atributos || {};
                const deporte =
                  atributos['Deporte'] ||
                  atributos['deporte'] ||
                  atributos['Sport'] ||
                  atributos['sport'];

                return this.generateSlug(String(deporte || '')) === sportSlug;
              })
            );
          }

          if (filters.genero) {
            const genderSlug = this.normalizeGenderSlug(filters.genero);
            products = products.filter(product =>
              (product.variantes || []).some(variant => {
                const atributos = variant.atributos || {};
                const genero =
                  atributos['Genero'] ||
                  atributos['Género'] ||
                  atributos['genero'] ||
                  atributos['género'] ||
                  atributos['sexo'];

                return this.normalizeGenderSlug(String(genero || '')) === genderSlug;
              })
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

  // product.service.ts - Agrega estos métodos

// Obtener categorías por padre (ropa, accesorios)
  getCategoriesByParent(parentId: number): Observable<Category[]> {
  return this.cache.getOrSet(
    `products:menu:categories-by-parent:${parentId}`,
    () => this.http.get<Category[]>(`${this.API_URL}/products/menu/categories-by-parent/${parentId}`),
    this.CACHE_TTL,
  );
}

// Obtener deportes
getSports(): Observable<any[]> {
  return this.cache.getOrSet(
    'products:menu:sports',
    () => this.http.get<any[]>(`${this.API_URL}/products/menu/sports`),
    this.CACHE_TTL,
  );
}

// Obtener menú completo
getCompleteMenu(): Observable<any> {
  return this.cache.getOrSet(
    'products:menu:complete',
    () => this.http.get(`${this.API_URL}/products/menu/complete-menu`),
    this.CACHE_TTL,
  );
}

getAllOrders(): Observable<any[]> {
  return this.cache.getOrSet(
    'products:orders',
    () => this.http.get<any[]>(`${this.API_URL}/products/get-all-orders`),
    this.SHORT_CACHE_TTL,
  );
}

getOrdersById(id: number): Observable<any> {
  return this.cache.getOrSet(
    `products:order-detail:${id}`,
    () => this.http.get<any[]>(`${this.API_URL}/products/get-order-details/${id}`),
    this.SHORT_CACHE_TTL,
  );
}

  clearRequestCache(): void {
    this.cache.invalidate('products:');
  }

  private invalidateProductCaches(idProducto?: number): void {
    this.cache.invalidate('products:list');
    this.cache.invalidate('products:recent');
    this.cache.invalidate('products:without-variants-attributes');
    this.cache.invalidate('products:orders');
    this.cache.invalidate('products:inventory-movement-variants');
    this.cache.invalidate('products:menu:complete');
    this.cache.invalidate('products:detail:');
    this.cache.invalidate('products:variants:');
    if (idProducto) {
      this.cache.invalidate(`products:detail:${idProducto}`);
      this.cache.invalidate(`products:variants:${idProducto}`);
    }
  }

  private invalidateInventoryCaches(): void {
    this.cache.invalidate('products:inventory');
    this.cache.invalidate('products:inventory-movements');
    this.cache.invalidate('products:inventory-movement-variants');
    this.cache.invalidate('products:variants:');
    this.cache.invalidate('products:detail:');
    this.cache.invalidate('products:list');
  }

  private invalidateCategoryCaches(): void {
    this.cache.invalidate('products:categorias');
    this.cache.invalidate('products:menu:categories-by-parent:');
    this.cache.invalidate('products:menu:complete');
    this.cache.invalidate('products:list');
  }

  private invalidateBrandCaches(): void {
    this.cache.invalidate('products:marcas');
    this.cache.invalidate('products:list');
  }

}
