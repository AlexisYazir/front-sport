import { Component, inject, signal, OnInit } from "@angular/core"
import { CommonModule } from "@angular/common"
import { FormsModule, ReactiveFormsModule } from "@angular/forms"
import { RouterModule } from "@angular/router"
import { AuthService } from '../../../core/services/auth.service';
import { Router } from "@angular/router";
import { GoogleAuthService } from '../../../core/services/google-auth.service';
import { RegisterRequest, UserRole } from '../../../core/models/user.model';
import { 
  evaluatePasswordStrength,
  PasswordStrength,
  validateEmail,
  validatePasswordComplexity,
  validateName,
  isSecureInput
} from '../../../core/validators/custom-validators';
import { PasswordStrengthComponent } from '../../../shared/components/password-strength/password-strength.component';

@Component({
  selector: "app-register",
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ReactiveFormsModule,
    RouterModule,
    PasswordStrengthComponent
  ],
  templateUrl: "./register.html",
  styleUrl: "./register.css"
})
export class Register implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  googleAuthService = inject(GoogleAuthService);  // Público para acceder desde template

  userData: RegisterRequest = {
    nombre: '',
    aPaterno: '',
    aMaterno: '',
    email: '',
    telefono: '',
    passw: '',
    rol: UserRole.USUARIO,
    activo: 1
  };

  confirmPassword = '';
  showPassword = false;
  showConfirmPassword = false;
  acceptTerms = false;
  subscribeNewsletter = false;
  isLoading = false;

  // Signals para validación en tiempo real
  passwordStrength = signal<PasswordStrength | null>(null);
  emailError = signal<string>('');
  nombreError = signal<string>('');
  aPaternoError = signal<string>('');
  aMaternoError = signal<string>('');
  passwordError = signal<string>('');
  secureError = signal<string>('');
  telefonoError = signal<string>('');

  ngOnInit() {
    // Inicializar Google Auth si está disponible
    this.initializeGoogle();
  }

  /**
   * Inicializar Google Identity Services
   */
  private initializeGoogle(): void {
    // Cliente ID configurado para Google OAuth
    const googleClientId = '637508139644-n30pocvh0corlgsv79bmu4joagg46nrv.apps.googleusercontent.com';

    if (googleClientId && googleClientId.includes('.apps.googleusercontent.com')) {
      this.googleAuthService.initializeGoogle(googleClientId);
      
      // Renderizar botón de Google con delay para asegurar que DOM esté listo
      setTimeout(() => {
        this.googleAuthService.renderGoogleButton('google-signup-button', {
          theme: 'outline',
          size: 'large',
          text: 'signup_with'
        });
      }, 300);
    } else {
      console.warn('⚠️ Google Client ID no está configurado');
    }
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  /**
   * Validar email en tiempo real
   */
  onEmailChange(email: string) {
    this.userData.email = email.trim();
    if (!this.userData.email) {
      this.emailError.set('');
      return;
    }
    if (!validateEmail(this.userData.email)) {
      this.emailError.set('El email debe ser válido (ej: usuario@dominio.com)');
    } else {
      this.emailError.set('');
    }
  }

  /**
   * Validar nombre en tiempo real
   */
  onNameChange(field: 'nombre' | 'aPaterno' | 'aMaterno', value: string) {
    const trimmedValue = (value || '').trim();
    this.userData[field] = trimmedValue;
    
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

  /**
   * Validar contraseña en tiempo real
   */
  onPasswordChange(password: string) {
    this.userData.passw = password;
    
    if (!password) {
      this.passwordStrength.set(null);
      this.passwordError.set('');
      this.secureError.set('');
      return;
    }

    // Evaluar fortaleza
    const strength = evaluatePasswordStrength(password);
    this.passwordStrength.set(strength);

    // Validar complejidad
    if (!validatePasswordComplexity(password)) {
      this.passwordError.set('La contraseña no cumple con los requisitos de seguridad');
    } else {
      this.passwordError.set('');
    }

    // Validar que no contenga XSS/SQL
    if (!isSecureInput(password)) {
      this.secureError.set('La contraseña contiene caracteres no permitidos');
    } else {
      this.secureError.set('');
    }
  }

  /**
   * Validar coincidencia de contraseñas
   */
  onConfirmPasswordChange(confirmPassword: string) {
    this.confirmPassword = confirmPassword;
  }

  /**
   * Verificar si contraseñas coinciden
   */
  passwordsMatch(): boolean {
    return this.userData.passw === this.confirmPassword && this.userData.passw.length > 0;
  }

  /**
   * Validar formulario completo
   */
  onSubmit() {
    if (!this.validateForm()) {
      return;
    }

    this.isLoading = true;

    this.authService.register(this.userData).subscribe({
      next: (response) => {
        this.isLoading = false;
        // Navegar a la vista separada de verificación con query params
      this.router.navigate(['/auth/verify-account'], {
        queryParams: { email: this.userData.email, from: 'register' }
      });
      },
      error: (error) => {
        this.isLoading = false;
      }
    });
  }

  /**
   * Validación del formulario
   */
  validateForm(): boolean {
    // Primero validar que acepte los términos (obligatorio)
    if (!this.acceptTerms) {
      return false;
    }

    // Limpiar errores previos
    this.nombreError.set('');
    this.aPaternoError.set('');
    this.aMaternoError.set('');
    this.emailError.set('');
    this.telefonoError.set('');
    this.passwordError.set('');
    this.secureError.set('');

    // Validar nombre
    if (!this.userData.nombre || this.userData.nombre.trim().length === 0) {
      this.nombreError.set('El nombre es requerido');
      return false;
    }
    if (!validateName(this.userData.nombre)) {
      this.nombreError.set('El nombre debe tener 2-50 caracteres (solo letras, espacios y acentos)');
      return false;
    }

    // Validar apellido paterno
    if (!this.userData.aPaterno || this.userData.aPaterno.trim().length === 0) {
      this.aPaternoError.set('El apellido paterno es requerido');
      return false;
    }
    if (!validateName(this.userData.aPaterno)) {
      this.aPaternoError.set('El apellido paterno debe tener 2-50 caracteres');
      return false;
    }

    // Validar email
    if (!this.userData.email || this.userData.email.trim().length === 0) {
      this.emailError.set('El email es requerido');
      return false;
    }
    if (!validateEmail(this.userData.email)) {
      this.emailError.set('El email debe ser válido (ej: usuario@dominio.com)');
      return false;
    }

    // Validar teléfono
    if (!this.userData.telefono || this.userData.telefono.trim().length === 0) {
      this.telefonoError.set('El teléfono es requerido');
      return false;
    }

    // Validar contraseña
    if (!this.userData.passw || this.userData.passw.length === 0) {
      this.passwordError.set('La contraseña es requerida');
      return false;
    }
    if (!validatePasswordComplexity(this.userData.passw)) {
      this.passwordError.set('La contraseña debe tener al menos 8 caracteres, mayúscula, minúscula, número y carácter especial');
      return false;
    }

    // Validar entrada segura
    if (!isSecureInput(this.userData.passw)) {
      this.secureError.set('La contraseña contiene caracteres no permitidos (XSS/SQL)');
      return false;
    }

    // Validar coincidencia
    if (!this.passwordsMatch()) {
      this.passwordError.set('Las contraseñas no coinciden');
      return false;
    }

    return true;
  }

  registerWithGoogle() {
    // El servicio de Google maneja todo automáticamente cuando el usuario hace click
    // Solo necesita que el botón esté renderizado
    console.log('Google Sign-In iniciado...');
  }

  registerWithFacebook() {
    console.log('Facebook register - proximamente');
  }


  /**
   * Verificar si el botón está habilitado
   */
  isSubmitDisabled(): boolean {
    return this.isLoading || !this.acceptTerms || 
           !this.userData.nombre || 
           !this.userData.aPaterno || 
           !this.userData.email || 
           !this.userData.telefono || 
           !this.userData.passw || 
           !this.passwordsMatch();
  }
  /**
 * Prevenir espacios en contraseñas
 */
preventSpace(event: KeyboardEvent): void {
  if (event.key === ' ' || event.code === 'Space') {
    event.preventDefault();
  }
}
}

