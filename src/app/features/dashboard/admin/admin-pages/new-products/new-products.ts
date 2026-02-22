import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../../../core/services/product.service';
import { RecientProduct, Attibute } from '../../../../../core/models/product.model';
import { RouterModule } from '@angular/router'; // <-- Importar RouterModule

// Interfaz para variantes
interface ProductVariant {
  sku: string;
  precio: number;
  stock: number;
  imagenes: string[];
  imagenInput?: string;
}

// Interfaz para variantes existentes
interface ExistingVariant {
  id_variante: number;
  id_producto: number;
  sku: string;
  precio: string;
  stock: number;
  imagenes: string[];
  selected?: boolean;
}

// Interfaz para productos incompletos (sin atributos)
interface IncompleteProduct {
  id_producto: number;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  fecha_creacion: string;
  estado_completado: 'incompleto';
}

@Component({
  selector: 'app-new-products',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './new-products.html',
  styleUrls: ['./new-products.css'],
})
export class NewProducts implements OnInit {
  private productService = inject(ProductService);
  
  // Productos recientes (todos)
  products: RecientProduct[] = [];
  filteredProducts: RecientProduct[] = [];
  paginatedProducts: RecientProduct[] = [];
  
  // Productos incompletos
  incompleteProducts: IncompleteProduct[] = [];
  filteredIncompleteProducts: IncompleteProduct[] = [];
  paginatedIncompleteProducts: IncompleteProduct[] = [];
  
  searchValue: string = '';
  activeTab: 'recientes' | 'incompletos' = 'recientes';
  
  // Paginación
  rowsPerPage: number = 10;
  rowsPerPageOptions: number[] = [5, 10, 20, 50, 100];
  first: number = 0;
  currentPage: number = 1;
  totalRecords: number = 0;
  
  // Modal de completar producto
  showCompleteModal: boolean = false;
  currentStep: number = 1;
  selectedProduct: RecientProduct | IncompleteProduct | null = null;
  isIncompleteProduct: boolean = false;
  
  // Paso 1: Datos básicos
  variantes: ProductVariant[] = [];
  varianteActualIndex: number = 0;
  
  // Paso 2: Variantes existentes
  existingVariants: ExistingVariant[] = [];
  
  // Estados
  loadingVariants: boolean = false;
  saving: boolean = false;
  step1Completed: boolean = false;
  successMessage: string = '';
  errorMessage: string = '';
  
  // Validaciones paso 1
  validationErrors = {
    sku: '',
    precio: '',
    stock: '',
    imagenes: ''
  };
  
  isLoading = signal<boolean>(false);
  isLoadingIncomplete = signal<boolean>(false);

  ngOnInit(): void {
    this.loadRecentProducts();
    this.loadIncompleteProducts(); // Cargar también al inicio
    this.loadAttributes(); 
  }

  // Cargar productos recientes
  loadRecentProducts() {
    this.isLoading.set(true);
    this.productService.getReceientProducts().subscribe({
      next: (data: RecientProduct[]) => {
        this.products = data;
        this.applyFilters();
        this.isLoading.set(false);
        console.log('Productos recientes:', data);
      },
      error: (error) => {
        console.error('Error al cargar productos recientes:', error);
        this.isLoading.set(false);
      }
    });
  }
  //funciones

  // Cargar productos incompletos (sin atributos)
  loadIncompleteProducts() {
    this.isLoadingIncomplete.set(true);
    this.productService.getProductsWithoutVariantsAttributes().subscribe({
      next: (data: any[]) => {
        // Mapear a IncompleteProduct
        this.incompleteProducts = data.map(p => ({
          id_producto: p.id_producto,
          nombre: p.nombre,
          descripcion: p.descripcion,
          activo: p.activo,
          fecha_creacion: p.fecha_creacion,
          estado_completado: 'incompleto' as const
        }));
        console.log('Productos incompletos:', this.incompleteProducts);
        
        // Si estamos en la pestaña de incompletos, actualizar la vista
        if (this.activeTab === 'incompletos') {
          this.applyFilters();
        }
        
        this.isLoadingIncomplete.set(false);
      },
      error: (error) => {
        console.error('Error al cargar productos incompletos:', error);
        this.isLoadingIncomplete.set(false);
      }
    });
  }

  // Cambiar entre pestañas
  switchTab(tab: 'recientes' | 'incompletos') {
    this.activeTab = tab;
    this.first = 0;
    this.searchValue = '';
    this.applyFilters(); // Aplicar filtros al cambiar de pestaña
  }

  // APLICAR FILTROS según pestaña activa
  applyFilters() {
    if (this.activeTab === 'recientes') {
      let filtered = [...this.products];

      if (this.searchValue) {
        const term = this.searchValue.toLowerCase();
        filtered = filtered.filter(product => 
          product.nombre.toLowerCase().includes(term) ||
          product.id_producto?.toString().includes(term)
        );
      }

      this.filteredProducts = filtered;
      this.totalRecords = filtered.length;
    } else {
      // Asegurarse de que incompleteProducts tenga datos
      let filtered = this.incompleteProducts && this.incompleteProducts.length > 0 
        ? [...this.incompleteProducts] 
        : [];

      if (this.searchValue && filtered.length > 0) {
        const term = this.searchValue.toLowerCase();
        filtered = filtered.filter(product => 
          product.nombre.toLowerCase().includes(term) ||
          product.id_producto?.toString().includes(term)
        );
      }

      this.filteredIncompleteProducts = filtered;
      this.totalRecords = filtered.length;
    }
    
    this.first = 0;
    this.updatePaginatedData();
  }

  updatePaginatedData() {
    if (this.activeTab === 'recientes') {
      const start = this.first;
      const end = this.first + this.rowsPerPage;
      this.paginatedProducts = this.filteredProducts.slice(start, end);
      this.totalRecords = this.filteredProducts.length;
    } else {
      const start = this.first;
      const end = this.first + this.rowsPerPage;
      this.paginatedIncompleteProducts = this.filteredIncompleteProducts && this.filteredIncompleteProducts.length > 0
        ? this.filteredIncompleteProducts.slice(start, end)
        : [];
      this.totalRecords = this.filteredIncompleteProducts ? this.filteredIncompleteProducts.length : 0;
    }
    this.currentPage = Math.floor(this.first / this.rowsPerPage) + 1;
  }

  onSearch(event: any) {
    this.searchValue = event.target.value;
    this.applyFilters();
  }

  clearSearch() {
    this.searchValue = '';
    this.applyFilters();
  }

  // Paginación
  onRowsPerPageChange() {
    this.first = 0;
    this.updatePaginatedData();
  }

  changePage(action: 'first' | 'prev' | 'next' | 'last') {
    switch (action) {
      case 'first': this.first = 0; break;
      case 'prev': if (this.first > 0) this.first -= this.rowsPerPage; break;
      case 'next': if (this.first + this.rowsPerPage < this.totalRecords) this.first += this.rowsPerPage; break;
      case 'last': this.first = Math.floor((this.totalRecords - 1) / this.rowsPerPage) * this.rowsPerPage; break;
    }
    this.updatePaginatedData();
  }

  goToPage(page: number) {
    this.first = (page - 1) * this.rowsPerPage;
    this.updatePaginatedData();
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
  getStatusClass(activo: boolean): string {
    return activo ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200';
  }

  getStatusIcon(activo: boolean): string {
    return activo ? 'pi pi-check' : 'pi pi-times';
  }

  getStatusText(activo: boolean): string {
    return activo ? 'Activo' : 'Inactivo';
  }

  getCompletionStatusClass(estado: 'incompleto'): string {
    return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  }

  getCompletionStatusText(estado: 'incompleto'): string {
    return 'Incompleto';
  }

  getCompletionStatusIcon(estado: 'incompleto'): string {
    return 'pi pi-exclamation-triangle';
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Acciones
  refreshData() {
    this.loadRecentProducts();
    this.loadIncompleteProducts();
    this.loadAttributes(); 
  }

  // ===== FUNCIONES DEL MODAL DE COMPLETAR PRODUCTO =====
  completeProduct(product: RecientProduct | IncompleteProduct) {
    this.selectedProduct = product;
    this.isIncompleteProduct = 'estado_completado' in product; // true si es incompleto
    this.currentStep = this.isIncompleteProduct ? 2 : 1; // Si es incompleto, va directo al paso 2
    this.step1Completed = this.isIncompleteProduct; // Si es incompleto, ya tiene paso 1 completado
    this.successMessage = '';
    this.errorMessage = '';
    
    // Inicializar paso 1 (solo si es necesario)
    if (!this.isIncompleteProduct) {
      this.variantes = [];
      this.agregarVariante();
    }
    
    // Verificar variantes existentes
    this.checkExistingVariants(product.id_producto);
    
    this.showCompleteModal = true;
  }

  checkExistingVariants(id_producto: number) {
    this.loadingVariants = true;
    this.productService.getProductVariants(id_producto).subscribe({
      next: (variants: any[]) => {
        if (variants && variants.length > 0) {
          this.step1Completed = true;
          this.existingVariants = variants.map(v => ({
            id_variante: v.id_variante,
            id_producto: v.id_producto,
            sku: v.sku,
            precio: v.precio,
            stock: v.stock,
            imagenes: v.imagenes || [],
            selected: false
          }));
        } else {
          this.existingVariants = [];
        }
        this.loadingVariants = false;
      },
      error: (err) => {
        console.error('Error al verificar variantes:', err);
        this.loadingVariants = false;
        this.existingVariants = [];
      }
    });
  }

  closeCompleteModal() {
    this.showCompleteModal = false;
    this.selectedProduct = null;
    this.currentStep = 1;
    this.variantes = [];
    this.existingVariants = [];
    this.isIncompleteProduct = false;
    
    // Recargar datos al cerrar el modal
    this.refreshData();
  }

  // ===== FUNCIONES PASO 1 =====
  agregarVariante() {
    const nuevaVariante: ProductVariant = {
      sku: '',
      precio: 0,
      stock: 0,
      imagenes: [],
      imagenInput: ''
    };
    this.variantes.push(nuevaVariante);
    this.varianteActualIndex = this.variantes.length - 1;
  }

  seleccionarVariante(index: number) {
    this.varianteActualIndex = index;
  }

  eliminarVariante(index: number) {
    if (this.variantes.length > 1) {
      this.variantes.splice(index, 1);
      if (this.varianteActualIndex >= index) {
        this.varianteActualIndex = Math.max(0, this.varianteActualIndex - 1);
      }
    }
  }

  agregarImagen() {
    const variante = this.variantes[this.varianteActualIndex];
    if (variante.imagenInput && variante.imagenInput.trim()) {
      variante.imagenes.push(variante.imagenInput.trim());
      variante.imagenInput = '';
    }
  }

  eliminarImagen(index: number) {
    this.variantes[this.varianteActualIndex].imagenes.splice(index, 1);
  }

  validateVariant(index: number): boolean {
    const v = this.variantes[index];
    let isValid = true;
    
    if (!v.sku?.trim()) {
      this.validationErrors.sku = 'El SKU es obligatorio';
      isValid = false;
    }
    
    if (v.precio <= 0) {
      this.validationErrors.precio = 'El precio debe ser mayor a 0';
      isValid = false;
    }
    
    if (v.stock < 0) {
      this.validationErrors.stock = 'El stock no puede ser negativo';
      isValid = false;
    }
    
    return isValid;
  }

  validateAllVariants(): boolean {
    for (let i = 0; i < this.variantes.length; i++) {
      if (!this.validateVariant(i)) {
        this.varianteActualIndex = i;
        return false;
      }
    }
    return true;
  }

  guardarPaso1() {
    if (!this.selectedProduct) return;
    
    if (!this.validateAllVariants()) return;

    this.saving = true;
    this.errorMessage = '';
    
    let completadas = 0;
    
    this.variantes.forEach(variante => {
      const variantData = {
        id_producto: this.selectedProduct!.id_producto,
        sku: variante.sku,
        precio: Number(variante.precio),
        stock: Number(variante.stock),
        imagenes: variante.imagenes
      };
      
      this.productService.createProductVariant(variantData).subscribe({
        next: () => {
          completadas++;
          if (completadas === this.variantes.length) {
            this.saving = false;
            this.step1Completed = true;
            this.successMessage = 'Paso 1 completado exitosamente';
            
            // Recargar variantes para el paso 2
            this.checkExistingVariants(this.selectedProduct!.id_producto);
            
            setTimeout(() => {
              this.currentStep = 2;
              this.successMessage = '';
            }, 1500);
          }
        },
        error: (err) => {
          console.error('Error al crear variante:', err);
          this.errorMessage = 'Error al guardar las variantes';
          this.saving = false;
        }
      });
    });
  }

  // ===== FUNCIONES PASO 2 =====
  irAlPaso2() {
    this.currentStep = 2;
  }

  volverAlPaso1() {
    this.currentStep = 1;
  }

  seleccionarTodasVariantes(checked: boolean) {
    this.existingVariants.forEach(v => v.selected = checked);
  }

  hayVariantesSeleccionadas(): boolean {
    return this.existingVariants.some(v => v.selected);
  }

  isAllSelected(): boolean {
    return this.existingVariants.length > 0 && this.existingVariants.every(v => v.selected);
  }

  formatPrecio(precio: string): string {
    return Number(precio).toFixed(2);
  }


  // ===== FUNCIONES PASO 2 - ASIGNAR VALORES =====

// Lista de atributos disponibles (los cargas desde el servicio)
availableAttributes: Attibute[] = [];

// Almacena los valores ingresados por el usuario para cada variante
// Ejemplo: { id_variante: 3, valores: [{ id_atributo: 1, valor: 'M' }] }
variantAttributeValues: { id_variante: number; valores: { id_atributo: number; valor: string }[] }[] = [];

// Estado para controlar la carga de atributos
loadingAttributes: boolean = false;

// Cargar atributos disponibles al iniciar (si no lo hiciste ya)
loadAttributes() {
  this.loadingAttributes = true;
  this.productService.getAttributes().subscribe({
    next: (data) => {
      this.availableAttributes = data;
      this.loadingAttributes = false;
    },
    error: (err) => {
      console.error('Error al cargar atributos:', err);
      this.loadingAttributes = false;
    }
  });
}

continuarConAtributos() {
  const seleccionadas = this.existingVariants.filter(v => v.selected);
  
  if (seleccionadas.length === 0) {
    alert('Selecciona al menos una variante');
    return;
  }

  // Inicializar estructura para cada variante seleccionada
  this.variantAttributeValues = seleccionadas.map(v => ({
    id_variante: v.id_variante,
    valores: []
  }));

  // Aquí puedes mostrar un submodal o cambiar a un "Paso 3"
  // Por simplicidad, lo haremos en el mismo modal, mostrando un nuevo paso
  this.currentStep = 3; // Necesitas agregar un paso 3 en el HTML
}

// Agregar un nuevo campo de atributo a una variante específica
agregarCampoAtributo(varianteIndex: number) {
  this.variantAttributeValues[varianteIndex].valores.push({
    id_atributo: 0, // valor por defecto, el usuario elegirá después
    valor: ''
  });
}

// Eliminar un campo de atributo
eliminarCampoAtributo(varianteIndex: number, attrIndex: number) {
  this.variantAttributeValues[varianteIndex].valores.splice(attrIndex, 1);
}

// Guardar todos los valores de atributos
guardarValoresAtributos() {
  let pendientes = 0;
  let errores = false;

  for (const item of this.variantAttributeValues) {
    for (const attr of item.valores) {
      if (!attr.id_atributo || !attr.valor.trim()) continue;

      pendientes++;
      this.productService.createProductVariantValues({
        id_variante: item.id_variante,
        id_atributo: attr.id_atributo,
        valor: attr.valor
      }).subscribe({
        next: () => {
          pendientes--;
          if (pendientes === 0 && !errores) {
            this.successMessage = 'Atributos asignados correctamente';
            setTimeout(() => {
              this.closeCompleteModal();
            }, 1500);
          }
        },
        error: (err) => {
          console.error('Error al asignar atributo:', err);
          errores = true;
          this.errorMessage = 'Error al asignar atributos';
        }
      });
    }
  }

  if (pendientes === 0) {
    this.successMessage = 'Atributos asignados correctamente';
    setTimeout(() => this.closeCompleteModal(), 1500);
  }
}
// ===== MÉTODO AUXILIAR PARA PASO 3 =====
getVariantSku(id_variante: number): string {
  const variant = this.existingVariants.find(v => v.id_variante === id_variante);
  return variant ? variant.sku : 'Variante no encontrada';
}

}