import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../environments/environment';
import { LoginResponse } from '../models/user.model';
import { AuthService } from './auth.service';
import { frontendLogger } from './frontend-logger.service';
import { apiErrorMessage } from './api-contracts';

interface GoogleCredentialResponse { credential: string; select_by?: string }
export interface GoogleButtonOptions {
  type?: 'standard' | 'icon'; theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small'; text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'; logo_alignment?: 'left' | 'center';
  width?: string | number; locale?: string; click_listener?: () => void;
}
interface GoogleIdentityApi {
  initialize(options: { client_id: string; callback: (response: GoogleCredentialResponse) => void;
    auto_select: boolean; itp_support: boolean }): void;
  renderButton(element: HTMLElement, options: GoogleButtonOptions): void;
  disableAutoSelect(): void;
}
declare const google: { accounts: { id: GoogleIdentityApi } };

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
  private authService = inject(AuthService);

  private readonly API_URL = environment.apiUrl;

  initializeGoogle(clientId: string): void {
    if (!clientId) {
      frontendLogger.error('Google Client ID no está configurado');
      return;
    }

    try {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: GoogleCredentialResponse) => this.handleGoogleResponse(response),
        auto_select: false,
        itp_support: true,
      });
    } catch (error) {
      frontendLogger.error('Error inicializando Google', error);
    }
  }

  renderGoogleButton(elementId: string, options?: GoogleButtonOptions): void {
    try {
      const defaultOptions: GoogleButtonOptions = {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        ...options,
      };

      const element = document.getElementById(elementId);
      if (!element) throw new Error('No se encontró el contenedor del botón de Google');
      google.accounts.id.renderButton(element, defaultOptions);
    } catch (error) {
      frontendLogger.error('Error renderizando botón de Google', error);
    }
  }

  private handleGoogleResponse(response: GoogleCredentialResponse): void {
    if (!response.credential) {
      this.toastr.error('Error en autenticación de Google', 'Error');
      return;
    }

    this.loginWithGoogle(response.credential);
  }

  loginWithGoogle(idToken: string): void {
    this.authService.setAuthenticationInProgress(true);

    this.http.post<LoginResponse>(
      `${this.API_URL}/users/auth/google-login`,
      { idToken, deviceName: this.getDeviceName() },
    ).subscribe({
      next: (response) => this.handleLoginSuccess(response),
      error: (error) => this.handleLoginError(error),
    });
  }

  private handleLoginSuccess(response: LoginResponse): void {
    try {
      this.authService.handleAuthenticationResponse(response, {
        navigate: true,
        successMessage: '¡Bienvenido! Autenticación exitosa',
      });
    } catch (error) {
      frontendLogger.error('Error procesando respuesta de Google', error);
      this.toastr.error('Error al procesar autenticación', 'Error');
    } finally {
      this.authService.setAuthenticationInProgress(false);
    }
  }

  private handleLoginError(error: unknown): void {
    const message = apiErrorMessage(error, 'Error al autenticarse con Google');

    this.toastr.error(message, 'Error de Autenticación');
    this.authService.setAuthenticationInProgress(false);
  }

  logout(): void {
    try {
      google.accounts.id.disableAutoSelect();
    } catch (error) {
      frontendLogger.error('Error deshabilitando Google auto select', error);
    }

    this.authService.logout();
  }

  isGoogleAvailable(): boolean {
    return typeof google !== 'undefined' && Boolean(google.accounts?.id);
  }

  private getDeviceName(): string {
    if (typeof navigator === 'undefined') {
      return 'unknown-device';
    }

    return navigator.userAgent.slice(0, 150);
  }
}
