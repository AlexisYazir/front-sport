import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../core/services/cart.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  logo = './assets/images/logo_sportcenter.png';
  
  private authService = inject(AuthService);
  private cartService = inject(CartService);
  private router = inject(Router);

  // Estado de búsqueda
  searchTerm = signal<string>('');
  // Estado del menú móvil
  mobileMenuOpen = signal<boolean>(false);

  // Verificar si el usuario es administrador (rol = 3)
  isAdmin = computed(() => {
    const user = this.authService.currentUser();
    return user?.rol === 3;
  });

  // Exponer servicios para el template
  get authServicePublic() { return this.authService; }
  cartItemCount = this.cartService.itemCount;

  onSearch() {
    const term = this.searchTerm().trim();
    if (term) {
      this.router.navigate(['/products'], { 
        queryParams: { search: term }
      });
    } else {
      this.router.navigate(['/products']);
    }
  }

  onSearchKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.onSearch();
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  toggleMobileMenu() {
    this.mobileMenuOpen.set(!this.mobileMenuOpen());
  }

  getDashboardLink(): string {
    const user = this.authService.currentUser();
    if (user) {
      // Si es admin (rol=3), va al dashboard admin
      if (user.rol === 3) {
        return '/dashboard/admin';
      }
      // Otros roles
      switch(user.rol) {
        case 1: return '/dashboard/usuario';
        case 2: return '/dashboard/empleado';
        default: return '/dashboard/usuario';
      }
    }
    return '/';
  }

  // NUEVO: Método para cerrar sesión desde admin navbar
  adminLogout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  // NUEVO: Método para ir al perfil
  goToProfile() {
    this.router.navigate(['/dashboard/usuario/profile']);
  }

    // NUEVO: Método para ir al perfil admin
  goToProfileAdmin() {
    this.router.navigate(['/dashboard/admin/profile']);
  }

    // NUEVO: Método para ir al dashboard admin
  goToDashboardAdmin() {
    this.router.navigate(['/dashboard/admin']);
  }

  // NUEVO: Método para ir a configuración
  goToSettings() {
  // Para usuario normal
  if (this.isAdmin()) {
    this.router.navigate(['/dashboard/admin/settings']);
  } else {
    this.router.navigate(['/dashboard/usuario/settings']);
  }
}
}