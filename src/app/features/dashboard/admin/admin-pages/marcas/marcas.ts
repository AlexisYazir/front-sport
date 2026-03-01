import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
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
  private toastr = inject(ToastrService);
  
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
    imagen: '' // Aquí se guardará la URL de la imagen
  };
  
  validationErrors = {
    nombre: '',
    imagen: '' // Para validar la URL de la imagen
  };
  
  creatingMarca: boolean = false;
  
  // Modal edición
  showEditModal: boolean = false;
  marcaEditando: Marca | null = null;
  
  // Guardar copia original para detectar cambios
  marcaOriginalData = {
    nombre: '',
    imagen: ''
  };
  
  editValidationErrors = {
    nombre: '',
    imagen: ''
  };
  
  editingMarca: boolean = false;
  
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
        console.error('Error loading marcas:', error);
        this.toastr.error('Error al cargar marcas', 'Error');
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
        (marca.imagen && marca.imagen.toLowerCase().includes(term))
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
    this.toastr.success('Filtros limpiados', 'Éxito');
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
      imagen: ''
    };
    this.validationErrors = {
      nombre: '',
      imagen: ''
    };
    this.showCreateModal = true;
  }

  closeCreateModal() {
    this.showCreateModal = false;
  }

  validateFields(): boolean {
    let isValid = true;
    this.validationErrors = {
      nombre: '',
      imagen: ''
    };

    if (!this.nuevaMarca.nombre?.trim()) {
      this.validationErrors.nombre = 'El nombre de la marca es obligatorio';
      isValid = false;
    }

    if (this.nuevaMarca.imagen && !this.isValidUrl(this.nuevaMarca.imagen)) {
      this.validationErrors.imagen = 'Ingresa una URL válida para la imagen';
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
    if (!this.validateFields()) {
      this.toastr.warning('Corrige los errores en el formulario', 'Validación');
      return;
    }

    this.creatingMarca = true;

    const marcaData = {
      nombre: this.nuevaMarca.nombre.trim(),
      imagen: this.nuevaMarca.imagen?.trim() || ''
    };

    console.log('Enviando marca:', marcaData);

    this.productService.createMarca(marcaData).subscribe({
      next: () => {
        this.creatingMarca = false;
        this.toastr.success('Marca creada exitosamente', 'Éxito');
        setTimeout(() => {
          this.closeCreateModal();
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
  openEditModal(marca: Marca) {
    this.marcaEditando = JSON.parse(JSON.stringify(marca));
    
    // Guardar datos originales para comparar cambios
    this.marcaOriginalData = {
      nombre: marca.nombre,
      imagen: marca.imagen || ''
    };
    
    this.editValidationErrors = {
      nombre: '',
      imagen: ''
    };
    
    this.showEditModal = true;
  }

  closeEditModal() {
    this.showEditModal = false;
    this.marcaEditando = null;
  }

  validateEditFields(): boolean {
    let isValid = true;
    this.editValidationErrors = {
      nombre: '',
      imagen: ''
    };

    if (!this.marcaEditando?.nombre?.trim()) {
      this.editValidationErrors.nombre = 'El nombre de la marca es obligatorio';
      isValid = false;
    }

    if (this.marcaEditando?.imagen && !this.isValidUrl(this.marcaEditando.imagen)) {
      this.editValidationErrors.imagen = 'Ingresa una URL válida para la imagen';
      isValid = false;
    }

    return isValid;
  }

  hasChanges(): boolean {
    if (!this.marcaEditando) return false;
    
    return this.marcaEditando.nombre !== this.marcaOriginalData.nombre ||
           (this.marcaEditando.imagen || '') !== this.marcaOriginalData.imagen;
  }

  actualizarMarca() {
    // Validar campos
    if (!this.validateEditFields()) {
      this.toastr.warning('Corrige los errores en el formulario', 'Validación');
      return;
    }
    
    // Verificar si hay cambios
    if (!this.hasChanges()) {
      this.toastr.info('No se detectaron cambios en la marca', 'Información');
      return;
    }

    this.editingMarca = true;

    const marcaData = {
      id_marca: this.marcaEditando!.id_marca,
      nombre: this.marcaEditando!.nombre.trim(),
      imagen: this.marcaEditando!.imagen?.trim() || ''
    };

    console.log('Actualizando marca:', marcaData);

    this.productService.updateMarca(marcaData).subscribe({
      next: () => {
        this.editingMarca = false;
        this.toastr.success('Marca actualizada exitosamente', 'Éxito');
        setTimeout(() => {
          this.closeEditModal();
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

  // ===== FUNCIÓN PARA OBTENER IMAGEN DE LA MARCA =====
  getMarcaImageUrl(marca: Marca): string {
    return marca.imagen || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(marca.nombre) + '&background=0367A6&color=fff&size=64';
  }

  // Acciones existentes
  refreshData() {
    this.loadMarcas();
    //this.toastr.success('Datos actualizados', 'Éxito');
  }

  viewDetails(marca: Marca) {
    console.log('Ver detalles:', marca);
  }

  editMarca(marca: Marca) {
    this.openEditModal(marca);
  }
}