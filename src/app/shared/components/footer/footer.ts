import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer {
  private authService = inject(AuthService);

  // Verificar si el usuario es admin (rol = 3)
  get isAdmin(): boolean {
    const user = this.authService.currentUser();
    return user?.rol === 3;
  }
}