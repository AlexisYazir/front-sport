import { Component, OnInit, inject, signal, computed, HostListener, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgxPaginationModule } from 'ngx-pagination';
import { ProductService } from '../../../core/services/product.service';
import { Product, ProductFilters } from '../../../core/models/product.model';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-product-marca',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, NgxPaginationModule],
  templateUrl: './product-marca.html',
  styleUrl: './product-marca.css',
})
export class ProductMarca implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);
  private toastr = inject(ToastrService);

  // Signals principales
  products = signal<Product[]>([]);
  filteredProducts = signal<Product[]>([]);
  marcaNombre = signal<string>('');
  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  // Filtros
  selectedCategory = signal<string>('');
  minPrice = signal<number | null>(null);
  maxPrice = signal<number | null>(null);
  sortBy = signal<string>('');

  // Estado de UI
  showFilters = signal<boolean>(true);
  mobileFiltersOpen = signal<boolean>(false);
  isMobile = signal<boolean>(window.innerWidth < 768);
  
  // Estado de filtros desplegables
  categoryExpanded = signal<boolean>(true);
  priceExpanded = signal<boolean>(false);
  sortExpanded = signal<boolean>(false);
  
  // Paginación
  currentPage = signal<number>(1);
  itemsPerPage = signal<number>(window.innerWidth < 640 ? 6 : 12);
  
  // Categorías disponibles (extraídas de los productos)
  availableCategories = computed(() => {
    const categories = new Set<string>();
    this.filteredProducts().forEach(product => {
      if (product.categoria) {
        categories.add(product.categoria);
      }
    });
    return Array.from(categories).sort();
  });

  // Productos filtrados según selección
  filteredBySelection = computed(() => {
    let result = [...this.filteredProducts()];
    
    // Filtrar por categoría
    if (this.selectedCategory()) {
      result = result.filter(p => p.categoria === this.selectedCategory());
    }
    
    // Filtrar por precio
    if (this.minPrice() !== null) {
      result = result.filter(p => (p.precio || 0) >= this.minPrice()!);
    }
    if (this.maxPrice() !== null) {
      result = result.filter(p => (p.precio || 0) <= this.maxPrice()!);
    }
    
    // Ordenar
    switch (this.sortBy()) {
      case 'precio-asc':
        result.sort((a, b) => (a.precio || 0) - (b.precio || 0));
        break;
      case 'precio-desc':
        result.sort((a, b) => (b.precio || 0) - (a.precio || 0));
        break;
      case 'nombre':
        result.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        break;
      case 'fecha':
        // Si tuvieras fecha de creación
        break;
    }
    
    return result;
  });

  // Verificar si hay filtros activos
  hasActiveFilters = computed(() => {
    return this.selectedCategory() !== '' ||
           this.minPrice() !== null ||
           this.maxPrice() !== null ||
           this.sortBy() !== '';
  });

  constructor() {
    // Efecto para resetear página cuando cambian filtros
    effect(() => {
      // Usar los signals para que se ejecute cuando cambien
      const filters = [
        this.selectedCategory(),
        this.minPrice(),
        this.maxPrice(),
        this.sortBy()
      ];
      // Forzar evaluación
      if (filters) {
        this.currentPage.set(1);
      }
    });
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    const mobile = event.target.innerWidth < 768;
    this.isMobile.set(mobile);
    this.itemsPerPage.set(event.target.innerWidth < 640 ? 6 : 12);
    
    if (mobile && this.showFilters()) {
      this.showFilters.set(false);
    }
  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      const marca = params['nombre'];
      if (marca) {
        this.marcaNombre.set(decodeURIComponent(marca));
        this.loadProductsByMarca(this.marcaNombre());
      } else {
        this.error.set('No se especificó ninguna marca');
        this.loading.set(false);
      }
    });
  }

  loadProductsByMarca(marca: string) {
    this.loading.set(true);
    this.error.set(null);
    
    this.productService.getProducts().subscribe({
      next: (products: Product[]) => {
        // Filtrar productos por marca (case insensitive)
        const filtered = products.filter(product => 
          product.marca?.toLowerCase() === marca.toLowerCase() ||
          product.marca?.toLowerCase().includes(marca.toLowerCase())
        );
        
        this.products.set(products);
        this.filteredProducts.set(filtered);
        
        if (filtered.length === 0) {
          this.toastr.info(`No se encontraron productos de la marca ${marca}`, 'Información');
        }
        
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error cargando productos:', error);
        this.error.set('Error al cargar los productos');
        this.toastr.error('Error al cargar los productos', 'Error');
        this.loading.set(false);
      }
    });
  }

  // Métodos para filtros
  onCategoryChange() {
    this.onSearch();
    if (this.isMobile()) this.mobileFiltersOpen.set(false);
  }
  
  onPriceChange() {
    // Validar precios
    if (this.minPrice() !== null && this.maxPrice() !== null) {
      if (this.minPrice()! > this.maxPrice()!) {
        this.toastr.warning('El precio mínimo no puede ser mayor que el máximo');
        return;
      }
    }
    this.onSearch();
  }

  onSortChange() {
    this.onSearch();
  }

  onSearch() {
    // Solo actualizamos la página, los productos ya están filtrados por computed
    this.currentPage.set(1);
  }

  clearFilters() {
    this.selectedCategory.set('');
    this.minPrice.set(null);
    this.maxPrice.set(null);
    this.sortBy.set('');
    this.currentPage.set(1);
    
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

  togglePrice() {
    this.priceExpanded.set(!this.priceExpanded());
  }

  toggleSort() {
    this.sortExpanded.set(!this.sortExpanded());
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Métodos de utilidad
  getProductImage(product: Product): string {
    if (product.variantes && product.variantes.length > 0) {
      for (const variante of product.variantes) {
        if (variante.imagenes && variante.imagenes.length > 0) {
          return variante.imagenes[0];
        }
      }
    }
    
    if (product.imagen && product.imagen !== 'null' && product.imagen !== '') {
      if (product.imagen.startsWith('http')) {
        return product.imagen;
      }
      return `http://localhost:3000/${product.imagen}`;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(product.nombre || 'Producto')}&background=0367A6&color=fff&size=128`;
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

  viewProduct(productId: number) {
    const product = this.filteredBySelection().find(item => (item.id_producto || item.id) === productId);
    if (!product) {
      return;
    }
    this.router.navigate(this.productService.buildProductDetailRoute(product));
  }

  goBack() {
    this.router.navigate(['/']);
  }
}
