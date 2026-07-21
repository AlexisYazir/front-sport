import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ProductService } from '../../../../../core/services/product.service';
import { UserOrder } from '../../../../../core/models/product.model';
import { formatMexicoDate } from '../../../../../core/utils/date-time.util';

@Component({
  selector: 'app-user-billing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-billing.html',
  styleUrl: './user-billing.css',
})
export class UserBilling implements OnInit {
  private productService = inject(ProductService);

  orders = signal<UserOrder[]>([]);
  isLoading = signal(false);

  totalSpent = computed(() =>
    this.orders().reduce((total, order) => total + Number(order.total || 0), 0),
  );
  averageTicket = computed(() =>
    this.orders().length > 0 ? this.totalSpent() / this.orders().length : 0,
  );
  paymentMethods = computed(() => {
    const methods = new Map<string, number>();

    for (const order of this.orders()) {
      const method = order.metodo_pago || 'No registrado';
      methods.set(method, (methods.get(method) || 0) + 1);
    }

    return Array.from(methods.entries()).map(([method, count]) => ({ method, count }));
  });

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.isLoading.set(true);
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
