import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Marca } from '../../../../../core/models/product.model';
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
  
  marcas: Marca[] = [];
  filteredMarcas: Marca[] = [];
  paginatedMarcas: Marca[] = [];
  searchValue: string = '';
  
  // Paginación
  rowsPerPage: number = 10;
  rowsPerPageOptions: number[] = [5, 10, 20, 50, 100];
  first: number = 0;
  currentPage: number = 1;
  totalRecords: number = 0;
  
  // Modal creación
  showCreateModal: boolean = false;
  nuevaMarca = {
    nombre: '',
    sitio_web: ''
  };
  
  validationErrors = {
    nombre: '',
    sitio_web: ''
  };
  
  creatingMarca: boolean = false;
  createSuccess: boolean = false;
  createError: string = '';
  
  // Modal edición
  showEditModal: boolean = false;
  marcaEditando: Marca | null = null;
  marcaOriginal: Marca | null = null;
  
  editValidationErrors = {
    nombre: '',
    sitio_web: ''
  };
  
  editingMarca: boolean = false;
  editSuccess: boolean = false;
  editError: string = '';
  noChangesMessage: string = '';
  
  isLoading = signal<boolean>(false);

  ngOnInit(): void {
    this.loadMarcas();
  }

  loadMarcas() {
    this.isLoading.set(true);
    this.productService.getMarcas().subscribe({
      next: (data: Marca[]) => {
        this.marcas = data;
        this.applyFilters();
        this.isLoading.set(false);
      },
      error: (error) => {
        //console.error('Error loading marcas:', error);
        this.isLoading.set(false);
      }
    });
  }

  // APLICAR FILTROS
  applyFilters() {
    let filtered = [...this.marcas];

    if (this.searchValue) {
      const term = this.searchValue.toLowerCase();
      filtered = filtered.filter(marca => 
        marca.nombre.toLowerCase().includes(term) ||
        marca.id_marca?.toString().includes(term) ||
        (marca.sitio_web && marca.sitio_web.toLowerCase().includes(term))
      );
    }

    this.filteredMarcas = filtered;
    this.totalRecords = filtered.length;
    this.first = 0;
    this.updatePaginatedMarcas();
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
  updatePaginatedMarcas() {
    const start = this.first;
    const end = this.first + this.rowsPerPage;
    this.paginatedMarcas = this.filteredMarcas.slice(start, end);
    this.totalRecords = this.filteredMarcas.length;
    this.currentPage = Math.floor(this.first / this.rowsPerPage) + 1;
  }

  onRowsPerPageChange() {
    this.first = 0;
    this.updatePaginatedMarcas();
  }

  changePage(action: 'first' | 'prev' | 'next' | 'last') {
    switch (action) {
      case 'first': this.first = 0; break;
      case 'prev': if (this.first > 0) this.first -= this.rowsPerPage; break;
      case 'next': if (this.first + this.rowsPerPage < this.totalRecords) this.first += this.rowsPerPage; break;
      case 'last': this.first = Math.floor((this.totalRecords - 1) / this.rowsPerPage) * this.rowsPerPage; break;
    }
    this.updatePaginatedMarcas();
  }

  goToPage(page: number) {
    this.first = (page - 1) * this.rowsPerPage;
    this.updatePaginatedMarcas();
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

  // ===== FUNCIONES PARA CREAR MARCA =====
  openCreateModal() {
    this.nuevaMarca = {
      nombre: '',
      sitio_web: ''
    };
    this.validationErrors = {
      nombre: '',
      sitio_web: ''
    };
    this.createSuccess = false;
    this.createError = '';
    this.showCreateModal = true;
  }

  closeCreateModal() {
    this.showCreateModal = false;
  }

  validateFields(): boolean {
    let isValid = true;
    this.validationErrors = {
      nombre: '',
      sitio_web: ''
    };

    if (!this.nuevaMarca.nombre?.trim()) {
      this.validationErrors.nombre = 'El nombre de la marca es obligatorio';
      isValid = false;
    }

    if (this.nuevaMarca.sitio_web && !this.isValidUrl(this.nuevaMarca.sitio_web)) {
      this.validationErrors.sitio_web = 'Ingresa una URL válida (ej: https://ejemplo.com)';
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
    if (!this.validateFields()) return;

    this.creatingMarca = true;
    this.createError = '';

    const marcaData = {
      nombre: this.nuevaMarca.nombre.trim(),
      sitio_web: this.nuevaMarca.sitio_web?.trim() || ''
    };

    console.log('Enviando marca:', marcaData);

    this.productService.createMarca(marcaData).subscribe({
      next: () => {
        this.createSuccess = true;
        this.creatingMarca = false;
        setTimeout(() => {
          this.closeCreateModal();
          this.loadMarcas();
        }, 1500);
      },
      error: (err) => {
        //console.error('Error al crear marca:', err);
        this.createError = err.error.message || 'Error al crear la marca';
        this.creatingMarca = false;
      }
    });
  }

  // ===== FUNCIONES PARA EDITAR MARCA =====
  openEditModal(marca: Marca) {
    // Clonar la marca para no modificar la original
    this.marcaEditando = JSON.parse(JSON.stringify(marca));
    this.marcaOriginal = JSON.parse(JSON.stringify(marca));
    
    this.editValidationErrors = {
      nombre: '',
      sitio_web: ''
    };
    this.editSuccess = false;
    this.editError = '';
    this.noChangesMessage = '';
    this.showEditModal = true;
  }

  closeEditModal() {
    this.showEditModal = false;
    this.marcaEditando = null;
    this.marcaOriginal = null;
    this.noChangesMessage = '';
  }

  validateEditFields(): boolean {
    let isValid = true;
    this.editValidationErrors = {
      nombre: '',
      sitio_web: ''
    };

    if (!this.marcaEditando?.nombre?.trim()) {
      this.editValidationErrors.nombre = 'El nombre de la marca es obligatorio';
      isValid = false;
    }

    if (this.marcaEditando?.sitio_web && !this.isValidUrl(this.marcaEditando.sitio_web)) {
      this.editValidationErrors.sitio_web = 'Ingresa una URL válida (ej: https://ejemplo.com)';
      isValid = false;
    }

    return isValid;
  }

  hasChanges(): boolean {
    if (!this.marcaEditando || !this.marcaOriginal) return false;
    
    return this.marcaEditando.nombre !== this.marcaOriginal.nombre ||
           this.marcaEditando.sitio_web !== this.marcaOriginal.sitio_web;
  }

  actualizarMarca() {
    // Limpiar mensaje anterior
    this.noChangesMessage = '';
    
    // Validar campos
    if (!this.validateEditFields()) return;
    
    // Verificar si hay cambios
    if (!this.hasChanges()) {
      this.noChangesMessage = 'No se detectaron cambios en la marca';
      return;
    }

    this.editingMarca = true;
    this.editError = '';

    const marcaData = {
      id_marca: this.marcaEditando!.id_marca,
      nombre: this.marcaEditando!.nombre.trim(),
      sitio_web: this.marcaEditando!.sitio_web?.trim() || ''
    };

    console.log('Actualizando marca:', marcaData);

    this.productService.updateMarca(marcaData).subscribe({
      next: () => {
        this.editSuccess = true;
        this.editingMarca = false;
        setTimeout(() => {
          this.closeEditModal();
          this.loadMarcas();
        }, 1500);
      },
      error: (err) => {
        console.error('Error al actualizar marca:', err);
        this.editError = 'Error al actualizar la marca';
        this.editingMarca = false;
      }
    });
  }

  // Acciones existentes
  refreshData() {
    this.loadMarcas();
  }

  viewDetails(marca: Marca) {
    console.log('Ver detalles:', marca);
  }

  editMarca(marca: Marca) {
    this.openEditModal(marca);
  }

  deleteMarca(marca: Marca) {
    if (confirm(`¿Estás seguro de eliminar la marca "${marca.nombre}"?`)) {
      console.log('Eliminar:', marca);
    }
  }
}