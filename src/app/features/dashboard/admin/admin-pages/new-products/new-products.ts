import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../../../core/services/product.service';
import { RecientProduct, Attibute } from '../../../../../core/models/product.model';
import { RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';
import { formatMexicoDateTime } from '../../../../../core/utils/date-time.util';

// Interfaz para variantes - AHORA INCLUYE ATRIBUTOS
interface ProductVariant {
  sku: string;
  precio: number;
  imagenes: string[];
  imagenInput?: string;
  atributos: {
    [key: string]: string; // Ej: { "talla": "M", "color": "negro" }
  };
}

// Interfaz para la selección de atributos en el formulario
interface AttributeField {
  id_atributo_padre: number;
  id_atributo_hijo: number;
  nombre_padre?: string;
  nombre_hijo?: string;
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
  
  searchValue: string = '';
  activeTab: 'recientes' = 'recientes'; // Solo una pestaña ahora
  
  // Paginación
  rowsPerPage: number = 10;
  rowsPerPageOptions: number[] = [10];
  first: number = 0;
  currentPage: number = 1;
  totalRecords: number = 0;
  
  // Modal de crear variantes
  showModal: boolean = false;
  selectedProduct: RecientProduct | null = null;
  
  // Datos del formulario
  variantes: ProductVariant[] = [];
  varianteActualIndex: number = 0;
  
  // Estados
  saving: boolean = false;
  uploadingImages: boolean = false;
  dragOverImages: boolean = false;
  
  // Validaciones
  validationErrors = {
    sku: '',
    precio: '',
    imagenes: ''
  };
  
  isLoading = signal<boolean>(false);

  // ===== PROPIEDADES PARA ATRIBUTOS =====
  availableAttributes: Attibute[] = [];
  parentAttributes: Attibute[] = [];
  childAttributesByParent: Map<number, Attibute[]> = new Map();
  
  // Atributos temporales para la variante actual (para la UI)
  currentVariantAttributes: AttributeField[] = [];
  
  // Array para rastrear errores de atributos duplicados
  attributeErrors: boolean[] = [];
  
  loadingAttributes: boolean = false;

  ngOnInit(): void {
    this.loadRecentProducts();
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

  // Cargar atributos y organizarlos por padre/hijo
  loadAttributes() {
    this.loadingAttributes = true;
    this.productService.getAttributes().subscribe({
      next: (data: Attibute[]) => {
        this.availableAttributes = data;
        
        // Filtrar atributos padre (id_padre = null)
        this.parentAttributes = data.filter(attr => attr.id_padre === null);
        
        // Organizar atributos hijos por id_padre
        this.childAttributesByParent.clear();
        data.forEach(attr => {
          if (attr.id_padre !== null) {
            if (!this.childAttributesByParent.has(attr.id_padre)) {
              this.childAttributesByParent.set(attr.id_padre, []);
            }
            this.childAttributesByParent.get(attr.id_padre)!.push(attr);
          }
        });
        
        this.loadingAttributes = false;
        console.log('Atributos padre:', this.parentAttributes);
        console.log('Atributos hijos por padre:', this.childAttributesByParent);
      },
      error: (err) => {
        console.error('Error al cargar atributos:', err);
        this.loadingAttributes = false;
        this.toastr.error('Error al cargar atributos', 'Error');
      }
    });
  }

  // Cambiar entre pestañas (solo hay una ahora)
  switchTab(tab: 'recientes') {
    this.activeTab = tab;
    this.first = 0;
    this.searchValue = '';
    this.applyFilters();
  }

  // Aplicar filtros
  applyFilters() {
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
    
    this.first = 0;
    this.updatePaginatedData();
  }

  updatePaginatedData() {
    const start = this.first;
    const end = this.first + this.rowsPerPage;
    this.paginatedProducts = this.filteredProducts.slice(start, end);
    this.totalRecords = this.filteredProducts.length;
    
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

  formatDate(dateString: string): string {
    return formatMexicoDateTime(dateString, 'es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Acciones
  refreshData() {
    this.loadRecentProducts();
    this.loadAttributes(); 
  }

  // ===== FUNCIONES DEL MODAL =====
  createVariants(product: RecientProduct) {
    this.selectedProduct = product;
    this.variantes = [];
    this.currentVariantAttributes = [];
    this.attributeErrors = [];
    this.agregarVariante();
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.selectedProduct = null;
    this.variantes = [];
    this.currentVariantAttributes = [];
    this.attributeErrors = [];
    this.validationErrors = { sku: '', precio: '', imagenes: '' };
    this.refreshData();
  }

  // ===== FUNCIONES DEL FORMULARIO =====
  agregarVariante() {
    const nuevaVariante: ProductVariant = {
      sku: '',
      precio: 0,
      imagenes: [],
      imagenInput: '',
      atributos: {}
    };
    this.variantes.push(nuevaVariante);
    this.varianteActualIndex = this.variantes.length - 1;
    
    // Reiniciar atributos temporales para la nueva variante
    this.currentVariantAttributes = [];
    this.attributeErrors = [];
  }

  seleccionarVariante(index: number) {
    this.varianteActualIndex = index;
    
    // Cargar los atributos de la variante seleccionada al editor temporal
    this.currentVariantAttributes = [];
    const variante = this.variantes[index];
    
    // Convertir el objeto de atributos a array para la UI
    if (variante.atributos && Object.keys(variante.atributos).length > 0) {
      Object.keys(variante.atributos).forEach(key => {
        const padre = this.parentAttributes.find(p => p.nombre.toLowerCase() === key.toLowerCase());
        if (padre) {
          const hijo = this.getChildAttributes(padre.id_atributo)
            .find(h => h.nombre.toLowerCase() === variante.atributos[key].toLowerCase());
          
          if (hijo) {
            this.currentVariantAttributes.push({
              id_atributo_padre: padre.id_atributo,
              id_atributo_hijo: hijo.id_atributo,
              nombre_padre: padre.nombre,
              nombre_hijo: hijo.nombre
            });
          }
        }
      });
    }
    
    // Reiniciar errores
    this.attributeErrors = new Array(this.currentVariantAttributes.length).fill(false);
  }

  eliminarVariante(index: number) {
    if (this.variantes.length > 1) {
      this.variantes.splice(index, 1);
      if (this.varianteActualIndex >= index) {
        this.varianteActualIndex = Math.max(0, this.varianteActualIndex - 1);
      }
      
      // Actualizar atributos temporales
      this.seleccionarVariante(this.varianteActualIndex);
    }
  }

  agregarImagen() {
    const variante = this.variantes[this.varianteActualIndex];
    if (variante.imagenInput && variante.imagenInput.trim()) {
      if (!this.isValidUrl(variante.imagenInput.trim())) {
        this.toastr.warning('Ingresa una URL valida para la imagen', 'Validacion');
        return;
      }

      variante.imagenes.push(variante.imagenInput.trim());
      variante.imagenInput = '';
    }
  }

  eliminarImagen(index: number) {
    this.variantes[this.varianteActualIndex].imagenes.splice(index, 1);
  }

  async onImageFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    await this.uploadImageFiles(Array.from(input.files));
    input.value = '';
  }

  onImageDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragOverImages = true;
  }

  onImageDragLeave(event: DragEvent) {
    event.preventDefault();
    this.dragOverImages = false;
  }

  async onImageDrop(event: DragEvent) {
    event.preventDefault();
    this.dragOverImages = false;

    const files = Array.from(event.dataTransfer?.files || []);
    if (!files.length) return;

    await this.uploadImageFiles(files);
  }

  private async uploadImageFiles(files: File[]) {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      this.toastr.warning('Selecciona archivos de imagen validos', 'Validacion');
      return;
    }

    this.uploadingImages = true;
    let uploaded = 0;
    const failed: string[] = [];

    try {
      for (const file of imageFiles) {
        try {
          const response = await firstValueFrom(
            this.productService.uploadProductImage(file)
          );

          if (response?.secure_url) {
            this.variantes[this.varianteActualIndex].imagenes.push(response.secure_url);
            uploaded++;
          } else {
            failed.push(file.name);
          }
        } catch (error) {
          console.error('Error al subir imagen:', error);
          failed.push(file.name);
        }
      }
    } finally {
      this.uploadingImages = false;
    }

    if (uploaded > 0) {
      this.toastr.success(
        `${uploaded} imagen(es) subida(s) a Cloudinary correctamente`,
        'Exito'
      );
    }

    if (failed.length > 0) {
      this.toastr.warning(
        `No se pudieron subir: ${failed.join(', ')}`,
        'Atencion'
      );
    }
  }

  isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  // ===== FUNCIONES DE ATRIBUTOS =====
  
  // Método mejorado para agregar campo de atributo
  agregarCampoAtributo() {
    this.currentVariantAttributes.push({
      id_atributo_padre: 0,
      id_atributo_hijo: 0
    });
    // Extender el array de errores
    this.attributeErrors.push(false);
  }

  // Método mejorado para eliminar campo de atributo
  eliminarCampoAtributo(index: number) {
    this.currentVariantAttributes.splice(index, 1);
    this.attributeErrors.splice(index, 1);
    this.actualizarAtributosVariante();
  }

  // Método mejorado para cuando cambia el atributo padre
  onPadreChange(attrIndex: number) {
    const atributoPadreId = this.currentVariantAttributes[attrIndex].id_atributo_padre;
    
    // Resetear hijo cuando cambia el padre
    this.currentVariantAttributes[attrIndex].id_atributo_hijo = 0;
    delete this.currentVariantAttributes[attrIndex].nombre_padre;
    delete this.currentVariantAttributes[attrIndex].nombre_hijo;
    
    // Actualizar nombre del padre si está seleccionado
    if (atributoPadreId > 0) {
      const padre = this.parentAttributes.find(
        p => p.id_atributo === atributoPadreId
      );
      if (padre) {
        this.currentVariantAttributes[attrIndex].nombre_padre = padre.nombre;
      }
      
      // Verificar si está duplicado
      if (this.isAtributoDuplicado(atributoPadreId, attrIndex)) {
        this.attributeErrors[attrIndex] = true;
        this.toastr.warning(
          `El atributo "${padre?.nombre}" ya está asignado a esta variante. No puedes repetirlo.`, 
          'Atributo duplicado'
        );
      } else {
        this.attributeErrors[attrIndex] = false;
      }
    }
    
    this.actualizarAtributosVariante();
  }

  onHijoChange(attrIndex: number) {
    if (this.currentVariantAttributes[attrIndex].id_atributo_hijo > 0) {
      const hijo = this.availableAttributes.find(
        a => a.id_atributo === this.currentVariantAttributes[attrIndex].id_atributo_hijo
      );
      if (hijo) {
        this.currentVariantAttributes[attrIndex].nombre_hijo = hijo.nombre;
      }
    }
    this.actualizarAtributosVariante();
  }

  actualizarAtributosVariante() {
    // Construir objeto de atributos para la variante actual
    const atributosObj: { [key: string]: string } = {};
    
    this.currentVariantAttributes.forEach(attr => {
      if (attr.id_atributo_padre > 0 && attr.id_atributo_hijo > 0 && attr.nombre_padre && attr.nombre_hijo) {
        atributosObj[attr.nombre_padre] = attr.nombre_hijo;
      }
    });
    
    this.variantes[this.varianteActualIndex].atributos = atributosObj;
  }

  getChildAttributes(id_padre: number): Attibute[] {
    return this.childAttributesByParent.get(id_padre) || [];
  }

  // Método para verificar si un atributo está duplicado en la variante actual
  isAtributoDuplicado(atributoPadreId: number, indexActual: number): boolean {
    if (!atributoPadreId || atributoPadreId === 0) return false;
    
    // Contar cuántas veces aparece este atributo padre en la lista actual
    const count = this.currentVariantAttributes.filter(
      (attr, idx) => attr.id_atributo_padre === atributoPadreId && idx !== indexActual
    ).length;
    
    return count > 0;
  }

  // Método para verificar si un atributo padre está siendo usado en otras filas (para el HTML)
  isAtributoPadreUsado(atributoPadreId: number, indexActual: number): boolean {
    if (!atributoPadreId || atributoPadreId === 0) return false;
    
    return this.currentVariantAttributes.some(
      (attr, idx) => idx !== indexActual && attr.id_atributo_padre === atributoPadreId
    );
  }

  // Método para obtener el nombre del atributo padre por ID
  getNombreAtributoPadre(id: number): string {
    const padre = this.parentAttributes.find(p => p.id_atributo === id);
    return padre ? padre.nombre : '';
  }

  // Validar todos los atributos antes de guardar
  validarAtributosAntesDeGuardar(): boolean {
    // Reiniciar errores
    this.attributeErrors = new Array(this.currentVariantAttributes.length).fill(false);
    
    const atributosPadreVistos = new Set<number>();
    let hayDuplicados = false;
    
    for (let i = 0; i < this.currentVariantAttributes.length; i++) {
      const attr = this.currentVariantAttributes[i];
      
      if (attr.id_atributo_padre > 0) {
        if (atributosPadreVistos.has(attr.id_atributo_padre)) {
          // Atributo duplicado
          this.attributeErrors[i] = true;
          hayDuplicados = true;
          
          const padre = this.parentAttributes.find(p => p.id_atributo === attr.id_atributo_padre);
          this.toastr.error(
            `Atributo duplicado: "${padre?.nombre || 'Desconocido'}" no puede repetirse en la misma variante`,
            'Error de validación'
          );
        } else {
          atributosPadreVistos.add(attr.id_atributo_padre);
        }
      }
    }
    
    return !hayDuplicados;
  }

  // ===== VALIDACIONES =====
  validateVariant(index: number): boolean {
    const v = this.variantes[index];
    let isValid = true;
    
    // Resetear errores
    this.validationErrors = { sku: '', precio: '', imagenes: '' };
    
    if (!v.sku?.trim()) {
      this.validationErrors.sku = 'El SKU es obligatorio';
      isValid = false;
    }
    
    if (v.precio <= 0) {
      this.validationErrors.precio = 'El precio debe ser mayor a 0';
      isValid = false;
    }
    
    return isValid;
  }

  validateAllVariants(): boolean {
    // Validar que no haya SKUs duplicados
    const skus = this.variantes.map(v => v.sku?.trim()).filter(sku => sku);
    const skuDuplicados = skus.filter((sku, index) => skus.indexOf(sku) !== index);
    
    if (skuDuplicados.length > 0) {
      this.toastr.warning('No puedes tener SKUs duplicados en las variantes', 'Advertencia');
      
      // Encontrar el índice de la primera variante con SKU duplicado
      const primerSkuDuplicado = skuDuplicados[0];
      const indexDuplicado = this.variantes.findIndex(v => v.sku?.trim() === primerSkuDuplicado);
      if (indexDuplicado !== -1) {
        this.varianteActualIndex = indexDuplicado;
        this.validationErrors.sku = 'Este SKU ya existe en otra variante';
        this.seleccionarVariante(indexDuplicado);
      }
      return false;
    }
    
    // Validar cada variante individualmente
    for (let i = 0; i < this.variantes.length; i++) {
      if (!this.validateVariant(i)) {
        this.varianteActualIndex = i;
        this.seleccionarVariante(i);
        return false;
      }
    }
    
    return true;
  }

  // ===== FUNCIÓN PRINCIPAL PARA GUARDAR =====
  guardarVariantes() {
    if (!this.selectedProduct) return;
    
    // Actualizar atributos de la variante actual
    this.actualizarAtributosVariante();
    
    // Validar atributos de la variante actual antes de cambiar de variante
    if (!this.validarAtributosAntesDeGuardar()) {
      return; // Detener si hay atributos duplicados
    }
    
    if (!this.validateAllVariants()) return;
    
    // Validar atributos duplicados en TODAS las variantes
    for (let i = 0; i < this.variantes.length; i++) {
      this.seleccionarVariante(i);
      if (!this.validarAtributosAntesDeGuardar()) {
        this.varianteActualIndex = i;
        return;
      }
    }

    this.saving = true;
    
    let completadas = 0;
    let exitosas = 0;
    let errores: string[] = [];
    
    this.variantes.forEach(variante => {
      const variantData = {
        id_producto: this.selectedProduct!.id_producto,
        sku: variante.sku,
        precio: Number(variante.precio),
        imagenes: variante.imagenes,
        atributos: variante.atributos
      };
      
      console.log('Enviando variante:', variantData);
      
      this.productService.createProductVariant(variantData).subscribe({
        next: (res) => {
          completadas++;
          exitosas++;
          console.log(`✅ Variante guardada:`, res);
          
          if (completadas === this.variantes.length) {
            this.procesarResultado(exitosas, this.variantes.length, errores);
          }
        },
        error: (err) => {
          console.error('❌ Error al crear variante:', err);
          completadas++;
          errores.push(`SKU ${variante.sku}: ${err.error?.message || 'Error desconocido'}`);
          
          if (completadas === this.variantes.length) {
            this.procesarResultado(exitosas, this.variantes.length, errores);
          }
        }
      });
    });
  }

  private procesarResultado(exitosas: number, total: number, errores: string[]) {
    this.saving = false;
    
    if (errores.length > 0) {
      const erroresMsg = errores.join('. ');
      this.toastr.error(`Se guardaron ${exitosas} de ${total} variantes. Errores: ${erroresMsg}`, 'Error');
    } else {
      this.toastr.success(`${total} variante(s) creada(s) correctamente con sus atributos`, 'Éxito');
      
      setTimeout(() => {
        this.closeModal();
      }, 1500);
    }
  }

  // Método auxiliar para verificar si un objeto de atributos tiene propiedades
  hasAtributos(atributos: any): boolean {
    return atributos && Object.keys(atributos).length > 0;
  }
}
