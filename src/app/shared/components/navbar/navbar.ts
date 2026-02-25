import { Component, inject, signal, computed, HostListener } from '@angular/core';
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
  // Estado para mostrar/ocultar navbar al hacer scroll
  showNavbar = signal<boolean>(true);
  private lastScrollPosition = 0;

  // Verificar si el usuario es administrador (rol = 3)
  isAdmin = computed(() => {
    const user = this.authService.currentUser();
    return user?.rol === 3;
  });

  // Exponer servicios para el template
  get authServicePublic() { return this.authService; }
  cartItemCount = this.cartService.itemCount;

  @HostListener('window:scroll', [])
  onWindowScroll() {
    const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
    
    // Determinar dirección del scroll
    if (currentScroll > this.lastScrollPosition && currentScroll > 50) {
      // Scrolling down - ocultar navbar
      this.showNavbar.set(false);
    } else {
      // Scrolling up - mostrar navbar
      this.showNavbar.set(true);
    }
    
    this.lastScrollPosition = currentScroll;
  }

  getRoleText(): string {
    const user = this.authService.currentUser();
    if (!user) return 'Usuario';
    
    switch(user.rol) {
      case 1: return 'Usuario';
      case 2: return 'Empleado';
      case 3: return 'Administrador';
      default: return 'Usuario';
    }
  }

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

  clearSearch() {
    this.searchTerm.set('');
    this.onSearch();
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
      if (user.rol === 3) {
        return '/dashboard/admin';
      }
      switch(user.rol) {
        case 1: return '/dashboard/usuario';
        case 2: return '/dashboard/empleado';
        default: return '/dashboard/usuario';
      }
    }
    return '/';
  }

  adminLogout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  goToProfile() {
    this.router.navigate(['/dashboard/usuario/profile']);
  }

  goToProfileAdmin() {
    this.router.navigate(['/dashboard/admin/profile']);
  }

  goToSettings() {
    if (this.isAdmin()) {
      this.router.navigate(['/dashboard/admin/settings']);
    } else {
      this.router.navigate(['/dashboard/usuario/settings']);
    }
  }
}