import { Injectable, inject, signal, effect } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

/**
 * Gestiona sesiones, timeouts de inactividad y bloqueo de cuenta
 */
@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private router = inject(Router);

  // Configuración de sesión
  private readonly INACTIVITY_TIMEOUT = 24 * 60 * 60 * 1000; // 1 día
  private readonly LOCK_TIME = 5 * 60 * 1000; // 5 minutos de bloqueo
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly SESSION_ID_KEY = 'auth:session_id';
  private readonly USER_KEY = environment.storageKeys.user;

  // Estado de sesión
  isActive = signal<boolean>(true);
  remainingTime = signal<number>(this.INACTIVITY_TIMEOUT);
  isAccountLocked = signal<boolean>(false);
  failedAttempts = signal<number>(0);

  private inactivityTimer?: number;
  private countdownTimer?: number;
  private lockTimer?: number;

  // Storage keys
  private readonly FAILED_ATTEMPTS_KEY = 'auth:failed_attempts';
  private readonly LOCK_TIME_KEY = 'auth:lock_time';
  private readonly LAST_ACTIVITY_KEY = 'auth:last_activity';

  constructor() {
    this.initializeSessionTracking();
  }

  /**
   * Inicializa el tracking de sesión (listeners de actividad)
   */
  private initializeSessionTracking() {
    if (typeof window === 'undefined') return;

    // Eventos que resetean el contador de inactividad
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    activityEvents.forEach(event => {
      document.addEventListener(event, () => this.resetInactivityTimer(), true);
    });

    // Cargar estado de bloqueo si existe
    this.checkAccountLock();
  }

  /**
   * Verifica si el usuario está logueado (sin inyectar AuthService)
   */
  private isLoggedIn(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return !!localStorage.getItem(this.USER_KEY) || !!localStorage.getItem(this.SESSION_ID_KEY);
  }

  /**
   * Resetea el timer de inactividad cada vez que hay actividad
   */
  resetInactivityTimer() {
    if (!this.isLoggedIn()) return;

    // Limpiar timers anteriores
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    if (this.countdownTimer) clearInterval(this.countdownTimer);

    // Resetear tiempo restante
    this.remainingTime.set(this.INACTIVITY_TIMEOUT);
    this.isActive.set(true);

    // Guardar último momento de actividad
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.LAST_ACTIVITY_KEY, Date.now().toString());
    }

    // Iniciar countdown y logout automático
    this.startInactivityCountdown();
  }

  /**
   * Inicia el countdown de inactividad (PÚBLICO para AuthService)
   */
  startInactivityCountdown() {
    // Contar regresivamente cada segundo
    this.countdownTimer = window.setInterval(() => {
      const remaining = this.remainingTime() - 1000;
      this.remainingTime.set(Math.max(0, remaining));

      // Logout automático cuando llega a 0
      if (remaining <= 0) {
        this.autoLogout('Sesión expirada por inactividad');
      }
    }, 1000);

    // Timer principal para logout automático
    this.inactivityTimer = window.setTimeout(() => {
      this.autoLogout('Sesión expirada por inactividad');
    }, this.INACTIVITY_TIMEOUT);
  }

  /**
   * Logout automático
   */
  autoLogout(reason: string = 'Session timeout') {
    console.warn('Auto-logout:', reason);
    this.clearSession();
    
    // Limpiar localStorage sin inyectar AuthService
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('auth:access_token');
      localStorage.removeItem('auth:refresh_token');
      localStorage.removeItem('auth:session_id');
      localStorage.removeItem(this.USER_KEY);
    }

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('auth:access_token');
      sessionStorage.removeItem('auth:refresh_token');
      sessionStorage.removeItem('auth:session_id');
    }
    
    this.router.navigate(['/auth/login'], {
      queryParams: { reason: 'session-expired' }
    });
  }

  /**
   * Limpia timers de sesión
   */
  public clearSession() {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    if (this.lockTimer) clearTimeout(this.lockTimer);
  }

  /**
   * Registra un intento de login fallido
   */
  recordFailedAttempt(email: string) {
    const key = `${this.FAILED_ATTEMPTS_KEY}:${email}`;
    const attempts = (parseInt(localStorage.getItem(key) || '0') || 0) + 1;

    localStorage.setItem(key, attempts.toString());
    this.failedAttempts.set(attempts);

    if (attempts >= this.MAX_FAILED_ATTEMPTS) {
      this.lockAccount(email);
    }
  }

  /**
   * Bloquea la cuenta temporalmente (PÚBLICO para AuthService)
   */
  lockAccount(email: string) {
    const key = `${this.LOCK_TIME_KEY}:${email}`;
    localStorage.setItem(key, Date.now().toString());
    this.isAccountLocked.set(true);

    // Auto-desbloqueo después de LOCK_TIME
    this.lockTimer = window.setTimeout(() => {
      this.unlockAccount(email);
    }, this.LOCK_TIME);
  }

  /**
   * Desbloquea la cuenta
   */
  private unlockAccount(email: string) {
    const key = `${this.LOCK_TIME_KEY}:${email}`;
    localStorage.removeItem(key);
    localStorage.removeItem(`${this.FAILED_ATTEMPTS_KEY}:${email}`);
    this.isAccountLocked.set(false);
    this.failedAttempts.set(0);
  }

  /**
   * Verifica si la cuenta está bloqueada
   */
  checkAccountLock(email?: string): boolean {
    if (!email) return this.isAccountLocked();

    const key = `${this.LOCK_TIME_KEY}:${email}`;
    const lockTime = localStorage.getItem(key);

    if (!lockTime) return false;

    const elapsed = Date.now() - parseInt(lockTime);
    if (elapsed > this.LOCK_TIME) {
      this.unlockAccount(email);
      return false;
    }

    return true;
  }

  /**
   * Obtiene tiempo restante de bloqueo (en segundos)
   */
  getRemainingLockTime(email: string): number {
    const key = `${this.LOCK_TIME_KEY}:${email}`;
    const lockTime = localStorage.getItem(key);

    if (!lockTime) return 0;

    const elapsed = Date.now() - parseInt(lockTime);
    const remaining = this.LOCK_TIME - elapsed;

    return Math.max(0, Math.ceil(remaining / 1000));
  }

  /**
   * Limpia intentos fallidos (después de login exitoso)
   */
  clearFailedAttempts(email: string) {
    const key = `${this.FAILED_ATTEMPTS_KEY}:${email}`;
    localStorage.removeItem(key);
    this.failedAttempts.set(0);
  }

  /**
   * Obtiene intentos fallidos
   */
  getFailedAttempts(email: string): number {
    const key = `${this.FAILED_ATTEMPTS_KEY}:${email}`;
    return parseInt(localStorage.getItem(key) || '0');
  }

  /**
   * Cleanup al destruir
   */
  ngOnDestroy() {
    this.clearSession();
  }
}
