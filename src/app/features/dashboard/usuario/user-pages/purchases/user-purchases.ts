import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { ProductService } from '../../../../../core/services/product.service';
import { CreateReturnRequest, ProductReturn, UserOrder } from '../../../../../core/models/product.model';
import { formatMexicoDateTime } from '../../../../../core/utils/date-time.util';

type OrderFilter = 'all' | 'pendiente' | 'en proceso' | 'entregado';

@Component({
  selector: 'app-user-purchases',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-purchases.html',
  styleUrl: './user-purchases.css',
})
export class UserPurchases implements OnInit {
  private productService = inject(ProductService);
  private toastr = inject(ToastrService);

  orders = signal<UserOrder[]>([]);
  returns = signal<ProductReturn[]>([]);
  isLoading = signal(false);
  isSubmittingReturn = signal(false);
  searchTerm = signal('');
  selectedStatus = signal<OrderFilter>('all');
  expandedOrderId = signal<number | null>(null);
  returnOrder = signal<UserOrder | null>(null);
  returnReason = signal('');
  returnComment = signal('');
  returnSelection = signal<Record<number, { selected: boolean; cantidad: number; motivo: string }>>({});

  filteredOrders = computed(() => {
    const search = this.searchTerm().trim().toLowerCase();
    const status = this.selectedStatus();

    return this.orders().filter((order) => {
      const orderStatus = this.normalizeStatus(order.estado);
      const matchesStatus = status === 'all' || orderStatus === status;
      const matchesSearch =
        !search ||
        [
          String(order.id_orden),
          order.estado,
          order.metodo_pago,
          ...(order.items || []).flatMap((item) => [item.sku, item.producto]),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));

      return matchesStatus && matchesSearch;
    });
  });

  totalSpent = computed(() =>
    this.filteredOrders().reduce((total, order) => total + Number(order.total || 0), 0),
  );
  deliveredCount = computed(() => this.statusCount('entregado'));
  activeCount = computed(() =>
    this.filteredOrders().filter((order) => this.normalizeStatus(order.estado) !== 'entregado').length,
  );
  visibleReturns = computed(() =>
    [...this.returns()].sort(
      (a, b) =>
        new Date(b.fecha_actualizacion || b.fecha_solicitud).getTime() -
        new Date(a.fecha_actualizacion || a.fecha_solicitud).getTime(),
    ),
  );

  ngOnInit(): void {
    this.loadOrders();
    this.loadReturns();
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

  loadReturns(): void {
    this.productService.getUserReturns().subscribe({
      next: (returns) => this.returns.set(returns || []),
      error: () => this.returns.set([]),
    });
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.selectedStatus.set('all');
  }

  toggleTracking(order: UserOrder): void {
    this.expandedOrderId.set(this.expandedOrderId() === order.id_orden ? null : order.id_orden);
  }

  openReturn(order: UserOrder): void {
    if (this.normalizeStatus(order.estado) !== 'entregado') {
      this.toastr.info('Solo puedes devolver pedidos entregados', 'Devoluciones');
      return;
    }

    if (this.hasActiveReturn(order)) {
      this.toastr.info('Este pedido ya tiene una devolución activa', 'Devoluciones');
      return;
    }

    const selection: Record<number, { selected: boolean; cantidad: number; motivo: string }> = {};
    for (const item of order.items || []) {
      selection[Number(item.id_variante)] = {
        selected: false,
        cantidad: 1,
        motivo: '',
      };
    }

    this.returnOrder.set(order);
    this.returnReason.set('');
    this.returnComment.set('');
    this.returnSelection.set(selection);
  }

  closeReturn(): void {
    this.returnOrder.set(null);
    this.returnReason.set('');
    this.returnComment.set('');
    this.returnSelection.set({});
  }

  toggleReturnItem(idVariante: number, selected: boolean): void {
    const current = { ...this.returnSelection() };
    current[idVariante] = {
      ...(current[idVariante] || { cantidad: 1, motivo: '' }),
      selected,
    };
    this.returnSelection.set(current);
  }

  updateReturnQuantity(idVariante: number, quantity: number): void {
    const current = { ...this.returnSelection() };
    current[idVariante] = {
      ...(current[idVariante] || { selected: true, motivo: '' }),
      cantidad: Math.max(1, Number(quantity || 1)),
    };
    this.returnSelection.set(current);
  }

  updateReturnReason(idVariante: number, reason: string): void {
    const current = { ...this.returnSelection() };
    current[idVariante] = {
      ...(current[idVariante] || { selected: true, cantidad: 1 }),
      motivo: reason,
    };
    this.returnSelection.set(current);
  }

  submitReturn(): void {
    const order = this.returnOrder();
    const reason = this.returnReason().trim();

    if (!order) return;

    if (!reason) {
      this.toastr.warning('Indica el motivo general de la devolución', 'Devoluciones');
      return;
    }

    const selection = this.returnSelection();
    const items = (order.items || [])
      .filter((item) => selection[Number(item.id_variante)]?.selected)
      .map((item) => ({
        id_variante: Number(item.id_variante),
        cantidad: Math.min(
          Number(selection[Number(item.id_variante)]?.cantidad || 1),
          Number(item.cantidad || 1),
        ),
        motivo: selection[Number(item.id_variante)]?.motivo?.trim() || undefined,
      }));

    if (items.length === 0) {
      this.toastr.warning('Selecciona al menos un producto', 'Devoluciones');
      return;
    }

    const payload: CreateReturnRequest = {
      id_orden: order.id_orden,
      motivo: reason,
      comentario: this.returnComment().trim() || undefined,
      items,
    };

    this.isSubmittingReturn.set(true);
    this.productService.createReturnRequest(payload).subscribe({
      next: (response) => {
        this.toastr.success(response.message, 'Devoluciones');
        this.isSubmittingReturn.set(false);
        this.closeReturn();
        this.loadReturns();
      },
      error: (error) => {
        this.isSubmittingReturn.set(false);
        const message = error?.error?.message || 'No fue posible solicitar la devolución';
        this.toastr.error(message, 'Devoluciones');
      },
    });
  }

  hasActiveReturn(order: UserOrder): boolean {
    return this.returns().some(
      (item) =>
        Number(item.id_orden) === Number(order.id_orden) &&
        ['solicitada', 'aprobada', 'recibida'].includes(
          String(item.estado || '').trim().toLowerCase(),
        ),
    );
  }

  getReturnsForOrder(order: UserOrder): ProductReturn[] {
    return this.returns().filter((item) => Number(item.id_orden) === Number(order.id_orden));
  }

  getOrderEvents(order: UserOrder): any[] {
    return order.eventos_envio || [];
  }

  getShipmentStatusLabel(status: string | null | undefined): string {
    const normalized = this.normalizeShipmentStatus(status);
    const labels: Record<string, string> = {
      pendiente: 'Pendiente',
      preparando: 'Preparando',
      enviado: 'Enviado',
      en_transito: 'En tránsito',
      entregado: 'Entregado',
      incidencia: 'Incidencia',
    };

    return labels[normalized] || 'Pendiente';
  }

  getReturnStatusLabel(status: string | null | undefined): string {
    const normalized = String(status || '').trim().toLowerCase();
    const labels: Record<string, string> = {
      solicitada: 'En revisión',
      aprobada: 'Aprobada',
      rechazada: 'Rechazada',
      recibida: 'Recibida',
      reembolsada: 'Reembolsada',
      cerrada: 'Cerrada',
    };

    return labels[normalized] || 'En revisión';
  }

  getReturnStatusClass(status: string | null | undefined): string {
    const normalized = String(status || '').trim().toLowerCase();

    if (['aprobada', 'recibida', 'reembolsada'].includes(normalized)) {
      return 'bg-green-100 text-green-700 border-green-200';
    }

    if (normalized === 'rechazada') {
      return 'bg-red-100 text-red-700 border-red-200';
    }

    if (normalized === 'cerrada') {
      return 'bg-gray-100 text-gray-700 border-gray-200';
    }

    return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  }

  getVariantInfo(item: any): string {
    const atributos = item?.atributos || {};
    const values = [atributos.Talla, atributos.talla, atributos.Color, atributos.color]
      .filter(Boolean);
    return values.join(' · ');
  }

  getAddressLabel(order: UserOrder): string {
    const address = order.direccion_envio;
    if (!address) return 'Sin dirección registrada';

    return [
      address.calle,
      address.numero,
      address.colonia,
      address.ciudad,
      address.estado,
      address.codigo_postal,
    ]
      .filter(Boolean)
      .join(', ');
  }

  private normalizeShipmentStatus(status: string | null | undefined): string {
    return String(status || 'pendiente').trim().toLowerCase().replace(/\s+/g, '_');
  }

  normalizeStatus(status: string): OrderFilter {
    const normalized = String(status || '').trim().toLowerCase();

    if (normalized === 'entregado') return 'entregado';
    if (normalized === 'en proceso') return 'en proceso';
    return 'pendiente';
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

  statusCount(status: OrderFilter): number {
    return this.filteredOrders().filter((order) => this.normalizeStatus(order.estado) === status).length;
  }

  formatCurrency(value: number | string): string {
    return Number(value || 0).toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN',
    });
  }

  formatDate(date: string | null): string {
    return date ? formatMexicoDateTime(date) : 'Pendiente';
  }
}
