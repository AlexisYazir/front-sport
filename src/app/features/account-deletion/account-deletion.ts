import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AccountDeletionService } from '../../core/services/account-deletion.service';
import type { DeletionResult } from '../../core/services/account-deletion.types';

const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  orders: 'Pedidos y comprobantes de compra',
  payments: 'Registros de pagos',
  orders_and_payments: 'Pedidos y registros de pagos',
  shipments: 'Información de entregas',
  shipping: 'Información de entregas',
  returns: 'Devoluciones y atención relacionada',
  legal_records: 'Registros sujetos a obligaciones legales',
  audit: 'Constancias de atención y cumplimiento',
};

@Component({
  selector: 'app-account-deletion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './account-deletion.html',
  styleUrls: ['./account-deletion.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountDeletionComponent {
  readonly api = inject(AccountDeletionService);
  readonly supportEmail = 'sportcentersoporte@gmail.com';
  readonly codeForm = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{6}$/)],
    }),
  });
  readonly confirmationForm = new FormGroup({
    confirmed: new FormControl(false, { nonNullable: true, validators: Validators.requiredTrue }),
  });

  readonly resultTitle = computed(() => {
    if (this.api.outcomeUnknown()) return 'Aún no confirmamos el resultado';
    switch (this.api.result()?.status) {
      case 'completed': return 'Tu cuenta fue eliminada';
      case 'requires_attention': return 'Tu solicitud necesita atención';
      case 'error': return 'La eliminación no está completada';
      case 'received': return 'Solicitud recibida';
      case 'identity_verified': return 'Identidad verificada';
      case 'deletion_confirmed': return 'Eliminación confirmada';
      default: return 'Eliminación en proceso';
    }
  });

  readonly resultDescription = computed(() => {
    if (this.api.outcomeUnknown()) {
      return 'El resultado todavía debe comprobarse. La solicitud puede haberse procesado. Consulta su estado antes de intentar otra acción.';
    }
    switch (this.api.result()?.status) {
      case 'completed':
        return 'La eliminación de tu cuenta se completó. Los registros sujetos a una obligación legal se conservan únicamente con ese fin. Un registro futuro creará una cuenta nueva, sin recuperar tus datos ni tu historial anterior.';
      case 'requires_attention':
        return 'El equipo debe atender una situación especial antes de completar la eliminación. Tu solicitud sigue registrada; puedes consultar su estado o contactar a soporte.';
      case 'error':
        return 'Todavía no podemos dar la cuenta por eliminada. Consulta el estado de la solicitud o contacta al equipo de atención.';
      case 'received':
      case 'identity_verified':
        return 'El estado registrado todavía no acredita una eliminación confirmada. Puedes consultar el resultado o solicitar ayuda al equipo de atención.';
      default:
        return 'Tu solicitud está en proceso. Esta pantalla sólo mostrará la eliminación como completada cuando el servicio lo confirme.';
    }
  });

  start(): void {
    if (this.api.busy() || !this.api.canStart() || this.api.stage() === 'result') return;
    this.resetForms();
    this.api.start();
  }

  verifyCode(): void {
    if (this.api.busy() || this.api.stage() !== 'code') return;
    this.codeForm.markAllAsTouched();
    if (this.codeForm.invalid) return;
    const code = this.codeForm.controls.code.value;
    this.confirmationForm.reset({ confirmed: false });
    this.api.verify(code);
    this.codeForm.reset({ code: '' });
  }

  confirmDeletion(): void {
    if (this.api.busy() || this.api.stage() !== 'review' || !this.api.verification()) return;
    this.confirmationForm.markAllAsTouched();
    if (this.confirmationForm.invalid) return;
    this.confirmationForm.reset({ confirmed: false });
    this.api.confirm();
  }

  cancel(): void {
    if (this.api.busy() || this.api.stage() === 'result') return;
    this.resetForms();
    this.api.cancel();
  }

  restartUnconfirmed(): void {
    const status = this.api.result()?.status;
    if (this.api.busy() || this.api.outcomeUnknown() || this.api.stage() !== 'result' ||
        (status !== 'received' && status !== 'identity_verified')) return;
    this.resetForms();
    this.api.restartUnconfirmed();
  }

  discardUnavailableReceipt(): void {
    if (this.api.busy() || this.api.stage() !== 'result' || !this.api.receiptUnavailable()) return;
    this.resetForms();
    this.api.discardUnavailableReceipt();
  }

  categories(values: readonly string[]): string[] {
    return [...new Set(values.map(value => CATEGORY_LABELS[value] ?? 'Otros registros sujetos a conservación legal'))];
  }

  reasonText(reason: string | null): string {
    if (!reason) return '';
    switch (reason) {
      case 'open_orders':
      case 'open_orders_or_returns':
      case 'pending_orders':
      case 'pending_returns':
        return 'Hay pedidos, entregas o devoluciones que requieren atención.';
      case 'pending_payments':
        return 'Hay pagos del pedido que requieren revisión antes de completar la eliminación.';
      case 'retention_policy_required':
        return 'El equipo debe precisar qué información debe conservarse y durante cuánto tiempo.';
      case 'identity_changed':
        return 'La información de identidad cambió. Es necesario verificar de nuevo la solicitud.';
      default:
        return 'El equipo debe revisar una condición de tu solicitud. Puedes contactar a soporte para conocer el seguimiento.';
    }
  }

  notificationText(notification: DeletionResult['notification']): string {
    switch (notification) {
      case 'sent': return 'La notificación del resultado fue enviada por correo.';
      case 'pending': return 'La notificación por correo está pendiente. Puedes consultar el estado aquí.';
      case 'unavailable': return 'No pudimos enviar la notificación por correo. Conserva el folio y consulta el estado aquí.';
      default: return '';
    }
  }

  private resetForms(): void {
    this.codeForm.reset({ code: '' });
    this.confirmationForm.reset({ confirmed: false });
  }
}
