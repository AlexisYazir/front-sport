import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../environments/environment';
import { LoginResponse } from '../models/user.model';
import { AuthService } from './auth.service';

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
  private authService = inject(AuthService);

  private readonly API_URL = environment.apiUrl;

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
        itp_support: true,
      });
    } catch (error) {
      console.error('Error inicializando Google:', error);
    }
  }

  renderGoogleButton(elementId: string, options?: any): void {
    try {
      const defaultOptions = {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        ...options,
      };

      google.accounts.id.renderButton(
        document.getElementById(elementId),
        defaultOptions,
      );
    } catch (error) {
      console.error('Error renderizando botón de Google:', error);
    }
  }

  private handleGoogleResponse(response: any): void {
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
      console.error('Error procesando respuesta de Google:', error);
      this.toastr.error('Error al procesar autenticación', 'Error');
    } finally {
      this.authService.setAuthenticationInProgress(false);
    }
  }

  private handleLoginError(error: any): void {
    const message =
      error.error?.message ||
      error.error?.error ||
      'Error al autenticarse con Google';

    this.toastr.error(message, 'Error de Autenticación');
    this.authService.setAuthenticationInProgress(false);
  }

  logout(): void {
    try {
      google.accounts.id.disableAutoSelect();
    } catch (error) {
      console.error('Error deshabilitando Google auto select:', error);
    }

    this.authService.logout();
  }

  isGoogleAvailable(): boolean {
    return typeof google !== 'undefined' && google.accounts && google.accounts.id;
  }

  private getDeviceName(): string {
    if (typeof navigator === 'undefined') {
      return 'unknown-device';
    }

    return navigator.userAgent.slice(0, 150);
  }
}
