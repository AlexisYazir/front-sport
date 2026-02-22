import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../../../core/services/product.service';
import { InventoryProduct } from '../../../../../core/models/product.model';

// Interfaz para variantes existentes
interface ExistingVariant {
  id_variante: number;
  id_producto: number;
  sku: string;
  precio: number;
  stock: number;
  imagenes: string[];
  selected?: boolean;
}

// Interfaz para editar variante
interface EditVariantData {
  id_producto: number;
  id_variante: number;
  precio: number;
  stock: number;
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
  
  // Modal de edición de variantes
  showEditModal: boolean = false;
  selectedProduct: InventoryProduct | null = null;
  productVariants: ExistingVariant[] = [];
  
  // Variante seleccionada para editar
  selectedVariant: ExistingVariant | null = null;
  editData: EditVariantData = {
    id_producto: 0,
    id_variante: 0,
    precio: 0,
    stock: 0
  };
  
  // Estados del modal
  loadingVariants: boolean = false;
  saving: boolean = false;
  editSuccess: boolean = false;
  editError: string = '';
  
  validationErrors = {
    precio: '',
    stock: ''
  };
  
  // Estado para toggle de producto activo
  togglingActive: { [key: number]: boolean } = {};
  
  isLoading = signal<boolean>(false);

  ngOnInit(): void {
    this.loadInventory();
  }

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
      return stock >= 0 && stock <= 5;
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
}


  // Paginación
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

  // ===== FUNCIÓN PARA TOGGLE DE ESTADO =====
  // ===== FUNCIÓN PARA TOGGLE DE ESTADO CON RECARGA =====
toggleProductStatus(product: InventoryProduct) {
  const productId = product.id_producto;
  
  // Evitar múltiples clics
  if (this.togglingActive[productId]) return;
  
  this.togglingActive[productId] = true;
  
  // Guardar estado anterior por si hay error
  const previousState = product.activo;
  
  // Cambiar visualmente inmediatamente para mejor UX
  product.activo = !product.activo;
  
  // Necesitamos una variante para actualizar el estado
  this.productService.getProductVariants(productId).subscribe({
    next: (variants: any[]) => {
      if (variants && variants.length > 0) {
        const firstVariant = variants[0];
        
        const updateData = {
          id_producto: productId,
          id_variante: firstVariant.id_variante,
          precio: Number(firstVariant.precio),
          stock: firstVariant.stock,
          estado: product.activo
        };
        
        this.productService.updateProductInv(updateData).subscribe({
          next: () => {
            this.togglingActive[productId] = false;
            // RECARGAR LA TABLA COMPLETA
            this.loadInventory();
          },
          error: (err) => {
            console.error('Error al cambiar estado:', err.error.message || err);
            // Revertir cambio visual en caso de error
            product.activo = previousState;
            this.togglingActive[productId] = false;
          }
        });
      } else {
        console.error('No hay variantes para este producto');
        // Revertir cambio visual
        product.activo = previousState;
        this.togglingActive[productId] = false;
      }
    },
    error: (err) => {
      console.error('Error al cargar variantes:', err);
      // Revertir cambio visual
      product.activo = previousState;
      this.togglingActive[productId] = false;
    }
  });
}


  // ===== FUNCIONES PARA EDITAR VARIANTES (SOLO PRECIO Y STOCK) =====
  openEditModal(product: InventoryProduct) {
    this.selectedProduct = product;
    this.loadingVariants = true;
    this.editSuccess = false;
    this.editError = '';
    
    // Cargar variantes del producto
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
        this.showEditModal = true;
      },
      error: (err) => {
        console.error('Error al cargar variantes:', err);
        this.loadingVariants = false;
        this.editError = 'Error al cargar las variantes';
      }
    });
  }

  closeEditModal() {
    this.showEditModal = false;
    this.selectedProduct = null;
    this.productVariants = [];
    this.selectedVariant = null;
    this.validationErrors = { precio: '', stock: '' };
  }

  selectVariant(variant: ExistingVariant) {
    this.selectedVariant = variant;
    this.editData = {
      id_producto: variant.id_producto,
      id_variante: variant.id_variante,
      precio: variant.precio,
      stock: variant.stock
    };
    this.validationErrors = { precio: '', stock: '' };
  }

  validateFields(): boolean {
    let isValid = true;
    this.validationErrors = { precio: '', stock: '' };

    if (this.editData.precio <= 0) {
      this.validationErrors.precio = 'El precio debe ser mayor a 0';
      isValid = false;
    }

    if (this.editData.stock < 0) {
      this.validationErrors.stock = 'El stock no puede ser negativo';
      isValid = false;
    }

    return isValid;
  }

  hasChanges(): boolean {
    if (!this.selectedVariant) return false;
    
    return this.editData.precio !== this.selectedVariant.precio ||
           this.editData.stock !== this.selectedVariant.stock;
  }

  guardarCambios() {
  if (!this.selectedVariant || !this.selectedProduct) return;
  
  if (!this.validateFields()) return;
  
  if (!this.hasChanges()) {
    this.editError = 'No se detectaron cambios';
    return;
  }

  this.saving = true;
  this.editError = '';

  // Mantener el estado actual del producto
  const updateData = {
    ...this.editData,
    estado: this.selectedProduct.activo
  };

  this.productService.updateProductInv(updateData).subscribe({
    next: () => {
      this.saving = false;
      this.editSuccess = true;
      
      // Actualizar datos locales
      if (this.selectedVariant) {
        this.selectedVariant.precio = this.editData.precio;
        this.selectedVariant.stock = this.editData.stock;
      }
      
      // Mostrar mensaje de éxito y cerrar modal después de 1 segundo
      setTimeout(() => {
        this.editSuccess = false;
        this.closeEditModal();
        this.loadInventory(); // Recargar datos
      }, 1000);
    },
    error: (err) => {
      console.error('Error al guardar cambios:', err);
      this.editError = 'Error al guardar los cambios';
      this.saving = false;
    }
  });
}

// ===== FUNCIÓN PARA DETECTAR WARNINGS EN VARIANTES =====
hasVariantWarnings(variant: ExistingVariant): boolean {
  // Stock bajo (menor o igual a 5)
  if (variant.stock <= 5) return true;
  
  // Precio muy bajo (menor a 10)
  if (variant.precio < 10) return true;
  
  // Sin imágenes
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
  }

  viewDetails(product: InventoryProduct) {
    console.log('Ver detalles:', product);
  }

  editProduct(product: InventoryProduct) {
    this.openEditModal(product);
  }

  deleteProduct(product: InventoryProduct) {
    if (confirm(`¿Estás seguro de eliminar el producto "${product.producto}"?`)) {
      console.log('Eliminar:', product);
    }
  }
  
}