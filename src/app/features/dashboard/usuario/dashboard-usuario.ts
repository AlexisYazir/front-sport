import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../core/services/cart.service';
import { ProductService } from '../../../core/services/product.service';
import { UserOrder } from '../../../core/models/product.model';
import { formatMexicoDate } from '../../../core/utils/date-time.util';

@Component({
  selector: 'app-dashboard-usuario',
  standalone: true,
  imports: [CommonModule, RouterModule, MatTooltipModule],
  templateUrl: './dashboard-usuario.html',
  styleUrl: './dashboard-usuario.css',
})
export class DashboardUsuario implements OnInit {
  private authService = inject(AuthService);
  private productService = inject(ProductService);
  private cartService = inject(CartService);
  public router = inject(Router);

  sidebarOpen = signal<boolean>(true);
  navbarOculto = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  orders = signal<UserOrder[]>([]);
  lastScrollTop = 0;

  currentUser = computed(() => this.authService.currentUser());
  cartItemCount = this.cartService.itemCount;
  cartSummary = this.cartService.summary;

  menuItems = [
    { icon: 'dashboard', label: 'Dashboard', route: '/dashboard/usuario' },
    { icon: 'shopping_bag', label: 'Compras', route: '/dashboard/usuario/compras' },
    { icon: 'account_circle', label: 'Perfil', route: '/dashboard/usuario/profile' },
    { icon: 'receipt_long', label: 'Facturación', route: '/dashboard/usuario/billing' },
    { icon: 'settings', label: 'Configuración', route: '/dashboard/usuario/settings' },
  ];

  totalOrders = computed(() => this.orders().length);
  deliveredOrders = computed(() =>
    this.orders().filter((order) => this.normalizeStatus(order.estado) === 'entregado').length,
  );
  activeOrders = computed(() =>
    this.orders().filter((order) => this.normalizeStatus(order.estado) !== 'entregado').length,
  );
  totalSpent = computed(() =>
    this.orders().reduce((total, order) => total + Number(order.total || 0), 0),
  );
  points = computed(() => Math.floor(this.totalSpent() / 10));
  recentOrders = computed(() => this.orders().slice(0, 3));
  averageTicket = computed(() =>
    this.totalOrders() > 0 ? this.totalSpent() / this.totalOrders() : 0,
  );
  nextOrder = computed(() =>
    this.orders().find((order) => this.normalizeStatus(order.estado) !== 'entregado') ?? null,
  );
  lastDeliveredOrder = computed(() =>
    this.orders().find((order) => this.normalizeStatus(order.estado) === 'entregado') ?? null,
  );

  get isDashboardRoute(): boolean {
    return this.router.url === '/dashboard/usuario' || this.router.url === '/dashboard/usuario/';
  }

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

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.isLoading.set(true);
    this.cartService.loadCart().subscribe();
    this.productService.getUserOrdersList().subscribe({
      next: (orders) => {
        this.orders.set(orders || []);
        this.isLoading.set(false);
      },
      error: () => {
        this.orders.set([]);
        this.isLoading.set(false);
      },
    });
  }

  toggleSidebar(): void {
    this.sidebarOpen.set(!this.sidebarOpen());
  }

  isActive(route: string): boolean {
    if (route === '/dashboard/usuario') {
      return this.isDashboardRoute;
    }

    return this.router.url.startsWith(route);
  }

  normalizeStatus(status: string): string {
    return String(status || '').trim().toLowerCase();
  }

  getStatusLabel(status: string): string {
    switch (this.normalizeStatus(status)) {
      case 'entregado':
        return 'Entregado';
      case 'en proceso':
        return 'En proceso';
      default:
        return 'Pendiente';
    }
  }

  getStatusClass(status: string): string {
    switch (this.normalizeStatus(status)) {
      case 'entregado':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'en proceso':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
  }

  formatCurrency(value: number | string): string {
    return Number(value || 0).toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN',
    });
  }

  formatDate(date: string | null): string {
    return date ? formatMexicoDate(date) : 'Pendiente';
  }
}
