import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { User, UserRole, getRoleName } from '../../../core/models/user.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.html',
  styleUrls: ['./profile.css']
})
export class Profile implements OnInit {
  private authService = inject(AuthService);
  
  // Obtener el usuario actual del servicio
  user = this.authService.currentUser;
  
  isLoading = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  
  // Fecha actual para mostrar en la vista
  currentDate = new Date();
  
  // Formulario de perfil
  profileForm = {
    nombre: '',
    aPaterno: '',
    aMaterno: '',
    email: '',
    telefono: ''
  };
  
  ngOnInit() {
    this.loadUserData();
  }
  
  loadUserData() {
    const currentUser = this.user();
    
    if (currentUser) {
      this.profileForm = {
        nombre: currentUser.nombre || '',
        aPaterno: currentUser.aPaterno || '',
        aMaterno: currentUser.aMaterno || '',
        email: currentUser.email || '',
        telefono: currentUser.telefono || ''
      };
    }
  }
  
  toggleEdit() {
    this.isEditing.set(!this.isEditing());
  }
  
  saveProfile() {
    this.isLoading.set(true);
    
    // Aquí iría la llamada a la API para actualizar
    console.log('Guardando perfil:', this.profileForm);
    
    // Simular guardado
    setTimeout(() => {
      this.isLoading.set(false);
      this.isEditing.set(false);
    }, 1000);
  }
  
  cancelEdit() {
    this.isEditing.set(false);
    this.loadUserData();
  }
  
  // Obtener el rol actual del usuario
  getCurrentRole(): UserRole {
    return this.user()?.rol ?? UserRole.USUARIO;
  }
  
  // Obtener nombre del rol
  getRoleName(): string {
    return getRoleName(this.getCurrentRole());
  }
  
  // Obtener clase CSS para el badge del rol
  getRoleClass(): string {
    const rol = this.getCurrentRole();
    switch (rol) {
      case UserRole.USUARIO:
        return 'bg-blue-100 text-blue-800';
      case UserRole.EMPLEADO:
        return 'bg-green-100 text-green-800';
      case UserRole.ADMIN:
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }
  
  // NUEVO: Obtener icono según el rol
  getRoleIcon(): string {
    const rol = this.getCurrentRole();
    switch (rol) {
      case UserRole.USUARIO:
        return 'person';
      case UserRole.EMPLEADO:
        return 'badge';
      case UserRole.ADMIN:
        return 'shield';
      default:
        return 'account_circle';
    }
  }
  
  // Verificar si es admin
  get isAdmin(): boolean {
    return this.getCurrentRole() === UserRole.ADMIN;
  }
  
  // Verificar si es empleado
  get isEmpleado(): boolean {
    return this.getCurrentRole() === UserRole.EMPLEADO;
  }
  
  // Verificar si es usuario regular
  get isUsuario(): boolean {
    return this.getCurrentRole() === UserRole.USUARIO;
  }
}