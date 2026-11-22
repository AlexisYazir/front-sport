import type { RegistrationReceipt, MessageResponse, UserProfile } from './api-contracts';
import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  Observable,
  Subscription,
  BehaviorSubject,
  catchError,
  defer,
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
  AlexaVerificationCodeResponse,
} from '../models/user.model';
import { TokenService } from './token.service';
import { SessionService } from './session.service';
import { RequestCacheService } from './request-cache.service';

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

export interface AuthSessionSnapshot {
  readonly userId: number;
  readonly sessionId: string | null;
  readonly epoch: number;
}

interface AuthOperationSnapshot {
  epoch: number;
  userId: number | null;
  sessionId: string | null;
  storedUserId: number | null;
  storedSessionId: string | null;
}

export class AuthSessionChangedError extends Error {
  readonly code = 'AUTH_SESSION_CHANGED';
  constructor() {
    super('La sesión cambió durante la operación');
    this.name = 'AuthSessionChangedError';
  }
}

@Injectable({
  providedIn: 'root',
})
export class AuthService implements OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);
  private toastr = inject(ToastrService);
  private tokenService = inject(TokenService);
  private sessionService = inject(SessionService);
  private requestCache = inject(RequestCacheService);

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
  private sessionEpoch = 0;
  private authenticationAttempt?: AuthOperationSnapshot;
  private readonly accountEmails = new Set<string>();
  private storageSyncListener?: (event: StorageEvent) => void;
  private cookieRestore?: Subscription;

  constructor() {
    this.loadAuthState();
    this.initializeStorageSync();
    this.restoreSessionFromCookies();
  }

  currentUser$(): Observable<User | null> {
    return this.authState$.asObservable().pipe(map((state) => state.user));
  }

  private advanceSessionEpoch(): number {
    this.sessionEpoch += 1;
    this.refreshRequest$ = undefined;
    this.authenticationAttempt = undefined;
    this.cookieRestore?.unsubscribe();
    this.cookieRestore = undefined;
    return this.sessionEpoch;
  }

  private storedSessionId(): string | null {
    return localStorage.getItem('auth:session_id') ?? sessionStorage.getItem('auth:session_id');
  }

  private captureOperation(): AuthOperationSnapshot {
    return {
      epoch: this.sessionEpoch,
      userId: this.currentUser()?.id ?? null,
      sessionId: this.authState$.value.sessionId,
      storedUserId: this.getStoredUser()?.id ?? null,
      storedSessionId: this.storedSessionId(),
    };
  }

  private isCurrentOperation(snapshot: AuthOperationSnapshot): boolean {
    return snapshot.epoch === this.sessionEpoch &&
      snapshot.userId === (this.currentUser()?.id ?? null) &&
      snapshot.sessionId === this.authState$.value.sessionId &&
      snapshot.storedUserId === (this.getStoredUser()?.id ?? null) &&
      snapshot.storedSessionId === this.storedSessionId();
  }

  captureSession(): AuthSessionSnapshot | null {
    const userId = this.currentUser()?.id;
    if (!this.isAuthenticated() || typeof userId !== 'number' || !Number.isSafeInteger(userId) || userId <= 0) return null;
    return Object.freeze({userId,sessionId:this.authState$.value.sessionId,epoch:this.sessionEpoch});
  }

  isCurrentSession(snapshot: AuthSessionSnapshot | null): boolean {
    return !!snapshot && this.isAuthenticated() &&
      snapshot.epoch === this.sessionEpoch && this.currentUser()?.id === snapshot.userId &&
      this.authState$.value.sessionId === snapshot.sessionId &&
      this.getStoredUser()?.id === snapshot.userId && this.storedSessionId() === snapshot.sessionId;
  }

  clearDeletedAccountSession(snapshot: AuthSessionSnapshot): void {
    if (!this.isCurrentSession(snapshot)) return;
    const remembered = localStorage.getItem('sc_remember_email')?.trim().toLowerCase();
    const removeRemembered = !!remembered && this.accountEmails.has(remembered);
    this.clearAuthState(false);
    if (removeRemembered) {
      localStorage.removeItem('sc_remember_email');
      localStorage.removeItem('sc_remember_me');
    }
  }

  beginAuthenticationAttempt(): number {
    const epoch = this.advanceSessionEpoch();
    this.authenticationAttempt = this.captureOperation();
    return epoch;
  }

  isCurrentAuthenticationAttempt(epoch: number): boolean {
    return !!this.authenticationAttempt && this.authenticationAttempt.epoch === epoch &&
      this.isCurrentOperation(this.authenticationAttempt);
  }

  ngOnDestroy(): void {
    this.advanceSessionEpoch();
    if (this.storageSyncListener && typeof window !== 'undefined') window.removeEventListener('storage', this.storageSyncListener);
  }

  private loadAuthState(): void {
    const token = this.tokenService.getAccessToken();
    const storedUser = this.getStoredUser();

    if (!storedUser) {
      this.clearAuthState(false);
      return;
    }

    if (!token) {
      this.updateAuthState(true, storedUser, null, this.tokenService.getSessionId());
      this.sessionService.startInactivityCountdown();
      return;
    }

    const tokenData = this.decodeToken(token);
    if (!tokenData) {
      this.updateAuthState(true, storedUser, null, this.tokenService.getSessionId());
      return;
    }

    if (this.isTokenExpired(token)) {
      this.updateAuthState(true, storedUser, null, tokenData.sessionId ?? this.tokenService.getSessionId());
      this.sessionService.startInactivityCountdown();
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

    this.storageSyncListener = (event) => {
      const relevantKeys = new Set([
        this.USER_KEY,
        'auth:session_id',
        'auth:access_token',
        'auth:refresh_token',
      ]);

      if (!event.key || relevantKeys.has(event.key)) {
        if (event.storageArea && event.storageArea !== localStorage) return;
        this.advanceSessionEpoch();
        const access = localStorage.getItem('auth:access_token');
        const refresh = localStorage.getItem('auth:refresh_token');
        const session = localStorage.getItem('auth:session_id');
        this.tokenService.setAccessToken(access);
        this.tokenService.setRefreshToken(refresh);
        this.tokenService.setSessionId(session);
        this.loadAuthState();
      }
    };
    window.addEventListener('storage', this.storageSyncListener);
  }

  private restoreSessionFromCookies(): void {
    const token = this.tokenService.getAccessToken();
    const storedUser = this.getStoredUser();
    const storedSessionId = this.tokenService.getSessionId();
    const operation = this.captureOperation();

    if (token) {
      return;
    }

    this.cookieRestore = this.http
      .get<LoginResponse>(`${this.API_URL}/users/session`, { withCredentials: true })
      .pipe(
        tap((response) => {
          if (!this.isCurrentOperation(operation)) throw new AuthSessionChangedError();
          const decoded = this.decodeToken(response.accessToken);
          if (!decoded || (operation.userId !== null && decoded.id_usuario !== operation.userId) ||
              (operation.sessionId !== null && response.sessionId !== operation.sessionId)) {
            this.clearAuthState(false);
            throw new AuthSessionChangedError();
          }
          this.applyAuthenticationResponse(response, {navigate:false});
        }),
        catchError(() => {
          if (this.isCurrentOperation(operation) && !storedUser && !storedSessionId) {
            this.updateAuthState(false, null, null, null);
          }
          return of(null);
        }),
      )
      .subscribe();
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
    if (user?.id !== this.currentUser()?.id) this.accountEmails.clear();
    if (user?.email) this.accountEmails.add(user.email.trim().toLowerCase());
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
    if (this.currentUser()?.id !== user.id || this.authState$.value.sessionId !== response.sessionId) this.advanceSessionEpoch();
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

  private getSafeReturnUrl(): string | null {
    const returnUrl = this.router.parseUrl(this.router.url).queryParams['returnUrl'];
    if (
      typeof returnUrl === 'string' &&
      returnUrl.startsWith('/') &&
      !returnUrl.startsWith('//') &&
      !returnUrl.startsWith('/auth/login') &&
      !returnUrl.includes('://')
    ) {
      return returnUrl;
    }

    return null;
  }

  handleAuthenticationResponse(
    response: LoginResponse,
    options?: { navigate?: boolean; successMessage?: string; expectedEpoch?: number },
  ): User {
    const epoch = options?.expectedEpoch ?? this.beginAuthenticationAttempt();
    if (!this.isCurrentAuthenticationAttempt(epoch)) throw new AuthSessionChangedError();
    return this.applyAuthenticationResponse(response, options);
  }

  private applyAuthenticationResponse(
    response: LoginResponse,
    options?: {navigate?:boolean;successMessage?:string},
  ): User {
    const tokenData = this.decodeToken(response.accessToken);

    if (!tokenData) {
      throw new Error('Token inválido');
    }

    const storedUser = this.getStoredUser();
    const existingUser = storedUser?.id === tokenData.id_usuario ? storedUser : undefined;
    const user = this.buildUserFromToken(tokenData, existingUser);
    this.persistAuthSession(response, user);
    this.authenticationInProgress = false;

    if (options?.successMessage) {
      this.toastr.success(options.successMessage, 'Login Exitoso');
    }

    if (options?.navigate !== false) {
      this.setNavigationInProgress(true);
      const returnUrl = this.getSafeReturnUrl();
      const navigation = returnUrl
        ? this.router.navigateByUrl(returnUrl)
        : this.router.navigate([getDashboardRoute(user.rol)]);

      const epoch = this.sessionEpoch;
      navigation.finally(() => {
        if (this.sessionEpoch === epoch) this.setNavigationInProgress(false);
      });
    }

    return user;
  }

  clearAuthState(redirect = false): void {
    this.advanceSessionEpoch();
    this.authenticationInProgress = false;
    this.navigationInProgress = false;
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem('auth_timestamp');
    this.tokenService.clearTokens();
    this.sessionService.clearSession();
    this.requestCache.clear();
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

    return defer(() => {
      const epoch = this.beginAuthenticationAttempt();
      return this.http.post<LoginResponse>(`${this.API_URL}/users/login-user`, payload, {
      withCredentials: true,
    }).pipe(
      map((response) => {
        if (!this.isCurrentAuthenticationAttempt(epoch)) throw new AuthSessionChangedError();
        this.handleAuthenticationResponse(response, {
          navigate: true,
          successMessage: '¡Bienvenido!',
          expectedEpoch: epoch,
        });
        return response;
      }),
      catchError((error) => {
        if (!this.isCurrentAuthenticationAttempt(epoch)) return throwError(() => new AuthSessionChangedError());
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
    });
  }

  refreshAccessToken(): Observable<string> {
    if (this.refreshRequest$) {
      return this.refreshRequest$;
    }

    const snapshot = this.captureSession();
    if (!snapshot || !this.isCurrentSession(snapshot)) return throwError(() => new AuthSessionChangedError());
    const shared = defer(() => {
      if (!this.isCurrentSession(snapshot)) return throwError(() => new AuthSessionChangedError());
      return this.http
      .post<LoginResponse>(
        `${this.API_URL}/users/refresh-token`,
        { refreshToken: this.tokenService.getRefreshToken() ?? undefined },
        { withCredentials: true },
      );
    })
      .pipe(
        map((response) => {
          if (!this.isCurrentSession(snapshot)) throw new AuthSessionChangedError();
          const user = this.currentUser();
          const decoded = this.decodeToken(response.accessToken);
          if (!user || !decoded || decoded.id_usuario !== snapshot.userId ||
              (snapshot.sessionId !== null && response.sessionId !== snapshot.sessionId)) throw new AuthSessionChangedError();

          this.persistAuthSession(response, user);
          return response.accessToken;
        }),
        finalize(() => {
          if (this.refreshRequest$ === guarded) this.refreshRequest$ = undefined;
        }),
        shareReplay({bufferSize:1,refCount:true}),
      );
    const guarded = shared.pipe(map(value => {
      if (!this.isCurrentSession(snapshot)) throw new AuthSessionChangedError();
      return value;
    }));
    this.refreshRequest$ = guarded;
    return this.refreshRequest$;
  }

  logout(notifyServer = true, showNotification = notifyServer): void {
    const hadSession = !!this.tokenService.getAccessToken() || !!this.getStoredUser();
    this.clearAuthState(false);
    const epoch = this.sessionEpoch;
    const finalizeLogout = () => {
      if (this.sessionEpoch !== epoch || this.currentUser() || this.getStoredUser()) return;
      this.router.navigate(['/home']);
      if (showNotification) {
        this.toastr.success('Tu sesión se cerró correctamente', 'Sesión cerrada');
      }
    };

    if (!notifyServer || !hadSession) {
      finalizeLogout();
      return;
    }

    this.http.post(`${this.API_URL}/users/logout`, {}, { withCredentials: true }).pipe(
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
      (!!this.tokenService.getAccessToken() || !!this.getStoredUser())
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
    const snapshot = this.captureSession();
    if (!snapshot || !this.isCurrentSession(snapshot) || user.id !== snapshot.userId) throw new AuthSessionChangedError();
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

  register(userData: RegisterRequest): Observable<RegistrationReceipt> {
    const registerData = {
      ...userData,
      rol: UserRole.USUARIO,
      activo: 1,
    };

    return this.http.post<RegistrationReceipt>(`${this.API_URL}/users/create-user`, registerData).pipe(
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

  requestPasswordReset(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.API_URL}/users/verify-user-email`, { email }).pipe(
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

  verifyRecoveryCode(email: string, token: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.API_URL}/users/verify-email`, { email, token }).pipe(
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

  resetPassword(email: string, newPassword: string, token: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.API_URL}/users/reset-psw`, {
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

  requestResendCode(email: string): Observable<MessageResponse> {
    const base = this.API_URL?.replace(/\/+$/, '');
    return this.http.post<MessageResponse>(`${base}/users/resend-code`, { email }).pipe(
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

  requestAlexaVerificationCode(): Observable<AlexaVerificationCodeResponse> {
    return this.http
      .post<AlexaVerificationCodeResponse>(`${this.API_URL}/users/alexa/request-code`, {})
      .pipe(
        tap(() => {
          this.toastr.success('Código enviado a tu correo', 'Alexa');
        }),
        catchError((error) => {
          const message = error?.error?.message || 'No fue posible generar el código.';
          this.toastr.error(message, 'Alexa');
          return throwError(() => error);
        }),
      );
  }

  getAlexaVerificationCode(): Observable<AlexaVerificationCodeResponse> {
    return this.http.get<AlexaVerificationCodeResponse>(`${this.API_URL}/users/alexa/code`);
  }

  unlinkAlexaAccount(): Observable<{ message: string; isLinked: boolean; linkedAt: string | null }> {
    return this.http
      .post<{ message: string; isLinked: boolean; linkedAt: string | null }>(
        `${this.API_URL}/users/alexa/unlink`,
        {},
      )
      .pipe(
        tap(() => {
          this.toastr.success('Alexa se desvinculó correctamente', 'Alexa');
        }),
        catchError((error) => {
          const message = error?.error?.message || 'No fue posible desvincular Alexa.';
          this.toastr.error(message, 'Alexa');
          return throwError(() => error);
        }),
      );
  }

  private mapRecentUserCreatedFromApi(u: RecentUserCreated): RecentUserCreated {
    return {
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
      activo: u.activo,
      fecha_creacion: u.fecha_creacion,
    };
  }

  private mapUsersAdminFromApi(u: UsersAdmin): UsersAdmin {
    return {
      id_usuario: u.id_usuario,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
      activo: u.activo,
      fecha_creacion: u.fecha_creacion,
    };
  }

  private mapRolesFromApi(r: Roles): Roles {
    return {
      id_rol: r.id_rol,
      rol: r.rol,
    };
  }

  getRecentUsers(): Observable<RecentUserCreated[]> {
    this.isLoading.set(true);

    return this.http.get<RecentUserCreated[]>(`${this.API_URL}/users/get-recent-users-created`).pipe(
      map((response) => response.map((u) => this.mapRecentUserCreatedFromApi(u))),
      finalize(() => this.isLoading.set(false)),
    );
  }

  getUsers(): Observable<UsersAdmin[]> {
    this.isLoading.set(true);

    return this.http.get<UsersAdmin[]>(`${this.API_URL}/users/get-users`).pipe(
      map((response) => response.map((u) => this.mapUsersAdminFromApi(u))),
      finalize(() => this.isLoading.set(false)),
    );
  }

  getRoles(): Observable<Roles[]> {
    this.isLoading.set(true);

    return this.http.get<Roles[]>(`${this.API_URL}/users/get-roles`).pipe(
      map((response) => response.map((u) => this.mapRolesFromApi(u))),
      finalize(() => this.isLoading.set(false)),
    );
  }

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.API_URL}/users/profile`);
  }

  updateProfile(data: UpdateProfileData): Observable<UpdateProfileResponse> {
    const snapshot = this.captureSession();
    return defer(() => {
      if (!snapshot || !this.isCurrentSession(snapshot)) return throwError(() => new AuthSessionChangedError());
      return this.http.patch<UpdateProfileResponse>(`${this.API_URL}/users/update-profile`, data);
    }).pipe(
      tap((response) => {
        if (!snapshot || !this.isCurrentSession(snapshot)) throw new AuthSessionChangedError();
        const currentUser = this.currentUser();
        if (currentUser) {
          this.updateCurrentUser({
            ...currentUser,
            ...response.user,
            id: snapshot.userId,
          });
        }
      }),
    );
  }

  updateUserFromAdmin(data: { id_usuario: number; activo: number; rol: number }): Observable<UsersAdmin> {
    this.isLoading.set(true);

    return this.http.patch<UsersAdmin>(`${this.API_URL}/users/update-user`, data).pipe(
      finalize(() => this.isLoading.set(false)),
    );
  }
}
