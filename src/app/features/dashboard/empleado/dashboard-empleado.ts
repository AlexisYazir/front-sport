import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../core/services/auth.service';
import { DashboardPreferencesService } from '../../../core/services/dashboard-preferences.service';

@Component({
  selector: 'app-dashboard-empleado',
  standalone: true,
  imports: [CommonModule, RouterModule, MatTooltipModule],
  templateUrl: './dashboard-empleado.html',
  styleUrl: './dashboard-empleado.css',
})
export class DashboardEmpleado {
  public authService = inject(AuthService);
  public router = inject(Router);
  public preferences = inject(DashboardPreferencesService);

  sidebarOpen = this.preferences.sidebarDefaultOpen;
  navbarOculto = signal<boolean>(false);
  currentUser = this.authService.currentUser();
  lastScrollTop = 0;

  menuItems = [
    { icon: 'orders', label: 'Pedidos', route: '/dashboard/empleado/orders' },
    { icon: 'assignment_return', label: 'Devoluciones', route: '/dashboard/empleado/returns' },
    { icon: 'account_circle', label: 'Perfil', route: '/dashboard/empleado/profile' },
    { icon: 'settings', label: 'Configuración', route: '/dashboard/empleado/settings' },
  ];

  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    const currentScroll = window.pageYOffset || document.documentElement.scrollTop;

    if (currentScroll > this.lastScrollTop && currentScroll > 50) {
      this.navbarOculto.set(true);
    } else {
      this.navbarOculto.set(false);
    }

    this.lastScrollTop = currentScroll;
  }

  toggleSidebar(): void {
    const nextValue = !this.sidebarOpen();
    this.sidebarOpen.set(nextValue);
    this.preferences.setSidebarDefaultOpen(nextValue);
  }

  isActive(route: string): boolean {
    return this.router.url === route || this.router.url.startsWith(`${route}/`);
  }
}
