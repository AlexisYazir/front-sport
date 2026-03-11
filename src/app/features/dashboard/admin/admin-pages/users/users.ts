import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../../core/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { FormsModule } from '@angular/forms';
import { UsersAdmin, Roles } from '../../../../../core/models/user.model';
import { RouterModule } from '@angular/router';

interface UserWithEditState extends UsersAdmin {
  editing: boolean;
  originalRol: number;
  originalActivo: number;
  hasChanges: boolean;
  saving: boolean;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './users.html',
  styleUrl: './users.css'
})
export class Users implements OnInit {
  private authService = inject(AuthService);
  private toastr = inject(ToastrService);
  
  users: UserWithEditState[] = [];
  filteredUsers: UserWithEditState[] = [];
  paginatedUsers: UserWithEditState[] = [];
  searchValue: string = '';
  currentUserId: number | null = null;
  
  // Roles disponibles
  roles: Roles[] = [];
  
  // Filtros adicionales
  filterRol: string = 'todos';
  filterEstado: string = 'todos';
  
  // Contadores
  totalUsuarios: number = 0;
  countActivos: number = 0;
  countInactivos: number = 0;
  countAdmin: number = 0;
  countEmpleado: number = 0;
  countUsuario: number = 0;
  
  // Paginación
  rowsPerPage: number = 10;
  rowsPerPageOptions: number[] = [5, 10, 20, 50, 100];
  first: number = 0;
  currentPage: number = 1;
  totalRecords: number = 0;
  
  isLoading = signal<boolean>(false);
  togglingActive: { [key: number]: boolean } = {};

  ngOnInit(): void {
    // ✅ CORREGIDO: Llamar al signal como función
    const currentUser = this.authService.currentUser(); // 👈 AHORA SÍ
    this.currentUserId = currentUser?.id || null;
    console.log('Usuario actual ID:', this.currentUserId); // Para verificar
    
    this.loadUsers();
    this.loadRoles();
  }

  loadUsers() {
    this.isLoading.set(true);
    this.authService.getUsers().subscribe({
      next: (users: UsersAdmin[]) => {
        // Filtrar para NO mostrar el usuario actual
        const filteredUsers = users.filter(user => user.id_usuario !== this.currentUserId);
        
        this.users = filteredUsers.map(user => ({
          ...user,
          editing: false,
          originalRol: user.rol as number,
          originalActivo: user.activo,
          hasChanges: false,
          saving: false
        }));
        
        this.calcularContadores();
        this.applyFilters();
        this.isLoading.set(false);
      },
      error: (error) => {
        this.toastr.error('Error al cargar usuarios', 'Error');
        this.isLoading.set(false);
      }
    });
  }

  calcularContadores() {
    this.totalUsuarios = this.users.length;
    this.countActivos = this.users.filter(u => u.activo === 1).length;
    this.countInactivos = this.users.filter(u => u.activo === 0).length;
    this.countAdmin = this.users.filter(u => u.rol === 3).length;
    this.countEmpleado = this.users.filter(u => u.rol === 2).length;
    this.countUsuario = this.users.filter(u => u.rol === 1).length;
  }

  loadRoles() {
    this.authService.getRoles().subscribe({
      next: (roles: Roles[]) => {
        this.roles = roles;
      },
      error: (error) => {
        this.toastr.error('Error al cargar roles', 'Error');
      }
    });
  }

  // ===== FILTROS Y BÚSQUEDA =====
  applyFilters() {
    let filtered = [...this.users];

    if (this.searchValue) {
      const term = this.searchValue.toLowerCase();
      filtered = filtered.filter(user => 
        user.nombre?.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term) ||
        user.id_usuario?.toString().includes(term)
      );
    }

    if (this.filterRol !== 'todos') {
      filtered = filtered.filter(user => user.rol === Number(this.filterRol));
    }

    if (this.filterEstado !== 'todos') {
      filtered = filtered.filter(user => 
        this.filterEstado === 'activo' ? user.activo === 1 : user.activo === 0
      );
    }

    this.filteredUsers = filtered;
    this.totalRecords = filtered.length;
    this.first = 0;
    this.updatePaginatedUsers();
  }

  onFilterRolChange(event: any) {
    this.filterRol = event.target.value;
    this.applyFilters();
  }

  onFilterEstadoChange(event: any) {
    this.filterEstado = event.target.value;
    this.applyFilters();
  }

  onSearch(event: any) {
    this.searchValue = event.target.value;
    this.applyFilters();
  }

  clearSearch() {
    this.searchValue = '';
    this.filterRol = 'todos';
    this.filterEstado = 'todos';
    this.applyFilters();
    this.toastr.success('Filtros limpiados', 'Éxito');
  }

  // ===== PAGINACIÓN =====
  updatePaginatedUsers() {
    const start = this.first;
    const end = this.first + this.rowsPerPage;
    this.paginatedUsers = this.filteredUsers.slice(start, end);
    this.totalRecords = this.filteredUsers.length;
    this.currentPage = Math.floor(this.first / this.rowsPerPage) + 1;
  }

  onRowsPerPageChange() {
    this.first = 0;
    this.updatePaginatedUsers();
  }

  changePage(action: 'first' | 'prev' | 'next' | 'last') {
    switch (action) {
      case 'first': this.first = 0; break;
      case 'prev': if (this.first > 0) this.first -= this.rowsPerPage; break;
      case 'next': if (this.first + this.rowsPerPage < this.totalRecords) this.first += this.rowsPerPage; break;
      case 'last': this.first = Math.floor((this.totalRecords - 1) / this.rowsPerPage) * this.rowsPerPage; break;
    }
    this.updatePaginatedUsers();
  }

  goToPage(page: number) {
    this.first = (page - 1) * this.rowsPerPage;
    this.updatePaginatedUsers();
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

  // ===== FUNCIONES PARA EDITAR USUARIO =====
  toggleUserEdit(user: UserWithEditState, enable: boolean) {
    if (enable) {
      user.editing = true;
      user.originalRol = user.rol;
      user.originalActivo = user.activo;
      user.hasChanges = false;
    } else {
      user.editing = false;
      user.rol = user.originalRol;
      user.activo = user.originalActivo;
      user.hasChanges = false;
    }
  }

  onRolChange(user: UserWithEditState) {
    user.hasChanges = true;
  }

  toggleUserStatus(user: UserWithEditState) {
    if (this.togglingActive[user.id_usuario]) return;
    
    this.togglingActive[user.id_usuario] = true;
    const previousState = user.activo;
    const newState = user.activo === 1 ? 0 : 1;
    
    user.activo = newState;

    const updateData = {
      id_usuario: user.id_usuario,
      activo: newState,
      rol: user.rol
    };

    this.authService.updateUserFromAdmin(updateData).subscribe({
      next: () => {
        this.togglingActive[user.id_usuario] = false;
        user.originalActivo = newState;
        user.hasChanges = false;
        this.toastr.success(`Estado de ${user.email} actualizado a ${newState === 1 ? 'activo' : 'inactivo'}`, 'Éxito');
        this.calcularContadores();
      },
      error: (err) => {
        user.activo = previousState;
        this.togglingActive[user.id_usuario] = false;
        this.toastr.error('Error al actualizar el estado', 'Error');
      }
    });
  }

  hasChanges(user: UserWithEditState): boolean {
    return user.rol !== user.originalRol;
  }

  saveUser(user: UserWithEditState) {
    if (!this.hasChanges(user)) {
      this.toastr.info('No hay cambios para guardar', 'Información');
      return;
    }

    user.saving = true;

    const updateData = {
      id_usuario: user.id_usuario,
      activo: user.activo,
      rol: user.rol
    };

    this.authService.updateUserFromAdmin(updateData).subscribe({
      next: () => {
        user.saving = false;
        user.editing = false;
        user.originalRol = user.rol;
        user.originalActivo = user.activo;
        user.hasChanges = false;
        this.toastr.success(`Usuario ${user.email} actualizado correctamente`, 'Éxito');
        this.calcularContadores();
      },
      error: (err) => {
        user.saving = false;
        this.toastr.error(err.error?.message || 'Error al actualizar usuario', 'Error');
      }
    });
  }

  // ===== REFRESCAR DATOS =====
  refreshData() {
    this.loadUsers();
    this.loadRoles();
    this.toastr.success('Datos actualizados', 'Éxito');
  }

  // ===== UTILIDADES =====
  getRolName(rolId: number): string {
    const rol = this.roles.find(r => r.id_rol === rolId);
    return rol ? rol.rol : 'Desconocido';
  }

  getRolClass(rol: number): string {
    switch (rol) {
      case 1: return 'bg-blue-100 text-blue-800';
      case 2: return 'bg-green-100 text-green-800';
      case 3: return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  getStatusClass(activo: number): string {
    return activo === 1 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  }

  getStatusText(activo: number): string {
    return activo === 1 ? 'Activo' : 'Inactivo';
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}