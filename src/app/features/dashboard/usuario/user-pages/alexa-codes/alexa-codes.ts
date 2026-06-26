import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { AlexaVerificationCodeResponse } from '../../../../../core/models/user.model';
import { AuthService } from '../../../../../core/services/auth.service';
import { formatMexicoDateTime } from '../../../../../core/utils/date-time.util';

@Component({
  selector: 'app-alexa-codes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alexa-codes.html',
  styleUrl: './alexa-codes.css',
})
export class AlexaCodes {
  private readonly authService = inject(AuthService);
  private readonly toastr = inject(ToastrService);

  isLoading = signal(false);
  isChecking = signal(true);
  now = signal(Date.now());
  code = signal<AlexaVerificationCodeResponse | null>(null);
  currentUser = computed(() => this.authService.currentUser());
  hasActiveCode = computed(() => {
    const currentCode = this.code();
    return !!(
      currentCode?.hasActiveCode &&
      currentCode.token &&
      currentCode.expiresAt &&
      this.remainingSeconds() > 0
    );
  });
  remainingSeconds = computed(() => {
    const expiresAt = this.code()?.expiresAt;
    if (!expiresAt) return 0;

    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - this.now()) / 1000));
  });
  private countdownId?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.loadCurrentCode();
    this.countdownId = setInterval(() => this.now.set(Date.now()), 1000);
  }

  ngOnDestroy(): void {
    if (this.countdownId) {
      clearInterval(this.countdownId);
    }
  }

  loadCurrentCode(): void {
    this.isChecking.set(true);
    this.authService.getAlexaVerificationCode().subscribe({
      next: (response) => {
        this.code.set(response);
        this.isChecking.set(false);
      },
      error: () => {
        this.code.set(null);
        this.isChecking.set(false);
      },
    });
  }

  requestCode(): void {
    if (this.hasActiveCode()) {
      return;
    }

    this.isLoading.set(true);
    this.authService.requestAlexaVerificationCode().subscribe({
      next: (response) => {
        this.code.set(response);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  copyCode(): void {
    const token = this.code()?.token;
    if (!token) return;

    navigator.clipboard?.writeText(token).then(
      () => this.toastr.success('Código copiado', 'Alexa'),
      () => this.toastr.info(`Código: ${token}`, 'Alexa'),
    );
  }

  formatDate(date: string): string {
    return formatMexicoDateTime(date);
  }

  formatRemaining(seconds: number): string {
    if (seconds <= 0) return 'Expirado';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours} h ${minutes} min ${remainingSeconds} s`;
    }

    if (minutes > 0) {
      return `${minutes} min ${remainingSeconds} s`;
    }

    return `${remainingSeconds} s`;
  }
}
