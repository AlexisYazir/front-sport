import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../environments/environment';
import { User, UserRole, getDashboardRoute } from '../models/user.model';
import { TokenService } from './token.service';
import { SessionService } from './session.service';
import { CsrfTokenService } from './csrf-token.service';
import { AuthService } from './auth.service';

// Declarar google global desde el script
declare const google: any;

export interface GoogleAuthConfig {
  clientId: string;
}

@Injectable({
  providedIn: 'root'
})
export class GoogleAuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private toastr = inject(ToastrService);
  private tokenService = inject(TokenService);
  private sessionService = inject(SessionService);
  private csrfTokenService = inject(CsrfTokenService);
  private authService = inject(AuthService);

  private readonly API_URL = environment.apiUrl;
  private readonly TOKEN_KEY = environment.storageKeys.token;
  private readonly USER_KEY = environment.storageKeys.user;

  /**
   * Inicializar Google Identity Services
   */
  initializeGoogle(clientId: string): void {
    if (!clientId) {
      console.error('Google Client ID no está configurado');
      return;
    }

    try {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: any) => this.handleGoogleResponse(response),
        auto_select: false,
        itp_support: true
      });


    } catch (error) {
      console.error('Error inicializando Google:', error);
    }
  }

  /**
   * Renderizar botón de Google en un elemento específico
   */
  renderGoogleButton(elementId: string, options?: any): void {
    try {
      const defaultOptions = {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        ...options
      };

      google.accounts.id.renderButton(
        document.getElementById(elementId),
        defaultOptions
      );


    } catch (error) {
      console.error('Error renderizando botón de Google:', error);
    }
  }

  /**
   * Manejar respuesta de Google (ID Token)
   */
  private handleGoogleResponse(response: any): void {
    if (!response.credential) {
      console.error('No se recibió credential de Google');
      this.toastr.error('Error en autenticación de Google', 'Error');
      return;
    }

    const idToken = response.credential;
    this.loginWithGoogle(idToken);
  }

  /**
   * Login con Google - Enviar ID Token al backend
   */
  loginWithGoogle(idToken: string): void {
    // Establecer flag: autenticación en progreso
    this.authService.setAuthenticationInProgress(true);


    this.http.post<any>(
      `${this.API_URL}/users/auth/google-login`,
      { idToken }
    ).subscribe({
      next: (response) => {
        this.handleLoginSuccess(response);
      },
      error: (error) => {
        this.handleLoginError(error);
      }
    });
  }

  /**
   * Manejar login exitoso
   */
  private handleLoginSuccess(response: any): void {
    try {
      if (!response.token && !response.accessToken) {
        throw new Error('No token en respuesta del servidor');
      }

      const token = response.token || response.accessToken;

      // Decodificar token para obtener datos del usuario
      const tokenData = this.decodeToken(token);

      const user: User = {
        id: tokenData.id || tokenData.sub,
        nombre: tokenData.nombre || tokenData.name || '',
        aPaterno: tokenData.aPaterno || '',
        aMaterno: tokenData.aMaterno || '',
        email: tokenData.email,
        telefono: tokenData.telefono || '',
        rol: tokenData.rol || UserRole.USUARIO,
        activo: 1
      };

      // Guardar datos de autenticación
      this.saveAuthData(token, user);

      // Mostrar mensaje de éxito
      this.toastr.success('¡Bienvenido! Autenticación exitosa', 'Login Exitoso');

      // 🔑 Limpiar flag ANTES de redirigir (para que guestGuard no interfiera)
      this.authService.setAuthenticationInProgress(false);

      // Redirigir según rol
      const dashboardRoute = getDashboardRoute(user.rol);

      this.router.navigate([dashboardRoute]);
    } catch (error) {
      console.error('Error procesando respuesta de Google:', error);
      this.toastr.error('Error al procesar autenticación', 'Error');
      // Limpiar flag en caso de error
      this.authService.setAuthenticationInProgress(false);
    }
  }

  /**
   * Manejar error de login
   */
  private handleLoginError(error: any): void {
    console.error('Error en login de Google:', error);
    
    const message = error.error?.message || 
                   error.error?.error || 
                   'Error al autenticarse con Google';
    
    this.toastr.error(message, 'Error de Autenticación');
    
    // Limpiar flag de autenticación en progreso
    this.authService.setAuthenticationInProgress(false);
  }

  /**
   * Guardar datos de autenticación (reutilizar lógica de auth.service)
   */
  private saveAuthData(token: string, user: User): void {
    try {
      localStorage.setItem(this.TOKEN_KEY, token);
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      localStorage.setItem('auth_timestamp', new Date().toISOString());

      this.tokenService.setAccessToken(token);
      this.csrfTokenService.initializeCsrfProtection();

      this.sessionService.clearFailedAttempts(user.email);
      this.sessionService.startInactivityCountdown();

      // 🔑 IMPORTANTE: Actualizar estado en AuthService
      this.authService.updateCurrentUser(user);


    } catch (error) {
      console.error('Error guardando sesión:', error);
      this.toastr.error('Error al guardar la sesión', 'Error');
    }
  }

  /**
   * Decodificar JWT token (simple, sin validación)
   */
  private decodeToken(token: string): any {
    try {
      const payload = token.split('.')[1];
      const decoded = atob(payload);
      return JSON.parse(decoded);
    } catch (error) {
      console.error('Error decodificando token:', error);
      return {};
    }
  }

  /**
   * Logout con Google
   */
  logout(): void {
    try {
      // Deshabilitar auto-select de Google
      google.accounts.id.disableAutoSelect();

      // Limpiar localStorage
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
      localStorage.removeItem('auth_timestamp');

      this.tokenService.clearTokens();
      this.csrfTokenService.clearToken();

      this.toastr.success('Sesión cerrada correctamente', 'Hasta pronto');
      this.router.navigate(['/home']);
    } catch (error) {
      console.error('Error en logout:', error);
      this.router.navigate(['/home']);
    }
  }

  /**
   * Verificar si Google está disponible
   */
  isGoogleAvailable(): boolean {
    return typeof google !== 'undefined' && google.accounts && google.accounts.id;
  }
}
