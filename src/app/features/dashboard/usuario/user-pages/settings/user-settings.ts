import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../../../core/services/auth.service';

@Component({
  selector: 'app-user-settings',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './user-settings.html',
  styleUrl: './user-settings.css',
})
export class UserSettings {
  private authService = inject(AuthService);

  currentUser = computed(() => this.authService.currentUser());
  accountStatus = computed(() => (this.currentUser()?.activo === 1 ? 'Activa' : 'Pendiente'));
}
