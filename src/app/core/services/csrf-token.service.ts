import { Injectable, inject } from '@angular/core';
import { TokenService } from './token.service';

/**
 * Servicio para gestionar tokens CSRF (Cross-Site Request Forgery)
 * Protección contra ataques CSRF en operaciones que modifican datos
 */
@Injectable({
  providedIn: 'root'
})
export class CsrfTokenService {
  private tokenService = inject(TokenService);

  private readonly CSRF_HEADER = 'X-CSRF-Token';
  private readonly CSRF_COOKIE = 'XSRF-TOKEN';

  /**
   * Inicializar CSRF (generar nuevo token)
   */
  initializeCsrfProtection(): string {
    let token = this.tokenService.getCsrfToken();

    if (!token) {
      token = this.tokenService.generateCsrfToken();
    }

    return token;
  }

  /**
   * Obtener token CSRF actual
   */
  getToken(): string | null {
    return this.tokenService.getCsrfToken();
  }

  /**
   * Validar token CSRF (verifica que no sea null/vacío)
   */
  validateToken(token: string | null): boolean {
    if (!token || token.trim().length === 0) {
      return false;
    }

    const currentToken = this.getToken();
    return token === currentToken;
  }

  /**
   * Renovar token CSRF (generar uno nuevo)
   */
  regenerateToken(): string {
    return this.tokenService.generateCsrfToken();
  }

  /**
   * Limpiar token CSRF
   */
  clearToken(): void {
    this.tokenService.clearTokens();
  }

  /**
   * Obtener header CSRF para peticiones HTTP
   */
  getCsrfHeaders(): { [key: string]: string } {
    const token = this.getToken();
    if (token) {
      return {
        [this.CSRF_HEADER]: token
      };
    }
    return {};
  }
}
