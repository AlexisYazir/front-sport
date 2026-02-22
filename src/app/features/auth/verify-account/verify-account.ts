import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { Subscription } from 'rxjs';

// ============================================================================
// RATE LIMITING CONFIGURATION
// ============================================================================
interface RateLimitState {
  attempts: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

const RATE_LIMIT_CONFIG = {
  maxAttempts: 3,           // Máximo 3 intentos
  timeWindow: 15 * 60000,   // Ventana de 15 minutos
  lockDuration: 30 * 60000, // Bloqueo de 30 minutos
  cooldownBase: 60,         // Cooldown base de 60 segundos
};

@Component({
  selector: 'app-verify-account',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './verify-account.html',
})
export class VerifyAccountComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);

  form!: FormGroup;
  email = '';
  from: 'login' | 'register' | 'other' = 'other';
  info = '';
  loading = false;
  error: string | null = null;
  resendCooldown = 0;
  
  // Rate limiting state
  isRateLimited = false;
  rateLimitMessage = '';
  remainingAttempts = RATE_LIMIT_CONFIG.maxAttempts;
  
  private cooldownRef: any = null;
  private routeSub: Subscription | null = null;
  private rateLimitKey = '';

  ngOnInit(): void {
    this.form = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });

    this.routeSub = this.route.queryParams.subscribe((params) => {
      this.email = (params['email'] || '').toString();
      const f = (params['from'] || '').toString().toLowerCase();
      this.from = f === 'login' || f === 'register' ? f : 'other';
      
      this.rateLimitKey = `rate_limit_recovery_${this.email}`;
      
      // Verificar rate limit al cargar
      this.checkRateLimit();
      
      this.info = this.email
        ? `Se ha enviado (o se enviará) un código de 6 dígitos a ${this.email}.`
        : 'Ingresa tu correo para recibir el código.';

      // AUTO-REENVIO: solo si no está bloqueado
      if (this.email && this.from !== 'register' && !this.isRateLimited) {
        this.autoResendIfNeeded();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.routeSub) this.routeSub.unsubscribe();
    this.clearCooldown();
  }

  submit(): void {
    this.error = null;
    if (this.form.invalid || !this.email) {
      this.error = 'Ingresa un código válido y un correo.';
      return;
    }

    const code = this.form.value.code;
    this.loading = true;

    this.auth.verifyRecoveryCode(this.email, code).subscribe({
      next: () => {
        this.loading = false;
        // ÉXITO: Limpiar rate limit
        this.clearRateLimit();
        this.router.navigate(['/auth/login']);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Código inválido o expirado.';
      },
    });
  }

  resend(): void {
    this.error = null;
    
    // Verificar rate limit ANTES de permitir reenvío
    if (this.isRateLimited) {
      this.error = this.rateLimitMessage;
      return;
    }
    
    if (!this.email || this.resendCooldown > 0) return;

    // Registrar intento
    if (!this.recordAttempt()) {
      this.error = this.rateLimitMessage;
      return;
    }

    this.loading = true;
    const resend$ =
      typeof (this.auth as any).requestResendCode === 'function'
        ? (this.auth as any).requestResendCode(this.email)
        : this.auth.requestPasswordReset(this.email);

    resend$.subscribe({
      next: () => {
        this.loading = false;
        this.info = `Código reenviado a ${this.email}. Revisa tu bandeja de entrada. (${this.remainingAttempts} intentos restantes)`;
        
        // Cooldown progresivo basado en intentos
        const state = this.getRateLimitState();
        const cooldown = this.calculateCooldown(state.attempts);
        this.startCooldown(cooldown);
      },
      error: (err: any) => {
        this.loading = false;
        this.error = err?.error?.message || 'No se pudo reenviar el código.';
      },
    });
  }

  // ============================================================================
  // RATE LIMITING LOGIC
  // ============================================================================

  /**
   * Verifica si el usuario está bajo rate limit
   */
  private checkRateLimit(): void {
    const state = this.getRateLimitState();
    const now = Date.now();

    // Verificar si está bloqueado
    if (state.lockedUntil && now < state.lockedUntil) {
      this.isRateLimited = true;
      const remainingMinutes = Math.ceil((state.lockedUntil - now) / 60000);
      this.rateLimitMessage = `Demasiados intentos. Cuenta bloqueada por ${remainingMinutes} minutos.`;
      this.startLockCountdown(state.lockedUntil);
      return;
    }

    // Limpiar bloqueo expirado
    if (state.lockedUntil && now >= state.lockedUntil) {
      this.clearRateLimit();
      return;
    }

    // Verificar ventana de tiempo
    if (state.firstAttempt && now - state.firstAttempt > RATE_LIMIT_CONFIG.timeWindow) {
      // Ventana expirada, resetear
      this.clearRateLimit();
      return;
    }

    // Calcular intentos restantes
    this.remainingAttempts = Math.max(0, RATE_LIMIT_CONFIG.maxAttempts - state.attempts);
    this.isRateLimited = false;
  }

  /**
   * Registra un intento de reenvío y verifica límites
   */
  private recordAttempt(): boolean {
    const state = this.getRateLimitState();
    const now = Date.now();

    // Inicializar si es el primer intento
    if (!state.firstAttempt) {
      state.firstAttempt = now;
      state.attempts = 0;
    }

    // Verificar si la ventana expiró
    if (now - state.firstAttempt > RATE_LIMIT_CONFIG.timeWindow) {
      // Resetear ventana
      state.firstAttempt = now;
      state.attempts = 0;
      state.lockedUntil = null;
    }

    // Incrementar intentos
    state.attempts++;

    // Verificar si alcanzó el límite
    if (state.attempts >= RATE_LIMIT_CONFIG.maxAttempts) {
      state.lockedUntil = now + RATE_LIMIT_CONFIG.lockDuration;
      this.saveRateLimitState(state);
      
      this.isRateLimited = true;
      const lockMinutes = Math.ceil(RATE_LIMIT_CONFIG.lockDuration / 60000);
      this.rateLimitMessage = `Has excedido el límite de ${RATE_LIMIT_CONFIG.maxAttempts} intentos. Bloqueado por ${lockMinutes} minutos.`;
      this.startLockCountdown(state.lockedUntil);
      
      return false;
    }

    // Guardar estado y actualizar UI
    this.saveRateLimitState(state);
    this.remainingAttempts = RATE_LIMIT_CONFIG.maxAttempts - state.attempts;
    
    return true;
  }

  /**
   * Calcula el cooldown progresivo basado en intentos
   * 1er intento: 60s
   * 2do intento: 120s
   * 3er intento: 180s
   */
  private calculateCooldown(attempts: number): number {
    return RATE_LIMIT_CONFIG.cooldownBase * Math.min(attempts, 3);
  }

  /**
   * Obtiene el estado del rate limit desde localStorage
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
    };
  }

  /**
   * Guarda el estado del rate limit en localStorage
   */
  private saveRateLimitState(state: RateLimitState): void {
    try {
      localStorage.setItem(this.rateLimitKey, JSON.stringify(state));
    } catch (e) {
      console.error('Error saving rate limit state:', e);
    }
  }

  /**
   * Limpia el rate limit (llamar tras éxito o expiración)
   */
  private clearRateLimit(): void {
    try {
      localStorage.removeItem(this.rateLimitKey);
    } catch (e) {
      console.error('Error clearing rate limit:', e);
    }
    
    this.isRateLimited = false;
    this.remainingAttempts = RATE_LIMIT_CONFIG.maxAttempts;
    this.rateLimitMessage = '';
  }

  /**
   * Inicia countdown visual del bloqueo
   */
  private startLockCountdown(lockUntil: number): void {
    this.clearCooldown();
    
    const updateCountdown = () => {
      const now = Date.now();
      const remaining = lockUntil - now;
      
      if (remaining <= 0) {
        this.isRateLimited = false;
        this.rateLimitMessage = '';
        this.clearRateLimit();
        this.clearCooldown();
        return;
      }
      
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      this.rateLimitMessage = `Bloqueado. Espera ${minutes}m ${seconds}s`;
    };
    
    updateCountdown();
    this.cooldownRef = setInterval(updateCountdown, 1000);
  }

  // ============================================================================
  // EXISTING METHODS (sin cambios)
  // ============================================================================

  private autoResendIfNeeded() {
    if (!this.email) return;

    const key = `sc_resend_sent_${this.email}`;
    const last = sessionStorage.getItem(key);
    const now = Date.now();

    if (last && now - Number(last) < 60_000) {
      const elapsed = Math.floor((now - Number(last)) / 1000);
      const remaining = Math.max(0, 60 - elapsed);
      if (remaining > 0) this.startCooldown(remaining);
      return;
    }

    // Verificar rate limit antes de auto-reenviar
    if (this.isRateLimited) {
      this.error = this.rateLimitMessage;
      return;
    }

    // Registrar intento para auto-reenvío
    if (!this.recordAttempt()) {
      this.error = this.rateLimitMessage;
      return;
    }

    const resend$ =
      typeof (this.auth as any).requestResendCode === 'function'
        ? (this.auth as any).requestResendCode(this.email)
        : this.auth.requestPasswordReset(this.email);

    this.loading = true;
    resend$.subscribe({
      next: () => {
        this.loading = false;
        sessionStorage.setItem(key, String(Date.now()));
        this.info = `Se ha enviado un código a ${this.email}. Revisa tu bandeja de entrada. (${this.remainingAttempts} intentos restantes)`;
        
        const state = this.getRateLimitState();
        const cooldown = this.calculateCooldown(state.attempts);
        this.startCooldown(cooldown);
      },
      error: (err: any) => {
        this.loading = false;
        this.error = err?.error?.message || 'No fue posible enviar el código automáticamente.';
      },
    });
  }

  startCooldown(seconds: number) {
    this.clearCooldown();
    this.resendCooldown = seconds;
    this.cooldownRef = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) this.clearCooldown();
    }, 1000);
  }

  clearCooldown() {
    if (this.cooldownRef) {
      clearInterval(this.cooldownRef);
      this.cooldownRef = null;
    }
    this.resendCooldown = 0;
  }

  cancel(): void {
    this.router.navigate(['/auth/login']);
  }
}