import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  Observable,
  BehaviorSubject,
  catchError,
  finalize,
  map,
  of,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { jwtDecode } from 'jwt-decode';
import { environment } from '../../../environments/environment';
import {
  User,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  AuthState,
  UserRole,
  getDashboardRoute,
  UsersAdmin,
  RecentUserCreated,
  Roles,
  UpdateProfileData,
  UpdateProfileResponse,
} from '../models/user.model';
import { TokenService } from './token.service';
import { SessionService } from './session.service';

interface JwtPayload {
  id_usuario: number;
  email: string;
  rol: number;
  nombre: string;
  aPaterno?: string;
  aMaterno?: string;
  telefono?: string;
  exp: number;
  sessionId?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private toastr = inject(ToastrService);
  private tokenService = inject(TokenService);
  private sessionService = inject(SessionService);

  public isLoading = signal<boolean>(false);
  public currentUser = signal<User | null>(null);
  public isAuthenticated = signal<boolean>(false);

  private readonly API_URL = environment.apiUrl;
  private readonly USER_KEY = environment.storageKeys.user;
  private readonly TOKEN_BUFFER_SECONDS = environment.tokenExpirationBuffer ?? 300;

  private authState$ = new BehaviorSubject<AuthState>({
    isAuthenticated: false,
    user: null,
    accessToken: null,
    sessionId: null,
  });

  private authenticationInProgress = false;
  private navigationInProgress = false;
  private refreshRequest$?: Observable<string>;

  constructor() {
    this.loadAuthState();
    this.initializeStorageSync();
  }

  currentUser$(): Observable<User | null> {
    return this.authState$.asObservable().pipe(map((state) => state.user));
  }

  private loadAuthState(): void {
    const token = this.tokenService.getAccessToken();
    const refreshToken = this.tokenService.getRefreshToken();
    const storedUser = this.getStoredUser();

    if (!storedUser) {
      this.clearAuthState(false);
      return;
    }

    if (!token && refreshToken) {
      this.updateAuthState(true, storedUser, null, this.tokenService.getSessionId());
      this.sessionService.startInactivityCountdown();
      return;
    }

    if (!token) {
      this.clearAuthState(false);
      return;
    }

    const tokenData = this.decodeToken(token);
    if (!tokenData) {
      this.clearAuthState(false);
      return;
    }

    if (this.isTokenExpired(token) && refreshToken) {
      this.updateAuthState(true, storedUser, null, tokenData.sessionId ?? this.tokenService.getSessionId());
      this.sessionService.startInactivityCountdown();
      return;
    }

    if (this.isTokenExpired(token)) {
      this.clearAuthState(false);
      return;
    }

    const user = this.buildUserFromToken(tokenData, storedUser);
    this.updateAuthState(true, user, token, tokenData.sessionId ?? this.tokenService.getSessionId());
    this.sessionService.startInactivityCountdown();
  }

  private getStoredUser(): User | null {
    try {
      const rawUser = localStorage.getItem(this.USER_KEY);
      return rawUser ? (JSON.parse(rawUser) as User) : null;
    } catch {
      return null;
    }
  }

  private initializeStorageSync(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('storage', (event) => {
      const relevantKeys = new Set([
        this.USER_KEY,
        'auth:access_token',
        'auth:refresh_token',
        'auth:session_id',
      ]);

      if (!event.key || relevantKeys.has(event.key)) {
        this.loadAuthState();
      }
    });
  }

  private buildUserFromToken(tokenData: JwtPayload, fallback?: Partial<User>): User {
    return {
      id: tokenData.id_usuario,
      email: tokenData.email,
      rol: tokenData.rol,
      nombre: tokenData.nombre ?? fallback?.nombre ?? '',
      aPaterno: tokenData.aPaterno ?? fallback?.aPaterno ?? '',
      aMaterno: tokenData.aMaterno ?? fallback?.aMaterno ?? '',
      telefono: tokenData.telefono ?? fallback?.telefono ?? '',
      activo: fallback?.activo ?? 1,
      fecha_creacion: fallback?.fecha_creacion,
      updatedAt: fallback?.updatedAt,
    };
  }

  private isTokenExpired(token: string): boolean {
    const decoded = this.decodeToken(token);
    if (!decoded?.exp) {
      return true;
    }

    return decoded.exp * 1000 <= Date.now();
  }

  private updateAuthState(
    isAuth: boolean,
    user: User | null,
    accessToken: string | null,
    sessionId: string | null,
  ): void {
    this.authState$.next({
      isAuthenticated: isAuth,
      user,
      accessToken,
      sessionId,
    });
    this.currentUser.set(user);
    this.isAuthenticated.set(isAuth);
  }

  private storeUser(user: User): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    localStorage.setItem('auth_timestamp', new Date().toISOString());
  }

  private persistAuthSession(response: LoginResponse, user: User): void {
    this.tokenService.setSessionTokens(
      response.accessToken,
      response.refreshToken,
      response.sessionId,
    );
    this.storeUser(user);
    this.updateAuthState(true, user, response.accessToken, response.sessionId);
    this.sessionService.startInactivityCountdown();
    this.sessionService.clearFailedAttempts(user.email);
  }

  private decodeToken(token: string): JwtPayload | null {
    try {
      return jwtDecode<JwtPayload>(token);
    } catch {
      return null;
    }
  }

  private getDeviceName(): string {
    if (typeof navigator === 'undefined') {
      return 'unknown-device';
    }

    return navigator.userAgent.slice(0, 150);
  }

  handleAuthenticationResponse(
    response: LoginResponse,
    options?: { navigate?: boolean; successMessage?: string },
  ): User {
    const tokenData = this.decodeToken(response.accessToken);

    if (!tokenData) {
      throw new Error('Token inválido');
    }

    const existingUser = this.getStoredUser() ?? undefined;
    const user = this.buildUserFromToken(tokenData, existingUser);
    this.persistAuthSession(response, user);

    if (options?.successMessage) {
      this.toastr.success(options.successMessage, 'Login Exitoso');
    }

    if (options?.navigate !== false) {
      this.setNavigationInProgress(true);
      const dashboardRoute = getDashboardRoute(user.rol);
      this.router.navigate([dashboardRoute]).finally(() => {
        this.setNavigationInProgress(false);
      });
    }

    return user;
  }

  clearAuthState(redirect = false): void {
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem('auth_timestamp');
    this.tokenService.clearTokens();
    this.sessionService.clearSession();
    this.updateAuthState(false, null, null, null);

    if (redirect) {
      this.router.navigate(['/home']);
    }
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    if (this.sessionService.checkAccountLock(credentials.email)) {
      const remainingTime = this.sessionService.getRemainingLockTime(credentials.email);
      const minutes = Math.ceil(remainingTime / 60);

      this.toastr.error(
        `Tu cuenta está bloqueada por ${minutes} minuto(s) debido a múltiples intentos fallidos.`,
        'Cuenta Bloqueada',
      );

      return throwError(() => new Error('Account locked'));
    }

    const payload = {
      ...credentials,
      deviceName: credentials.deviceName ?? this.getDeviceName(),
    };

    return this.http.post<LoginResponse>(`${this.API_URL}/users/login-user`, payload).pipe(
      tap((response) => {
        this.handleAuthenticationResponse(response, {
          navigate: true,
          successMessage: '¡Bienvenido!',
        });
      }),
      catchError((error) => {
        this.sessionService.recordFailedAttempt(credentials.email);

        if (this.sessionService.checkAccountLock(credentials.email)) {
          this.sessionService.lockAccount(credentials.email);
          this.toastr.error(
            'Tu cuenta ha sido bloqueada por múltiples intentos fallidos. Intenta nuevamente en 5 minutos.',
            'Cuenta Bloqueada',
          );
        } else {
          const failedAttempts = this.sessionService.getFailedAttempts(credentials.email);
          const remaining = Math.max(0, 5 - failedAttempts);
          const message =
            error.error?.message ||
            error.error?.error ||
            'Error al iniciar sesión. Verifica tus credenciales.';

          this.toastr.error(
            `${message} (${remaining} intentos restantes)`,
            'Error de Autenticación',
          );
        }

        return throwError(() => error);
      }),
    );
  }

  refreshAccessToken(): Observable<string> {
    const refreshToken = this.tokenService.getRefreshToken();

    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    if (this.refreshRequest$) {
      return this.refreshRequest$;
    }

    this.refreshRequest$ = this.http
      .post<LoginResponse>(`${this.API_URL}/users/refresh-token`, { refreshToken })
      .pipe(
        map((response) => {
          const user = this.currentUser() ?? this.getStoredUser();
          if (!user) {
            throw new Error('No user available for refreshed session');
          }

          this.persistAuthSession(response, user);
          return response.accessToken;
        }),
        finalize(() => {
          this.refreshRequest$ = undefined;
        }),
        shareReplay(1),
      );

    return this.refreshRequest$;
  }

  logout(notifyServer = true): void {
    const finalizeLogout = () => {
      this.clearAuthState(false);
      this.router.navigate(['/home']);
    };

    if (!notifyServer || !this.tokenService.getAccessToken()) {
      finalizeLogout();
      return;
    }

    this.http.post(`${this.API_URL}/users/logout`, {}).pipe(
      catchError(() => of(null)),
      finalize(() => finalizeLogout()),
    ).subscribe();
  }

  getToken(): string | null {
    return this.tokenService.getAccessToken();
  }

  getCurrentUser(): User | null {
    return this.currentUser();
  }

  isLoggedIn(): boolean {
    return (
      this.isAuthenticated() &&
      (!!this.tokenService.getAccessToken() || !!this.tokenService.getRefreshToken())
    );
  }

  hasRole(role: UserRole): boolean {
    const user = this.currentUser();
    return user !== null && user.rol === role;
  }

  hasAnyRole(roles: UserRole[]): boolean {
    const user = this.currentUser();
    return user !== null && roles.includes(user.rol);
  }

  getAuthState(): Observable<AuthState> {
    return this.authState$.asObservable();
  }

  isUserActive(): boolean {
    const user = this.currentUser();
    return user !== null && user.activo === 1;
  }

  updateCurrentUser(user: User): void {
    this.storeUser(user);
    this.updateAuthState(
      true,
      user,
      this.tokenService.getAccessToken(),
      this.tokenService.getSessionId(),
    );
  }

  getSessionStatus() {
    return {
      isActive: this.sessionService.isActive(),
      remainingTime: this.sessionService.remainingTime(),
      isLocked: this.sessionService.isAccountLocked(),
    };
  }

  setAuthenticationInProgress(inProgress: boolean): void {
    this.authenticationInProgress = inProgress;
  }

  isAuthenticationInProgress(): boolean {
    return this.authenticationInProgress;
  }

  setNavigationInProgress(inProgress: boolean): void {
    this.navigationInProgress = inProgress;
  }

  isNavigationInProgress(): boolean {
    return this.navigationInProgress;
  }

  shouldRefreshSoon(): boolean {
    return this.tokenService.isAccessTokenExpired(this.TOKEN_BUFFER_SECONDS);
  }

  register(userData: RegisterRequest): Observable<any> {
    const registerData = {
      ...userData,
      rol: UserRole.USUARIO,
      activo: 1,
    };

    return this.http.post<any>(`${this.API_URL}/users/create-user`, registerData).pipe(
      tap((response) => {
        if (response && response.id_usuario) {
          this.toastr.success('Tu cuenta ha sido creada exitosamente.', 'Registro Exitoso');
        } else {
          this.toastr.error('Error en el registro', 'Error');
        }
      }),
      catchError((error) => {
        const message =
          error.error?.message ||
          error.error?.error ||
          'Error al registrar usuario. El email podría estar en uso.';
        this.toastr.error(message, 'Error de Registro');
        return throwError(() => error);
      }),
    );
  }

  requestPasswordReset(email: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/users/verify-user-email`, { email }).pipe(
      tap(() => {
        this.toastr.success('Código enviado a tu email', 'Código Enviado');
      }),
      catchError((error) => {
        const message =
          error.error?.message || 'Error al solicitar recuperación. Verifica que el email existe.';
        this.toastr.error(message, 'Error');
        return throwError(() => error);
      }),
    );
  }

  verifyRecoveryCode(email: string, token: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/users/verify-email`, { email, token }).pipe(
      tap(() => {
        this.toastr.success('Código verificado correctamente', 'Verificación exitosa');
      }),
      catchError((error) => {
        const message = error.error?.message || 'Código inválido o expirado.';
        this.toastr.error(message, 'Error');
        return throwError(() => error);
      }),
    );
  }

  resetPassword(email: string, newPassword: string, token: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/users/reset-psw`, {
      email,
      psw: newPassword,
      token,
    }).pipe(
      tap(() => {
        this.toastr.success(
          'Contraseña restablecida correctamente. Inicia sesión con tu nueva contraseña.',
          'Éxito',
        );
      }),
      catchError((error) => {
        const message = error.error?.message || 'Error al restablecer la contraseña.';
        this.toastr.error(message, 'Error');
        return throwError(() => error);
      }),
    );
  }

  requestResendCode(email: string): Observable<any> {
    const base = this.API_URL?.replace(/\/+$/, '');
    return this.http.post<any>(`${base}/users/resend-code`, { email }).pipe(
      tap(() => {
        this.toastr.success('Código reenviado. Revisa tu bandeja de entrada.', 'Enviado');
      }),
      catchError((error) => {
        const message = error?.error?.message || 'No se pudo reenviar el código.';
        this.toastr.error(message, 'Error');
        return throwError(() => error);
      }),
    );
  }

  private mapRecentUserCreatedFromApi(u: any): RecentUserCreated {
    return {
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
      activo: u.activo,
      fecha_creacion: u.fecha_creacion,
    };
  }

  private mapUsersAdminFromApi(u: any): UsersAdmin {
    return {
      id_usuario: u.id_usuario,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
      activo: u.activo,
      fecha_creacion: u.fecha_creacion,
    };
  }

  private mapRolesFromApi(r: any): Roles {
    return {
      id_rol: r.id_rol,
      rol: r.rol,
    };
  }

  getRecentUsers(): Observable<RecentUserCreated[]> {
    this.isLoading.set(true);

    return this.http.get<any[]>(`${this.API_URL}/users/get-recent-users-created`).pipe(
      map((response) => response.map((u) => this.mapRecentUserCreatedFromApi(u))),
      finalize(() => this.isLoading.set(false)),
    );
  }

  getUsers(): Observable<UsersAdmin[]> {
    this.isLoading.set(true);

    return this.http.get<any[]>(`${this.API_URL}/users/get-users`).pipe(
      map((response) => response.map((u) => this.mapUsersAdminFromApi(u))),
      finalize(() => this.isLoading.set(false)),
    );
  }

  getRoles(): Observable<Roles[]> {
    this.isLoading.set(true);

    return this.http.get<any[]>(`${this.API_URL}/users/get-roles`).pipe(
      map((response) => response.map((u) => this.mapRolesFromApi(u))),
      finalize(() => this.isLoading.set(false)),
    );
  }

  getProfile(): Observable<any> {
    return this.http.get(`${this.API_URL}/users/profile`);
  }

  updateProfile(data: UpdateProfileData): Observable<UpdateProfileResponse> {
    return this.http.patch<UpdateProfileResponse>(`${this.API_URL}/users/update-profile`, data).pipe(
      tap((response) => {
        const currentUser = this.currentUser();
        if (currentUser) {
          this.updateCurrentUser({
            ...currentUser,
            ...response.user,
          });
        }
      }),
    );
  }

  updateUserFromAdmin(data: { id_usuario: number; activo: number; rol: number }): Observable<any> {
    this.isLoading.set(true);

    return this.http.patch(`${this.API_URL}/users/update-user`, data).pipe(
      finalize(() => this.isLoading.set(false)),
    );
  }
}
