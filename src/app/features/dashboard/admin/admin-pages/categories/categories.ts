import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { Categorie } from '../../../../../core/models/product.model';
import { ProductService } from '../../../../../core/services/product.service';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './categories.html',
  styleUrls: ['./categories.css']
})
export class Categories implements OnInit {
  private productService = inject(ProductService);
  private toastr = inject(ToastrService);
  
  categorias: Categorie[] = [];
  filteredCategorias: Categorie[] = [];
  paginatedCategorias: Categorie[] = [];
  searchValue: string = '';
  
  // Filtro adicional
  filterTipo: string = 'todas'; // 'todas', 'padre', 'hija'
  
  // Paginación
  rowsPerPage: number = 10;
  rowsPerPageOptions: number[] = [5, 10, 20, 50, 100];
  first: number = 0;
  currentPage: number = 1;
  totalRecords: number = 0;
  
  // Modal creación
  showCreateModal: boolean = false;
  nuevaCategoria = {
    nombre: '',
    id_padre: null as number | null,
    tipo: 'padre' as 'padre' | 'hija'
  };
  
  validationErrors = {
    nombre: '',
    id_padre: ''
  };
  
  creatingCategoria: boolean = false;
  
  // Modal edición
  showEditModal: boolean = false;
  categoriaEditando: Categorie | null = null;
  categoriaOriginal: Categorie | null = null;
  
  editValidationErrors = {
    nombre: '',
    id_padre: ''
  };
  
  editingCategoria: boolean = false;
  
  // Guardar copia original para detectar cambios
  categoriaOriginalData = {
    nombre: '',
    id_padre: null as number | null
  };
  
  // Solo categorías padre para el select
  categoriasPadre: Categorie[] = [];
  
  isLoading = signal<boolean>(false);

  ngOnInit(): void {
    this.loadCategorias();
  }

  loadCategorias() {
    this.isLoading.set(true);
    this.productService.getCategorias().subscribe({
      next: (data: Categorie[]) => {
        this.categorias = data;
        this.categoriasPadre = data.filter(c => c.id_padre === null);
        this.applyFilters();
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading categorias:', error);
        this.toastr.error('Error al cargar categorías', 'Error');
        this.isLoading.set(false);
      }
    });
  }

  // APLICAR FILTROS
  applyFilters() {
    let filtered = [...this.categorias];

    if (this.searchValue) {
      const term = this.searchValue.toLowerCase();
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
    this.totalRecords = filtered.length;
    this.first = 0;
    this.updatePaginatedCategorias();
  }

  onFilterTipoChange(event: any) {
    this.filterTipo = event.target.value;
    this.applyFilters();
  }

  onSearch(event: any) {
    this.searchValue = event.target.value;
    this.applyFilters();
  }

  clearSearch() {
    this.searchValue = '';
    this.filterTipo = 'todas';
    this.applyFilters();
    //this.toastr.success('Filtros limpiados', 'Éxito');
  }

  // Paginación
  updatePaginatedCategorias() {
    const start = this.first;
    const end = this.first + this.rowsPerPage;
    this.paginatedCategorias = this.filteredCategorias.slice(start, end);
    this.totalRecords = this.filteredCategorias.length;
    this.currentPage = Math.floor(this.first / this.rowsPerPage) + 1;
  }

  onRowsPerPageChange() {
    this.first = 0;
    this.updatePaginatedCategorias();
  }

  changePage(action: 'first' | 'prev' | 'next' | 'last') {
    switch (action) {
      case 'first': this.first = 0; break;
      case 'prev': if (this.first > 0) this.first -= this.rowsPerPage; break;
      case 'next': if (this.first + this.rowsPerPage < this.totalRecords) this.first += this.rowsPerPage; break;
      case 'last': this.first = Math.floor((this.totalRecords - 1) / this.rowsPerPage) * this.rowsPerPage; break;
    }
    this.updatePaginatedCategorias();
  }

  goToPage(page: number) {
    this.first = (page - 1) * this.rowsPerPage;
    this.updatePaginatedCategorias();
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

  getNombreCategoriaPadre(id_padre: number | null): string {
    if (id_padre === null) return '-';
    const padre = this.categorias.find(c => c.id_categoria === id_padre);
    return padre ? padre.nombre : 'Desconocida';
  }

  // ===== FUNCIONES PARA CREAR CATEGORÍA =====
  openCreateModal() {
    this.nuevaCategoria = {
      nombre: '',
      id_padre: null,
      tipo: 'padre'
    };
    this.validationErrors = {
      nombre: '',
      id_padre: ''
    };
    this.showCreateModal = true;
  }

  closeCreateModal() {
    this.showCreateModal = false;
  }

  onTipoChange() {
    if (this.nuevaCategoria.tipo === 'padre') {
      this.nuevaCategoria.id_padre = null;
      this.validationErrors.id_padre = '';
    }
  }

  validateFields(): boolean {
    let isValid = true;
    this.validationErrors = {
      nombre: '',
      id_padre: ''
    };

    if (!this.nuevaCategoria.nombre?.trim()) {
      this.validationErrors.nombre = 'El nombre es obligatorio';
      isValid = false;
    }

    if (this.nuevaCategoria.tipo === 'hija' && !this.nuevaCategoria.id_padre) {
      this.validationErrors.id_padre = 'Debes seleccionar una categoría padre';
      isValid = false;
    }

    return isValid;
  }

  guardarCategoria() {
    if (!this.validateFields()) {
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
          this.closeCreateModal();
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
  openEditModal(categoria: Categorie) {
    // Clonar la categoría para no modificar la original
    this.categoriaEditando = JSON.parse(JSON.stringify(categoria));
    this.categoriaOriginal = JSON.parse(JSON.stringify(categoria));
    
    // Guardar datos originales para comparar cambios
    this.categoriaOriginalData = {
      nombre: categoria.nombre,
      id_padre: categoria.id_padre
    };
    
    this.editValidationErrors = {
      nombre: '',
      id_padre: ''
    };
    this.showEditModal = true;
  }

  closeEditModal() {
    this.showEditModal = false;
    this.categoriaEditando = null;
    this.categoriaOriginal = null;
  }

  validateEditFields(): boolean {
    let isValid = true;
    this.editValidationErrors = {
      nombre: '',
      id_padre: ''
    };

    if (!this.categoriaEditando?.nombre?.trim()) {
      this.editValidationErrors.nombre = 'El nombre es obligatorio';
      isValid = false;
    }

    return isValid;
  }

  hasChanges(): boolean {
    if (!this.categoriaEditando || !this.categoriaOriginalData) return false;
    
    return this.categoriaEditando.nombre !== this.categoriaOriginalData.nombre ||
           this.categoriaEditando.id_padre !== this.categoriaOriginalData.id_padre;
  }

  actualizarCategoria() {
    // Validar campos
    if (!this.validateEditFields()) {
      this.toastr.warning('Corrige los errores en el formulario', 'Validación');
      return;
    }
    
    // Verificar si hay cambios
    if (!this.hasChanges()) {
      this.toastr.info('No se detectaron cambios en la categoría', 'Información');
      return;
    }

    this.editingCategoria = true;

    // Preparar datos para enviar
    const idPadre = this.categoriaEditando!.id_padre === null ? null : this.categoriaEditando!.id_padre;

    const categoriaData = {
      id_categoria: this.categoriaEditando!.id_categoria,
      nombre: this.categoriaEditando!.nombre.trim(),
      id_padre: idPadre
    };

    this.productService.updateCatetorie(categoriaData).subscribe({
      next: () => {
        this.editingCategoria = false;
        this.toastr.success('Categoría actualizada exitosamente', 'Éxito');
        setTimeout(() => {
          this.closeEditModal();
          this.loadCategorias();
        }, 1500);
      },
      error: (err) => {
        //console.error('Error al actualizar categoría:', err);
        this.editingCategoria = false;
        this.toastr.error(err.error?.message || 'Error al actualizar la categoría', 'Error');
      }
    });
  }

  // Acciones existentes
  refreshData() {
    this.loadCategorias();
    //this.toastr.success('Datos actualizados', 'Éxito');
  }

  viewDetails(categoria: Categorie) {
    //console.log('Ver detalles:', categoria);
  }

  editCategoria(categoria: Categorie) {
    this.openEditModal(categoria);
  }

}