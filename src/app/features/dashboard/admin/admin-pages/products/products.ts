import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ProductService } from '../../../../../core/services/product.service';
import { Product, CreateProductDto, Categorie, Marca, Attibute, RecientProduct } from '../../../../../core/models/product.model';

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
  filterStock: string = 'todos';
  
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
  
  // Estados para guardado
  savingProduct: boolean = false;
  
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

    if (this.filterStock !== 'todos') {
      filtered = filtered.filter(product => 
        this.filterStock === 'con-stock' ? product.stock > 0 : product.stock === 0
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

  onFilterStockChange(event: any) {
    this.filterStock = event.target.value;
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
    this.filterStock = 'todos';
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

  // ===== FUNCIÓN PARA EDITAR SOLO DATOS GENERALES =====
  editProduct(product: Product) {
    this.selectedProduct = JSON.parse(JSON.stringify(product));
    
    // Inicializar datos de edición
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
    
    this.showEditModal = true;
  }

  closeEditModal() {
    this.showEditModal = false;
    this.selectedProduct = null;
  }

  // ===== VERIFICAR SI HAY CAMBIOS =====
  hasChanges(): boolean {
    return this.editProductData.nombre !== this.originalProductData.nombre ||
           this.editProductData.descripcion !== this.originalProductData.descripcion ||
           this.editProductData.id_marca !== this.originalProductData.id_marca ||
           this.editProductData.id_categoria !== this.originalProductData.id_categoria;
  }

  // ===== VALIDAR DATOS DEL PRODUCTO =====
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

  // ===== GUARDAR SOLO DATOS GENERALES =====
  saveProductData() {
    if (!this.validateProductData()) return;
    
    // Verificar si hay cambios
    if (!this.hasChanges()) {
      this.toastr.info('No se detectaron cambios', 'Información');
      return;
    }

    this.savingProduct = true;
    
    this.productService.updateProductFull(this.editProductData).subscribe({
      next: () => {
        this.savingProduct = false;
        this.toastr.success('Producto actualizado exitosamente', 'Éxito');
        
        setTimeout(() => {
          this.closeEditModal();
          this.loadProducts();
        }, 1500);
      },
      error: (err) => {
        this.savingProduct = false;
        this.toastr.error(err.error?.message || 'Error al guardar los datos del producto', 'Error');
        console.error('Error al guardar producto:', err);
      }
    });
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

  getStockValue(stock: number | string): number {
    return typeof stock === 'string' ? parseInt(stock) : stock;
  }

  getObjectKeys(obj: any): string[] {
    return obj ? Object.keys(obj) : [];
  }

  getVariantAttributes(variant: any): { key: string, value: any }[] {
    if (!variant.atributos) return [];
    
    return Object.keys(variant.atributos).map(key => ({
      key: key,
      value: variant.atributos[key]
    }));
  }
}