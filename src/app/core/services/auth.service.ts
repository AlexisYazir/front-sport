import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, BehaviorSubject, tap, catchError, throwError, map } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { jwtDecode } from 'jwt-decode';
import { environment } from '../../../environments/environment';
import {
  User,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  AuthState,
  UserRole,
  getDashboardRoute,
  UsersAdmin,
  RecentUserCreated,
  Roles,
  UpdateProfileData,
  UpdateProfileResponse
} from '../models/user.model';
import { TokenService } from './token.service';
import { SessionService } from './session.service';
import { CsrfTokenService } from './csrf-token.service';

interface JwtPayload {
  id_usuario: number;
  email: string;
  rol: number;
  nombre: string;
  aPaterno?: string;
  aMaterno?: string;
  telefono?: string;
  exp: number;
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
  private csrfTokenService = inject(CsrfTokenService);
  public isLoading = signal<boolean>(false);

  // API Base URL desde environment
  private readonly API_URL = environment.apiUrl;

  // Storage keys desde environment
  private readonly TOKEN_KEY = environment.storageKeys.token;

  // Auth State usando BehaviorSubject para reactividad
  private authState$ = new BehaviorSubject<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
  });

  private mapRecentUserCreatedFromApi(u: any): RecentUserCreated {
    return {
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
      activo: u.activo,
      fecha_creacion: u.fecha_creacion
    }
  }

  private mapUsersAdminFromApi(u: any): UsersAdmin {
    return {
      id_usuario: u.id_usuario,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
      activo: u.activo,
      fecha_creacion: u.fecha_creacion
    }
  }

  private mapRolesFromApi(r: any): Roles {
    return {
      id_rol: r.id_rol,
      rol: r.rol
    }
  }

  // Signals para estado reactivo (Angular 18+)
  public currentUser = signal<User | null>(null);
  public isAuthenticated = signal<boolean>(false);

  // Flag para indicar si hay autenticación en progreso (ej: Google OAuth)
  private authenticationInProgress = false;

  // Flag para indicar si AuthService ya está redirigiendo
  private navigationInProgress = false;

  constructor() {
    this.loadAuthState();
  }

  
  /**
   * Observable del usuario actual para reactividad
   */
  currentUser$(): Observable<User | null> {
    return this.authState$.asObservable().pipe(map((state) => state.user));
  }

  /**
   * Cargar estado de autenticación desde localStorage
   */
  private loadAuthState(): void {
    try {
      const token = localStorage.getItem(this.TOKEN_KEY);

      if (!token) return;

      if (this.isTokenExpired(token)) {
        // console.warn('Token expirado, limpiando sesión');
        this.clearAuthState();
        return;
      }

      const tokenData = this.decodeToken(token);

      if (!tokenData) {
        this.clearAuthState();
        return;
      }

      const user: User = {
        id: tokenData.id_usuario,
        email: tokenData.email,
        rol: tokenData.rol,
        nombre: tokenData.nombre,
        aPaterno: '',
        aMaterno: '',
        telefono: '',
        activo: 1
      };

      this.updateAuthState(true, user, token);

      this.tokenService.setAccessToken(token);
      this.csrfTokenService.initializeCsrfProtection();
      this.sessionService.startInactivityCountdown();

    } catch (error) {
      // console.error('Error loading auth state:', error);
      this.clearAuthState();
    }
  }

  /**
   * Verificar si el token JWT está expirado
   */
  private isTokenExpired(token: string): boolean {
    try {
      const decoded = this.decodeToken(token);

      if (!decoded || !decoded.exp) {
        return true;
      }

      const expirationDate = new Date(decoded.exp * 1000);
      const now = new Date();

      return expirationDate < now;
    } catch (error) {
      // console.error('Error checking token expiration:', error);
      return true;
    }
  }

  /**
   * Actualizar estado de autenticación
   */
  private updateAuthState(isAuth: boolean, user: User | null, token: string | null): void {
    this.authState$.next({
      isAuthenticated: isAuth,
      user,
      token,
    });
    this.currentUser.set(user);
    this.isAuthenticated.set(isAuth);
  }

  /**
   * Guardar datos de autenticación
   */
  private saveAuthData(token: string, user: User): void {
    try {

      localStorage.setItem(this.TOKEN_KEY, token);
      localStorage.setItem('auth_timestamp', new Date().toISOString());

      this.tokenService.setAccessToken(token);
      this.csrfTokenService.initializeCsrfProtection();

      this.updateAuthState(true, user, token);

      this.sessionService.startInactivityCountdown();
      this.sessionService.clearFailedAttempts(user.email);

    } catch (error) {
      // console.error('Error al guardar la sesión:', error);
      this.toastr.error('Error al guardar la sesión', 'Error');
    }
  }
private clearAllStorage(): void {
  // Limpiar TODAS las keys relacionadas con auth
  const keysToRemove = [
    this.TOKEN_KEY,
    'auth_timestamp',
    'auth:token',
    'auth:user',
    'auth:access_token',
    'auth:refresh_token',
    'auth:csrf_token',
    'auth:last_activity',
    'auth:failed_attempts',
    'auth:lock_time'
  ];
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });
  
  // También limpiar cualquier key que empiece con 'auth:'
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('auth:') || key.includes('failed_attempts') || key.includes('lock_time')) {
      localStorage.removeItem(key);
    }
  });
  
  // Limpiar sessionStorage también por si acaso
  sessionStorage.clear();
}
  /**
   * Limpiar estado de autenticación
   */
public clearAuthState(): void {
  // Limpiar TODO el storage
  this.clearAllStorage();

  // Limpiar tokens en servicios
  this.tokenService.clearTokens();
  this.csrfTokenService.clearToken();
  
  // Limpiar timers de sesión
  this.sessionService.clearSession();

  // Resetear signals
  this.updateAuthState(false, null, null);
  
  // Forzar actualización del signal
  this.currentUser.set(null);
  this.isAuthenticated.set(false);
}

  /**
   * LOGIN - Iniciar sesión
   */
  login(credentials: LoginRequest): Observable<any> {

  if (this.sessionService.checkAccountLock(credentials.email)) {
    const remainingTime = this.sessionService.getRemainingLockTime(credentials.email);
    const minutes = Math.ceil(remainingTime / 60000);

    this.toastr.error(
      `Tu cuenta está bloqueada por ${minutes} minuto(s) debido a múltiples intentos fallidos.`,
      'Cuenta Bloqueada'
    );

    return throwError(() => new Error('Account locked'));
  }

  return this.http.post<any>(`${this.API_URL}/users/login-user`, credentials).pipe(
    tap((response) => {

      if (response && response.accessToken && response.refreshToken) {

        const tokenData = this.decodeToken(response.accessToken);

        if (!tokenData) {
          this.toastr.error('Token inválido', 'Error');
          return;
        }

        const user: User = {
          id: tokenData.id_usuario,
          nombre: tokenData.nombre || '',
          aPaterno: tokenData.aPaterno || '',
          aMaterno: tokenData.aMaterno || '',
          email: tokenData.email,
          telefono: tokenData.telefono || '',
          rol: tokenData.rol,
          activo: 1
        };

        // guardar tokens
        this.tokenService.setAccessToken(response.accessToken);
        this.tokenService.setRefreshToken(response.refreshToken);

        this.saveAuthData(response.accessToken, user);

        this.toastr.success(`¡Bienvenido!`, 'Login Exitoso');

        this.setNavigationInProgress(true);

        const dashboardRoute = getDashboardRoute(user.rol);

        this.router.navigate([dashboardRoute]).then(() => {
          setTimeout(() => {
            this.setNavigationInProgress(false);
          }, 100);
        });

      } else {
        this.toastr.error('Respuesta inválida del servidor', 'Error');
      }

    }),
    catchError((error) => {

      // console.error('Login error:', error);

      this.sessionService.recordFailedAttempt(credentials.email);

      if (this.sessionService.checkAccountLock(credentials.email)) {

        this.sessionService.lockAccount(credentials.email);

        this.toastr.error(
          'Tu cuenta ha sido bloqueada por múltiples intentos fallidos. Intenta nuevamente en 5 minutos.',
          'Cuenta Bloqueada'
        );

      } else {

        const failedAttempts = this.sessionService.getFailedAttempts(credentials.email);
        const remaining = 5 - failedAttempts;

        const message =
          error.error?.message ||
          error.error?.error ||
          'Error al iniciar sesión. Verifica tus credenciales.';

        this.toastr.error(
          `${message} (${remaining} intentos restantes)`,
          'Error de Autenticación'
        );

      }

      return throwError(() => error);
    })
  );
}

  /**
   * Decodificar JWT token (simple, sin validación)
   */
  // private decodeToken(token: string): any {
  //   try {
  //     const payload = token.split('.')[1];
  //     const decoded = atob(payload);
  //     return JSON.parse(decoded);
  //   } catch (error) {
      //console.error('Error decoding token:', error);
  //     return {};
  //   }
  // }

  private decodeToken(token: string): JwtPayload | null {
    try {
      return jwtDecode<JwtPayload>(token);
    } catch (error) {
      // console.error('Error decoding token:', error);
      return null;
    }
  }

  /**
   * REGISTER - Registrar nuevo usuario
   */
  register(userData: RegisterRequest): Observable<any> {
    // Asegurar que el rol sea 1 para registros públicos
    const registerData = {
      ...userData,
      rol: UserRole.USUARIO,
      activo: 1, // Activo por defecto
    };

    return this.http.post<any>(`${this.API_URL}/users/create-user`, registerData).pipe(
      tap((response) => {
        // El backend devuelve el objeto usuario completo
        if (response && response.id_usuario) {
          this.toastr.success('Tu cuenta ha sido creada exitosamente.', 'Registro Exitoso');
          // // Redireccionar a login después de registro
          // setTimeout(() => {
          //   this.router.navigate(['/auth/login']);
          // }, 2000);
        } else {
          this.toastr.error('Error en el registro', 'Error');
        }
      }),
      catchError((error) => {
        // console.error('Register error:', error);
        const message =
          error.error?.message ||
          error.error?.error ||
          'Error al registrar usuario. El email podría estar en uso.';
        this.toastr.error(message, 'Error de Registro');
        return throwError(() => error);
      })
    );
  }

  /**
   * LOGOUT - Cerrar sesión
   */
logout(): void {
  console.log('Cerrando sesión...');
  
  // Limpiar todo
  this.clearAuthState();
  
  // Redirigir al home
  this.router.navigate(['/home']).then(() => {
  });
}

  /**
   * Obtener token actual
   */
  getToken(): string | null {
    return this.tokenService.getAccessToken() || localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Obtener usuario actual
   */
  getCurrentUser(): User | null {
    return this.currentUser();
  }

  /**
   * Verificar si el usuario está autenticado
   */
  isLoggedIn(): boolean {
    return this.isAuthenticated();
  }

  /**
   * Verificar si el usuario tiene un rol específico
   */
  hasRole(role: UserRole): boolean {
    const user = this.currentUser();
    return user !== null && user.rol === role;
  }

  /**
   * Verificar si el usuario tiene al menos uno de los roles especificados
   */
  hasAnyRole(roles: UserRole[]): boolean {
    const user = this.currentUser();
    return user !== null && roles.includes(user.rol);
  }

  /**
   * Obtener observable del estado de autenticación
   */
  getAuthState(): Observable<AuthState> {
    return this.authState$.asObservable();
  }

  /**
   * Verificar si el usuario está activo
   */
  isUserActive(): boolean {
    const user = this.currentUser();
    return user !== null && user.activo === 1;
  }

  /**
   * Actualizar información del usuario actual
   */
  updateCurrentUser(user: User): void {

    this.currentUser.set(user);

    this.isAuthenticated.set(true);

    this.authState$.next({
      isAuthenticated: true,
      user: user,
      token: this.getToken(),
    });

}

  /**
   * Obtener estado de sesión
   */
  getSessionStatus() {
    return {
      isActive: this.sessionService.isActive(),
      remainingTime: this.sessionService.remainingTime(),
      isLocked: this.sessionService.isAccountLocked(),
    };
  }

  /**
   * Establecer flag de autenticación en progreso (Google OAuth, etc)
   */
  setAuthenticationInProgress(inProgress: boolean): void {
    this.authenticationInProgress = inProgress;
    // console.log(`🔄 Autenticación en progreso: ${inProgress}`);
  }

  /**
   * Verificar si hay autenticación en progreso
   */
  isAuthenticationInProgress(): boolean {
    return this.authenticationInProgress;
  }

  /**
   * Establecer flag de navegación en progreso (AuthService redirigiendo)
   */
  setNavigationInProgress(inProgress: boolean): void {
    this.navigationInProgress = inProgress;
  }

  /**
   * Verificar si hay navegación en progreso
   */
  isNavigationInProgress(): boolean {
    return this.navigationInProgress;
  }

  /**
   * FORGOT PASSWORD - Solicitar código de recuperación
   */
  requestPasswordReset(email: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/users/verify-user-email`, { email }).pipe(
      tap((response) => {
        this.toastr.success('Código enviado a tu email', 'Código Enviado');
      }),
      catchError((error) => {
        // console.error('Password reset request error:', error);
        const message =
          error.error?.message || 'Error al solicitar recuperación. Verifica que el email existe.';
        this.toastr.error(message, 'Error');
        return throwError(() => error);
      })
    );
  }

  /**
   * VERIFY CODE - Verificar código de recuperación
   */
  verifyRecoveryCode(email: string, token: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/users/verify-email`, { email, token }).pipe(
      tap((response) => {
        this.toastr.success('Código verificado correctamente', 'Verificación exitosa');
        const base = this.API_URL?.replace(/\/+$/, '');
        const url = `${base}/users/verify-email`;
        // console.log('AuthService.verifyRecoveryCode ->', url, { email, token });
      }),
      catchError((error) => {
        // console.error('Code verification error:', error);
        const message = error.error?.message || 'Código inválido o expirado.';
        this.toastr.error(message, 'Error');
        return throwError(() => error);
      })
    );
  }

  /**
   * RESET PASSWORD - Restablecer contraseña
   */
  resetPassword(email: string, newPassword: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/users/reset-psw`, { email, psw: newPassword }).pipe(
      tap((response) => {
        this.toastr.success(
          'Contraseña restablecida correctamente. Inicia sesión con tu nueva contraseña.',
          'Éxito'
        );
      }),
      catchError((error) => {
        // console.error('Password reset error:', error);
        const message = error.error?.message || 'Error al restablecer la contraseña.';
        this.toastr.error(message, 'Error');
        return throwError(() => error);
      })
    );
  }

  requestResendCode(email: string): Observable<any> {
    // Asegurar que no haya doble "/" en la URL
    const base = this.API_URL?.replace(/\/+$/, '');
    return this.http.post<any>(`${base}/users/resend-code`, { email }).pipe(
      tap(() => {
        this.toastr.success('Código reenviado. Revisa tu bandeja de entrada.', 'Enviado');
      }),
      catchError((error) => {
        // console.error('resend-code error:', error);
        const message = error?.error?.message || 'No se pudo reenviar el código.';
        this.toastr.error(message, 'Error');
        return throwError(() => error);
      })
    );
  }

    getRecentUsers(): Observable<RecentUserCreated[]> {
      this.isLoading.set(true);
  
      return this.http
        .get<any[]>(`${this.API_URL}/users/get-recent-users-created`)
        .pipe(
          map(response => {
            const mapped = response.map(u => this.mapRecentUserCreatedFromApi(u));
            this.isLoading.set(false);
            return mapped;
          })
        );
    }

    getUsers(): Observable<UsersAdmin[]> {
      this.isLoading.set(true);
  
      return this.http
        .get<any[]>(`${this.API_URL}/users/get-users`)
        .pipe(
          map(response => {
            const mapped = response.map(u => this.mapUsersAdminFromApi(u));
            this.isLoading.set(false);
            return mapped;
          })
        );
    }

    getRoles(): Observable<Roles[]> {
      this.isLoading.set(true);
  
      return this.http
        .get<any[]>(`${this.API_URL}/users/get-roles`)
        .pipe(
          map(response => {
            const mapped = response.map(u => this.mapRolesFromApi(u));
            this.isLoading.set(false);
            return mapped;
          })
        );
    }

getProfile(): Observable<any> {
  return this.http.get(`${this.API_URL}/users/profile`);
}

 // Actualizar perfil del usuario (usa PATCH como en tu backend)
  updateProfile(data: UpdateProfileData): Observable<UpdateProfileResponse> {
    return this.http.patch<UpdateProfileResponse>(`${this.API_URL}/users/update-profile`, data);
  }

  updateUserFromAdmin(data: { id_usuario: number, activo: number, rol: number }): Observable<any> {

    this.isLoading.set(true);

    return this.http.patch(`${this.API_URL}/users/update-user`, data).pipe(
      map(res => {
        this.isLoading.set(false);
        return res;
      })
    );

  }
}
