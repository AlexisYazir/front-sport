import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../core/services/auth.service';

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

  sidebarOpen = signal<boolean>(true);
  navbarOculto = signal<boolean>(false);
  currentUser = this.authService.currentUser();
  lastScrollTop = 0;

  menuItems = [
    { icon: 'orders', label: 'Pedidos', route: '/dashboard/empleado/orders' },
    { icon: 'assignment_return', label: 'Devoluciones', route: '/dashboard/empleado/returns' },
    { icon: 'account_circle', label: 'Perfil', route: '/dashboard/empleado/profile' },
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
    this.sidebarOpen.set(!this.sidebarOpen());
  }

  isActive(route: string): boolean {
    return this.router.url === route || this.router.url.startsWith(`${route}/`);
  }
}
