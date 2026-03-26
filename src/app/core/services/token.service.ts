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
    return this.accessToken$.value ?? sessionStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return this.refreshToken$.value ?? sessionStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  getSessionId(): string | null {
    return this.sessionId$.value ?? sessionStorage.getItem(this.SESSION_ID_KEY);
  }

  setAccessToken(token: string | null): void {
    this.accessToken$.next(token);

    if (token) {
      sessionStorage.setItem(this.ACCESS_TOKEN_KEY, token);
      const payload = this.decodeToken(token);
      if (payload?.sessionId) {
        this.setSessionId(payload.sessionId);
      }
      return;
    }

    sessionStorage.removeItem(this.ACCESS_TOKEN_KEY);
  }

  setRefreshToken(token: string | null): void {
    this.refreshToken$.next(token);

    if (token) {
      sessionStorage.setItem(this.REFRESH_TOKEN_KEY, token);
      return;
    }

    sessionStorage.removeItem(this.REFRESH_TOKEN_KEY);
  }

  setSessionId(sessionId: string | null): void {
    this.sessionId$.next(sessionId);

    if (sessionId) {
      sessionStorage.setItem(this.SESSION_ID_KEY, sessionId);
      return;
    }

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

    sessionStorage.removeItem(this.ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(this.REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(this.SESSION_ID_KEY);
  }

  private restoreFromStorage(): void {
    const accessToken = sessionStorage.getItem(this.ACCESS_TOKEN_KEY);
    const refreshToken = sessionStorage.getItem(this.REFRESH_TOKEN_KEY);
    const sessionId = sessionStorage.getItem(this.SESSION_ID_KEY);

    if (accessToken) {
      this.accessToken$.next(accessToken);
    }

    if (refreshToken) {
      this.refreshToken$.next(refreshToken);
    }

    if (sessionId) {
      this.sessionId$.next(sessionId);
    }
  }

  private decodeToken(token: string): JwtPayload | null {
    try {
      return jwtDecode<JwtPayload>(token);
    } catch {
      return null;
    }
  }
}
