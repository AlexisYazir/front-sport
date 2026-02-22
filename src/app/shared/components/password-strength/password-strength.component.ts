import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PasswordStrength } from '../../../core/validators/custom-validators';

/**
 * Componente para mostrar la fortaleza de la contraseña
 * Visualiza score (0-4) y sugerencias de mejora
 */
@Component({
  selector: 'app-password-strength',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="strength" class="mt-3 space-y-2">
      <!-- Barra de fortaleza -->
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold text-gray-700">Fortaleza:</span>
        <div class="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            [ngClass]="{
              'bg-red-500': strength.score === 0,
              'bg-orange-500': strength.score === 1,
              'bg-yellow-500': strength.score === 2,
              'bg-lime-500': strength.score === 3,
              'bg-green-500': strength.score === 4
            }"
            [style.width.%]="(strength.score + 1) * 20"
            class="h-full transition-all duration-300"
          ></div>
        </div>
        <span 
          [ngClass]="{
            'text-red-600': strength.score === 0,
            'text-orange-600': strength.score === 1,
            'text-yellow-600': strength.score === 2,
            'text-lime-600': strength.score === 3,
            'text-green-600': strength.score === 4
          }"
          class="text-xs font-semibold min-w-20"
        >
          {{ getStrengthLabel(strength.score) }}
        </span>
      </div>

      <!-- Retroalimentación -->
      <div *ngIf="strength.feedback.length > 0" class="space-y-1">
        <p class="text-xs font-semibold text-gray-700">Sugerencias:</p>
        <ul class="text-xs text-gray-600 space-y-1">
          <li *ngFor="let feedback of strength.feedback" class="flex items-start gap-2">
            <span class="text-blue-500 mt-0.5">✓</span>
            <span>{{ feedback }}</span>
          </li>
        </ul>
      </div>

      <!-- Estado de validación -->
      <div *ngIf="!strength.isValid" class="flex items-start gap-2 p-2 bg-red-50 rounded-lg border border-red-200">
        <span class="text-red-500 text-sm mt-0.5">!</span>
        <span class="text-xs text-red-700">
          Tu contraseña debe cumplir con todos los requisitos
        </span>
      </div>

      <div *ngIf="strength.isValid" class="flex items-start gap-2 p-2 bg-green-50 rounded-lg border border-green-200">
        <span class="text-green-600 text-sm mt-0.5">✓</span>
        <span class="text-xs text-green-700">
          Contraseña segura
        </span>
      </div>
    </div>
  `,
  styles: []
})
export class PasswordStrengthComponent {
  @Input() strength: PasswordStrength | null = null;

  getStrengthLabel(score: number): string {
    switch (score) {
      case 0:
        return 'Muy débil';
      case 1:
        return 'Débil';
      case 2:
        return 'Regular';
      case 3:
        return 'Fuerte';
      case 4:
        return 'Muy fuerte';
      default:
        return '';
    }
  }
}
