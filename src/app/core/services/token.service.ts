import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { jwtDecode } from 'jwt-decode';

interface JwtPayload {
  exp?: number;
  sessionId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TokenService {
  private readonly ACCESS_TOKEN_KEY = 'auth:access_token';
  private readonly REFRESH_TOKEN_KEY = 'auth:refresh_token';
  private readonly SESSION_ID_KEY = 'auth:session_id';

  private accessToken$ = new BehaviorSubject<string | null>(null);
  private refreshToken$ = new BehaviorSubject<string | null>(null);
  private sessionId$ = new BehaviorSubject<string | null>(null);

  constructor() {
    this.restoreFromStorage();
  }

  getAccessTokenChanges(): Observable<string | null> {
    return this.accessToken$.asObservable();
  }

  getAccessToken(): string | null {
    return this.accessToken$.value;
  }

  getRefreshToken(): string | null {
    return this.refreshToken$.value;
  }

  getSessionId(): string | null {
    return this.sessionId$.value ?? localStorage.getItem(this.SESSION_ID_KEY);
  }

  setAccessToken(token: string | null): void {
    this.accessToken$.next(token);

    if (token) {
      const payload = this.decodeToken(token);
      if (payload?.sessionId) {
        this.setSessionId(payload.sessionId);
      }
    }

    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(this.ACCESS_TOKEN_KEY);
  }

  setRefreshToken(token: string | null): void {
    this.refreshToken$.next(token);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(this.REFRESH_TOKEN_KEY);
  }

  setSessionId(sessionId: string | null): void {
    this.sessionId$.next(sessionId);

    if (sessionId) {
      localStorage.setItem(this.SESSION_ID_KEY, sessionId);
      sessionStorage.removeItem(this.SESSION_ID_KEY);
      return;
    }

    localStorage.removeItem(this.SESSION_ID_KEY);
    sessionStorage.removeItem(this.SESSION_ID_KEY);
  }

  setSessionTokens(accessToken: string, refreshToken: string, sessionId?: string): void {
    this.setAccessToken(accessToken);
    this.setRefreshToken(refreshToken);
    if (sessionId) {
      this.setSessionId(sessionId);
    }
  }

  isAccessTokenExpired(bufferSeconds = 0): boolean {
    const token = this.getAccessToken();
    if (!token) {
      return true;
    }

    const payload = this.decodeToken(token);
    if (!payload?.exp) {
      return true;
    }

    return payload.exp * 1000 <= Date.now() + bufferSeconds * 1000;
  }

  clearTokens(): void {
    this.accessToken$.next(null);
    this.refreshToken$.next(null);
    this.sessionId$.next(null);

    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.SESSION_ID_KEY);
    sessionStorage.removeItem(this.ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(this.REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(this.SESSION_ID_KEY);
  }

  private restoreFromStorage(): void {
    const sessionId = localStorage.getItem(this.SESSION_ID_KEY) ?? sessionStorage.getItem(this.SESSION_ID_KEY);
    this.accessToken$.next(null);
    this.refreshToken$.next(null);

    if (sessionId) {
      this.sessionId$.next(sessionId);
      localStorage.setItem(this.SESSION_ID_KEY, sessionId);
      sessionStorage.removeItem(this.SESSION_ID_KEY);
    }

    // Limpia tokens heredados de implementaciones anteriores.
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(this.ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(this.REFRESH_TOKEN_KEY);
  }

  private decodeToken(token: string): JwtPayload | null {
    try {
      return jwtDecode<JwtPayload>(token);
    } catch {
      return null;
    }
  }
}
