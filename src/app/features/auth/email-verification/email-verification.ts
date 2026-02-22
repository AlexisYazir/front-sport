import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

type VerificationStatus = 'loading' | 'success' | 'error' | 'invalid-token';

@Component({
  selector: 'app-email-verification',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './email-verification.html',
  styleUrl: './email-verification.css'
})
export class EmailVerificationComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toastr = inject(ToastrService);

  // Estados
  status = signal<VerificationStatus>('loading');
  message = signal<string>('Verificando tu cuenta...');
  redirectCountdown = signal<number>(3);
  private redirectInterval: any;

  ngOnInit() {
    // Capturar parámetros de la URL
    this.route.queryParams.subscribe(params => {
      const status = params['status'];
      const token = params['token'];

      if (!token) {
        this.status.set('invalid-token');
        this.message.set('Token inválido o expirado');
        return;
      }

      // Procesar según el estado devuelto por el backend
      if (status === 'success') {
        this.handleSuccess();
      } else if (status === 'error' || status === 'invalid') {
        this.handleError(params['message'] || 'Ocurrió un error al verificar la cuenta');
      } else {
        this.handleError('Estado desconocido');
      }
    });
  }

  /**
   * Manejar verificación exitosa
   */
  private handleSuccess() {
    this.status.set('success');
    this.message.set('¡Cuenta verificada exitosamente!');
    this.toastr.success('Tu cuenta ha sido activada', 'Verificación Exitosa');
    this.startRedirectCountdown();
  }

  /**
   * Manejar error de verificación
   */
  private handleError(errorMessage: string) {
    this.status.set('error');
    this.message.set(errorMessage);
    this.toastr.error(errorMessage, 'Error de Verificación');
  }

  /**
   * Iniciar countdown de redirección (3 segundos)
   */
  private startRedirectCountdown() {
    let seconds = 3;
    this.redirectCountdown.set(seconds);

    this.redirectInterval = setInterval(() => {
      seconds--;
      this.redirectCountdown.set(seconds);

      if (seconds <= 0) {
        clearInterval(this.redirectInterval);
        this.router.navigate(['/auth/login']);
      }
    }, 1000);
  }

  /**
   * Redirigir manualmente a login
   */
  goToLogin() {
    if (this.redirectInterval) {
      clearInterval(this.redirectInterval);
    }
    this.router.navigate(['/auth/login']);
  }

  /**
   * Redirigir a registro
   */
  goToRegister() {
    if (this.redirectInterval) {
      clearInterval(this.redirectInterval);
    }
    this.router.navigate(['/auth/register']);
  }
}
