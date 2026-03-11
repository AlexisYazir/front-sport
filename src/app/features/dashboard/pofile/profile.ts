import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { User, UserRole, getRoleName } from '../../../core/models/user.model';
import { ToastrService } from 'ngx-toastr';
import { UpdateProfileData } from '../../../core/models/user.model';
import { 
  validateEmail,
  validateName,
  validatePhone
} from '../../../core/validators/custom-validators';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule], // Quitamos PasswordStrengthComponent
  templateUrl: './profile.html',
  styleUrls: ['./profile.css']
})
export class Profile implements OnInit {
  private authService = inject(AuthService);
  private toastr = inject(ToastrService);
  
  // Usuario obtenido del getProfile
  user = signal<User | null>(null);
  isLoading = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  isChangingPassword = signal<boolean>(false);
  
  // Control de visibilidad de contraseñas
  showNewPassword = false;
  showConfirmNewPassword = false;
  showCurrentPassword = false;
  
  // Fecha actual para mostrar
  currentDate = new Date();
  
  // Formulario de perfil
  profileForm = {
    nombre: '',
    aPaterno: '',
    aMaterno: '',
    email: '',
    telefono: ''
  };
  
  // Formulario de contraseña
  passwordForm = {
    contrasenaActual: '',
    nuevaContrasena: '',
    confirmarContrasena: ''
  };
  
  // Errores de validación
  passwordErrors = {
    contrasenaActual: '',
    nuevaContrasena: '',
    confirmarContrasena: ''
  };
  
  // Signals para validación en tiempo real
  emailError = signal<string>('');
  nombreError = signal<string>('');
  aPaternoError = signal<string>('');
  aMaternoError = signal<string>('');
  telefonoError = signal<string>('');
  
  // Validación de contraseña simplificada
  passwordChecks = {
    minLength: false,
    hasUpper: false,
    hasLower: false,
    hasNumber: false,
    hasSpecial: false
  };
  
  ngOnInit() {
    this.loadUserData();
  }
  
  loadUserData() {
    this.isLoading.set(true);
    
    this.authService.getProfile().subscribe({
      next: (profile) => {
        console.log('Perfil cargado:', profile);
        this.user.set(profile);
        
        this.profileForm = {
          nombre: profile.nombre || '',
          aPaterno: profile.aPaterno || '',
          aMaterno: profile.aMaterno || '',
          email: profile.email || '',
          telefono: profile.telefono || ''
        };
        
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error al cargar perfil:', error);
        this.isLoading.set(false);
        this.toastr.error('Error al cargar el perfil', 'Error');
      }
    });
  }
  
  toggleEdit() {
    this.isEditing.set(!this.isEditing());
    if (!this.isEditing()) {
      this.isChangingPassword.set(false);
      this.resetPasswordForm();
    }
  }
  
  togglePasswordChange() {
    this.isChangingPassword.set(!this.isChangingPassword());
    this.resetPasswordForm();
  }
  
  // Toggles para los ojitos
  toggleNewPassword() {
    this.showNewPassword = !this.showNewPassword;
  }
  
  toggleConfirmNewPassword() {
    this.showConfirmNewPassword = !this.showConfirmNewPassword;
  }
  
  toggleCurrentPassword() {
    this.showCurrentPassword = !this.showCurrentPassword;
  }
  
  resetPasswordForm() {
    this.passwordForm = {
      contrasenaActual: '',
      nuevaContrasena: '',
      confirmarContrasena: ''
    };
    this.passwordErrors = {
      contrasenaActual: '',
      nuevaContrasena: '',
      confirmarContrasena: ''
    };
    this.resetPasswordChecks();
  }
  
  resetPasswordChecks() {
    this.passwordChecks = {
      minLength: false,
      hasUpper: false,
      hasLower: false,
      hasNumber: false,
      hasSpecial: false
    };
  }
  
  // Validaciones en tiempo real
  onEmailChange(email: string) {
    this.profileForm.email = email.trim();
    if (!this.profileForm.email) {
      this.emailError.set('');
      return;
    }
    if (!validateEmail(this.profileForm.email)) {
      this.emailError.set('El email debe ser válido (ej: usuario@dominio.com)');
    } else {
      this.emailError.set('');
    }
  }
  
  onTelefonoChange(telefono: string) {
    this.profileForm.telefono = telefono.trim();
    if (!this.profileForm.telefono) {
      this.telefonoError.set('');
      return;
    }
    if (!validatePhone(this.profileForm.telefono)) {
      this.telefonoError.set('El teléfono debe tener 10 dígitos');
    } else {
      this.telefonoError.set('');
    }
  }
  
  onNameChange(field: 'nombre' | 'aPaterno' | 'aMaterno', value: string) {
    const trimmedValue = (value || '').trim();
    (this.profileForm as any)[field] = trimmedValue;
    
    if (!trimmedValue) {
      if (field === 'nombre') this.nombreError.set('');
      else if (field === 'aPaterno') this.aPaternoError.set('');
      else if (field === 'aMaterno') this.aMaternoError.set('');
      return;
    }
    
    if (!validateName(trimmedValue)) {
      const errorMsg = 'Formato inválido: 2-50 caracteres, solo letras, espacios y acentos';
      if (field === 'nombre') this.nombreError.set(errorMsg);
      else if (field === 'aPaterno') this.aPaternoError.set(errorMsg);
      else if (field === 'aMaterno') this.aMaternoError.set(errorMsg);
    } else {
      if (field === 'nombre') this.nombreError.set('');
      else if (field === 'aPaterno') this.aPaternoError.set('');
      else if (field === 'aMaterno') this.aMaternoError.set('');
    }
  }
  
  // Validación de contraseña simplificada
  onPasswordChange(password: string) {
    this.passwordForm.nuevaContrasena = password;
    
    this.passwordChecks = {
      minLength: password.length >= 8,
      hasUpper: /[A-Z]/.test(password),
      hasLower: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };
  }
  
  onConfirmPasswordChange(confirmPassword: string) {
    this.passwordForm.confirmarContrasena = confirmPassword;
  }
  
  passwordsMatch(): boolean {
    return this.passwordForm.nuevaContrasena === this.passwordForm.confirmarContrasena && 
           this.passwordForm.nuevaContrasena.length > 0;
  }
  
  isPasswordValid(): boolean {
    return this.passwordChecks.minLength && 
           this.passwordChecks.hasUpper && 
           this.passwordChecks.hasLower && 
           this.passwordChecks.hasNumber && 
           this.passwordChecks.hasSpecial;
  }
  
  validatePasswordForm(): boolean {
    let isValid = true;
    this.passwordErrors = {
      contrasenaActual: '',
      nuevaContrasena: '',
      confirmarContrasena: ''
    };
    
    if (this.isChangingPassword()) {
      // Validar nueva contraseña
      if (!this.passwordForm.nuevaContrasena) {
        this.passwordErrors.nuevaContrasena = 'La nueva contraseña es requerida';
        isValid = false;
      } else if (!this.isPasswordValid()) {
        this.passwordErrors.nuevaContrasena = 'La contraseña no cumple con los requisitos';
        isValid = false;
      }
      
      // Validar confirmación
      if (!this.passwordForm.confirmarContrasena) {
        this.passwordErrors.confirmarContrasena = 'Debes confirmar la nueva contraseña';
        isValid = false;
      } else if (!this.passwordsMatch()) {
        this.passwordErrors.confirmarContrasena = 'Las contraseñas no coinciden';
        isValid = false;
      }
      
      // Validar contraseña actual
      if (!this.passwordForm.contrasenaActual) {
        this.passwordErrors.contrasenaActual = 'La contraseña actual es requerida';
        isValid = false;
      }
    }
    
    return isValid;
  }
  
  validateProfileForm(): boolean {
    let isValid = true;
    
    if (!this.profileForm.nombre || this.profileForm.nombre.trim().length === 0) {
      this.nombreError.set('El nombre es requerido');
      isValid = false;
    } else if (!validateName(this.profileForm.nombre)) {
      this.nombreError.set('El nombre debe tener 2-50 caracteres (solo letras, espacios y acentos)');
      isValid = false;
    }
    
    if (!this.profileForm.aPaterno || this.profileForm.aPaterno.trim().length === 0) {
      this.aPaternoError.set('El apellido paterno es requerido');
      isValid = false;
    } else if (!validateName(this.profileForm.aPaterno)) {
      this.aPaternoError.set('El apellido paterno debe tener 2-50 caracteres');
      isValid = false;
    }
    
    if (!this.profileForm.email || this.profileForm.email.trim().length === 0) {
      this.emailError.set('El email es requerido');
      isValid = false;
    } else if (!validateEmail(this.profileForm.email)) {
      this.emailError.set('El email debe ser válido (ej: usuario@dominio.com)');
      isValid = false;
    }
    
    if (!this.profileForm.telefono || this.profileForm.telefono.trim().length === 0) {
      this.telefonoError.set('El teléfono es requerido');
      isValid = false;
    } else if (!validatePhone(this.profileForm.telefono)) {
      this.telefonoError.set('El teléfono debe tener 10 dígitos');
      isValid = false;
    }
    
    return isValid;
  }
  
  saveProfile() {
    if (!this.validateProfileForm()) {
      return;
    }
    
    if (this.isChangingPassword() && !this.validatePasswordForm()) {
      return;
    }
    
    this.isLoading.set(true);
    
    const updateData: UpdateProfileData = {
      nombre: this.profileForm.nombre,
      aPaterno: this.profileForm.aPaterno,
      aMaterno: this.profileForm.aMaterno,
      email: this.profileForm.email,
      telefono: this.profileForm.telefono
    };
    
    if (this.isChangingPassword()) {
      updateData.contrasenaActual = this.passwordForm.contrasenaActual;
      updateData.passw = this.passwordForm.nuevaContrasena;
    }
    
    this.authService.updateProfile(updateData).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        this.isEditing.set(false);
        this.isChangingPassword.set(false);
        this.resetPasswordForm();
        
        this.user.set(response.user);
        this.profileForm = {
          nombre: response.user.nombre || '',
          aPaterno: response.user.aPaterno || '',
          aMaterno: response.user.aMaterno || '',
          email: response.user.email || '',
          telefono: response.user.telefono || ''
        };
        
        this.toastr.success(response.message, 'Éxito');
      },
      error: (error) => {
        this.isLoading.set(false);
        
        if (error.error?.message) {
          const errorMsg = error.error.message;
          
          if (errorMsg.includes('contraseña actual es incorrecta')) {
            this.passwordErrors.contrasenaActual = errorMsg;
            this.toastr.error(errorMsg, 'Error');
          } else if (errorMsg.includes('correo') || errorMsg.includes('email')) {
            this.emailError.set(errorMsg);
            this.toastr.error(errorMsg, 'Error');
          } else if (errorMsg.includes('teléfono')) {
            this.telefonoError.set(errorMsg);
            this.toastr.error(errorMsg, 'Error');
          } else {
            this.toastr.error(errorMsg, 'Error');
          }
        } else {
          this.toastr.error('Error al actualizar el perfil', 'Error');
        }
      }
    });
  }
  
  cancelEdit() {
    this.isEditing.set(false);
    this.isChangingPassword.set(false);
    this.resetPasswordForm();
    
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
    
    this.emailError.set('');
    this.nombreError.set('');
    this.aPaternoError.set('');
    this.aMaternoError.set('');
    this.telefonoError.set('');
  }
  
  preventSpace(event: KeyboardEvent): void {
    if (event.key === ' ' || event.code === 'Space') {
      event.preventDefault();
    }
  }
  
  getCurrentRole(): UserRole {
    return this.user()?.rol ?? UserRole.USUARIO;
  }
  
  getRoleName(): string {
    return getRoleName(this.getCurrentRole());
  }
  
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
  
  getInitials(): string {
    const user = this.user();
    if (!user) return 'U';
    
    const first = user.nombre?.charAt(0) || '';
    const last = user.aPaterno?.charAt(0) || '';
    return (first + last).toUpperCase() || 'U';
  }
  
  getFechaCreacion(): string {
    const user = this.user();
    if (!user?.fecha_creacion) return 'No disponible';
    
    const date = new Date(user.fecha_creacion);
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}