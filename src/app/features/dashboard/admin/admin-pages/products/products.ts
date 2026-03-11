import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ProductService } from '../../../../../core/services/product.service';
import { Product, CreateProductDto, Categorie, Marca, Attibute, RecientProduct } from '../../../../../core/models/product.model';

// Interfaz para variantes existentes - SIN STOCK
interface ExistingVariant {
  id_variante: number;
  id_producto: number;
  sku: string;
  precio: number;
  imagenes: string[];
  selected?: boolean;
  expanded?: boolean;
  atributos?: Record<string, any>;
}

// Interfaz para atributos en edición
interface VariantAttribute {
  id_atributo_padre: number;
  id_atributo_hijo: number;
  nombre_padre: string;
  nombre_hijo: string;
  isNew?: boolean;
  isDeleted?: boolean;
}

// Interfaz para editar variante (CON ATRIBUTOS, SIN STOCK)
interface EditVariantData {
  id_producto: number;
  id_variante: number;
  sku: string;
  precio: number;
  imagenes: string[];
  atributos: Record<string, any>;
}

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './products.html',
  styleUrls: ['./products.css']
})
export class Products implements OnInit {
  private productService = inject(ProductService);
  private toastr = inject(ToastrService);
  
  products: Product[] = [];
  filteredProducts: Product[] = [];
  paginatedProducts: Product[] = [];
  searchValue: string = '';
  
  filterEstado: string = 'todos';
  
  rowsPerPage: number = 10;
  rowsPerPageOptions: number[] = [5, 10, 20, 50, 100];
  first: number = 0;
  currentPage: number = 1;
  totalRecords: number = 0;
  
  showCreateModal: boolean = false;
  nuevoProducto: CreateProductDto = {
    nombre: '',
    descripcion: '',
    id_marca: 0,
    id_categoria: 0
  };
  
  validationErrors = {
    nombre: '',
    descripcion: '',
    id_marca: '',
    id_categoria: ''
  };
  
  creatingProduct: boolean = false;
  
  categorias: Categorie[] = [];
  categoriasPadre: Categorie[] = [];
  subcategorias: Categorie[] = [];
  marcas: Marca[] = [];
  
  showEditModal: boolean = false;
  selectedProduct: Product | null = null;
  attributes: Attibute[] = [];
  parentAttributes: Attibute[] = [];
  childAttributesByParent: Map<number, Attibute[]> = new Map();
  
  // Datos para edición de producto (SOLO DATOS GENERALES)
  editProductData = {
    id_producto: 0,
    id_marca: 0,
    id_categoria: 0,
    nombre: '',
    descripcion: ''
  };
  
  // Guardar copia original para detectar cambios
  originalProductData = {
    id_marca: 0,
    id_categoria: 0,
    nombre: '',
    descripcion: ''
  };
  
  // Estados para guardado de producto
  savingProduct: boolean = false;
  
  // ===== PROPIEDADES PARA VARIANTES =====
  productVariants: ExistingVariant[] = [];
  selectedVariant: ExistingVariant | null = null;
  editVariantData: EditVariantData = {
    id_producto: 0,
    id_variante: 0,
    sku: '',
    precio: 0,
    imagenes: [],
    atributos: {}
  };
  
  // Atributos temporales para la UI
  variantAttributes: VariantAttribute[] = [];
  originalVariantAttributes: VariantAttribute[] = [];
  attributeErrors: boolean[] = [];
  
  originalVariantData: EditVariantData | null = null;
  variantImageInput: string = '';
  loadingVariants: boolean = false;
  savingVariant: boolean = false;
  
  variantValidationErrors = {
    sku: '',
    precio: ''
  };
  
  // Contador de productos nuevos
  newProductsCount: number = 0;
  
  isLoading = this.productService.isLoading;

  ngOnInit() {
    this.loadProducts();
    this.loadCategories();
    this.loadMarcas();
    this.loadAttributes();
    this.loadNewProductsCount();
  }

  loadProducts() {
    this.productService.getProducts().subscribe({
      next: (products) => {
        this.products = products;
        this.applyFilters();
      },
      error: (error) => {
        console.error('Error loading products:', error);
        this.toastr.error('Error al cargar productos', 'Error');
      }
    });
  }

  loadNewProductsCount() {
    this.productService.getReceientProducts().subscribe({
      next: (data: RecientProduct[]) => {
        this.newProductsCount = data.length;
      },
      error: (error) => {
        console.error('Error al cargar productos nuevos:', error);
      }
    });
  }

  applyFilters() {
    let filtered = [...this.products];

    if (this.searchValue) {
      const term = this.searchValue.toLowerCase();
      filtered = filtered.filter(product => 
        product.nombre.toLowerCase().includes(term) ||
        product.marca?.toLowerCase().includes(term) ||
        product.categoria.toLowerCase().includes(term) ||
        product.id?.toString().includes(term)
      );
    }

    if (this.filterEstado !== 'todos') {
      filtered = filtered.filter(product => 
        this.filterEstado === 'activo' ? product.activo : !product.activo
      );
    }

    this.filteredProducts = filtered;
    this.totalRecords = filtered.length;
    this.first = 0;
    this.updatePaginatedProducts();
  }

  onFilterEstadoChange(event: any) {
    this.filterEstado = event.target.value;
    this.applyFilters();
  }

  loadCategories() {
    this.productService.getCategorias().subscribe({
      next: (data: Categorie[]) => {
        this.categorias = data;
        this.categoriasPadre = data.filter(c => c.id_padre === null);
      },
      error: (error) => {
        console.error('Error loading categories:', error);
        this.toastr.error('Error al cargar categorías', 'Error');
      }
    });
  }

  onCategoriaPadreChange(event: any) {
    const padreId = parseInt(event.target.value);
    if (padreId) {
      this.subcategorias = this.categorias.filter(c => c.id_padre === padreId);
      this.nuevoProducto.id_categoria = 0;
      this.validationErrors.id_categoria = '';
    } else {
      this.subcategorias = [];
    }
  }

  loadMarcas() {
    this.productService.getMarcas().subscribe({
      next: (data: Marca[]) => {
        this.marcas = data;
      },
      error: (error) => {
        console.error('Error loading marcas:', error);
        this.toastr.error('Error al cargar marcas', 'Error');
      }
    });
  }

  loadAttributes() {
    this.productService.getAttributes().subscribe({
      next: (data: Attibute[]) => {
        this.attributes = data;
        
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
      },
      error: (error) => {
        console.error('Error loading attributes:', error);
        this.toastr.error('Error al cargar atributos', 'Error');
      }
    });
  }

  updatePaginatedProducts() {
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
    this.filterEstado = 'todos';
    this.applyFilters();
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
    const pages: number[] = [];
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }

  getProductImage(product: Product): string {
    return product.imagen || 'assets/images/no-imagen.webp';
  }

  getMarcaImageUrl(product: Product): string {
    return product.imagen_marca || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(product.nombre) + '&background=0367A6&color=fff&size=64';
  }

  refreshData() {
    this.loadProducts();
    this.loadNewProductsCount();
    this.toastr.success('Datos actualizados correctamente', 'Éxito');
  }

  deleteProduct(product: Product) {
    console.log('Eliminar:', product);
  }

  openCreateModal() {
    this.nuevoProducto = { nombre: '', descripcion: '', id_marca: 0, id_categoria: 0 };
    this.validationErrors = { nombre: '', descripcion: '', id_marca: '', id_categoria: '' };
    this.subcategorias = [];
    this.showCreateModal = true;
  }

  onFormChange() {
    if (this.nuevoProducto.nombre) this.validationErrors.nombre = '';
    if (this.nuevoProducto.descripcion) this.validationErrors.descripcion = '';
  }

  closeCreateModal() {
    this.showCreateModal = false;
  }

  validateFields(): boolean {
    let isValid = true;
    this.validationErrors = { nombre: '', descripcion: '', id_marca: '', id_categoria: '' };

    if (!this.nuevoProducto.nombre?.trim()) {
      this.validationErrors.nombre = 'El nombre es obligatorio';
      isValid = false;
    }
    if (!this.nuevoProducto.descripcion?.trim()) {
      this.validationErrors.descripcion = 'La descripción es obligatoria';
      isValid = false;
    }
    if (!this.nuevoProducto.id_marca) {
      this.validationErrors.id_marca = 'Selecciona una marca';
      isValid = false;
    }
    if (!this.nuevoProducto.id_categoria) {
      this.validationErrors.id_categoria = 'Selecciona una categoría';
      isValid = false;
    }
    return isValid;
  }

  guardarProductoBase() {
    if (!this.validateFields()) return;

    this.creatingProduct = true;
    this.productService.createBaseProduct(this.nuevoProducto).subscribe({
      next: () => {
        this.creatingProduct = false;
        this.closeCreateModal();
        this.loadProducts();
        this.loadNewProductsCount();
        this.toastr.success('Producto creado exitosamente', 'Éxito');
      },
      error: (err) => {
        this.creatingProduct = false;
        this.toastr.error(err.error?.message || 'Error al crear producto', 'Error');
        console.error('Error al crear producto:', err);
      }
    });
  }

  // ===== FUNCIÓN PARA EDITAR PRODUCTO COMPLETO (BASE + VARIANTES) =====
  editProduct(product: Product) {
    this.selectedProduct = JSON.parse(JSON.stringify(product));
    
    // Inicializar datos de edición del producto base
    this.editProductData = {
      id_producto: product.id_producto || product.id || 0,
      id_marca: this.marcas.find(m => m.nombre === product.marca)?.id_marca || 0,
      id_categoria: this.categorias.find(c => c.nombre === product.categoria)?.id_categoria || 0,
      nombre: product.nombre,
      descripcion: product.descripcion
    };
    
    // Guardar copia original para comparar cambios
    this.originalProductData = {
      id_marca: this.editProductData.id_marca,
      id_categoria: this.editProductData.id_categoria,
      nombre: this.editProductData.nombre,
      descripcion: this.editProductData.descripcion
    };
    
    // Cargar variantes del producto
    this.loadProductVariants(product.id_producto || product.id || 0);
    
    this.showEditModal = true;
  }

  loadProductVariants(productId: number) {
    this.loadingVariants = true;
    this.productService.getProductVariants(productId).subscribe({
      next: (variants: any[]) => {
        console.log('📦 Variantes cargadas:', variants);
        
        this.productVariants = variants.map(v => ({
          id_variante: v.id_variante,
          id_producto: v.id_producto,
          sku: v.sku,
          precio: Number(v.precio),
          imagenes: v.imagenes || [],
          atributos: v.atributos || {},
          expanded: false
        }));
        
        console.log('✅ Variantes mapeadas:', this.productVariants);
        this.loadingVariants = false;
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
    this.variantAttributes = [];
    this.attributeErrors = [];
    
    // Recargar productos para actualizar la tabla
    this.loadProducts();
  }

  // ===== FUNCIONES PARA PRODUCTO BASE =====
  hasProductChanges(): boolean {
    return this.editProductData.nombre !== this.originalProductData.nombre ||
           this.editProductData.descripcion !== this.originalProductData.descripcion ||
           this.editProductData.id_marca !== this.originalProductData.id_marca ||
           this.editProductData.id_categoria !== this.originalProductData.id_categoria;
  }

  validateProductData(): boolean {
    if (!this.editProductData.nombre.trim()) {
      this.toastr.warning('El nombre es obligatorio', 'Validación');
      return false;
    }
    if (!this.editProductData.descripcion.trim()) {
      this.toastr.warning('La descripción es obligatoria', 'Validación');
      return false;
    }
    if (!this.editProductData.id_marca) {
      this.toastr.warning('Selecciona una marca', 'Validación');
      return false;
    }
    if (!this.editProductData.id_categoria) {
      this.toastr.warning('Selecciona una categoría', 'Validación');
      return false;
    }
    return true;
  }

  saveProductData() {
    if (!this.validateProductData()) return;
    
    if (!this.hasProductChanges()) {
      this.toastr.info('No se detectaron cambios en el producto base', 'Información');
      return;
    }

    this.savingProduct = true;
    
    this.productService.updateProductFull(this.editProductData).subscribe({
      next: () => {
        this.savingProduct = false;
        this.toastr.success('Producto base actualizado exitosamente', 'Éxito');
        
        // Actualizar datos originales
        this.originalProductData = {
          id_marca: this.editProductData.id_marca,
          id_categoria: this.editProductData.id_categoria,
          nombre: this.editProductData.nombre,
          descripcion: this.editProductData.descripcion
        };
      },
      error: (err) => {
        this.savingProduct = false;
        this.toastr.error(err.error?.message || 'Error al guardar los datos del producto', 'Error');
        console.error('Error al guardar producto:', err);
      }
    });
  }

  // ===== FUNCIONES PARA VARIANTES =====
  toggleVariantExpand(variant: ExistingVariant) {
    variant.expanded = !variant.expanded;
    if (variant.expanded) {
      this.selectVariant(variant);
    } else {
      this.selectedVariant = null;
    }
  }

  selectVariant(variant: ExistingVariant) {
    console.log('🎯 Variante seleccionada:', variant);
    console.log('🎯 Atributos de la variante:', variant.atributos);
    
    this.selectedVariant = variant;
    this.editVariantData = {
      id_producto: variant.id_producto,
      id_variante: variant.id_variante,
      sku: variant.sku,
      precio: variant.precio,
      imagenes: [...variant.imagenes],
      atributos: { ...(variant.atributos || {}) }
    };
    
    // Convertir atributos a formato de UI
    this.variantAttributes = [];
    
    if (variant.atributos && Object.keys(variant.atributos).length > 0) {
      console.log('📋 Procesando atributos:', variant.atributos);
      
      Object.entries(variant.atributos).forEach(([key, value]) => {
        const valorStr = String(value);
        
        const padre = this.parentAttributes.find(p => p.nombre === key);
        if (padre) {
          const hijos = this.getChildAttributes(padre.id_atributo);
          const hijo = hijos.find(h => h.nombre === valorStr);
          
          if (hijo) {
            this.variantAttributes.push({
              id_atributo_padre: padre.id_atributo,
              id_atributo_hijo: hijo.id_atributo,
              nombre_padre: padre.nombre,
              nombre_hijo: hijo.nombre
            });
          } else {
            // Si no encuentra el hijo, usar el valor como texto
            console.warn(`Hijo no encontrado: ${key}=${valorStr}`);
            this.variantAttributes.push({
              id_atributo_padre: padre.id_atributo,
              id_atributo_hijo: 0,
              nombre_padre: padre.nombre,
              nombre_hijo: valorStr
            });
          }
        } else {
          // Si no encuentra el padre, crear un atributo temporal
          console.warn(`Atributo padre no encontrado: ${key}`);
          this.variantAttributes.push({
            id_atributo_padre: 0,
            id_atributo_hijo: 0,
            nombre_padre: key,
            nombre_hijo: valorStr
          });
        }
      });
    }
    
    console.log('✅ Atributos para UI:', this.variantAttributes);
    
    // Guardar copia original de atributos
    this.originalVariantAttributes = JSON.parse(JSON.stringify(this.variantAttributes));
    
    this.originalVariantData = { 
      id_producto: this.editVariantData.id_producto,
      id_variante: this.editVariantData.id_variante,
      sku: this.editVariantData.sku,
      precio: this.editVariantData.precio,
      imagenes: [...this.editVariantData.imagenes],
      atributos: { ...this.editVariantData.atributos }
    };
    
    this.variantImageInput = '';
    this.variantValidationErrors = { sku: '', precio: '' };
    this.attributeErrors = new Array(this.variantAttributes.length).fill(false);
  }

  addVariantImage() {
    if (this.variantImageInput && this.variantImageInput.trim()) {
      this.editVariantData.imagenes.push(this.variantImageInput.trim());
      this.variantImageInput = '';
    }
  }

  removeVariantImage(index: number) {
    this.editVariantData.imagenes.splice(index, 1);
  }

  // ===== FUNCIONES PARA ATRIBUTOS DE VARIANTES =====
  agregarCampoAtributo() {
    this.variantAttributes.push({
      id_atributo_padre: 0,
      id_atributo_hijo: 0,
      nombre_padre: '',
      nombre_hijo: '',
      isNew: true
    });
    this.attributeErrors.push(false);
  }

  eliminarCampoAtributo(index: number) {
    const attribute = this.variantAttributes[index];
    
    // Si es un atributo existente (no es nuevo), marcarlo para eliminación
    if (!attribute.isNew) {
      attribute.isDeleted = true;
    } else {
      // Si es nuevo, simplemente eliminarlo
      this.variantAttributes.splice(index, 1);
      this.attributeErrors.splice(index, 1);
    }
    
    this.actualizarAtributosVariante();
  }

  restaurarCampoAtributo(index: number) {
    const attribute = this.variantAttributes[index];
    if (attribute.isDeleted) {
      attribute.isDeleted = false;
      this.actualizarAtributosVariante();
    }
  }

  onPadreChange(attrIndex: number) {
    const atributoPadreId = this.variantAttributes[attrIndex].id_atributo_padre;
    
    // Resetear hijo
    this.variantAttributes[attrIndex].id_atributo_hijo = 0;
    this.variantAttributes[attrIndex].nombre_hijo = '';
    
    // Actualizar nombre del padre
    if (atributoPadreId > 0) {
      const padre = this.parentAttributes.find(p => p.id_atributo === atributoPadreId);
      if (padre) {
        this.variantAttributes[attrIndex].nombre_padre = padre.nombre;
      }
      
      // Verificar duplicados
      if (this.isAtributoDuplicado(atributoPadreId, attrIndex)) {
        this.attributeErrors[attrIndex] = true;
        this.toastr.warning(
          `El atributo "${padre?.nombre}" ya está asignado. No puedes repetirlo.`,
          'Atributo duplicado'
        );
      } else {
        this.attributeErrors[attrIndex] = false;
      }
    }
    
    this.actualizarAtributosVariante();
  }

  onHijoChange(attrIndex: number) {
    if (this.variantAttributes[attrIndex].id_atributo_hijo > 0) {
      const hijo = this.attributes.find(
        a => a.id_atributo === this.variantAttributes[attrIndex].id_atributo_hijo
      );
      if (hijo) {
        this.variantAttributes[attrIndex].nombre_hijo = hijo.nombre;
      }
    }
    this.actualizarAtributosVariante();
  }

  isAtributoDuplicado(atributoPadreId: number, indexActual: number): boolean {
    if (!atributoPadreId || atributoPadreId === 0) return false;
    
    const count = this.variantAttributes.filter(
      (attr, idx) => 
        !attr.isDeleted && 
        idx !== indexActual && 
        attr.id_atributo_padre === atributoPadreId
    ).length;
    
    return count > 0;
  }

  isAtributoPadreUsado(atributoPadreId: number, indexActual: number): boolean {
    if (!atributoPadreId || atributoPadreId === 0) return false;
    
    return this.variantAttributes.some(
      (attr, idx) => 
        !attr.isDeleted && 
        idx !== indexActual && 
        attr.id_atributo_padre === atributoPadreId
    );
  }

  getChildAttributes(id_padre: number): Attibute[] {
    return this.childAttributesByParent.get(id_padre) || [];
  }

  actualizarAtributosVariante() {
    // Construir objeto de atributos para enviar al backend
    const atributosObj: Record<string, any> = {};
    
    this.variantAttributes.forEach(attr => {
      // Solo incluir atributos no eliminados y completos
      if (!attr.isDeleted && attr.id_atributo_padre > 0 && attr.id_atributo_hijo > 0) {
        atributosObj[attr.nombre_padre] = attr.nombre_hijo;
      }
    });
    
    this.editVariantData.atributos = atributosObj;
  }

  validarAtributosAntesDeGuardar(): boolean {
    this.attributeErrors = new Array(this.variantAttributes.length).fill(false);
    
    const atributosPadreVistos = new Set<number>();
    let hayDuplicados = false;
    
    for (let i = 0; i < this.variantAttributes.length; i++) {
      const attr = this.variantAttributes[i];
      
      // Saltar atributos marcados para eliminar
      if (attr.isDeleted) continue;
      
      if (attr.id_atributo_padre > 0) {
        if (atributosPadreVistos.has(attr.id_atributo_padre)) {
          this.attributeErrors[i] = true;
          hayDuplicados = true;
          
          const padre = this.parentAttributes.find(p => p.id_atributo === attr.id_atributo_padre);
          this.toastr.error(
            `Atributo duplicado: "${padre?.nombre}" no puede repetirse`,
            'Error de validación'
          );
        } else {
          atributosPadreVistos.add(attr.id_atributo_padre);
        }
      }
    }
    
    return !hayDuplicados;
  }

  // ===== VALIDACIONES DE VARIANTE =====
  validateVariantFields(): boolean {
    let isValid = true;
    this.variantValidationErrors = { sku: '', precio: '' };

    if (!this.editVariantData.sku.trim()) {
      this.variantValidationErrors.sku = 'El SKU es obligatorio';
      isValid = false;
    }

    if (this.editVariantData.precio <= 0) {
      this.variantValidationErrors.precio = 'El precio debe ser mayor a 0';
      isValid = false;
    }

    return isValid;
  }

  hasVariantChanges(): boolean {
    if (!this.selectedVariant || !this.originalVariantData) return false;
    
    // Verificar cambios en campos básicos
    const hasBasicChanges = this.editVariantData.sku !== this.originalVariantData.sku ||
           this.editVariantData.precio !== this.originalVariantData.precio ||
           JSON.stringify(this.editVariantData.imagenes) !== JSON.stringify(this.originalVariantData.imagenes);
    
    // Verificar cambios en atributos
    const hasAttributeChanges = JSON.stringify(this.editVariantData.atributos) !== 
                                JSON.stringify(this.originalVariantData.atributos);
    
    return hasBasicChanges || hasAttributeChanges;
  }

  saveVariant() {
    if (!this.selectedVariant) return;
    
    if (!this.validateVariantFields()) {
      this.toastr.warning('Corrige los errores en el formulario', 'Validación');
      return;
    }
    
    if (!this.validarAtributosAntesDeGuardar()) {
      return;
    }
    
    if (!this.hasVariantChanges()) {
      this.toastr.info('No se detectaron cambios en la variante', 'Información');
      return;
    }

    this.savingVariant = true;

    const updateData = {
      id_producto: this.editVariantData.id_producto,
      id_variante: this.editVariantData.id_variante,
      sku: this.editVariantData.sku,
      precio: this.editVariantData.precio,
      imagenes: this.editVariantData.imagenes,
      atributos: this.editVariantData.atributos
    };

    console.log('Enviando datos de variante:', updateData);

    this.productService.updateProductVariant(updateData).subscribe({
      next: () => {
        this.savingVariant = false;
        this.toastr.success('Variante actualizada correctamente', 'Éxito');
        
        // Actualizar datos locales
        if (this.selectedVariant) {
          this.selectedVariant.sku = this.editVariantData.sku;
          this.selectedVariant.precio = this.editVariantData.precio;
          this.selectedVariant.imagenes = [...this.editVariantData.imagenes];
          this.selectedVariant.atributos = { ...this.editVariantData.atributos };
          
          // Actualizar datos originales
          this.originalVariantData = { 
            id_producto: this.editVariantData.id_producto,
            id_variante: this.editVariantData.id_variante,
            sku: this.editVariantData.sku,
            precio: this.editVariantData.precio,
            imagenes: [...this.editVariantData.imagenes],
            atributos: { ...this.editVariantData.atributos }
          };
          
          // Actualizar atributos originales
          this.originalVariantAttributes = JSON.parse(JSON.stringify(this.variantAttributes));
          
          // Marcar todos los atributos como no nuevos
          this.variantAttributes.forEach(attr => {
            delete attr.isNew;
          });
        }
      },
      error: (err) => {
        console.error('Error al guardar variante:', err);
        this.savingVariant = false;
        this.toastr.error(err.error?.message || 'Error al guardar la variante', 'Error');
      }
    });
  }

  // ===== FUNCIONES PARA WARNINGS =====
  hasVariantWarnings(variant: ExistingVariant): boolean {
    if (variant.precio < 10) return true;
    if (!variant.imagenes || variant.imagenes.length === 0) return true;
    return false;
  }

  getWarningIcon(variant: ExistingVariant): string {
    if (variant.precio < 10) return 'pi pi-exclamation-triangle text-yellow-500';
    if (!variant.imagenes || variant.imagenes.length === 0) return 'pi pi-image text-yellow-500';
    return '';
  }

  getWarningTooltip(variant: ExistingVariant): string {
    const warnings: string[] = [];
    
    if (variant.precio < 10) warnings.push('Precio muy bajo');
    if (!variant.imagenes || variant.imagenes.length === 0) warnings.push('Sin imágenes');
    
    return warnings.join(' • ');
  }

  // ===== PROPIEDADES PARA MODAL DE VISUALIZACIÓN =====
  showViewModal: boolean = false;
  viewProductData: Product | null = null;
  viewProductVariants: any[] = [];
  loadingViewVariants: boolean = false;

  viewProduct(product: Product) {
    this.viewProductData = product;
    this.loadingViewVariants = true;
    this.showViewModal = true;
    
    const productId = product.id_producto || product.id;
    
    if (productId) {
      this.productService.getProductVariants(productId).subscribe({
        next: (variants: any[]) => {
          this.viewProductVariants = variants;
          this.loadingViewVariants = false;
        },
        error: (err) => {
          console.error('Error al cargar variantes:', err);
          this.toastr.error('Error al cargar variantes', 'Error');
          this.viewProductVariants = [];
          this.loadingViewVariants = false;
        }
      });
    } else {
      this.viewProductVariants = [];
      this.loadingViewVariants = false;
    }
  }

  closeViewModal() {
    this.showViewModal = false;
    this.viewProductData = null;
    this.viewProductVariants = [];
  }

  // ===== MÉTODOS AUXILIARES =====
  formatPrecio(precio: number | string): string {
    const precioNum = typeof precio === 'string' ? parseFloat(precio) : precio;
    return precioNum.toFixed(2);
  }

  getObjectKeys(obj: any): string[] {
    return obj ? Object.keys(obj) : [];
  }

  getVariantAttributes(variant: any): { key: string, value: any }[] {
    if (!variant || !variant.atributos) return [];
    
    return Object.keys(variant.atributos).map(key => ({
      key: key,
      value: variant.atributos[key]
    }));
  }
}