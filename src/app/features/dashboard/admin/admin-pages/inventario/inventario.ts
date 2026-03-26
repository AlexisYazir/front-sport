import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { ProductService } from '../../../../../core/services/product.service';
import { InventoryProduct, ProductVariant } from '../../../../../core/models/product.model';
import * as XLSX from 'xlsx';

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
  sku: string;
  imagen_variante?: string;
  imagenes_variante?: string[];
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
  imagen?: string;
  imagenes?: string[];
}

// ===== NUEVAS INTERFACES PARA EXCEL =====
interface ExcelRow {
  sku: string;
  tipo: string;
  cantidad: number;
  costo_unitario?: number;
  referencia_tipo?: string;
  referencia_id?: number;
}

interface ExcelImportPreview {
  validRows: ExcelRow[];
  invalidRows: Array<{
    row: number;
    sku: string;
    tipo: string;
    cantidad: any;
    error: string;
  }>;
  totalRows: number;
}

interface ExcelImportResult {
  success: number;
  errors: Array<{
    row: number;
    sku: string;
    error: string;
    data: any;
  }>;
  total: number;
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
  rowsPerPageOptions: number[] = [10];
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
  
  // ===== NUEVAS PROPIEDADES PARA IMPORTACIÓN EXCEL =====
  showImportModal: boolean = false;
  selectedFile: File | null = null;
  importPreview: ExcelImportPreview | null = null;
  importing: boolean = false;
  
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
    return product.imagen || 'assets/images/no-imagen.webp';
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

    const nextState = !product.activo;
    const stock = this.getStockValue(product);
    const precio = product.precio ? Number(product.precio) : 0;

    if (nextState && stock <= 0) {
      this.toastr.warning('No puedes activar un producto con stock 0', 'Validacion');
      return;
    }

    if (nextState && precio <= 0) {
      this.toastr.warning('No puedes activar un producto con precio 0', 'Validacion');
      return;
    }
    
    this.togglingActive[productId] = true;
    const previousState = product.activo;
    product.activo = nextState;
    
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
          stock: v.stock || 0,
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
    return product.imagen_marca || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(product.marca || product.producto) + '&background=0367A6&color=fff&size=64';
  }

  getMovementImage(movement: InventoryMovement): string {
    if (movement.imagen_variante) {
      return movement.imagen_variante;
    }

    if (movement.imagenes_variante && movement.imagenes_variante.length > 0) {
      return movement.imagenes_variante[0];
    }

    return 'assets/images/no-imagen.webp';
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
        console.log('Primer movimiento:', response[0]); // 👈 VERIFICA AQUÍ
      } 
      // Si la respuesta tiene propiedad data
      else if (response && response.data) {
        this.movements = response.data;
        console.log('Primer movimiento:', response.data[0]); // 👈 VERIFICA AQUÍ
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
// Aplicar filtros a movimientos - CORREGIDO
applyMovementsFilters() {
  let filtered = [...this.movements];

  // Filtro por tipo
  if (this.filterTipo !== 'todos') {
    filtered = filtered.filter(m => m.tipo === this.filterTipo);
  }

  // Filtro por fecha inicio - CORREGIDO
  if (this.filterFechaInicio) {
    const fechaInicio = new Date(this.filterFechaInicio);
    fechaInicio.setHours(0, 0, 0, 0);
    
    filtered = filtered.filter(m => {
      const fechaMovimiento = new Date(m.fecha);
      fechaMovimiento.setHours(0, 0, 0, 0); // Ignorar hora para comparar solo fecha
      return fechaMovimiento >= fechaInicio;
    });
  }

  // Filtro por fecha fin - CORREGIDO
  if (this.filterFechaFin) {
    const fechaFin = new Date(this.filterFechaFin);
    fechaFin.setHours(23, 59, 59, 999);
    
    filtered = filtered.filter(m => {
      const fechaMovimiento = new Date(m.fecha);
      return fechaMovimiento <= fechaFin;
    });
  }

if (this.searchMovementValue) {
  const term = this.searchMovementValue.toLowerCase();
  filtered = filtered.filter(m => 
    m.id_movimiento.toString().includes(term) ||
    m.sku.toLowerCase().includes(term) ||
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

// Filtros de movimientos - CORREGIDOS
onFechaInicioChange(value: string) {  // Cambiado de event a value
  this.filterFechaInicio = value;
  console.log('Fecha inicio seleccionada:', this.filterFechaInicio);
  this.applyMovementsFilters();
}

onFechaFinChange(value: string) {  // Cambiado de event a value
  this.filterFechaFin = value;
  console.log('Fecha fin seleccionada:', this.filterFechaFin);
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
    this.productService.getVariantsForInventoryMovement().subscribe({
      next: (variants: VariantSearchItem[]) => {
        this.allVariants = variants || [];
        this.filterVariantsForMovement();
        this.loadingVariantsForSearch = false;
      },
      error: (error) => {
        console.error('Error loading variants for search:', error);
        this.toastr.error('Error al cargar variantes', 'Error');
        this.loadingVariantsForSearch = false;
      }
    });
  }

  filterVariantsForMovement() {
    if (!this.allVariants || this.allVariants.length === 0) {
      this.filteredVariantsForMovement = [];
      return;
    }

    const sortedVariants = [...this.allVariants].sort((a, b) => {
      const aStock = Number(a.stock_actual || 0);
      const bStock = Number(b.stock_actual || 0);

      if (aStock === 0 && bStock !== 0) return -1;
      if (aStock !== 0 && bStock === 0) return 1;
      if (aStock !== bStock) return aStock - bStock;

      return a.sku.localeCompare(b.sku);
    });
    
    if (!this.variantSearchTerm || this.variantSearchTerm.trim() === '') {
      this.filteredVariantsForMovement = sortedVariants.slice(0, 10);
    } else {
      const term = this.variantSearchTerm.toLowerCase().trim();
      this.filteredVariantsForMovement = sortedVariants.filter(v => 
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

  // ===== NUEVOS MÉTODOS PARA IMPORTACIÓN EXCEL =====

  // Abrir modal de importación
  openImportModal() {
    this.showImportModal = true;
    this.selectedFile = null;
    this.importPreview = null;
  }

  // Cerrar modal de importación
  closeImportModal() {
    this.showImportModal = false;
    this.selectedFile = null;
    this.importPreview = null;
  }

  // Descargar plantilla Excel
  downloadTemplate() {
    // Crear datos de ejemplo para la plantilla
    const data = [
      ['sku', 'tipo', 'cantidad', 'costo_unitario', 'referencia_tipo', 'referencia_id'],
      ['PROD-001', 'entrada', 10, 150.50, 'compra', 1001],
      ['PROD-002', 'salida', 5, '', 'venta', 2001],
      ['PROD-003', 'ajuste', 2, '', 'inventario', ''],
    ];

    // Crear libro de Excel
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Ajustar ancho de columnas
    ws['!cols'] = [
      { wch: 15 }, // sku
      { wch: 10 }, // tipo
      { wch: 10 }, // cantidad
      { wch: 15 }, // costo_unitario
      { wch: 15 }, // referencia_tipo
      { wch: 12 }, // referencia_id
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
    
    // Generar archivo y descargar
    XLSX.writeFile(wb, 'plantilla_movimientos.xlsx');
    
    this.toastr.success('Plantilla descargada', 'Éxito');
  }

  // Manejar selección de archivo
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    // Validar tipo de archivo
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.oasis.opendocument.spreadsheet',
      'text/csv'
    ];

    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      this.toastr.error('El archivo debe ser Excel (.xls, .xlsx) o CSV', 'Error');
      return;
    }

    this.selectedFile = file;
    this.previewExcelFile(file);
  }

  // Previsualizar archivo Excel
  previewExcelFile(file: File) {
    const reader = new FileReader();
    
    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Convertir a JSON (array de arrays)
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        
        if (rows.length < 2) {
          this.toastr.error('El archivo está vacío', 'Error');
          return;
        }

        // Obtener headers (primera fila)
        const headers = rows[0].map(h => String(h).toLowerCase().trim());
        
        // Validar headers requeridos
        const requiredHeaders = ['sku', 'tipo', 'cantidad'];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        
        if (missingHeaders.length > 0) {
          this.toastr.error(`Faltan columnas requeridas: ${missingHeaders.join(', ')}`, 'Error');
          return;
        }

        // Procesar filas (desde la fila 2)
        const preview: ExcelImportPreview = {
          validRows: [],
          invalidRows: [],
          totalRows: rows.length - 1
        };

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          
          // Saltar filas vacías
          if (!row || row.length === 0 || !row[0]) continue;

          // Crear objeto con los valores
          const rowData: any = {};
          headers.forEach((header, index) => {
            rowData[header] = row[index];
          });

          // Validar fila
          const errors: string[] = [];
          
          // Validar SKU
          if (!rowData.sku) {
            errors.push('SKU requerido');
          }
          
          // Validar tipo
          if (!rowData.tipo) {
            errors.push('Tipo requerido');
          } else if (!['entrada', 'salida', 'ajuste'].includes(String(rowData.tipo).toLowerCase())) {
            errors.push('Tipo debe ser entrada, salida o ajuste');
          }
          
          // Validar cantidad
          const cantidad = Number(rowData.cantidad);
          if (isNaN(cantidad) || cantidad <= 0) {
            errors.push('Cantidad debe ser un número mayor a 0');
          }

          if (errors.length > 0) {
            preview.invalidRows.push({
              row: i + 1,
              sku: rowData.sku || 'N/A',
              tipo: rowData.tipo || 'N/A',
              cantidad: rowData.cantidad,
              error: errors.join(', ')
            });
          } else {
            preview.validRows.push({
              sku: String(rowData.sku).trim(),
              tipo: String(rowData.tipo).toLowerCase().trim() as any,
              cantidad: cantidad,
              costo_unitario: rowData.costo_unitario ? Number(rowData.costo_unitario) : undefined,
              referencia_tipo: rowData.referencia_tipo ? String(rowData.referencia_tipo).trim() : undefined,
              referencia_id: rowData.referencia_id ? Number(rowData.referencia_id) : undefined
            });
          }
        }

        this.importPreview = preview;
        
        if (preview.invalidRows.length > 0) {
          this.toastr.warning(`${preview.invalidRows.length} filas con errores. Revisa la vista previa.`, 'Validación');
        } else {
          this.toastr.success(`${preview.validRows.length} filas válidas para importar`, 'Listo');
        }

      } catch (error) {
        console.error('Error al leer Excel:', error);
        this.toastr.error('Error al leer el archivo Excel', 'Error');
      }
    };

    reader.readAsArrayBuffer(file);
  }

  // Importar datos
  importData() {
    if (!this.importPreview || this.importPreview.validRows.length === 0) {
      this.toastr.warning('No hay datos válidos para importar', 'Validación');
      return;
    }

    this.importing = true;

    this.productService.bulkCreateInventoryMovements(this.importPreview.validRows).subscribe({
      next: (result: ExcelImportResult) => {
        this.importing = false;
        
        if (result.success > 0) {
          this.toastr.success(
            `Importación completada: ${result.success} de ${result.total} exitosos`,
            'Éxito'
          );
        }
        
        if (result.errors && result.errors.length > 0) {
          console.warn('Errores en importación:', result.errors);
          this.toastr.warning(
            `${result.errors.length} registros con errores. Revisa la consola.`,
            'Importación con errores'
          );
        }

        this.closeImportModal();
        this.loadMovements();
        this.loadInventory();
      },
      error: (error) => {
        console.error('Error al importar:', error);
        this.importing = false;
        this.toastr.error(error.error?.message || 'Error al importar datos', 'Error');
      }
    });
  }

  // Agrega este método a tu componente
resetFileSelection() {
  this.selectedFile = null;
  this.importPreview = null;
  // Resetear el input file
  const fileInput = document.getElementById('excelFile') as HTMLInputElement;
  if (fileInput) {
    fileInput.value = '';
  }
}

// Exportar todos los movimientos
exportAllMovements() {
  this.exportToExcel(this.movements, 'todos_los_movimientos');
}

// Exportar solo los movimientos filtrados
exportFilteredMovements() {
  if (this.filteredMovements.length === 0) {
    this.toastr.warning('No hay movimientos para exportar', 'Información');
    return;
  }
  this.exportToExcel(this.filteredMovements, 'movimientos_filtrados');
}

// Método genérico para exportar a Excel
private exportToExcel(data: any[], filename: string) {
  try {
    // Preparar los datos para Excel
    const excelData = data.map(m => ({
      'ID Movimiento': m.id_movimiento,
      'Fecha': this.formatDateForExport(m.fecha),
      'Tipo': m.tipo,
      'ID Variante': m.id_variante,
      'Cantidad': m.cantidad,
      'Costo Unitario': m.costo_unitario,
      'Referencia Tipo': m.referencia_tipo,
      'Referencia ID': m.referencia_id || 'N/A'
    }));

    // Crear hoja de Excel
    const ws = XLSX.utils.json_to_sheet(excelData);
    
    // Ajustar ancho de columnas
    const colWidths = [
      { wch: 15 }, // ID Movimiento
      { wch: 20 }, // Fecha
      { wch: 10 }, // Tipo
      { wch: 15 }, // ID Variante
      { wch: 10 }, // Cantidad
      { wch: 15 }, // Costo Unitario
      { wch: 15 }, // Referencia Tipo
      { wch: 12 }, // Referencia ID
    ];
    ws['!cols'] = colWidths;

    // Crear libro y agregar la hoja
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');

    // Generar nombre de archivo con fecha
    const date = new Date();
    const dateStr = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')}`;
    const fileName = `${filename}_${dateStr}.xlsx`;

    // Descargar archivo
    XLSX.writeFile(wb, fileName);
    
    this.toastr.success(`Exportados ${data.length} movimientos`, 'Éxito');
  } catch (error) {
    console.error('Error al exportar:', error);
    this.toastr.error('Error al exportar los datos', 'Error');
  }
}

// Formatear fecha para export
private formatDateForExport(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
}
