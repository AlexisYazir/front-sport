import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { GoogleAuthService } from '../../../core/services/google-auth.service';
import { LoginRequest } from '../../../core/models/user.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  googleAuthService = inject(GoogleAuthService); // Público para acceder desde template

  credentials: LoginRequest = {
    email: '',
    passw: '',
    code: '',
  };

  showPassword = false;
  rememberMe = false;
  isLoading = false;
  googleClientId = ''; // Se debe configurar desde environment

  // Nuevas flags para verificación
  showVerify = false;
  verifyEmail = '';

  ngOnInit() {
    // Inicializar Google Auth si está disponible
    this.initializeGoogle();

    // Cargar credenciales guardadas si existen
    this.loadRememberedCredentials();
  }

  /**
   * Cargar credenciales guardadas desde localStorage
   */
  private loadRememberedCredentials(): void {
    const rememberedEmail = localStorage.getItem('sc_remember_email');
    const rememberMeFlag = localStorage.getItem('sc_remember_me') === 'true';

    if (rememberedEmail && rememberMeFlag) {
      this.credentials.email = rememberedEmail;
      this.rememberMe = true;
      console.log('✅ Credenciales recuperadas del localStorage');
    }
  }

  /**
   * Inicializar Google Identity Services
   */
  private initializeGoogle(): void {
    // Cliente ID configurado para Google OAuth
    // const googleClientId ='637508139644-n30pocvh0corlgsv79bmu4joagg46nrv.apps.googleusercontent.com'; //ANTERIOR
    const googleClientId ='791356083560-kg90udkq7qdpg7hq0g3r3coot85hqrgb.apps.googleusercontent.com';

    if (googleClientId && googleClientId.includes('.apps.googleusercontent.com')) {
      this.googleAuthService.initializeGoogle(googleClientId);

      // Renderizar botón de Google con delay para asegurar que DOM esté listo
      setTimeout(() => {
        this.googleAuthService.renderGoogleButton('google-signin-button', {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
        });
      }, 300);
    } else {
      console.warn('⚠️ Google Client ID no está configurado');
    }
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  onSubmit() {
    if (!this.credentials.email || !this.credentials.passw) {
      return;
    }

    // Guardar o limpiar credenciales según el checkbox
    if (this.rememberMe) {
      localStorage.setItem('sc_remember_email', this.credentials.email);
      localStorage.setItem('sc_remember_me', 'true');
      //console.log('💾 Credenciales guardadas para próxima vez');
    } else {
      localStorage.removeItem('sc_remember_email');
      localStorage.removeItem('sc_remember_me');
      //console.log('🗑️ Credenciales removidas del localStorage');
    }

    this.isLoading = true;

    this.authService.login(this.credentials).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        if (response?.token) return;

        // Si backend indica cuenta no activada en response.code === 2 -> redirigir
        if (response?.code === 2) {
          this.router.navigate(['/auth/verify-account'], {
            queryParams: { email: this.credentials.email, from: 'login' },
          });
        }
      },
      error: (error) => {
        this.isLoading = false;

        this.isLoading = false;

        // Por si el backend devolviera error en vez de next; detectamos code en err
        const codeErr = error?.error?.code ?? error?.code;
        if (codeErr === 2) {
          this.router.navigate(['/auth/verify-account'], {
            queryParams: { email: this.credentials.email, from: 'login' },
          });
        }
      },
    });
  }

  onVerifiedFromChild() {
    this.showVerify = false;
    // Reintentar login automáticamente (opcional). Aquí lo reintentamos.
    this.onSubmit();
  }
}
