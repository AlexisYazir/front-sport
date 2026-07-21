import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ProductService } from '../../../../../core/services/product.service';
import { UserOrder } from '../../../../../core/models/product.model';
import { formatMexicoDateTime } from '../../../../../core/utils/date-time.util';

type OrderFilter = 'all' | 'pendiente_pago' | 'pendiente' | 'en proceso' | 'entregado';

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
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  orders = signal<UserOrder[]>([]);
  isLoading = signal(false);
  searchTerm = signal('');
  selectedStatus = signal<OrderFilter>('all');
  currentPage = signal(1);
  selectedOrderId = signal<number | null>(null);
  expandedOrderId = signal<number | null>(null);
  deliveryCode = signal('');
  confirmingDeliveryId = signal<number | null>(null);

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
    }).sort(
      (a, b) => new Date(b.fecha_creacion || 0).getTime() - new Date(a.fecha_creacion || 0).getTime(),
    );
  });

  paginatedOrders = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredOrders().slice(start, start + this.pageSize);
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredOrders().length / this.pageSize)),
  );

  selectedOrder = computed(() => {
    const id = this.selectedOrderId();
    if (!id) return null;
    return this.orders().find((order) => Number(order.id_orden) === Number(id)) ?? null;
  });

  totalSpent = computed(() =>
    this.filteredOrders().reduce((total, order) => total + Number(order.total || 0), 0),
  );
  deliveredCount = computed(() => this.statusCount('entregado'));
  activeCount = computed(() =>
    this.filteredOrders().filter((order) => this.normalizeStatus(order.estado) !== 'entregado').length,
  );
  readonly pageSize = 10;

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));
      this.selectedOrderId.set(Number.isFinite(id) && id > 0 ? id : null);
    });
    this.loadOrders();
  }

  loadOrders(): void {
    this.isLoading.set(true);
    this.productService.getUserOrdersList().subscribe({
      next: (orders) => {
        this.orders.set(orders || []);
        this.currentPage.set(1);
        this.isLoading.set(false);
      },
      error: () => {
        this.orders.set([]);
        this.isLoading.set(false);
      },
    });
  }

  refreshOrders(): void {
    this.productService.clearRequestCache();
    this.loadOrders();
    this.toastr.success('Datos actualizados correctamente', 'Actualización');
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.selectedStatus.set('all');
    this.currentPage.set(1);
  }

  onFiltersChange(): void {
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    this.currentPage.set(Math.min(Math.max(1, page), this.totalPages()));
  }

  pageNumbers(): number[] {
    return Array.from({ length: this.totalPages() }, (_, index) => index + 1);
  }

  toggleTracking(order: UserOrder): void {
    this.expandedOrderId.set(this.expandedOrderId() === order.id_orden ? null : order.id_orden);
  }

  viewOrder(order: UserOrder): void {
    this.router.navigate(['/dashboard/usuario/compras', order.id_orden]);
  }

  backToPurchases(): void {
    this.router.navigate(['/dashboard/usuario/compras']);
  }

  confirmDelivery(order: UserOrder): void {
    const code = this.deliveryCode().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (!/^[A-Z0-9]{10}$/.test(code)) {
      this.toastr.info('El código debe tener 10 caracteres', 'Confirmar entrega');
      return;
    }

    this.confirmingDeliveryId.set(order.id_orden);
    this.productService.confirmDeliveryCode(order.id_orden, code).subscribe({
      next: (response) => {
        const tracking = response.tracking;
        this.orders.set(
          this.orders().map((item) =>
            item.id_orden === order.id_orden
              ? {
                  ...item,
                  estado_envio: tracking.estado_envio,
                  entrega_confirmada_por_usuario: tracking.entrega_confirmada_por_usuario,
                  entrega_confirmada_en: tracking.entrega_confirmada_en,
                  entrega_validada_por_empleado: tracking.entrega_validada_por_empleado,
                  entrega_validada_en: tracking.entrega_validada_en,
                  eventos_envio: tracking.eventos_envio || item.eventos_envio,
                }
              : item,
          ),
        );
        this.deliveryCode.set('');
        this.confirmingDeliveryId.set(null);
        this.toastr.success(response.message, 'Confirmar entrega');
      },
      error: (error) => {
        this.confirmingDeliveryId.set(null);
        const message = error?.error?.message || 'No fue posible confirmar la entrega';
        this.toastr.error(message, 'Confirmar entrega');
      },
    });
  }

  getOrderImage(order: UserOrder): string {
    return this.getPrimaryOrderItem(order)?.imagen || 'assets/images/no-image.jpg';
  }

  getPrimaryOrderItem(order: UserOrder): any {
    return order.items?.[0] || null;
  }

  getItemName(item: any): string {
    return item?.producto || item?.nombre || 'Producto';
  }

  getItemDescription(item: any): string {
    return item?.descripcion || [item?.marca, item?.categoria].filter(Boolean).join(' · ') || 'Producto de Sport Center';
  }

  getItemAttributes(item: any): string {
    const attrs = this.getVariantInfo(item);
    return attrs || [item?.marca, item?.categoria].filter(Boolean).join(' · ');
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

  getShipmentStatusClass(status: string | null | undefined): string {
    const normalized = this.normalizeShipmentStatus(status);

    if (normalized === 'entregado') {
      return 'bg-green-100 text-green-700 border-green-200';
    }

    if (['preparando', 'enviado', 'en_transito'].includes(normalized)) {
      return 'bg-blue-100 text-blue-700 border-blue-200';
    }

    if (normalized === 'incidencia') {
      return 'bg-red-100 text-red-700 border-red-200';
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

    if (normalized === 'pendiente_pago') return 'pendiente_pago';
    if (normalized === 'entregado') return 'entregado';
    if (normalized === 'en proceso') return 'en proceso';
    return 'pendiente';
  }

  getStatusLabel(status: string): string {
    switch (this.normalizeStatus(status)) {
      case 'pendiente_pago':
        return 'Pago pendiente';
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
      case 'pendiente_pago':
        return 'bg-orange-100 text-orange-700 border-orange-200';
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

  get firstItem(): number {
    if (this.filteredOrders().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize + 1;
  }

  get lastItem(): number {
    return Math.min(this.currentPage() * this.pageSize, this.filteredOrders().length);
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

  formatLongDate(date: string | null): string {
    if (!date) return 'Pendiente';

    return new Intl.DateTimeFormat('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(date));
  }
}
