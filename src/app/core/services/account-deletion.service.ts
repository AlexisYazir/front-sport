import { HttpBackend, HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { Observable, Subscription, map, of, switchMap, throwError, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import type { DeletionRequest, DeletionResult, DeletionVerification } from './account-deletion.types';

export const ACCOUNT_DELETION_API_URL = new InjectionToken<string>('ACCOUNT_DELETION_API_URL', {
  providedIn: 'root', factory: () => environment.apiUrl,
});

type SessionSnapshot = NonNullable<ReturnType<AuthService['captureSession']>>;
interface Receipt { requestId: string; receiptToken: string; ownerId: number }
const RECEIPT_KEY = 'sc_account_deletion_receipt_v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECRET = /^[A-Za-z0-9_-]{43}$/;
const STATUSES = new Set(['received', 'identity_verified', 'deletion_confirmed', 'in_progress', 'completed', 'requires_attention', 'error']);

@Injectable({ providedIn: 'root' })
export class AccountDeletionService {
  private readonly auth = inject(AuthService);
  // This flow owns its authentication. Never replay an irreversible confirmation,
  // refresh/redirect on a receipt request, or send another account's credentials.
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly base = inject(ACCOUNT_DELETION_API_URL).replace(/\/+$/, '') + '/users/account-deletion';
  readonly stage = signal<'start' | 'code' | 'review' | 'result'>('start');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly challengeExpiresAt = signal<string | null>(null);
  readonly verification = signal<DeletionVerification | null>(null);
  readonly result = signal<DeletionResult | null>(null);
  readonly outcomeUnknown = signal(false);
  readonly signedIn = computed(() => this.auth.isAuthenticated());
  readonly canStart = computed(() => this.auth.isAuthenticated() && this.auth.currentUser()?.rol === 1);
  readonly hasReceipt = signal(false);
  readonly receiptUnavailable = signal(false);
  private challenge: DeletionRequest | null = null;
  private owner: SessionSnapshot | null = null;
  private receipt: Receipt | null = null;
  private operation = 0;
  private active?: Subscription;
  private confirming = false;
  private storageWarning: string | null = null;

  constructor() {
    this.restoreReceipt();
    this.auth.getAuthState().subscribe(({ user }) => {
      if (this.receipt && user && user.id !== this.receipt.ownerId) {
        this.reset(true);
        return;
      }
      if (this.owner && !this.auth.isCurrentSession(this.owner) && !this.confirming && !this.receipt) {
        this.reset(false);
        this.error.set('La sesión cambió. Inicia una nueva solicitud con la cuenta que deseas eliminar.');
      }
    });
  }

  start(): void {
    if (this.busy() || !this.canStart() || this.receipt) return;
    const owner = this.auth.captureSession();
    if (!owner) return;
    this.owner = owner;
    this.verification.set(null);
    this.challenge = null;
    this.challengeExpiresAt.set(null);
    this.run(this.authenticated<DeletionRequest>('/requests', {}, owner), (value) => {
      if (!UUID.test(value.requestId) || !SECRET.test(value.receiptToken) || value.status !== 'received' || !this.validDate(value.expiresAt)) {
        throw new Error('INVALID_DELETION_RESPONSE');
      }
      this.challenge = value;
      this.challengeExpiresAt.set(value.expiresAt);
      this.stage.set('code');
    }, 'No se pudo enviar el código. No se ha confirmado la eliminación.');
  }

  verify(code: string): void {
    if (this.busy() || !this.challenge || !this.owner || this.stage() !== 'code' || !/^[0-9]{6}$/.test(code)) return;
    if (Date.parse(this.challenge.expiresAt) <= Date.now()) {
      this.error.set('El código venció. Solicita uno nuevo.');
      return;
    }
    this.run(this.authenticated<DeletionVerification>(`/requests/${this.challenge.requestId}/verify`, { code }, this.owner), (value) => {
      const consequences = value.consequences;
      if (value.status !== 'identity_verified' || !SECRET.test(value.confirmationToken) || !this.validDate(value.expiresAt) ||
          !consequences || consequences.irreversible !== true || consequences.endsAllSessions !== true ||
          consequences.newRegistrationIsSeparate !== true || !Array.isArray(consequences.retainedCategories) ||
          !consequences.retainedCategories.every(item => typeof item === 'string') ||
          typeof consequences.requiresAttention !== 'boolean' || !this.validReason(consequences.reason) ||
          (consequences.retentionPolicy !== null && (!consequences.retentionPolicy ||
            typeof consequences.retentionPolicy.basis !== 'string' || !Number.isInteger(consequences.retentionPolicy.days) ||
            consequences.retentionPolicy.days < 1 || consequences.retentionPolicy.days > 36500))) throw new Error('INVALID_DELETION_RESPONSE');
      this.verification.set(value);
      this.stage.set('review');
    }, 'No se pudo verificar el código. No se ha confirmado la eliminación.');
  }

  confirm(): void {
    const verification = this.verification();
    const owner = this.owner;
    const challenge = this.challenge;
    if (this.busy() || this.stage() !== 'review' || !verification || !owner || !challenge || !this.auth.isCurrentSession(owner)) return;
    if (Date.parse(verification.expiresAt) <= Date.now()) {
      this.verification.set(null);
      this.stage.set('code');
      this.error.set('La autorización venció. Solicita un código nuevo para continuar.');
      return;
    }
    // Persist the read-only receipt BEFORE sending. A lost response must only
    // trigger a status query, including after a reload or the session is revoked.
    this.receipt = { requestId: challenge.requestId, receiptToken: challenge.receiptToken, ownerId: owner.userId };
    this.hasReceipt.set(true);
    this.saveReceipt();
    this.confirming = true;
    const body = { confirmationToken: verification.confirmationToken, confirmed: true };
    this.verification.set(null);
    this.run(this.authenticated<DeletionResult>(`/requests/${challenge.requestId}/confirm`, body, owner), (value) => {
      this.acceptResult(value);
      this.finishConfirmation(owner);
    }, 'No pudimos confirmar el resultado. Consulta el estado; no repitas la eliminación.', () => {
      this.outcomeUnknown.set(true);
      this.stage.set('result');
      this.finishConfirmation(owner);
      this.refreshResult();
    });
  }

  refreshResult(): void {
    if (this.busy() || !this.receipt) return;
    const receipt = this.receipt;
    this.run(this.http.post<DeletionResult>(`${this.base}/requests/${receipt.requestId}/result`,
      { receiptToken: receipt.receiptToken }, { headers: this.headers(), withCredentials: false }).pipe(timeout(30000)),
    value => this.acceptResult(value), 'No se pudo consultar el resultado. La falta de respuesta no acredita la eliminación.', error => {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        this.receiptUnavailable.set(true);
        this.error.set('Este comprobante ya no está disponible. Esto no acredita la eliminación de la cuenta. Contacta a Sport Center para dar seguimiento.');
      }
    });
  }

  cancel(): void {
    if (this.busy() || this.receipt) return;
    this.reset(false);
  }

  restartUnconfirmed(): void {
    if (this.busy() || !['received', 'identity_verified'].includes(this.result()?.status ?? '')) return;
    this.reset(true);
  }

  discardUnavailableReceipt(): void {
    if (this.busy() || !this.receiptUnavailable()) return;
    this.reset(true);
  }

  private authenticated<T>(path: string, body: object, owner: SessionSnapshot): Observable<T> {
    const token$ = this.auth.shouldRefreshSoon() ? this.auth.refreshAccessToken() : of(this.auth.getToken());
    return token$.pipe(switchMap(token => {
      if (!this.auth.isCurrentSession(owner)) return throwError(() => new Error('SESSION_CHANGED'));
      const headers = this.headers(token);
      return this.http.post<T>(this.base + path, body, { headers, withCredentials: true }).pipe(map(value => {
        if (!this.auth.isCurrentSession(owner)) throw new Error('SESSION_CHANGED');
        return value;
      }));
    }), timeout(30000));
  }

  private headers(token?: string | null): HttpHeaders {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' });
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }

  private run<T>(request: Observable<T>, accept: (value: T) => void, fallback: string, failed?: (error?: unknown) => void): void {
    const operation = ++this.operation;
    this.busy.set(true);
    this.error.set(this.receipt ? this.storageWarning : null);
    this.active = request.subscribe({
      next: value => {
        if (operation !== this.operation) return;
        try { accept(value); }
        catch { this.handleFailure(fallback, failed); }
      },
      error: error => {
        if (operation !== this.operation) return;
        this.handleFailure(this.errorMessage(error, fallback), failed, error);
      },
      complete: () => { if (operation === this.operation) this.busy.set(false); },
    });
  }

  private handleFailure(message: string, failed?: (error?: unknown) => void, error?: unknown): void {
    this.busy.set(false);
    this.error.set(message);
    failed?.(error);
  }

  private finishConfirmation(owner: SessionSnapshot): void {
    this.auth.clearDeletedAccountSession(owner);
    this.confirming = false;
    this.challenge = null;
    this.owner = null;
  }

  private acceptResult(value: DeletionResult): void {
    if (!this.receipt || value.requestId !== this.receipt.requestId || !STATUSES.has(value.status) ||
        !Array.isArray(value.retainedCategories) || !value.retainedCategories.every(item => typeof item === 'string') ||
        !['pending', 'sent', 'not_required', 'unavailable'].includes(value.notification) || !this.validReason(value.reason) ||
        (value.retention !== undefined && (!value.retention || !this.validDate(value.retention.until) ||
          typeof value.retention.basis !== 'string' || typeof value.retention.identifiersExpired !== 'boolean'))) throw new Error('INVALID_DELETION_RESPONSE');
    this.result.set(value);
    this.receiptUnavailable.set(false);
    this.outcomeUnknown.set(false);
    this.stage.set('result');
    // A received/verified request has NOT deleted anything. Recovering its receipt
    // must not enable replay of a confirmation whose authorization was consumed.
  }

  private reset(removeReceipt: boolean): void {
    ++this.operation;
    this.active?.unsubscribe();
    this.busy.set(false);
    this.confirming = false;
    this.challenge = null;
    this.owner = null;
    this.verification.set(null);
    this.challengeExpiresAt.set(null);
    this.result.set(null);
    this.receiptUnavailable.set(false);
    this.outcomeUnknown.set(false);
    this.error.set(null);
    this.stage.set('start');
    if (removeReceipt) {
      this.receipt = null;
      this.storageWarning = null;
      this.hasReceipt.set(false);
      try { sessionStorage.removeItem(RECEIPT_KEY); } catch { /* restricted browser */ }
    }
  }

  private saveReceipt(): void {
    try {
      sessionStorage.setItem(RECEIPT_KEY, JSON.stringify(this.receipt));
      this.storageWarning = null;
    } catch {
      this.storageWarning = 'Mantén esta página abierta para consultar el resultado. El navegador no permite guardar el seguimiento.';
    }
  }

  private restoreReceipt(): void {
    try {
      const raw = sessionStorage.getItem(RECEIPT_KEY);
      if (!raw) return;
      const value = JSON.parse(raw) as Receipt;
      if (!UUID.test(value.requestId) || !SECRET.test(value.receiptToken) || !Number.isSafeInteger(value.ownerId) || value.ownerId <= 0) {
        sessionStorage.removeItem(RECEIPT_KEY);
        return;
      }
      this.receipt = { requestId: value.requestId, receiptToken: value.receiptToken, ownerId: value.ownerId };
      this.hasReceipt.set(true);
      this.outcomeUnknown.set(true);
      this.stage.set('result');
    } catch { /* Receipt is optional; no mutation can be recovered or repeated. */ }
  }

  private validDate(value: string): boolean { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }

  private validReason(value: string | null): boolean { return value === null || typeof value === 'string'; }

  private errorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 429) return 'Espera antes de intentarlo de nuevo. Se alcanzó el límite de solicitudes.';
      if (error.status === 401 || error.status === 419) return 'La sesión o la verificación ya no es válida. Inicia sesión y solicita un código nuevo.';
      if (error.status === 503) return 'El servicio no está disponible en este momento. Puedes solicitar atención por correo.';
      if (error.status === 400 && this.stage() === 'code') return 'El código es incorrecto, venció o ya no es válido. Revísalo o solicita uno nuevo.';
      if (error.status === 403) return 'Esta operación requiere la verificación de la cuenta o atención de Sport Center.';
    }
    return fallback;
  }
}
