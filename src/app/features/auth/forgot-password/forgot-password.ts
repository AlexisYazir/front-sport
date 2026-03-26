import { Component, inject, signal, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterModule, Router } from "@angular/router";
import { AuthService } from '../../../core/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { validateEmail, evaluatePasswordStrength, validatePasswordComplexity, isSecureInput, PasswordStrength } from '../../../core/validators/custom-validators';
import { PasswordStrengthComponent } from '../../../shared/components/password-strength/password-strength.component';

type ForgotPasswordStep = 'email' | 'verify' | 'reset';

// ============================================================================
// RATE LIMITING CONFIGURATION
// ============================================================================
interface RateLimitState {
  attempts: number;
  firstAttempt: number;
  lockedUntil: number | null;
  lastAttemptTime: number;
}

const RATE_LIMIT_CONFIG = {
  maxAttempts: 3,           // Máximo 3 intentos
  timeWindow: 15 * 60000,   // Ventana de 15 minutos
  lockDuration: 30 * 60000, // Bloqueo de 30 minutos
  cooldownBase: 60,         // Cooldown base de 60 segundos
  minTimeBetweenAttempts: 5000, // Mínimo 5 segundos entre intentos
};

@Component({
  selector: "app-forgot-password",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PasswordStrengthComponent],
  templateUrl: "./forgot-password.html",
  styleUrl: "./forgot-password.css"
})
export class ForgotPassword implements OnDestroy {
  private authService = inject(AuthService);
  private toastr = inject(ToastrService);
  private router = inject(Router);
  private codeExpiryInterval: any;
  private resendCooldownInterval: any;
  private lockCountdownInterval: any;

  // Estados
  currentStep = signal<ForgotPasswordStep>('email');
  isLoading = signal<boolean>(false);
  
  // Paso 1: Email
  email = signal<string>('');
  emailError = signal<string>('');
  
  // Paso 2: Verificación de código
  recoveryCode = signal<string>('');
  codeError = signal<string>('');
  codeExpiry = signal<number>(0);
  canResendCode = signal<boolean>(true);
  resendCooldown = signal<number>(0);
  
  // Paso 3: Nueva contraseña
  newPassword = signal<string>('');
  confirmPassword = signal<string>('');
  showPassword = signal<boolean>(false);
  showConfirmPassword = signal<boolean>(false);
  passwordError = signal<string>('');
  secureError = signal<string>('');
  passwordStrength = signal<PasswordStrength | null>(null);

  // Rate Limiting
  isRateLimited = signal<boolean>(false);
  rateLimitMessage = signal<string>('');
  remainingAttempts = signal<number>(RATE_LIMIT_CONFIG.maxAttempts);
  lockTimeRemaining = signal<string>('');

  private rateLimitKey = '';

  ngOnDestroy(): void {
    this.cleanupIntervals();
  }

  /**
   * Paso 1: Solicitar código de recuperación
   */
  requestRecoveryCode() {
    this.emailError.set('');

    if (!this.email() || !validateEmail(this.email())) {
      this.emailError.set('Por favor ingresa un email válido');
      return;
    }

    // Configurar key de rate limit basada en email
    this.rateLimitKey = `rate_limit_forgot_${this.email()}`;

    // Verificar rate limit
    if (!this.checkRateLimit()) {
      this.emailError.set(this.rateLimitMessage());
      return;
    }

    // Registrar intento
    if (!this.recordAttempt()) {
      this.emailError.set(this.rateLimitMessage());
      return;
    }

    this.isLoading.set(true);

    this.authService.requestPasswordReset(this.email()).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.currentStep.set('verify');
        this.recoveryCode.set('');
        this.codeError.set('');
        this.canResendCode.set(false);
        this.startCodeExpiry();
        this.startResendCooldown();
        
        // Mostrar intentos restantes
        if (this.remainingAttempts() < RATE_LIMIT_CONFIG.maxAttempts) {
          this.toastr.info(`Intentos restantes: ${this.remainingAttempts()}`, 'Información');
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.toastr.error(err?.error?.message || 'Error al enviar el código', 'Error');
      }
    });
  }

  /**
   * Reenviar código con rate limiting
   */
  resendCode() {
    if (this.isRateLimited()) {
      this.codeError.set(this.rateLimitMessage());
      return;
    }

    if (!this.canResendCode()) {
      this.codeError.set(`Espera ${this.resendCooldown()}s para reenviar`);
      return;
    }

    // Verificar rate limit antes de reenviar
    if (!this.checkRateLimit()) {
      this.codeError.set(this.rateLimitMessage());
      return;
    }

    // Registrar intento
    if (!this.recordAttempt()) {
      this.codeError.set(this.rateLimitMessage());
      return;
    }

    this.isLoading.set(true);

    this.authService.requestPasswordReset(this.email()).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.toastr.success(`Código reenviado. ${this.remainingAttempts()} intentos restantes`, 'Éxito');
        this.recoveryCode.set('');
        this.codeError.set('');
        
        // Cooldown progresivo
        const state = this.getRateLimitState();
        const cooldown = this.calculateCooldown(state.attempts);
        this.startResendCooldown(cooldown);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.toastr.error(err?.error?.message || 'Error al reenviar el código', 'Error');
      }
    });
  }

  /**
   * Paso 2: Verificar código
   */
  verifyCode() {
    this.codeError.set('');

    if (!this.recoveryCode() || this.recoveryCode().length < 1) {
      this.codeError.set('Ingresa el código que recibiste');
      return;
    }

    this.isLoading.set(true);

    this.authService.verifyRecoveryCode(this.email(), this.recoveryCode()).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.cleanupIntervals();
        this.currentStep.set('reset');
        
        // Limpiar rate limit tras éxito
        this.clearRateLimit();
      },
      error: (err) => {
        this.isLoading.set(false);
        const message = err?.error?.message || 'Código inválido';
        if (message.includes('intentos') || message.includes('agotado') || message.includes('expirado')) {
          this.codeError.set(message);
          this.toastr.error(message, 'Código Inválido');
        } else {
          this.codeError.set(message);
        }
      }
    });
  }

  /**
   * Paso 3: Restablecer contraseña
   */
  resetPassword() {
    this.passwordError.set('');
    this.secureError.set('');

    if (!this.newPassword() || !validatePasswordComplexity(this.newPassword())) {
      this.passwordError.set('La contraseña no cumple con los requisitos de seguridad');
      return;
    }

    if (!isSecureInput(this.newPassword())) {
      this.secureError.set('La contraseña contiene caracteres no permitidos');
      return;
    }

    if (this.newPassword() !== this.confirmPassword()) {
      this.passwordError.set('Las contraseñas no coinciden');
      return;
    }

    if (!this.recoveryCode()) {
      this.passwordError.set('No se encontró el token de recuperación. Verifica el código nuevamente.');
      return;
    }

    this.isLoading.set(true);

    this.authService.resetPassword(
      this.email(),
      this.newPassword(),
      this.recoveryCode()
    ).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.cleanupIntervals();
        this.clearRateLimit();
        this.toastr.success('Contraseña restablecida exitosamente', 'Éxito');
        this.router.navigate(['/auth/login']);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.toastr.error(err?.error?.message || 'Error al restablecer la contraseña', 'Error');
      }
    });
  }

  // ============================================================================
  // RATE LIMITING LOGIC
  // ============================================================================

  /**
   * Verifica si el usuario puede hacer una solicitud
   */
  private checkRateLimit(): boolean {
    const state = this.getRateLimitState();
    const now = Date.now();

    // Verificar si está bloqueado
    if (state.lockedUntil && now < state.lockedUntil) {
      this.isRateLimited.set(true);
      this.startLockCountdown(state.lockedUntil);
      return false;
    }

    // Limpiar bloqueo expirado
    if (state.lockedUntil && now >= state.lockedUntil) {
      this.clearRateLimit();
      return true;
    }

    // Verificar ventana de tiempo
    if (state.firstAttempt && now - state.firstAttempt > RATE_LIMIT_CONFIG.timeWindow) {
      this.clearRateLimit();
      return true;
    }

    // Verificar tiempo mínimo entre intentos (prevenir spam)
    if (state.lastAttemptTime && now - state.lastAttemptTime < RATE_LIMIT_CONFIG.minTimeBetweenAttempts) {
      this.rateLimitMessage.set('Espera unos segundos antes de intentar nuevamente');
      return false;
    }

    // Calcular intentos restantes
    this.remainingAttempts.set(Math.max(0, RATE_LIMIT_CONFIG.maxAttempts - state.attempts));
    this.isRateLimited.set(false);
    
    return true;
  }

  /**
   * Registra un intento y verifica límites
   */
  private recordAttempt(): boolean {
    const state = this.getRateLimitState();
    const now = Date.now();

    // Inicializar primer intento
    if (!state.firstAttempt) {
      state.firstAttempt = now;
      state.attempts = 0;
    }

    // Verificar si la ventana expiró
    if (now - state.firstAttempt > RATE_LIMIT_CONFIG.timeWindow) {
      state.firstAttempt = now;
      state.attempts = 0;
      state.lockedUntil = null;
    }

    // Incrementar intentos
    state.attempts++;
    state.lastAttemptTime = now;

    // Verificar si alcanzó el límite
    if (state.attempts >= RATE_LIMIT_CONFIG.maxAttempts) {
      state.lockedUntil = now + RATE_LIMIT_CONFIG.lockDuration;
      this.saveRateLimitState(state);
      
      this.isRateLimited.set(true);
      const lockMinutes = Math.ceil(RATE_LIMIT_CONFIG.lockDuration / 60000);
      this.rateLimitMessage.set(`Has excedido el límite de intentos. Bloqueado por ${lockMinutes} minutos.`);
      this.startLockCountdown(state.lockedUntil);
      
      this.toastr.error(this.rateLimitMessage(), 'Cuenta Bloqueada', { timeOut: 5000 });
      return false;
    }

    // Guardar estado
    this.saveRateLimitState(state);
    this.remainingAttempts.set(RATE_LIMIT_CONFIG.maxAttempts - state.attempts);
    
    return true;
  }

  /**
   * Calcula cooldown progresivo
   */
  private calculateCooldown(attempts: number): number {
    return RATE_LIMIT_CONFIG.cooldownBase * Math.min(attempts, 3);
  }

  /**
   * Obtiene estado de rate limit
   */
  private getRateLimitState(): RateLimitState {
    try {
      const stored = localStorage.getItem(this.rateLimitKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error parsing rate limit state:', e);
    }
    
    return {
      attempts: 0,
      firstAttempt: 0,
      lockedUntil: null,
      lastAttemptTime: 0,
    };
  }

  /**
   * Guarda estado de rate limit
   */
  private saveRateLimitState(state: RateLimitState): void {
    try {
      localStorage.setItem(this.rateLimitKey, JSON.stringify(state));
    } catch (e) {
      console.error('Error saving rate limit state:', e);
    }
  }

  /**
   * Limpia rate limit
   */
  private clearRateLimit(): void {
    try {
      if (this.rateLimitKey) {
        localStorage.removeItem(this.rateLimitKey);
      }
    } catch (e) {
      console.error('Error clearing rate limit:', e);
    }
    
    this.isRateLimited.set(false);
    this.remainingAttempts.set(RATE_LIMIT_CONFIG.maxAttempts);
    this.rateLimitMessage.set('');
    this.lockTimeRemaining.set('');
    
    if (this.lockCountdownInterval) {
      clearInterval(this.lockCountdownInterval);
      this.lockCountdownInterval = null;
    }
  }

  /**
   * Inicia countdown del bloqueo
   */
  private startLockCountdown(lockUntil: number): void {
    if (this.lockCountdownInterval) {
      clearInterval(this.lockCountdownInterval);
    }
    
    const updateCountdown = () => {
      const now = Date.now();
      const remaining = lockUntil - now;
      
      if (remaining <= 0) {
        this.isRateLimited.set(false);
        this.rateLimitMessage.set('');
        this.lockTimeRemaining.set('');
        this.clearRateLimit();
        return;
      }
      
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      this.lockTimeRemaining.set(`${minutes}m ${seconds}s`);
      this.rateLimitMessage.set(`Cuenta bloqueada. Espera ${minutes}m ${seconds}s`);
    };
    
    updateCountdown();
    this.lockCountdownInterval = setInterval(updateCountdown, 1000);
  }

  // ============================================================================
  // EXISTING METHODS
  // ============================================================================

  private startCodeExpiry() {
    let seconds = 86400; // 24 horas
    this.codeExpiry.set(seconds);

    this.codeExpiryInterval = setInterval(() => {
      seconds--;
      this.codeExpiry.set(seconds);

      if (seconds <= 0) {
        clearInterval(this.codeExpiryInterval);
      }
    }, 1000);
  }

  private startResendCooldown(cooldownSeconds?: number) {
    let seconds = cooldownSeconds || 60;
    this.resendCooldown.set(seconds);
    this.canResendCode.set(false);

    this.resendCooldownInterval = setInterval(() => {
      seconds--;
      this.resendCooldown.set(seconds);

      if (seconds <= 0) {
        clearInterval(this.resendCooldownInterval);
        this.canResendCode.set(true);
        this.resendCooldown.set(0);
      }
    }, 1000);
  }

  onPasswordChange(password: string) {
    this.newPassword.set(password);

    const strength = evaluatePasswordStrength(password);
    this.passwordStrength.set(strength);

    if (password && !validatePasswordComplexity(password)) {
      this.passwordError.set('La contraseña no cumple con los requisitos de seguridad');
    } else {
      this.passwordError.set('');
    }

    if (password && !isSecureInput(password)) {
      this.secureError.set('La contraseña contiene caracteres no permitidos');
    } else {
      this.secureError.set('');
    }
  }

  formatTimeRemaining(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  private cleanupIntervals() {
    if (this.codeExpiryInterval) clearInterval(this.codeExpiryInterval);
    if (this.resendCooldownInterval) clearInterval(this.resendCooldownInterval);
    if (this.lockCountdownInterval) clearInterval(this.lockCountdownInterval);
  }

  goBack() {
    if (this.currentStep() === 'verify') {
      this.cleanupIntervals();
      this.currentStep.set('email');
      this.recoveryCode.set('');
      this.codeError.set('');
      this.codeExpiry.set(0);
      this.canResendCode.set(true);
      this.resendCooldown.set(0);
    } else if (this.currentStep() === 'reset') {
      this.currentStep.set('verify');
      this.newPassword.set('');
      this.confirmPassword.set('');
      this.passwordError.set('');
      this.secureError.set('');
      this.passwordStrength.set(null);
    }
  }

  goToLogin() {
    this.cleanupIntervals();
    this.router.navigate(['/auth/login']);
  }
  /**
 * Prevenir espacios en contraseñas
 */
preventSpace(event: KeyboardEvent): void {
  if (event.key === ' ' || event.code === 'Space') {
    event.preventDefault();
  }
}
}