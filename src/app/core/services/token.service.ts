import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Gestiona tokens de seguridad (JWT y CSRF)
 * Almacenamiento en memoria para mayor seguridad (no localStorage)
 */
@Injectable({
  providedIn: 'root'
})
export class TokenService {
  private http = inject(HttpClient);

  // Almacenamiento en memoria (no persiste entre recargas, más seguro)
  private accessToken = new BehaviorSubject<string | null>(null);
  private csrfToken = new BehaviorSubject<string | null>(null);

  // Keys para sessionStorage (temporal, más seguro que localStorage)
  private readonly ACCESS_TOKEN_KEY = 'auth:access_token';
  private readonly CSRF_TOKEN_KEY = 'auth:csrf_token';
  private readonly TOKEN_EXPIRY_KEY = 'auth:token_expiry';

  constructor() {
    this.loadTokensFromSession();
  }

  /**
   * Obtener Access Token observable
   */
  getAccessToken$(): Observable<string | null> {
    return this.accessToken.asObservable();
  }

  /**
   * Obtener Access Token sincronamente
   */
  getAccessToken(): string | null {
    return this.accessToken.value || sessionStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  /**
   * Guardar Access Token (en memoria + sessionStorage)
   */
  setAccessToken(token: string, expiresIn: number = 3600000) {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(this.ACCESS_TOKEN_KEY, token);
      sessionStorage.setItem(this.TOKEN_EXPIRY_KEY, (Date.now() + expiresIn).toString());
    }
    this.accessToken.next(token);
  }

  /**
   * Obtener CSRF Token
   */
  getCsrfToken(): string | null {
    return this.csrfToken.value || sessionStorage.getItem(this.CSRF_TOKEN_KEY);
  }

  /**
   * Guardar CSRF Token
   */
  setCsrfToken(token: string) {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(this.CSRF_TOKEN_KEY, token);
    }
    this.csrfToken.next(token);
  }

  /**
   * Generar CSRF Token (mock - en producción obtener del servidor)
   */
  generateCsrfToken(): string {
    const token = this.generateRandomToken(32);
    this.setCsrfToken(token);
    return token;
  }

  /**
   * Verificar si el token ha expirado
   */
  isTokenExpired(): boolean {
    const expiry = sessionStorage.getItem(this.TOKEN_EXPIRY_KEY);
    if (!expiry) return false;

    return Date.now() > parseInt(expiry);
  }

  /**
   * Obtener tiempo restante del token (ms)
   */
  getTokenExpiryTime(): number {
    const expiry = sessionStorage.getItem(this.TOKEN_EXPIRY_KEY);
    if (!expiry) return 0;

    const remaining = parseInt(expiry) - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Limpiar tokens
   */
  clearTokens() {
    this.accessToken.next(null);
    this.csrfToken.next(null);

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(this.ACCESS_TOKEN_KEY);
      sessionStorage.removeItem(this.CSRF_TOKEN_KEY);
      sessionStorage.removeItem(this.TOKEN_EXPIRY_KEY);
    }
  }

  /**
   * Generar token aleatorio criptográfico
   */
  private generateRandomToken(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';

    if (typeof window !== 'undefined' && window.crypto) {
      const array = new Uint8Array(length);
      window.crypto.getRandomValues(array);
      array.forEach(i => {
        token += chars[i % chars.length];
      });
    } else {
      // Fallback para ambientes sin crypto
      for (let i = 0; i < length; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }

    return token;
  }

  /**
   * Cargar tokens desde sessionStorage (restaurar después de refresh)
   */
  private loadTokensFromSession() {
    if (typeof sessionStorage === 'undefined') return;

    const token = sessionStorage.getItem(this.ACCESS_TOKEN_KEY);
    const csrf = sessionStorage.getItem(this.CSRF_TOKEN_KEY);

    if (token && !this.isTokenExpired()) {
      this.accessToken.next(token);
    }

    if (csrf) {
      this.csrfToken.next(csrf);
    }
  }
}
