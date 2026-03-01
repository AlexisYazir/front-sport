import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
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

// Interfaz para editar variante completa
interface EditVariantFullData {
  id_producto: number;
  id_variante: number;
  sku: string;
  precio: number;
  stock: number;
  imagenes: string[];
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
  
  // Datos para edición completa de variante
  editVariantData: EditVariantFullData = {
    id_producto: 0,
    id_variante: 0,
    sku: '',
    precio: 0,
    stock: 0,
    imagenes: []
  };
  
  // Guardar copia original para detectar cambios
  originalVariantData: EditVariantFullData | null = null;
  
  // Input para nueva imagen
  variantImageInput: string = '';
  
  // Estados del modal
  loadingVariants: boolean = false;
  saving: boolean = false;
  
  validationErrors = {
    sku: '',
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

  // ===== FUNCIÓN PARA TOGGLE DE ESTADO CON TOASTR =====
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

  // ===== FUNCIONES PARA EDITAR VARIANTES COMPLETAS =====
  openEditModal(product: InventoryProduct) {
    this.selectedProduct = product;
    this.loadingVariants = true;
    this.variantImageInput = '';
    
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
        this.toastr.error('Error al cargar las variantes', 'Error');
      }
    });
  }

  closeEditModal() {
    this.showEditModal = false;
    this.selectedProduct = null;
    this.productVariants = [];
    this.selectedVariant = null;
    this.originalVariantData = null;
    this.variantImageInput = '';
    this.validationErrors = { sku: '', precio: '', stock: '' };
  }

  selectVariant(variant: ExistingVariant) {
    this.selectedVariant = variant;
    this.editVariantData = {
      id_producto: variant.id_producto,
      id_variante: variant.id_variante,
      sku: variant.sku,
      precio: variant.precio,
      stock: variant.stock,
      imagenes: [...variant.imagenes]
    };
    
    // Guardar copia original para comparar cambios
    this.originalVariantData = { ...this.editVariantData, imagenes: [...this.editVariantData.imagenes] };
    
    this.variantImageInput = '';
    this.validationErrors = { sku: '', precio: '', stock: '' };
  }

  // Funciones para manejar imágenes
  addVariantImage() {
    if (this.variantImageInput && this.variantImageInput.trim()) {
      this.editVariantData.imagenes.push(this.variantImageInput.trim());
      this.variantImageInput = '';
    }
  }

  removeVariantImage(index: number) {
    this.editVariantData.imagenes.splice(index, 1);
  }

  // Validaciones
  validateFields(): boolean {
    let isValid = true;
    this.validationErrors = { sku: '', precio: '', stock: '' };

    if (!this.editVariantData.sku.trim()) {
      this.validationErrors.sku = 'El SKU es obligatorio';
      isValid = false;
    }

    if (this.editVariantData.precio <= 0) {
      this.validationErrors.precio = 'El precio debe ser mayor a 0';
      isValid = false;
    }

    if (this.editVariantData.stock < 0) {
      this.validationErrors.stock = 'El stock no puede ser negativo';
      isValid = false;
    }

    return isValid;
  }

  hasChanges(): boolean {
    if (!this.selectedVariant || !this.originalVariantData) return false;
    
    return this.editVariantData.sku !== this.originalVariantData.sku ||
           this.editVariantData.precio !== this.originalVariantData.precio ||
           this.editVariantData.stock !== this.originalVariantData.stock ||
           JSON.stringify(this.editVariantData.imagenes) !== JSON.stringify(this.originalVariantData.imagenes);
  }

  // Guardar cambios de la variante
  guardarCambios() {
    if (!this.selectedVariant || !this.selectedProduct) return;
    
    if (!this.validateFields()) {
      this.toastr.warning('Corrige los errores en el formulario', 'Validación');
      return;
    }
    
    if (!this.hasChanges()) {
      this.toastr.info('No se detectaron cambios', 'Información');
      return;
    }

    this.saving = true;

    this.productService.updateProductVariantAttributes(this.editVariantData).subscribe({
      next: () => {
        this.saving = false;
        this.toastr.success('Variante actualizada correctamente', 'Éxito');
        
        // Actualizar datos locales
        if (this.selectedVariant) {
          this.selectedVariant.sku = this.editVariantData.sku;
          this.selectedVariant.precio = this.editVariantData.precio;
          this.selectedVariant.stock = this.editVariantData.stock;
          this.selectedVariant.imagenes = [...this.editVariantData.imagenes];
        }
        
        setTimeout(() => {
          this.closeEditModal();
          this.loadInventory();
        }, 1500);
      },
      error: (err) => {
        console.error('Error al guardar cambios:', err);
        this.saving = false;
        this.toastr.error(err.error?.message || 'Error al guardar los cambios', 'Error');
      }
    });
  }

  // ===== FUNCIÓN PARA DETECTAR WARNINGS EN VARIANTES =====
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
    // this.toastr.success('Datos actualizados', 'Éxito');
  }

  viewDetails(product: InventoryProduct) {
    console.log('Ver detalles:', product);
  }

  editProduct(product: InventoryProduct) {
    this.openEditModal(product);
  }

    getMarcaImageUrl(product: InventoryProduct): string {
      return product.imagen || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(product.imagen) + '&background=0367A6&color=fff&size=64';
    }
}