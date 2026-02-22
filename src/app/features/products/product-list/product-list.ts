import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ProductService } from '../../../core/services/product.service';
import { Product, Category, ProductFilters } from '../../../core/models/product.model';
import { Breadcrumbs, BreadcrumbItem } from '../../../shared/components/breadcrumbs/breadcrumbs';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, Breadcrumbs],
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
  showOnlyAvailable = signal<boolean>(false);

  // Datos reactivos
  searchResults = signal<{products: Product[], total: number, hasResults: boolean}>({
    products: [], 
    total: 0, 
    hasResults: false
  });
  categories = signal<Category[]>([]);
  brands = signal<string[]>([]);
  isLoading = computed(() => this.productService.isLoading());
  
  // NUEVA: Categorías filtradas (sin "todos" o "todas")
  filteredCategories = computed(() => {
    return this.categories().filter(c => 
      c.nombre.toLowerCase() !== 'todos' && 
      c.nombre.toLowerCase() !== 'todas'
    );
  });
  
  // Estado de la UI
  showFilters = signal<boolean>(false);
  noResults = computed(() => !this.searchResults().hasResults && !this.isLoading());

  // Breadcrumbs para el catálogo
  breadcrumbs = computed((): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [
      { label: 'Productos', url: '/products', icon: 'storefront' }
    ];

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

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (!this.parseQueryParams(params)) {
        this.router.navigate(['/error/400']);
        return;
      }
      this.loadInitialData();
    });
  }

  private parseQueryParams(params: Record<string, any>): boolean {
    if (params['search']) {
      this.searchTerm.set(String(params['search']));
    }

    if (params['category']) {
      this.selectedCategory.set(String(params['category']));
    }

    if (params['brand']) {
      this.selectedBrand.set(String(params['brand']));
    }

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

    if (minParsed !== null && maxParsed !== null && minParsed > maxParsed) {
      this.toastr.error('minPrice no puede ser mayor que maxPrice', 'Parámetro inválido');
      return false;
    }

    if (minParsed !== null) this.minPrice.set(minParsed);
    if (maxParsed !== null) this.maxPrice.set(maxParsed);

    if (params['available'] !== undefined) {
      const available = params['available'];
      if (available === 'true' || available === true) {
        this.showOnlyAvailable.set(true);
      } else if (available === 'false' || available === false) {
        this.showOnlyAvailable.set(false);
      } else {
        this.toastr.error('available debe ser true o false', 'Parámetro inválido');
        return false;
      }
    }

    if (params['sort']) {
      const allowed = ['precio-asc', 'precio-desc', 'nombre'];
      if (!allowed.includes(params['sort'])) {
        this.toastr.error('sort no es válido', 'Parámetro inválido');
        return false;
      }
      this.sortBy.set(params['sort']);
    }

    return true;
  }

  private loadInitialData() {
    this.productService.getCategories().subscribe(categories => {
      this.categories.set(categories);
    });

    this.productService.getBrands().subscribe(brands => {
      this.brands.set(brands);
    });

    this.onSearch();
  }

  onSearch() {
    const filters: ProductFilters = {
      categoria: this.selectedCategory() || undefined,
      marca: this.selectedBrand() || undefined,
      precioMin: this.minPrice() || undefined,
      precioMax: this.maxPrice() || undefined,
      disponible: this.showOnlyAvailable() ? true : undefined,
      ordenarPor: this.sortBy() as any
    };

    this.productService.searchProducts(this.searchTerm(), filters).subscribe(result => {
      this.searchResults.set(result);
    });
  }

  onCategoryChange() {
    this.onSearch();
  }

  onBrandChange() {
    this.onSearch();
  }

  onPriceChange() {
    this.onSearch();
  }

  clearFilters() {
    this.searchTerm.set('');
    this.selectedCategory.set('');
    this.selectedBrand.set('');
    this.minPrice.set(null);
    this.maxPrice.set(null);
    this.sortBy.set('');
    this.showOnlyAvailable.set(false);
    this.onSearch();
  }

  toggleFilters() {
    this.showFilters.set(!this.showFilters());
  }

  // Métodos originales
  getPriceWithDiscount(product: Product): number {
    return this.productService.getPriceWithDiscount(product);
  }

  hasDiscount(product: Product): boolean {
    return product.descuento ? product.descuento > 0 : false;
  }

  getStockClass(stock: number): string {
    if (stock === 0) return 'text-red-600';
    if (stock <= 5) return 'text-yellow-600';
    return 'text-green-600';
  }

  getStockText(product: Product): string {
    if (!product.disponible || product.stock === 0) return 'Agotado';
    if (product.stock <= 5) return `Solo ${product.stock} disponibles`;
    return 'Disponible';
  }

  // NUEVOS MÉTODOS PARA VARIANTES
  getProductImage(product: Product): string {
    if (product.variantes && product.variantes.length > 0) {
      for (const variante of product.variantes) {
        if (variante.imagenes && variante.imagenes.length > 0) {
          return variante.imagenes[0];
        }
      }
    }
    return  'https://upload.wikimedia.org/wikipedia/commons/a/a3/Image-not-found.png';
  }

  getTotalStock(product: Product): number {
    if (product.variantes && product.variantes.length > 0) {
      return product.variantes.reduce((sum, v) => sum + (v.stock || 0), 0);
    }
    return product.stock || 0;
  }

  getAvailableVariants(product: Product): number {
    if (product.variantes && product.variantes.length > 0) {
      return product.variantes.filter(v => v.stock > 0).length;
    }
    return product.stock > 0 ? 1 : 0;
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

  hasMultiplePrices(product: Product): boolean {
    return this.getMinPrice(product) !== this.getMaxPrice(product);
  }

  getAtributosArray(atributos: Record<string, string>): {key: string, value: string}[] {
    if (!atributos) return [];
    return Object.entries(atributos).map(([key, value]) => ({ key, value }));
  }

  hasVariants(product: Product): boolean {
    return !!(product.variantes && product.variantes.length > 0);
  }

  isProductAvailable(product: Product): boolean {
    return this.getAvailableVariants(product) > 0;
  }
}