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
  private closeTimeout: any;
  private infoTimeout: any;
  private supportTimeout: any;
  private isMobile = window.innerWidth < 768;

  // Estados de los dropdowns (por click) - para móvil
  userMenuOpen = signal<boolean>(false);
  guestMenuOpen = signal<boolean>(false);
  adminMenuOpen = signal<boolean>(false);
  
  // Estados de hover - para desktop
  userHovered = false;
  guestHovered = false;
  adminHovered = false;
  
  // Estados para info y soporte
  infoHovered = false;
  supportHovered = false;
  
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

  // Métodos para determinar si mostrar los menús
  shouldShowUserMenu(): boolean {
    return this.userMenuOpen() || (this.userHovered && !this.isMobile);
  }

  shouldShowGuestMenu(): boolean {
    return this.guestMenuOpen() || (this.guestHovered && !this.isMobile);
  }

  shouldShowAdminMenu(): boolean {
    return this.adminMenuOpen() || (this.adminHovered && !this.isMobile);
  }

  shouldShowInfoMenu(): boolean {
    return !this.isMobile && this.infoHovered;
  }

  shouldShowSupportMenu(): boolean {
    return !this.isMobile && this.supportHovered;
  }

  @HostListener('window:resize')
  onResize() {
    this.isMobile = window.innerWidth < 768;
    // Cerrar menús al cambiar tamaño
    if (this.isMobile) {
      this.infoHovered = false;
      this.supportHovered = false;
    }
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
    
    if (currentScroll > this.lastScrollPosition && currentScroll > 50) {
      this.showNavbar.set(false);
    } else {
      this.showNavbar.set(true);
    }
    
    this.lastScrollPosition = currentScroll;
  }

  // Cerrar menús al hacer click fuera
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.relative')) {
      this.userMenuOpen.set(false);
      this.guestMenuOpen.set(false);
      this.adminMenuOpen.set(false);
      this.infoHovered = false;
      this.supportHovered = false;
      
      // Limpiar timeouts
      if (this.closeTimeout) clearTimeout(this.closeTimeout);
      if (this.infoTimeout) clearTimeout(this.infoTimeout);
      if (this.supportTimeout) clearTimeout(this.supportTimeout);
    }
  }

  // Manejo de hover
  onMouseEnter(menu: 'user' | 'guest' | 'admin' | 'info' | 'support') {
    if (menu === 'info') {
      if (!this.isMobile) {
        if (this.infoTimeout) clearTimeout(this.infoTimeout);
        this.infoHovered = true;
      }
      return;
    }
    
    if (menu === 'support') {
      if (!this.isMobile) {
        if (this.supportTimeout) clearTimeout(this.supportTimeout);
        this.supportHovered = true;
      }
      return;
    }
    
    // Para user, guest, admin
    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout);
      this.closeTimeout = null;
    }
    
    if (menu === 'user') this.userHovered = true;
    if (menu === 'guest') this.guestHovered = true;
    if (menu === 'admin') this.adminHovered = true;
  }

  onMouseLeave(menu: 'user' | 'guest' | 'admin' | 'info' | 'support') {
    if (menu === 'info') {
      if (!this.isMobile) {
        this.infoTimeout = setTimeout(() => {
          this.infoHovered = false;
          this.infoTimeout = null;
        }, 300); // Mismo delay que user/guest/admin
      }
      return;
    }
    
    if (menu === 'support') {
      if (!this.isMobile) {
        this.supportTimeout = setTimeout(() => {
          this.supportHovered = false;
          this.supportTimeout = null;
        }, 300); // Mismo delay que user/guest/admin
      }
      return;
    }
    
    // Para user, guest, admin
    this.closeTimeout = setTimeout(() => {
      if (menu === 'user') this.userHovered = false;
      if (menu === 'guest') this.guestHovered = false;
      if (menu === 'admin') this.adminHovered = false;
      this.closeTimeout = null;
    }, 300);
  }

  // Cancelar cierre para info y soporte
  cancelInfoClose() {
    if (this.infoTimeout) {
      clearTimeout(this.infoTimeout);
      this.infoTimeout = null;
    }
  }

  cancelSupportClose() {
    if (this.supportTimeout) {
      clearTimeout(this.supportTimeout);
      this.supportTimeout = null;
    }
  }

  // Toggles para click - solo para user/guest/admin
  toggleUserMenu() {
    this.userMenuOpen.update(val => !val);
    this.guestMenuOpen.set(false);
    this.adminMenuOpen.set(false);
  }

  toggleGuestMenu() {
    this.guestMenuOpen.update(val => !val);
    this.userMenuOpen.set(false);
    this.adminMenuOpen.set(false);
  }

  toggleAdminMenu() {
    this.adminMenuOpen.update(val => !val);
    this.userMenuOpen.set(false);
    this.guestMenuOpen.set(false);
  }

  closeAllMenus() {
    this.userMenuOpen.set(false);
    this.guestMenuOpen.set(false);
    this.adminMenuOpen.set(false);
    this.userHovered = false;
    this.guestHovered = false;
    this.adminHovered = false;
    this.infoHovered = false;
    this.supportHovered = false;
    
    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout);
      this.closeTimeout = null;
    }
    if (this.infoTimeout) {
      clearTimeout(this.infoTimeout);
      this.infoTimeout = null;
    }
    if (this.supportTimeout) {
      clearTimeout(this.supportTimeout);
      this.supportTimeout = null;
    }
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
    this.closeAllMenus();
    this.router.navigate(['/']);
  }

  toggleMobileMenu() {
    this.mobileMenuOpen.update(val => !val);
    if (this.mobileMenuOpen()) {
      this.closeAllMenus();
    }
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
    this.closeAllMenus();
    this.router.navigate(['/']);
  }

  goToProfile() {
    this.router.navigate(['/dashboard/usuario/profile']);
    this.closeAllMenus();
  }

  goToProfileAdmin() {
    this.router.navigate(['/dashboard/admin/profile']);
    this.closeAllMenus();
  }

  goToSettings() {
    if (this.isAdmin()) {
      this.router.navigate(['/dashboard/admin/settings']);
    } else {
      this.router.navigate(['/dashboard/usuario/settings']);
    }
    this.closeAllMenus();
  }
}