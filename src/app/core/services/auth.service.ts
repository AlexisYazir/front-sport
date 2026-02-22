import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, BehaviorSubject, tap, catchError, throwError, map } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
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
  RecentUserCreated
} from '../models/user.model';
import { TokenService } from './token.service';
import { SessionService } from './session.service';
import { CsrfTokenService } from './csrf-token.service';

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
  private readonly USER_KEY = environment.storageKeys.user;

  // Auth State usando BehaviorSubject para reactividad
  private authState$ = new BehaviorSubject<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
  });

    private mapRecentUserCreatedFromApi(u: any): RecentUserCreated {
      return {
        nombre: u.nombre,
        email: u.email,
        rol: u.rol,
        activo: u.activo,
        fecha_creacion: u.fecha_creacion
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
      const userStr = localStorage.getItem(this.USER_KEY);

      if (token && userStr) {
        // Verificar si el token está expirado
        if (this.isTokenExpired(token)) {
          console.warn('Token expirado, limpiando sesión');
          this.clearAuthState();
          return;
        }

        const user = JSON.parse(userStr);
        this.updateAuthState(true, user, token);

        // Inicializar servicios de seguridad
        this.tokenService.setAccessToken(token);
        this.csrfTokenService.initializeCsrfProtection();
        this.sessionService.startInactivityCountdown();
      }
    } catch (error) {
      console.error('Error loading auth state:', error);
      this.clearAuthState();
    }
  }

  /**
   * Verificar si el token JWT está expirado
   */
  private isTokenExpired(token: string): boolean {
    try {
      const decoded = this.decodeToken(token);
      if (!decoded.exp) return false;

      const expirationDate = new Date(decoded.exp * 1000);
      const now = new Date();

      return expirationDate < now;
    } catch (error) {
      console.error('Error checking token expiration:', error);
      return true; // Si hay error, considerar como expirado
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
      // Guardar en localStorage
      localStorage.setItem(this.TOKEN_KEY, token);
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      localStorage.setItem('auth_timestamp', new Date().toISOString());

      // Guardar en servicios de seguridad
      this.tokenService.setAccessToken(token);
      this.csrfTokenService.initializeCsrfProtection();

      this.updateAuthState(true, user, token);

      // Iniciar monitoreo de sesión
      this.sessionService.startInactivityCountdown();
      this.sessionService.clearFailedAttempts(user.email);
    } catch (error) {
      console.error('Error al guardar la sesión:', error);
      this.toastr.error('Error al guardar la sesión', 'Error');
    }
  }

  /**
   * Limpiar estado de autenticación
   */
  private clearAuthState(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem('auth_timestamp');

    this.tokenService.clearTokens();
    this.csrfTokenService.clearToken();

    this.updateAuthState(false, null, null);
  }

  /**
   * LOGIN - Iniciar sesión
   */
  login(credentials: LoginRequest): Observable<any> {
    // Verificar si la cuenta está bloqueada
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
        // El backend solo devuelve { "token": "..." }
        if (response && response.token) {
          // Decodificar el token JWT para obtener los datos del usuario
          const tokenData = this.decodeToken(response.token);

          // Crear objeto User a partir de los datos del token
          const user: User = {
            id: tokenData.id,
            nombre: tokenData.nombre || '',
            aPaterno: tokenData.aPaterno || '',
            aMaterno: tokenData.aMaterno || '',
            email: tokenData.email,
            telefono: tokenData.telefono || '',
            rol: tokenData.rol,
            activo: 1, // Asumimos activo si logró hacer login
          };

          this.saveAuthData(response.token, user);
          this.toastr.success(`¡Bienvenido!`, 'Login Exitoso');

          // Establecer flag: navegación iniciada por AuthService
          this.setNavigationInProgress(true);

          // Redireccionar según rol
          const dashboardRoute = getDashboardRoute(user.rol);
          this.router.navigate([dashboardRoute]).then(() => {
            // Limpiar flag después de que la navegación se complete
            setTimeout(() => {
              this.setNavigationInProgress(false);
            }, 100);
          });
        } else {
          this.toastr.error('Respuesta inválida del servidor', 'Error');
        }
      }),
      catchError((error) => {
        console.error('Login error:', error);

        // Registrar intento fallido
        this.sessionService.recordFailedAttempt(credentials.email);

        // Verificar si la cuenta debe bloquearse
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
  private decodeToken(token: string): any {
    try {
      const payload = token.split('.')[1];
      const decoded = atob(payload);
      return JSON.parse(decoded);
    } catch (error) {
      console.error('Error decoding token:', error);
      return {};
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
        console.error('Register error:', error);
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
    const user = this.currentUser();
    this.clearAuthState();
    this.toastr.success('Sesión cerrada correctamente', 'Hasta pronto');
    this.router.navigate(['/home']);
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
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.currentUser.set(user);
    // 🔑 IMPORTANTE: También actualizar el signal de autenticación
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
    console.log(`🔄 Autenticación en progreso: ${inProgress}`);
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
        console.error('Password reset request error:', error);
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
        console.log('AuthService.verifyRecoveryCode ->', url, { email, token });
      }),
      catchError((error) => {
        console.error('Code verification error:', error);
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
        console.error('Password reset error:', error);
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
        console.error('resend-code error:', error);
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
}
