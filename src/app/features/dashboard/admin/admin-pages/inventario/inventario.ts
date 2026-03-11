import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { ProductService } from '../../../../../core/services/product.service';
import { InventoryProduct, ProductVariant } from '../../../../../core/models/product.model';

// Interfaz para variantes existentes (SOLO VISUALIZACIÓN)
interface ExistingVariant {
  id_variante: number;
  id_producto: number;
  sku: string;
  precio: number;
  stock: number;
  imagenes: string[];
}

// Interfaz para movimientos de inventario
interface InventoryMovement {
  id_movimiento: number;
  id_variante: number;
  tipo: 'entrada' | 'salida' | 'ajuste';
  cantidad: number;
  costo_unitario: number;
  referencia_tipo: string;
  referencia_id: number;
  fecha: string;
}

// Interfaz para nuevo movimiento
interface NewMovement {
  id_variante: number | null;
  tipo: 'entrada' | 'salida' | 'ajuste';
  cantidad: number;
  costo_unitario: number;
  referencia_tipo: string;
  referencia_id: number | null;
}

// Interfaz para variante en búsqueda
interface VariantSearchItem {
  id_variante: number;
  id_producto: number;
  sku: string;
  producto: string;
  marca: string;
  stock_actual: number;
  precio: number;
}

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventario.html',
  styleUrls: ['./inventario.css']
})
export class Inventario implements OnInit {
  private productService = inject(ProductService);
  private toastr = inject(ToastrService);
  
  // ===== APARTADO 1: PRODUCTOS (SIN CAMBIOS) =====
  products: InventoryProduct[] = [];
  filteredProducts: InventoryProduct[] = [];
  paginatedProducts: InventoryProduct[] = [];
  searchValue: string = '';
  
  // Filtros adicionales
  filterEstado: string = 'todos';
  filterStock: string = 'todos';
  
  // Paginación
  rowsPerPage: number = 10;
  rowsPerPageOptions: number[] = [5, 10, 20, 50, 100];
  first: number = 0;
  currentPage: number = 1;
  totalRecords: number = 0;
  
  // Modal de visualización de variantes (SOLO VER)
  showVariantsModal: boolean = false;
  selectedProduct: InventoryProduct | null = null;
  productVariants: ExistingVariant[] = [];
  
  // Estados del modal
  loadingVariants: boolean = false;
  
  // Estado para toggle de producto activo
  togglingActive: { [key: number]: boolean } = {};
  
  // ===== APARTADO 2: MOVIMIENTOS =====
  activeTab: 'productos' | 'movimientos' = 'productos';
  
  // Lista de movimientos
  movements: InventoryMovement[] = [];
  filteredMovements: InventoryMovement[] = [];
  paginatedMovements: InventoryMovement[] = [];
  searchMovementValue: string = '';
  
  // Filtros para movimientos
  filterTipo: string = 'todos';
  filterFechaInicio: string = '';
  filterFechaFin: string = '';
  
  // Paginación para movimientos
  movementsRowsPerPage: number = 10;
  movementsFirst: number = 0;
  movementsCurrentPage: number = 1;
  movementsTotalRecords: number = 0;
  
  // Modal para registrar movimiento
  showMovementModal: boolean = false;
  newMovement: NewMovement = {
    id_variante: null,
    tipo: 'entrada',
    cantidad: 1,
    costo_unitario: 0,
    referencia_tipo: 'manual',
    referencia_id: null
  };
  
  // Para búsqueda de variantes en modal
  variantSearchTerm: string = '';
  filteredVariantsForMovement: VariantSearchItem[] = [];
  allVariants: VariantSearchItem[] = []; // Para cargar variantes disponibles
  loadingVariantsForSearch: boolean = false;
  
  // Estados
  isLoading = signal<boolean>(false);
  savingMovement: boolean = false;
  loadingMovements: boolean = false;

  ngOnInit(): void {
    this.loadInventory();
    this.loadMovements();
  }

  // ===== MÉTODOS PARA APARTADO 1: PRODUCTOS (SIN CAMBIOS) =====
  loadInventory() {
    this.isLoading.set(true);
    this.productService.getInventoryProducts().subscribe({
      next: (data: InventoryProduct[]) => {
        this.products = data;
        this.applyFilters();
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading inventory:', error);
        this.toastr.error('Error al cargar el inventario', 'Error');
        this.isLoading.set(false);
      }
    });
  }

  // APLICAR FILTROS COMBINADOS
  applyFilters() {
    let filtered = [...this.products];

    if (this.searchValue) {
      const term = this.searchValue.toLowerCase();
      filtered = filtered.filter(product => 
        product.producto.toLowerCase().includes(term) ||
        product.marca?.toLowerCase().includes(term) ||
        product.id_producto?.toString().includes(term)
      );
    }

    if (this.filterEstado !== 'todos') {
      filtered = filtered.filter(product => 
        this.filterEstado === 'activo' ? product.activo : !product.activo
      );
    }

    if (this.filterStock !== 'todos') {
      if (this.filterStock === 'con-stock') {
        filtered = filtered.filter(product => {
          const stock = product.stock ? Number(product.stock) : 0;
          return stock > 0;
        });
      } else if (this.filterStock === 'sin-stock') {
        filtered = filtered.filter(product => {
          const stock = product.stock ? Number(product.stock) : 0;
          return stock === 0;
        });
      } else if (this.filterStock === 'stock-bajo') {
        filtered = filtered.filter(product => {
          const stock = product.stock ? Number(product.stock) : 0;
          return stock > 0 && stock <= 5;
        });
      }
    }

    this.filteredProducts = filtered;
    this.totalRecords = filtered.length;
    this.first = 0;
    this.updatePaginatedProducts();
  }

  // MÉTODOS PARA FILTROS
  onFilterEstadoChange(event: any) {
    this.filterEstado = event.target.value;
    this.applyFilters();
  }

  onFilterStockChange(event: any) {
    this.filterStock = event.target.value;
    this.applyFilters();
  }

  onSearch(event: any) {
    this.searchValue = event.target.value;
    this.applyFilters();
  }

  clearSearch() {
    this.searchValue = '';
    this.filterEstado = 'todos';
    this.filterStock = 'todos';
    this.applyFilters();
    this.toastr.success('Búsqueda limpiada', 'Éxito');
  }

  // Paginación productos
  updatePaginatedProducts() {
    const start = this.first;
    const end = this.first + this.rowsPerPage;
    this.paginatedProducts = this.filteredProducts.slice(start, end);
    this.totalRecords = this.filteredProducts.length;
    this.currentPage = Math.floor(this.first / this.rowsPerPage) + 1;
  }

  onRowsPerPageChange() {
    this.first = 0;
    this.updatePaginatedProducts();
  }

  changePage(action: 'first' | 'prev' | 'next' | 'last') {
    switch (action) {
      case 'first': this.first = 0; break;
      case 'prev': if (this.first > 0) this.first -= this.rowsPerPage; break;
      case 'next': if (this.first + this.rowsPerPage < this.totalRecords) this.first += this.rowsPerPage; break;
      case 'last': this.first = Math.floor((this.totalRecords - 1) / this.rowsPerPage) * this.rowsPerPage; break;
    }
    this.updatePaginatedProducts();
  }

  goToPage(page: number) {
    this.first = (page - 1) * this.rowsPerPage;
    this.updatePaginatedProducts();
  }

  get last(): number {
    return Math.min(this.first + this.rowsPerPage, this.totalRecords);
  }

  get pageNumbers(): number[] {
    const totalPages = Math.ceil(this.totalRecords / this.rowsPerPage);
    const current = this.currentPage;
    const pages: number[] = [];
    
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (current <= 3) for (let i = 1; i <= 5; i++) pages.push(i);
      else if (current >= totalPages - 2) for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      else for (let i = current - 2; i <= current + 2; i++) pages.push(i);
    }
    return pages;
  }

  // Utilidades para la tabla
  getProductImage(product: InventoryProduct): string {
    return 'assets/images/no-imagen.webp';
  }

  getStockValue(product: InventoryProduct): number {
    return product.stock ? Number(product.stock) : 0;
  }

  getPrecioValue(product: InventoryProduct): string {
    const precio = product.precio ? Number(product.precio) : 0;
    return precio.toFixed(2);
  }

  getStockClass(stock: number): string {
    if (stock <= 0) return 'bg-red-100 text-red-800';
    if (stock <= 5) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  }

  getStockIcon(stock: number): string {
    if (stock <= 0) return 'pi pi-exclamation-circle';
    if (stock <= 5) return 'pi pi-exclamation-triangle';
    return 'pi pi-check-circle';
  }

  getStatusClass(activo: boolean): string {
    return activo ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200';
  }

  getStatusIcon(activo: boolean): string {
    return activo ? 'pi pi-check' : 'pi pi-times';
  }

  getStatusText(activo: boolean): string {
    return activo ? 'Activo' : 'Inactivo';
  }

  // TOGGLE DE ESTADO (SIN CAMBIOS)
  toggleProductStatus(product: InventoryProduct) {
    const productId = product.id_producto;
    
    if (this.togglingActive[productId]) return;
    
    this.togglingActive[productId] = true;
    const previousState = product.activo;
    product.activo = !product.activo;
    
    const updateData = {
      id_producto: productId,
      estado: product.activo
    };
    
    this.productService.updateProductInv(updateData).subscribe({
      next: () => {
        this.togglingActive[productId] = false;
        this.loadInventory();
        this.toastr.success(
          `Producto ${product.activo ? 'activado' : 'desactivado'} correctamente`, 
          'Éxito'
        );
      },
      error: (err) => {
        console.error('Error al cambiar estado:', err);
        product.activo = previousState;
        this.togglingActive[productId] = false;
        this.toastr.error('Error al cambiar el estado del producto', 'Error');
      }
    });
  }

  // VER VARIANTES (SOLO VISUALIZACIÓN)
  openVariantsModal(product: InventoryProduct) {
    this.selectedProduct = product;
    this.loadingVariants = true;
    this.showVariantsModal = true;
    
    this.productService.getProductVariants(product.id_producto).subscribe({
      next: (variants: any[]) => {
        this.productVariants = variants.map(v => ({
          id_variante: v.id_variante,
          id_producto: v.id_producto,
          sku: v.sku,
          precio: Number(v.precio),
          stock: v.stock,
          imagenes: v.imagenes || [],
        }));
        this.loadingVariants = false;
      },
      error: (err) => {
        console.error('Error al cargar variantes:', err);
        this.loadingVariants = false;
        this.toastr.error('Error al cargar las variantes', 'Error');
        this.closeVariantsModal();
      }
    });
  }

  closeVariantsModal() {
    this.showVariantsModal = false;
    this.selectedProduct = null;
    this.productVariants = [];
  }

  // DETECTAR WARNINGS EN VARIANTES
  hasVariantWarnings(variant: ExistingVariant): boolean {
    if (variant.stock <= 5) return true;
    if (variant.precio < 10) return true;
    if (!variant.imagenes || variant.imagenes.length === 0) return true;
    return false;
  }

  getWarningIcon(variant: ExistingVariant): string {
    if (variant.stock <= 0) return 'pi pi-exclamation-circle text-red-500';
    if (variant.stock <= 5) return 'pi pi-exclamation-triangle text-yellow-500';
    if (variant.precio < 10) return 'pi pi-exclamation-triangle text-yellow-500';
    if (!variant.imagenes || variant.imagenes.length === 0) return 'pi pi-image text-yellow-500';
    return '';
  }

  getWarningTooltip(variant: ExistingVariant): string {
    const warnings: string[] = [];
    
    if (variant.stock <= 0) warnings.push('Stock agotado');
    else if (variant.stock <= 5) warnings.push(`Stock bajo (${variant.stock} unidades)`);
    
    if (variant.precio < 10) warnings.push('Precio muy bajo');
    
    if (!variant.imagenes || variant.imagenes.length === 0) warnings.push('Sin imágenes');
    
    return warnings.join(' • ');
  }

  // Acciones
  refreshData() {
    this.loadInventory();
    this.loadMovements();
    this.toastr.success('Datos actualizados', 'Éxito');
  }

  viewVariants(product: InventoryProduct) {
    this.openVariantsModal(product);
  }

  getMarcaImageUrl(product: InventoryProduct): string {
    return product.imagen || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(product.producto) + '&background=0367A6&color=fff&size=64';
  }

  // Función para previsualizar imagen
  openImagePreview(imageUrl: string) {
    window.open(imageUrl, '_blank');
  }

  // ===== MÉTODOS PARA APARTADO 2: MOVIMIENTOS =====
  
  // Cambiar de pestaña
  changeTab(tab: 'productos' | 'movimientos') {
    this.activeTab = tab;
    if (tab === 'movimientos' && this.movements.length === 0) {
      this.loadMovements();
    }
  }

  // Cargar movimientos
  loadMovements() {
    this.loadingMovements = true;
    this.productService.getInventoryMovements().subscribe({
      next: (response: any) => {
        // Si la respuesta es un array directamente
        if (Array.isArray(response)) {
          this.movements = response;
        } 
        // Si la respuesta tiene propiedad data
        else if (response && response.data) {
          this.movements = response.data;
        } else {
          this.movements = [];
        }
        
        this.applyMovementsFilters();
        this.loadingMovements = false;
      },
      error: (error) => {
        console.error('Error loading movements:', error);
        this.toastr.error('Error al cargar movimientos', 'Error');
        this.movements = [];
        this.loadingMovements = false;
      }
    });
  }

  // Aplicar filtros a movimientos
  applyMovementsFilters() {
    let filtered = [...this.movements];

    // Filtro por tipo
    if (this.filterTipo !== 'todos') {
      filtered = filtered.filter(m => m.tipo === this.filterTipo);
    }

    // Filtro por fecha inicio
    if (this.filterFechaInicio) {
      const fechaInicio = new Date(this.filterFechaInicio);
      fechaInicio.setHours(0, 0, 0, 0);
      filtered = filtered.filter(m => new Date(m.fecha) >= fechaInicio);
    }

    // Filtro por fecha fin
    if (this.filterFechaFin) {
      const fechaFin = new Date(this.filterFechaFin);
      fechaFin.setHours(23, 59, 59, 999);
      filtered = filtered.filter(m => new Date(m.fecha) <= fechaFin);
    }

    // Búsqueda por texto (ID, referencia, etc.)
    if (this.searchMovementValue) {
      const term = this.searchMovementValue.toLowerCase();
      filtered = filtered.filter(m => 
        m.id_movimiento.toString().includes(term) ||
        m.referencia_tipo.toLowerCase().includes(term) ||
        m.referencia_id?.toString().includes(term) ||
        m.id_variante.toString().includes(term)
      );
    }

    this.filteredMovements = filtered;
    this.movementsTotalRecords = filtered.length;
    this.movementsFirst = 0;
    this.updatePaginatedMovements();
  }

  // Filtros de movimientos
  onMovementTipoChange(event: any) {
    this.filterTipo = event.target.value;
    this.applyMovementsFilters();
  }

  onMovementSearch(event: any) {
    this.searchMovementValue = event.target.value;
    this.applyMovementsFilters();
  }

  onFechaInicioChange(event: any) {
    this.filterFechaInicio = event.target.value;
    this.applyMovementsFilters();
  }

  onFechaFinChange(event: any) {
    this.filterFechaFin = event.target.value;
    this.applyMovementsFilters();
  }

  clearMovementFilters() {
    this.searchMovementValue = '';
    this.filterTipo = 'todos';
    this.filterFechaInicio = '';
    this.filterFechaFin = '';
    this.applyMovementsFilters();
    this.toastr.success('Filtros limpiados', 'Éxito');
  }

  // Paginación movimientos
  updatePaginatedMovements() {
    const start = this.movementsFirst;
    const end = this.movementsFirst + this.movementsRowsPerPage;
    this.paginatedMovements = this.filteredMovements.slice(start, end);
    this.movementsTotalRecords = this.filteredMovements.length;
    this.movementsCurrentPage = Math.floor(this.movementsFirst / this.movementsRowsPerPage) + 1;
  }

  onMovementsRowsPerPageChange() {
    this.movementsFirst = 0;
    this.updatePaginatedMovements();
  }

  changeMovementsPage(action: 'first' | 'prev' | 'next' | 'last') {
    switch (action) {
      case 'first': this.movementsFirst = 0; break;
      case 'prev': if (this.movementsFirst > 0) this.movementsFirst -= this.movementsRowsPerPage; break;
      case 'next': if (this.movementsFirst + this.movementsRowsPerPage < this.movementsTotalRecords) this.movementsFirst += this.movementsRowsPerPage; break;
      case 'last': this.movementsFirst = Math.floor((this.movementsTotalRecords - 1) / this.movementsRowsPerPage) * this.movementsRowsPerPage; break;
    }
    this.updatePaginatedMovements();
  }

  goToMovementsPage(page: number) {
    this.movementsFirst = (page - 1) * this.movementsRowsPerPage;
    this.updatePaginatedMovements();
  }

  get movementsLast(): number {
    return Math.min(this.movementsFirst + this.movementsRowsPerPage, this.movementsTotalRecords);
  }

  get movementsPageNumbers(): number[] {
    const totalPages = Math.ceil(this.movementsTotalRecords / this.movementsRowsPerPage);
    const current = this.movementsCurrentPage;
    const pages: number[] = [];
    
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (current <= 3) for (let i = 1; i <= 5; i++) pages.push(i);
      else if (current >= totalPages - 2) for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      else for (let i = current - 2; i <= current + 2; i++) pages.push(i);
    }
    return pages;
  }

  // Utilidades para movimientos
  getTipoClass(tipo: string): string {
    switch(tipo) {
      case 'entrada': return 'bg-green-100 text-green-800 border-green-200';
      case 'salida': return 'bg-red-100 text-red-800 border-red-200';
      case 'ajuste': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  getTipoIcon(tipo: string): string {
    switch(tipo) {
      case 'entrada': return 'pi pi-arrow-down';
      case 'salida': return 'pi pi-arrow-up';
      case 'ajuste': return 'pi pi-pencil';
      default: return 'pi pi-question';
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // ===== MÉTODOS PARA REGISTRAR MOVIMIENTO =====
  
  openMovementModal() {
    this.showMovementModal = true;
    this.newMovement = {
      id_variante: null,
      tipo: 'entrada',
      cantidad: 1,
      costo_unitario: 0,
      referencia_tipo: 'manual',
      referencia_id: null
    };
    this.variantSearchTerm = '';
    this.filteredVariantsForMovement = [];
    this.loadVariantsForSearch();
  }

  closeMovementModal() {
    this.showMovementModal = false;
    this.newMovement = {
      id_variante: null,
      tipo: 'entrada',
      cantidad: 1,
      costo_unitario: 0,
      referencia_tipo: 'manual',
      referencia_id: null
    };
    this.variantSearchTerm = '';
    this.filteredVariantsForMovement = [];
  }

  loadVariantsForSearch() {
    this.loadingVariantsForSearch = true;
    
    // Necesitamos cargar todas las variantes de todos los productos
    // Esto podría ser ineficiente si hay muchos productos, pero funciona
    const variantPromises = this.products.map(product => 
      this.productService.getProductVariants(product.id_producto).toPromise()
    );
    
    Promise.all(variantPromises)
      .then(results => {
        const allVariants: VariantSearchItem[] = [];
        
        results.forEach((variants: any, index) => {
          const product = this.products[index];
          
          if (variants && Array.isArray(variants)) {
            variants.forEach((v: any) => {
              allVariants.push({
                id_variante: v.id_variante,
                id_producto: v.id_producto,
                sku: v.sku,
                producto: product.producto,
                marca: product.marca || '',
                stock_actual: v.stock || 0,
                precio: v.precio || 0
              });
            });
          }
        });
        
        this.allVariants = allVariants;
        this.filterVariantsForMovement();
        this.loadingVariantsForSearch = false;
      })
      .catch(error => {
        console.error('Error loading variants for search:', error);
        this.toastr.error('Error al cargar variantes', 'Error');
        this.loadingVariantsForSearch = false;
      });
  }

  filterVariantsForMovement() {
    if (!this.allVariants || this.allVariants.length === 0) {
      this.filteredVariantsForMovement = [];
      return;
    }
    
    if (!this.variantSearchTerm || this.variantSearchTerm.trim() === '') {
      this.filteredVariantsForMovement = this.allVariants.slice(0, 10);
    } else {
      const term = this.variantSearchTerm.toLowerCase().trim();
      this.filteredVariantsForMovement = this.allVariants.filter(v => 
        v.sku.toLowerCase().includes(term) ||
        v.producto.toLowerCase().includes(term) ||
        v.marca.toLowerCase().includes(term) ||
        v.id_variante.toString().includes(term)
      ).slice(0, 20);
    }
  }

  selectVariantForMovement(variant: VariantSearchItem) {
    this.newMovement.id_variante = variant.id_variante;
    this.variantSearchTerm = `${variant.sku} - ${variant.producto} (Stock: ${variant.stock_actual})`;
    this.filteredVariantsForMovement = [];
  }

  validateMovement(): boolean {
    if (!this.newMovement.id_variante) {
      this.toastr.warning('Debes seleccionar una variante', 'Validación');
      return false;
    }
    
    if (this.newMovement.cantidad <= 0) {
      this.toastr.warning('La cantidad debe ser mayor a 0', 'Validación');
      return false;
    }
    
    if (this.newMovement.costo_unitario < 0) {
      this.toastr.warning('El costo unitario no puede ser negativo', 'Validación');
      return false;
    }
    
    return true;
  }

  saveMovement() {
    if (!this.validateMovement()) return;
    
    this.savingMovement = true;
    
    const movementData = {
      id_variante: this.newMovement.id_variante!,
      tipo: this.newMovement.tipo,
      cantidad: this.newMovement.cantidad,
      costo_unitario: this.newMovement.costo_unitario,
      referencia_tipo: this.newMovement.referencia_tipo,
      referencia_id: this.newMovement.referencia_id || 0
    };
    
    this.productService.createInventoryMovement(movementData).subscribe({
      next: (response) => {
        this.savingMovement = false;
        this.toastr.success('Movimiento registrado correctamente', 'Éxito');
        this.closeMovementModal();
        this.loadMovements();
        this.loadInventory();
      },
      error: (error) => {
        console.error('Error al crear movimiento:', error);
        this.savingMovement = false;
        this.toastr.error(error.error?.message || 'Error al registrar movimiento', 'Error');
      }
    });
  }

  clearVariantSelection() {
    this.newMovement.id_variante = null;
    this.variantSearchTerm = '';
    this.filterVariantsForMovement();
  }
}