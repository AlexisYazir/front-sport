import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';

/**
 * Gestiona tokens de seguridad (JWT y CSRF)
 * Almacenamiento en memoria + sessionStorage
 */
@Injectable({
  providedIn: 'root'
})
export class TokenService {

  private http = inject(HttpClient);

  // Tokens en memoria
  private accessToken = new BehaviorSubject<string | null>(null);
  private refreshToken = new BehaviorSubject<string | null>(null);
  private csrfToken = new BehaviorSubject<string | null>(null);

  // Keys sessionStorage
  private readonly ACCESS_TOKEN_KEY = 'auth:access_token';
  private readonly REFRESH_TOKEN_KEY = 'auth:refresh_token';
  private readonly CSRF_TOKEN_KEY = 'auth:csrf_token';
  private readonly TOKEN_EXPIRY_KEY = 'auth:token_expiry';

  constructor() {
    this.loadTokensFromSession();
  }

  /**
   * Observable Access Token
   */
  getAccessToken$(): Observable<string | null> {
    return this.accessToken.asObservable();
  }

  /**
   * Obtener Access Token
   */
  getAccessToken(): string | null {
    return this.accessToken.value || sessionStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  /**
   * Obtener Refresh Token
   */
  getRefreshToken(): string | null {
    return this.refreshToken.value || sessionStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  /**
   * Guardar Access Token
   */
  setAccessToken(token: string, expiresIn: number = 15 * 60 * 1000) {

    if (typeof sessionStorage !== 'undefined') {

      sessionStorage.setItem(this.ACCESS_TOKEN_KEY, token);

      sessionStorage.setItem(
        this.TOKEN_EXPIRY_KEY,
        (Date.now() + expiresIn).toString()
      );

    }

    this.accessToken.next(token);
  }

  /**
   * Guardar Refresh Token
   */
  setRefreshToken(token: string) {

    if (typeof sessionStorage !== 'undefined') {

      sessionStorage.setItem(this.REFRESH_TOKEN_KEY, token);

    }

    this.refreshToken.next(token);
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
   * Generar CSRF Token
   */
  generateCsrfToken(): string {

    const token = this.generateRandomToken(32);

    this.setCsrfToken(token);

    return token;
  }

  /**
   * Verificar expiración del access token
   */
  isTokenExpired(): boolean {

    const expiry = sessionStorage.getItem(this.TOKEN_EXPIRY_KEY);

    if (!expiry) return false;

    return Date.now() > parseInt(expiry);

  }

  /**
   * Tiempo restante del access token
   */
  getTokenExpiryTime(): number {

    const expiry = sessionStorage.getItem(this.TOKEN_EXPIRY_KEY);

    if (!expiry) return 0;

    const remaining = parseInt(expiry) - Date.now();

    return Math.max(0, remaining);

  }

  /**
   * Limpiar todos los tokens
   */
  clearTokens() {
    this.accessToken.next(null);
    this.refreshToken.next(null);
    this.csrfToken.next(null);

    if (typeof sessionStorage !== 'undefined') {

      sessionStorage.removeItem(this.ACCESS_TOKEN_KEY);
      sessionStorage.removeItem(this.REFRESH_TOKEN_KEY);
      sessionStorage.removeItem(this.CSRF_TOKEN_KEY);
      sessionStorage.removeItem(this.TOKEN_EXPIRY_KEY);

    }

  }

  /**
   * Generador criptográfico de tokens
   */
  private generateRandomToken(length: number): string {

    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    let token = '';

    if (typeof window !== 'undefined' && window.crypto) {

      const array = new Uint8Array(length);

      window.crypto.getRandomValues(array);

      array.forEach((i) => {
        token += chars[i % chars.length];
      });

    } else {

      for (let i = 0; i < length; i++) {

        token += chars.charAt(Math.floor(Math.random() * chars.length));

      }

    }

    return token;

  }

  /**
   * Restaurar tokens después de refresh del navegador
   */
  private loadTokensFromSession() {

    if (typeof sessionStorage === 'undefined') return;

    const access = sessionStorage.getItem(this.ACCESS_TOKEN_KEY);
    const refresh = sessionStorage.getItem(this.REFRESH_TOKEN_KEY);
    const csrf = sessionStorage.getItem(this.CSRF_TOKEN_KEY);

    if (access && !this.isTokenExpired()) {
      this.accessToken.next(access);
    }

    if (refresh) {
      this.refreshToken.next(refresh);
    }

    if (csrf) {
      this.csrfToken.next(csrf);
    }

  }
}