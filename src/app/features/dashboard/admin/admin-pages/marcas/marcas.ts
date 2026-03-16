import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { Marca, Categorie } from '../../../../../core/models/product.model';
import { ProductService } from '../../../../../core/services/product.service';

@Component({
  selector: 'app-marcas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './marcas.html',
  styleUrls: ['./marcas.css']
})
export class Marcas implements OnInit {
  private productService = inject(ProductService);
  private toastr = inject(ToastrService);
  
  // ===== PESTAÑA ACTIVA =====
  activeTab: 'marcas' | 'categorias' = 'marcas';
  
  // ===== PROPIEDADES PARA MARCAS =====
  marcas: Marca[] = [];
  filteredMarcas: Marca[] = [];
  paginatedMarcas: Marca[] = [];
  searchMarcasValue: string = '';
  
  // Paginación para marcas
  marcasRowsPerPage: number = 10;
  marcasFirst: number = 0;
  marcasCurrentPage: number = 1;
  marcasTotalRecords: number = 0;
  
  // Modal creación marca
  showCreateMarcaModal: boolean = false;
  nuevaMarca = {
    nombre: '',
    imagen: ''
  };
  
  marcaValidationErrors = {
    nombre: '',
    imagen: ''
  };
  
  creatingMarca: boolean = false;
  
  // Modal edición marca
  showEditMarcaModal: boolean = false;
  marcaEditando: Marca | null = null;
  marcaOriginalData = {
    nombre: '',
    imagen: ''
  };
  
  marcaEditValidationErrors = {
    nombre: '',
    imagen: ''
  };
  
  editingMarca: boolean = false;
  
  // ===== PROPIEDADES PARA CATEGORÍAS =====
  categorias: Categorie[] = [];
  filteredCategorias: Categorie[] = [];
  paginatedCategorias: Categorie[] = [];
  searchCategoriasValue: string = '';
  
  // Filtro para categorías
  filterTipo: string = 'todas'; // 'todas', 'padre', 'hija'
  
  // Paginación para categorías
  categoriasRowsPerPage: number = 10;
  categoriasFirst: number = 0;
  categoriasCurrentPage: number = 1;
  categoriasTotalRecords: number = 0;
  
  // Modal creación categoría
  showCreateCategoriaModal: boolean = false;
  nuevaCategoria = {
    nombre: '',
    id_padre: null as number | null,
    tipo: 'padre' as 'padre' | 'hija'
  };
  
  categoriaValidationErrors = {
    nombre: '',
    id_padre: ''
  };
  
  creatingCategoria: boolean = false;
  
  // Modal edición categoría
  showEditCategoriaModal: boolean = false;
  categoriaEditando: Categorie | null = null;
  categoriaOriginalData = {
    nombre: '',
    id_padre: null as number | null
  };
  
  categoriaEditValidationErrors = {
    nombre: '',
    id_padre: ''
  };
  
  editingCategoria: boolean = false;
  
  // Categorías padre para el select
  categoriasPadre: Categorie[] = [];
  
  // Estado de carga general
  isLoading = signal<boolean>(false);

  ngOnInit(): void {
    this.loadMarcas();
    this.loadCategorias();
  }

  // ===== CAMBIAR PESTAÑA =====
  changeTab(tab: 'marcas' | 'categorias') {
    this.activeTab = tab;
  }

  // ===== MÉTODOS PARA MARCAS =====
  
  loadMarcas() {
    this.isLoading.set(true);
    this.productService.getMarcas().subscribe({
      next: (data: Marca[]) => {
        this.marcas = data;
        this.applyMarcasFilters();
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading marcas:', error);
        this.toastr.error('Error al cargar marcas', 'Error');
        this.isLoading.set(false);
      }
    });
  }

  applyMarcasFilters() {
    let filtered = [...this.marcas];

    if (this.searchMarcasValue) {
      const term = this.searchMarcasValue.toLowerCase();
      filtered = filtered.filter(marca => 
        marca.nombre.toLowerCase().includes(term) ||
        marca.id_marca?.toString().includes(term) ||
        (marca.imagen && marca.imagen.toLowerCase().includes(term))
      );
    }

    this.filteredMarcas = filtered;
    this.marcasTotalRecords = filtered.length;
    this.marcasFirst = 0;
    this.updatePaginatedMarcas();
  }

  onMarcasSearch(event: any) {
    this.searchMarcasValue = event.target.value;
    this.applyMarcasFilters();
  }

  clearMarcasSearch() {
    this.searchMarcasValue = '';
    this.applyMarcasFilters();
  }

  updatePaginatedMarcas() {
    const start = this.marcasFirst;
    const end = this.marcasFirst + this.marcasRowsPerPage;
    this.paginatedMarcas = this.filteredMarcas.slice(start, end);
    this.marcasCurrentPage = Math.floor(this.marcasFirst / this.marcasRowsPerPage) + 1;
  }

  onMarcasRowsPerPageChange() {
    this.marcasFirst = 0;
    this.updatePaginatedMarcas();
  }

  changeMarcasPage(action: 'first' | 'prev' | 'next' | 'last') {
    switch (action) {
      case 'first': this.marcasFirst = 0; break;
      case 'prev': if (this.marcasFirst > 0) this.marcasFirst -= this.marcasRowsPerPage; break;
      case 'next': if (this.marcasFirst + this.marcasRowsPerPage < this.marcasTotalRecords) this.marcasFirst += this.marcasRowsPerPage; break;
      case 'last': this.marcasFirst = Math.floor((this.marcasTotalRecords - 1) / this.marcasRowsPerPage) * this.marcasRowsPerPage; break;
    }
    this.updatePaginatedMarcas();
  }

  goToMarcasPage(page: number) {
    this.marcasFirst = (page - 1) * this.marcasRowsPerPage;
    this.updatePaginatedMarcas();
  }

  get marcasLast(): number {
    return Math.min(this.marcasFirst + this.marcasRowsPerPage, this.marcasTotalRecords);
  }

  get marcasPageNumbers(): number[] {
    const totalPages = Math.ceil(this.marcasTotalRecords / this.marcasRowsPerPage);
    const current = this.marcasCurrentPage;
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

  // ===== FUNCIONES PARA CREAR MARCA =====
  openCreateMarcaModal() {
    this.nuevaMarca = {
      nombre: '',
      imagen: ''
    };
    this.marcaValidationErrors = {
      nombre: '',
      imagen: ''
    };
    this.showCreateMarcaModal = true;
  }

  closeCreateMarcaModal() {
    this.showCreateMarcaModal = false;
  }

  validateMarcaFields(): boolean {
    let isValid = true;
    this.marcaValidationErrors = {
      nombre: '',
      imagen: ''
    };

    if (!this.nuevaMarca.nombre?.trim()) {
      this.marcaValidationErrors.nombre = 'El nombre de la marca es obligatorio';
      isValid = false;
    }

    if (this.nuevaMarca.imagen && !this.isValidUrl(this.nuevaMarca.imagen)) {
      this.marcaValidationErrors.imagen = 'Ingresa una URL válida para la imagen';
      isValid = false;
    }

    return isValid;
  }

  isValidUrl(url: string): boolean {
    if (!url) return true;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  guardarMarca() {
    if (!this.validateMarcaFields()) {
      this.toastr.warning('Corrige los errores en el formulario', 'Validación');
      return;
    }

    this.creatingMarca = true;

    const marcaData = {
      nombre: this.nuevaMarca.nombre.trim(),
      imagen: this.nuevaMarca.imagen?.trim() || ''
    };

    this.productService.createMarca(marcaData).subscribe({
      next: () => {
        this.creatingMarca = false;
        this.toastr.success('Marca creada exitosamente', 'Éxito');
        setTimeout(() => {
          this.closeCreateMarcaModal();
          this.loadMarcas();
        }, 1500);
      },
      error: (err) => {
        console.error('Error al crear marca:', err);
        this.creatingMarca = false;
        this.toastr.error(err.error?.message || 'Error al crear la marca', 'Error');
      }
    });
  }

  // ===== FUNCIONES PARA EDITAR MARCA =====
  openEditMarcaModal(marca: Marca) {
    this.marcaEditando = JSON.parse(JSON.stringify(marca));
    
    this.marcaOriginalData = {
      nombre: marca.nombre,
      imagen: marca.imagen || ''
    };
    
    this.marcaEditValidationErrors = {
      nombre: '',
      imagen: ''
    };
    
    this.showEditMarcaModal = true;
  }

  closeEditMarcaModal() {
    this.showEditMarcaModal = false;
    this.marcaEditando = null;
  }

  validateEditMarcaFields(): boolean {
    let isValid = true;
    this.marcaEditValidationErrors = {
      nombre: '',
      imagen: ''
    };

    if (!this.marcaEditando?.nombre?.trim()) {
      this.marcaEditValidationErrors.nombre = 'El nombre de la marca es obligatorio';
      isValid = false;
    }

    if (this.marcaEditando?.imagen && !this.isValidUrl(this.marcaEditando.imagen)) {
      this.marcaEditValidationErrors.imagen = 'Ingresa una URL válida para la imagen';
      isValid = false;
    }

    return isValid;
  }

  hasMarcaChanges(): boolean {
    if (!this.marcaEditando) return false;
    
    return this.marcaEditando.nombre !== this.marcaOriginalData.nombre ||
           (this.marcaEditando.imagen || '') !== this.marcaOriginalData.imagen;
  }

  actualizarMarca() {
    if (!this.validateEditMarcaFields()) {
      this.toastr.warning('Corrige los errores en el formulario', 'Validación');
      return;
    }
    
    if (!this.hasMarcaChanges()) {
      this.toastr.info('No se detectaron cambios en la marca', 'Información');
      return;
    }

    this.editingMarca = true;

    const marcaData = {
      id_marca: this.marcaEditando!.id_marca,
      nombre: this.marcaEditando!.nombre.trim(),
      imagen: this.marcaEditando!.imagen?.trim() || ''
    };

    this.productService.updateMarca(marcaData).subscribe({
      next: () => {
        this.editingMarca = false;
        this.toastr.success('Marca actualizada exitosamente', 'Éxito');
        setTimeout(() => {
          this.closeEditMarcaModal();
          this.loadMarcas();
        }, 1500);
      },
      error: (err) => {
        console.error('Error al actualizar marca:', err);
        this.editingMarca = false;
        this.toastr.error(err.error?.message || 'Error al actualizar la marca', 'Error');
      }
    });
  }

  getMarcaImageUrl(marca: Marca): string {
    return marca.imagen || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(marca.nombre) + '&background=0367A6&color=fff&size=64';
  }

  // ===== MÉTODOS PARA CATEGORÍAS =====
  
  loadCategorias() {
    this.isLoading.set(true);
    this.productService.getCategorias().subscribe({
      next: (data: Categorie[]) => {
        this.categorias = data;
        this.categoriasPadre = data.filter(c => c.id_padre === null);
        this.applyCategoriasFilters();
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading categorias:', error);
        this.toastr.error('Error al cargar categorías', 'Error');
        this.isLoading.set(false);
      }
    });
  }

  applyCategoriasFilters() {
    let filtered = [...this.categorias];

    if (this.searchCategoriasValue) {
      const term = this.searchCategoriasValue.toLowerCase();
      filtered = filtered.filter(cat => 
        cat.nombre.toLowerCase().includes(term) ||
        cat.id_categoria?.toString().includes(term)
      );
    }

    if (this.filterTipo !== 'todas') {
      filtered = filtered.filter(cat => 
        this.filterTipo === 'padre' ? cat.id_padre === null : cat.id_padre !== null
      );
    }

    this.filteredCategorias = filtered;
    this.categoriasTotalRecords = filtered.length;
    this.categoriasFirst = 0;
    this.updatePaginatedCategorias();
  }

  onFilterTipoChange(event: any) {
    this.filterTipo = event.target.value;
    this.applyCategoriasFilters();
  }

  onCategoriasSearch(event: any) {
    this.searchCategoriasValue = event.target.value;
    this.applyCategoriasFilters();
  }

  clearCategoriasSearch() {
    this.searchCategoriasValue = '';
    this.filterTipo = 'todas';
    this.applyCategoriasFilters();
  }

  updatePaginatedCategorias() {
    const start = this.categoriasFirst;
    const end = this.categoriasFirst + this.categoriasRowsPerPage;
    this.paginatedCategorias = this.filteredCategorias.slice(start, end);
    this.categoriasCurrentPage = Math.floor(this.categoriasFirst / this.categoriasRowsPerPage) + 1;
  }

  onCategoriasRowsPerPageChange() {
    this.categoriasFirst = 0;
    this.updatePaginatedCategorias();
  }

  changeCategoriasPage(action: 'first' | 'prev' | 'next' | 'last') {
    switch (action) {
      case 'first': this.categoriasFirst = 0; break;
      case 'prev': if (this.categoriasFirst > 0) this.categoriasFirst -= this.categoriasRowsPerPage; break;
      case 'next': if (this.categoriasFirst + this.categoriasRowsPerPage < this.categoriasTotalRecords) this.categoriasFirst += this.categoriasRowsPerPage; break;
      case 'last': this.categoriasFirst = Math.floor((this.categoriasTotalRecords - 1) / this.categoriasRowsPerPage) * this.categoriasRowsPerPage; break;
    }
    this.updatePaginatedCategorias();
  }

  goToCategoriasPage(page: number) {
    this.categoriasFirst = (page - 1) * this.categoriasRowsPerPage;
    this.updatePaginatedCategorias();
  }

  get categoriasLast(): number {
    return Math.min(this.categoriasFirst + this.categoriasRowsPerPage, this.categoriasTotalRecords);
  }

  get categoriasPageNumbers(): number[] {
    const totalPages = Math.ceil(this.categoriasTotalRecords / this.categoriasRowsPerPage);
    const current = this.categoriasCurrentPage;
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

  getNombreCategoriaPadre(id_padre: number | null): string {
    if (id_padre === null) return '-';
    const padre = this.categorias.find(c => c.id_categoria === id_padre);
    return padre ? padre.nombre : 'Desconocida';
  }

  // ===== FUNCIONES PARA CREAR CATEGORÍA =====
  openCreateCategoriaModal() {
    this.nuevaCategoria = {
      nombre: '',
      id_padre: null,
      tipo: 'padre'
    };
    this.categoriaValidationErrors = {
      nombre: '',
      id_padre: ''
    };
    this.showCreateCategoriaModal = true;
  }

  closeCreateCategoriaModal() {
    this.showCreateCategoriaModal = false;
  }

  onCategoriaTipoChange() {
    if (this.nuevaCategoria.tipo === 'padre') {
      this.nuevaCategoria.id_padre = null;
      this.categoriaValidationErrors.id_padre = '';
    }
  }

  validateCategoriaFields(): boolean {
    let isValid = true;
    this.categoriaValidationErrors = {
      nombre: '',
      id_padre: ''
    };

    if (!this.nuevaCategoria.nombre?.trim()) {
      this.categoriaValidationErrors.nombre = 'El nombre es obligatorio';
      isValid = false;
    }

    if (this.nuevaCategoria.tipo === 'hija' && !this.nuevaCategoria.id_padre) {
      this.categoriaValidationErrors.id_padre = 'Debes seleccionar una categoría padre';
      isValid = false;
    }

    return isValid;
  }

  guardarCategoria() {
    if (!this.validateCategoriaFields()) {
      this.toastr.warning('Corrige los errores en el formulario', 'Validación');
      return;
    }

    this.creatingCategoria = true;

    const categoriaData = {
      nombre: this.nuevaCategoria.nombre,
      id_padre: this.nuevaCategoria.tipo === 'padre' ? null : this.nuevaCategoria.id_padre!
    };

    this.productService.createCatetorie(categoriaData).subscribe({
      next: () => {
        this.creatingCategoria = false;
        this.toastr.success('Categoría creada exitosamente', 'Éxito');
        setTimeout(() => {
          this.closeCreateCategoriaModal();
          this.loadCategorias();
        }, 1500);
      },
      error: (err) => {
        console.error('Error al crear categoría:', err);
        this.creatingCategoria = false;
        this.toastr.error(err.error?.message || 'Error al crear la categoría', 'Error');
      }
    });
  }

  // ===== FUNCIONES PARA EDITAR CATEGORÍA =====
  openEditCategoriaModal(categoria: Categorie) {
    this.categoriaEditando = JSON.parse(JSON.stringify(categoria));
    
    this.categoriaOriginalData = {
      nombre: categoria.nombre,
      id_padre: categoria.id_padre
    };
    
    this.categoriaEditValidationErrors = {
      nombre: '',
      id_padre: ''
    };
    this.showEditCategoriaModal = true;
  }

  closeEditCategoriaModal() {
    this.showEditCategoriaModal = false;
    this.categoriaEditando = null;
  }

  validateEditCategoriaFields(): boolean {
    let isValid = true;
    this.categoriaEditValidationErrors = {
      nombre: '',
      id_padre: ''
    };

    if (!this.categoriaEditando?.nombre?.trim()) {
      this.categoriaEditValidationErrors.nombre = 'El nombre es obligatorio';
      isValid = false;
    }

    return isValid;
  }

  hasCategoriaChanges(): boolean {
    if (!this.categoriaEditando || !this.categoriaOriginalData) return false;
    
    return this.categoriaEditando.nombre !== this.categoriaOriginalData.nombre ||
           this.categoriaEditando.id_padre !== this.categoriaOriginalData.id_padre;
  }

  actualizarCategoria() {
    if (!this.validateEditCategoriaFields()) {
      this.toastr.warning('Corrige los errores en el formulario', 'Validación');
      return;
    }
    
    if (!this.hasCategoriaChanges()) {
      this.toastr.info('No se detectaron cambios en la categoría', 'Información');
      return;
    }

    this.editingCategoria = true;

    const categoriaData = {
      id_categoria: this.categoriaEditando!.id_categoria,
      nombre: this.categoriaEditando!.nombre.trim(),
      id_padre: this.categoriaEditando!.id_padre === null ? null : this.categoriaEditando!.id_padre
    };

    this.productService.updateCatetorie(categoriaData).subscribe({
      next: () => {
        this.editingCategoria = false;
        this.toastr.success('Categoría actualizada exitosamente', 'Éxito');
        setTimeout(() => {
          this.closeEditCategoriaModal();
          this.loadCategorias();
        }, 1500);
      },
      error: (err) => {
        this.editingCategoria = false;
        this.toastr.error(err.error?.message || 'Error al actualizar la categoría', 'Error');
      }
    });
  }

  // ===== MÉTODOS GENERALES =====
  refreshData() {
    if (this.activeTab === 'marcas') {
      this.loadMarcas();
    } else {
      this.loadCategorias();
    }
  }

  // Métodos para mantener compatibilidad con el HTML (opcional)
  editMarca(marca: Marca) {
    this.openEditMarcaModal(marca);
  }

  editCategoria(categoria: Categorie) {
    this.openEditCategoriaModal(categoria);
  }
  rowsPerPageOptions: number[] = [5, 10, 20, 50, 100];
}