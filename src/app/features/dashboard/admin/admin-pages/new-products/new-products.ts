import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../../../core/services/product.service';
import { RecientProduct, Attibute } from '../../../../../core/models/product.model';
import { RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

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
  private toastr = inject(ToastrService);
  
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
  
  // Validaciones paso 1
  validationErrors = {
    sku: '',
    precio: '',
    stock: '',
    imagenes: ''
  };
  
  isLoading = signal<boolean>(false);
  isLoadingIncomplete = signal<boolean>(false);

  // ===== PROPIEDADES PARA ATRIBUTOS =====
  availableAttributes: Attibute[] = [];
  variantAttributeValues: { id_variante: number; valores: { id_atributo: number; valor: string }[] }[] = [];
  loadingAttributes: boolean = false;

  ngOnInit(): void {
    this.loadRecentProducts();
    this.loadIncompleteProducts();
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
        this.toastr.error('Error al cargar productos recientes', 'Error');
      }
    });
  }

  // Cargar productos incompletos (sin atributos)
  loadIncompleteProducts() {
    this.isLoadingIncomplete.set(true);
    this.productService.getProductsWithoutVariantsAttributes().subscribe({
      next: (data: any[]) => {
        this.incompleteProducts = data.map(p => ({
          id_producto: p.id_producto,
          nombre: p.nombre,
          descripcion: p.descripcion,
          activo: p.activo,
          fecha_creacion: p.fecha_creacion,
          estado_completado: 'incompleto' as const
        }));
        console.log('Productos incompletos:', this.incompleteProducts);
        
        if (this.activeTab === 'incompletos') {
          this.applyFilters();
        }
        
        this.isLoadingIncomplete.set(false);
      },
      error: (error) => {
        console.error('Error al cargar productos incompletos:', error);
        this.isLoadingIncomplete.set(false);
        this.toastr.error('Error al cargar productos incompletos', 'Error');
      }
    });
  }

  // Cargar atributos
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
        this.toastr.error('Error al cargar atributos', 'Error');
      }
    });
  }

  // Cambiar entre pestañas
  switchTab(tab: 'recientes' | 'incompletos') {
    this.activeTab = tab;
    this.first = 0;
    this.searchValue = '';
    this.applyFilters();
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
    this.isIncompleteProduct = 'estado_completado' in product;
    this.currentStep = this.isIncompleteProduct ? 2 : 1;
    this.step1Completed = this.isIncompleteProduct;
    
    if (!this.isIncompleteProduct) {
      this.variantes = [];
      this.agregarVariante();
    }
    
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
        this.toastr.error('Error al cargar variantes', 'Error');
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
    this.variantAttributeValues = [];
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
            this.toastr.success('Paso 1 completado exitosamente', 'Éxito');
            
            this.checkExistingVariants(this.selectedProduct!.id_producto);
            
            setTimeout(() => {
              this.currentStep = 2;
            }, 1500);
          }
        },
        error: (err) => {
          console.error('Error al crear variante:', err);
          this.saving = false;
          this.toastr.error('Error al guardar las variantes. '+err.error.message, 'Error');
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

  continuarConAtributos() {
    const seleccionadas = this.existingVariants.filter(v => v.selected);
    
    if (seleccionadas.length === 0) {
      this.toastr.warning('Selecciona al menos una variante', 'Advertencia');
      return;
    }

    this.variantAttributeValues = seleccionadas.map(v => ({
      id_variante: v.id_variante,
      valores: []
    }));

    console.log('Variantes seleccionadas para atributos:', seleccionadas.length);
    
    this.currentStep = 3;
  }

  agregarCampoAtributo(varianteIndex: number) {
    this.variantAttributeValues[varianteIndex].valores.push({
      id_atributo: 0,
      valor: ''
    });
  }

  eliminarCampoAtributo(varianteIndex: number, attrIndex: number) {
    this.variantAttributeValues[varianteIndex].valores.splice(attrIndex, 1);
  }

  // ===== FUNCIÓN PARA GUARDAR ATRIBUTOS CON TOASTR =====
  guardarValoresAtributos() {
    // Filtrar solo atributos válidos
    const atributosValidos: { id_variante: number; id_atributo: number; valor: string }[] = [];
    
    for (const item of this.variantAttributeValues) {
      for (const attr of item.valores) {
        if (attr.id_atributo && attr.id_atributo > 0 && attr.valor?.trim()) {
          atributosValidos.push({
            id_variante: item.id_variante,
            id_atributo: attr.id_atributo,
            valor: attr.valor.trim()
          });
        }
      }
    }

    const totalAtributosValidos = atributosValidos.length;

    if (totalAtributosValidos === 0) {
      this.toastr.warning('No hay atributos válidos para guardar', 'Advertencia');
      return;
    }

    this.saving = true;
    
    let completadas = 0;
    let exitosas = 0;
    let errores: { id_atributo: number; error: string }[] = [];

    // Procesar cada atributo válido
    atributosValidos.forEach((attr) => {
      this.productService.createProductVariantValues(attr).subscribe({
        next: () => {
          completadas++;
          exitosas++;
          console.log(`✅ Atributo ${attr.id_atributo} guardado (${completadas}/${totalAtributosValidos})`);
          
          if (completadas === totalAtributosValidos) {
            this.procesarResultadoAtributos(exitosas, totalAtributosValidos, errores);
          }
        },
        error: (err) => {
          console.error(`❌ Error en atributo ${attr.id_atributo}:`, err);
          completadas++;
          errores.push({ 
            id_atributo: attr.id_atributo, 
            error: err.error?.message || 'Error desconocido' 
          });
          
          if (completadas === totalAtributosValidos) {
            this.procesarResultadoAtributos(exitosas, totalAtributosValidos, errores);
          }
        }
      });
    });
  }

  private procesarResultadoAtributos(
    exitosas: number, 
    total: number, 
    errores: { id_atributo: number; error: string }[]
  ) {
    this.saving = false;
    
    if (errores.length > 0) {
      const erroresMsg = errores.map(e => e.error).join('. ');
      this.toastr.error(`Se guardaron ${exitosas} de ${total} atributos. Errores: ${erroresMsg}`, 'Error');
    } else {
      this.toastr.success('Atributos asignados correctamente', 'Éxito');
      
      // Cerrar modal y recargar datos después de 1 segundo
      setTimeout(() => {
        this.closeCompleteModal();
      }, 1000);
    }
  }

  // ===== MÉTODO AUXILIAR =====
  getVariantSku(id_variante: number): string {
    const variant = this.existingVariants.find(v => v.id_variante === id_variante);
    return variant ? variant.sku : 'Variante no encontrada';
  }
}