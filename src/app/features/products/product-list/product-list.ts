import { Component, inject, OnInit, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router, UrlSegment } from '@angular/router';
import { NgxPaginationModule } from 'ngx-pagination';
import { ProductService } from '../../../core/services/product.service';
import { Product, Category, ProductFilters } from '../../../core/models/product.model';
import { Breadcrumbs, BreadcrumbItem } from '../../../shared/components/breadcrumbs/breadcrumbs';
import { ToastrService } from 'ngx-toastr';
import { combineLatest } from 'rxjs';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, Breadcrumbs, NgxPaginationModule],
  templateUrl: './product-list.html',
  styleUrl: './product-list.css',
})
export class ProductList implements OnInit {
  private productService = inject(ProductService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toastr = inject(ToastrService);

  // Estado de la búsqueda
  searchTerm = signal<string>('');
  selectedCategory = signal<string>('');
  selectedBrand = signal<string>('');
  minPrice = signal<number | null>(null);
  maxPrice = signal<number | null>(null);
  sortBy = signal<string>('');
  routeGenero = signal<string>('');
  routeCategoriaPadre = signal<string>('');
  routeSubcategoria = signal<string>('');
  routeDeporte = signal<string>('');

  // Estado de UI
  showFilters = signal<boolean>(true);
  mobileFiltersOpen = signal<boolean>(false);
  isMobile = signal<boolean>(window.innerWidth < 768);
  
  // Estado de filtros desplegables
  categoryExpanded = signal<boolean>(true);
  brandExpanded = signal<boolean>(false);
  priceExpanded = signal<boolean>(false);
  sortExpanded = signal<boolean>(false);
  
  // Paginación
  currentPage = signal<number>(1);
  itemsPerPage = signal<number>(window.innerWidth < 640 ? 6 : 12); // 6 en móvil, 12 en desktop
  
  // Datos reactivos
  searchResults = signal<{products: Product[], total: number, hasResults: boolean}>({
    products: [], 
    total: 0, 
    hasResults: false
  });
  allProducts = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  brands = signal<string[]>([]);
  isLoading = signal<boolean>(false);
  
  // Categorías filtradas
  filteredCategories = computed(() => {
    const categories = this.categories().filter(c => 
      c.nombre.toLowerCase() !== 'todos' && 
      c.nombre.toLowerCase() !== 'todas'
    );

    const products = this.allProducts();
    if (!products.length) {
      return categories;
    }

    return categories.filter(category =>
      products.some(product => this.productMatchesCurrentContext(product, category.nombre))
    );
  });

  isCategoryLocked = computed(() => this.routeSubcategoria() !== '');

  filteredBrands = computed(() => {
    const selectedCategory = this.selectedCategory();
    const categoryName = selectedCategory
      ? this.categories().find(category => category.id === selectedCategory)?.nombre
      : undefined;

    return Array.from(new Set(
      this.allProducts()
        .filter(product => this.productMatchesCurrentContext(product, categoryName))
        .map(product => product.marca)
        .filter((brand): brand is string => Boolean(brand?.trim()))
    )).sort((a, b) => a.localeCompare(b, 'es'));
  });
  
  // Verificar si hay filtros activos
  hasActiveFilters = computed(() => {
    return this.selectedCategory() !== '' ||
           this.selectedBrand() !== '' ||
           this.minPrice() !== null ||
           this.maxPrice() !== null ||
           this.sortBy() !== '';
  });
  
  // Estado de la UI
  noResults = computed(() => !this.searchResults().hasResults && !this.isLoading());

  // Breadcrumbs
  breadcrumbs = computed((): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [
      { label: 'Productos', url: '/products', icon: 'storefront' }
    ];

    if (this.routeGenero()) {
      items.push({ label: this.formatSlugLabel(this.routeGenero()) });
    }

    if (this.routeCategoriaPadre()) {
      items.push({ label: this.formatSlugLabel(this.routeCategoriaPadre()) });
    }

    if (this.routeSubcategoria()) {
      items.push({ label: this.formatSlugLabel(this.routeSubcategoria()) });
    }

    if (this.routeDeporte()) {
      items.push({ label: `Deporte: ${this.formatSlugLabel(this.routeDeporte())}` });
    }

    if (this.searchTerm()) {
      items.push({ label: `Búsqueda: "${this.searchTerm()}"` });
    }

    if (this.selectedCategory()) {
      const category = this.categories().find(c => c.id === this.selectedCategory());
      if (category) {
        items.push({ 
          label: category.nombre,
          url: `/products?category=${category.id}`
        });
      }
    }

    return items;
  });

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    const mobile = event.target.innerWidth < 768;
    this.isMobile.set(mobile);
    
    // Ajustar items por página según tamaño de pantalla
    this.itemsPerPage.set(event.target.innerWidth < 640 ? 6 : 12);
    
    if (mobile && this.showFilters()) {
      this.showFilters.set(false);
    }
  }

  ngOnInit() {
    this.loadFilterMetadata();

    combineLatest([this.route.url, this.route.queryParams]).subscribe(([segments, params]) => {
      if (!this.parseRouteSegments(segments) || !this.parseQueryParams(params)) {
        this.router.navigate(['/error/400']);
        return;
      }
      this.onSearch(false);
    });
  }

  private loadFilterMetadata() {
    this.isLoading.set(true);

    this.productService.getProducts().subscribe({
      next: (products) => {
        this.allProducts.set(products);
      },
      error: (error) => {
      }
    });
    
    this.productService.getCategories().subscribe({
      next: (categories) => {
        this.categories.set(categories);
      },
      error: (error) => {
        this.toastr.error('Error al cargar categorías', 'Error');
      }
    });

    this.productService.getBrands().subscribe({
      next: (brands) => {
        this.brands.set(brands);
      },
      error: (error) => {
        this.toastr.error('Error al cargar marcas', 'Error');
      }
    });
  }

  private parseRouteSegments(segments: UrlSegment[]): boolean {
    this.routeGenero.set('');
    this.routeCategoriaPadre.set('');
    this.routeSubcategoria.set('');
    this.routeDeporte.set('');

    const values = segments.map(segment => segment.path);
    const [first, second, third] = values;

    if (!first || first === 'products') {
      return true;
    }

    if (['hombres', 'mujeres', 'ninos'].includes(first)) {
      this.routeGenero.set(first);
      if (second) {
        this.routeCategoriaPadre.set(second);
      }
      if (third) {
        this.routeSubcategoria.set(third);
      }
      return true;
    }

    if (first === 'accesorios') {
      this.routeCategoriaPadre.set('accesorios');
      if (second) {
        this.routeSubcategoria.set(second);
      }
      return true;
    }

    if (first === 'deporte' && second) {
      this.routeDeporte.set(second);
      return true;
    }

    return false;
  }

  private parseQueryParams(params: Record<string, any>): boolean {
    this.searchTerm.set('');
    this.selectedCategory.set('');
    this.selectedBrand.set('');
    this.minPrice.set(null);
    this.maxPrice.set(null);
    this.sortBy.set('');
    this.currentPage.set(1);

    if (params['search']) this.searchTerm.set(String(params['search']));
    if (params['category'] && !this.routeSubcategoria()) this.selectedCategory.set(String(params['category']));
    if (params['brand']) this.selectedBrand.set(String(params['brand']));
    if (params['page']) this.currentPage.set(Number(params['page']) || 1);

    const min = params['minPrice'];
    const max = params['maxPrice'];

    const toNumber = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const minParsed = min !== undefined ? toNumber(min) : null;
    const maxParsed = max !== undefined ? toNumber(max) : null;

    if (min !== undefined && minParsed === null) {
      this.toastr.error('minPrice debe ser numérico', 'Parámetro inválido');
      return false;
    }

    if (max !== undefined && maxParsed === null) {
      this.toastr.error('maxPrice debe ser numérico', 'Parámetro inválido');
      return false;
    }

    // Validar que minPrice no sea mayor que maxPrice
    if (minParsed !== null && maxParsed !== null && minParsed > maxParsed) {
      this.toastr.error('El precio mínimo no puede ser mayor que el máximo', 'Filtro inválido');
      // Intercambiar valores automáticamente
      this.minPrice.set(maxParsed);
      this.maxPrice.set(minParsed);
    } else {
      if (minParsed !== null) this.minPrice.set(minParsed);
      if (maxParsed !== null) this.maxPrice.set(maxParsed);
    }

    if (params['sort']) {
      const allowed = ['precio-asc', 'precio-desc', 'nombre', 'fecha'];
      if (!allowed.includes(params['sort'])) {
        this.toastr.error('sort no es válido', 'Parámetro inválido');
        return false;
      }
      this.sortBy.set(params['sort']);
    }

    return true;
  }

  onSearch(resetPage = true) {
    // Validar precios antes de buscar
    if (this.minPrice() !== null && this.maxPrice() !== null) {
      if (this.minPrice()! > this.maxPrice()!) {
        this.toastr.warning('El precio mínimo no puede ser mayor que el máximo', 'Ajustando filtros');
        // Intercambiar valores
        const temp = this.minPrice();
        this.minPrice.set(this.maxPrice());
        this.maxPrice.set(temp);
      }
    }

    const filters: ProductFilters = {
      categoria: this.selectedCategory() || undefined,
      categoriaPadre: this.routeCategoriaPadre() || undefined,
      subcategoria: this.routeSubcategoria() || undefined,
      marca: this.selectedBrand() || undefined,
      deporte: this.routeDeporte() || undefined,
      genero: this.routeGenero() || undefined,
      precioMin: this.minPrice() || undefined,
      precioMax: this.maxPrice() || undefined,
      ordenarPor: this.sortBy() as any
    };

    this.isLoading.set(true);
    
    this.productService.searchProducts(this.searchTerm(), filters).subscribe({
      next: (result) => {
        this.searchResults.set(result);
        this.isLoading.set(false);
        if (resetPage) {
          this.currentPage.set(1);
        }
      },
      error: (error) => {
        this.toastr.error('Error al buscar productos', 'Error');
        this.isLoading.set(false);
      }
    });
  }

  onCategoryChange() { 
    this.onFilterChange();
    if (this.isMobile()) this.mobileFiltersOpen.set(false);
  }
  
  onBrandChange() { 
    this.onFilterChange();
    if (this.isMobile()) this.mobileFiltersOpen.set(false);
  }

  onFilterChange() {
    this.currentPage.set(1);
    this.updateQueryParams(1);
  }
  
  onPriceChange() {
    // Validar en tiempo real
    if (this.minPrice() !== null && this.maxPrice() !== null) {
      if (this.minPrice()! > this.maxPrice()!) {
        this.toastr.warning('El precio mínimo no puede ser mayor que el máximo');
        return;
      }
    }
    this.onFilterChange();
  }

  clearFilters() {
    this.searchTerm.set('');
    this.selectedCategory.set('');
    this.selectedBrand.set('');
    this.minPrice.set(null);
    this.maxPrice.set(null);
    this.sortBy.set('');
    this.currentPage.set(1);
    
    this.updateQueryParams(1);
    
    if (this.isMobile()) {
      this.mobileFiltersOpen.set(false);
    }
  }

  // Toggles
  toggleFilters() {
    this.showFilters.set(!this.showFilters());
  }

  toggleMobileFilters() {
    this.mobileFiltersOpen.set(!this.mobileFiltersOpen());
  }

  toggleCategory() {
    this.categoryExpanded.set(!this.categoryExpanded());
  }

  toggleBrand() {
    this.brandExpanded.set(!this.brandExpanded());
  }

  togglePrice() {
    this.priceExpanded.set(!this.priceExpanded());
  }

  toggleSort() {
    this.sortExpanded.set(!this.sortExpanded());
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
    this.updateQueryParams(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private updateQueryParams(page = this.currentPage()) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        search: this.searchTerm() || null,
        category: !this.routeSubcategoria() && this.selectedCategory() ? this.selectedCategory() : null,
        brand: this.selectedBrand() || null,
        minPrice: this.minPrice() ?? null,
        maxPrice: this.maxPrice() ?? null,
        sort: this.sortBy() || null,
        page: page > 1 ? page : null,
      },
    });
  }

  // Métodos para variantes
  getProductImage(product: Product): string {
    if (product.variantes && product.variantes.length > 0) {
      for (const variante of product.variantes) {
        if (variante.imagenes && variante.imagenes.length > 0) {
          return variante.imagenes[0];
        }
      }
    }
    return 'https://upload.wikimedia.org/wikipedia/commons/a/a3/Image-not-found.png';
  }

  getMinPrice(product: Product): number {
    if (product.variantes && product.variantes.length > 0) {
      return Math.min(...product.variantes.map(v => v.precio));
    }
    return product.precio || 0;
  }

  getMaxPrice(product: Product): number {
    if (product.variantes && product.variantes.length > 0) {
      return Math.max(...product.variantes.map(v => v.precio));
    }
    return product.precio || 0;
  }

  getPriceDisplay(product: Product): string {
    const minPrice = this.getMinPrice(product);
    const maxPrice = this.getMaxPrice(product);
    
    if (minPrice === maxPrice) {
      return `$${minPrice.toFixed(0)}`;
    } else {
      return `$${minPrice.toFixed(0)} - $${maxPrice.toFixed(0)}`;
    }
  }

  getAvailableVariants(product: Product): number {
    if (product.variantes && product.variantes.length > 0) {
      return product.variantes.filter(v => v.stock > 0).length;
    }
    return product.stock > 0 ? 1 : 0;
  }

  isProductAvailable(product: Product): boolean {
    return this.getAvailableVariants(product) > 0;
  }

// Método para obtener el slug del producto
getProductSlug(product: Product): string {
  const nombre = product.nombre || product.producto || '';
  return this.productService.generateSlug(nombre);
}

getProductLink(product: Product): string[] {
  return this.productService.buildProductDetailRoute(product);
}

async shareProduct(product: Product, event?: Event): Promise<void> {
  event?.preventDefault();
  event?.stopPropagation();

  const route = this.getProductLink(product).join('/');
  const url = `${window.location.origin}${route}`;
  const title = product.nombre || product.producto || 'Producto Sport Center';
  const text = `Mira este producto en Sport Center: ${title}`;

  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return;
    }

    await navigator.clipboard.writeText(url);
    this.toastr.success('Link copiado al portapapeles', 'Compartir');
  } catch (error) {
    if ((error as DOMException)?.name !== 'AbortError') {
      this.toastr.error('No se pudo compartir el producto', 'Compartir');
    }
  }
}

private formatSlugLabel(value: string): string {
  return value
    .replace(/-/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

private productMatchesCurrentContext(product: Product, categoryName?: string): boolean {
  if (categoryName && this.productService.generateSlug(product.categoria || '') !== this.productService.generateSlug(categoryName)) {
    return false;
  }

  if (this.routeCategoriaPadre() && this.productService.generateSlug(product.categoria_padre || '') !== this.routeCategoriaPadre()) {
    return false;
  }

  if (this.routeSubcategoria() && this.productService.generateSlug(product.categoria || '') !== this.routeSubcategoria()) {
    return false;
  }

  if (this.routeDeporte()) {
    const sportSlug = this.routeDeporte();
    const hasSport = (product.deportes || []).some(deporte => this.productService.generateSlug(deporte) === sportSlug);
    if (!hasSport) {
      return false;
    }
  }

  if (!this.routeGenero()) {
    return true;
  }

  const targetGender = this.productService.normalizeGenderSlug(this.routeGenero());
  return (product.variantes || []).some(variant => {
    const atributos = variant.atributos || {};
    const genero =
      atributos['Genero'] ||
      atributos['Género'] ||
      atributos['genero'] ||
      atributos['género'] ||
      atributos['sexo'];

    return this.productService.matchesGenderFilter(String(genero || ''), targetGender);
  });
}
}
