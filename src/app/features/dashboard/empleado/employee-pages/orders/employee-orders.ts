import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import {
  EmployeeOrder,
  EmployeeOrderStatus,
  UpdateShipmentRequest,
} from '../../../../../core/models/product.model';
import { ProductService } from '../../../../../core/services/product.service';
import { formatMexicoDateTime } from '../../../../../core/utils/date-time.util';

type StatusFilter = EmployeeOrderStatus | 'all';

@Component({
  selector: 'app-employee-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './employee-orders.html',
  styleUrl: './employee-orders.css',
})
export class EmployeeOrders implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly toastr = inject(ToastrService);

  orders = signal<EmployeeOrder[]>([]);
  isLoading = signal(false);
  updatingOrderId = signal<number | null>(null);

  searchTerm = signal('');
  selectedStatus = signal<StatusFilter>('all');
  currentPage = signal(1);
  expandedOrderId = signal<number | null>(null);

  readonly pageSize = 10;
  readonly statuses: Array<{ value: EmployeeOrderStatus; label: string }> = [
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'en proceso', label: 'En proceso' },
    { value: 'entregado', label: 'Entregado' },
  ];
  readonly shipmentActions: Array<{
    value: UpdateShipmentRequest['estado'];
    label: string;
    icon: string;
  }> = [
    { value: 'preparando', label: 'Preparar', icon: 'inventory_2' },
    { value: 'enviado', label: 'Enviar', icon: 'local_shipping' },
    { value: 'en_transito', label: 'En tránsito', icon: 'route' },
    { value: 'entregado', label: 'Entregar', icon: 'task_alt' },
  ];

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
          order.cliente,
          order.email,
          order.estado,
          order.metodo_pago,
          ...(order.items || []).flatMap((item) => [item.sku, item.producto]),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));

      return matchesStatus && matchesSearch;
    });
  });

  paginatedOrders = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredOrders().slice(start, start + this.pageSize);
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredOrders().length / this.pageSize)),
  );

  pendingCount = computed(() => this.statusCount('pendiente'));
  inProcessCount = computed(() => this.statusCount('en proceso'));
  deliveredCount = computed(() => this.statusCount('entregado'));

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.isLoading.set(true);
    this.productService.getEmployeeOrdersList().subscribe({
      next: (orders) => {
        this.orders.set(orders || []);
        this.currentPage.set(1);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.toastr.error('No fue posible cargar los pedidos', 'Pedidos');
      },
    });
  }

  refresh(): void {
    this.productService.clearRequestCache();
    this.loadOrders();
  }

  onFiltersChange(): void {
    this.currentPage.set(1);
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.selectedStatus.set('all');
    this.currentPage.set(1);
  }

  onStatusChange(order: EmployeeOrder, status: string): void {
    const newStatus = this.normalizeStatus(status);
    const currentStatus = this.normalizeStatus(order.estado);

    if (currentStatus === 'entregado') {
      this.toastr.info('Los pedidos entregados ya están finalizados', 'Pedidos');
      return;
    }

    if (newStatus === currentStatus) {
      return;
    }

    this.updatingOrderId.set(order.id_orden);
    this.productService
      .updateEmployeeOrderStatus(order.id_orden, newStatus)
      .subscribe({
        next: (response) => {
          const updated = response.order;
          this.orders.set(
            this.orders().map((item) =>
              item.id_orden === order.id_orden
                ? {
                    ...item,
                    estado: updated.estado,
                    fecha_envio: String(updated.fecha_envio ?? item.fecha_envio ?? ''),
                    fecha_entrega: String(updated.fecha_entrega ?? item.fecha_entrega ?? ''),
                  }
                : item,
            ),
          );
          this.updatingOrderId.set(null);
          this.toastr.success(response.message, 'Pedidos');
        },
        error: (error) => {
          this.updatingOrderId.set(null);
          const message = error?.error?.message || 'No fue posible actualizar el pedido';
          this.toastr.error(message, 'Pedidos');
        },
      });
  }

  quickShipmentUpdate(
    order: EmployeeOrder,
    status: UpdateShipmentRequest['estado'],
  ): void {
    if (this.isDelivered(order)) {
      this.toastr.info('Los pedidos entregados ya están finalizados', 'Envíos');
      return;
    }

    const payload: UpdateShipmentRequest = {
      estado: status,
      comentario: `Actualización de envío: ${this.getShipmentStatusLabel(status)}`,
    };

    if (['enviado', 'en_transito', 'en transito'].includes(status)) {
      payload.tracking_number =
        window.prompt('Número de guía / tracking', order.tracking_number || '')?.trim() ||
        order.tracking_number ||
        undefined;
      payload.paqueteria =
        window.prompt('Paquetería', order.paqueteria || '')?.trim() ||
        order.paqueteria ||
        undefined;
    }

    if (status === 'entregado' && !confirm('¿Marcar este pedido como entregado?')) {
      return;
    }

    this.updatingOrderId.set(order.id_orden);
    this.productService.updateOrderShipment(order.id_orden, payload).subscribe({
      next: (response) => {
        const tracking = response.tracking;
        this.orders.set(
          this.orders().map((item) =>
            item.id_orden === order.id_orden
              ? {
                  ...item,
                  estado: tracking.estado_pedido || item.estado,
                  estado_envio: tracking.estado_envio,
                  tracking_number: tracking.tracking_number,
                  paqueteria: tracking.paqueteria,
                  fecha_envio: tracking.fecha_envio || item.fecha_envio,
                  fecha_entrega: tracking.fecha_entrega || item.fecha_entrega,
                  fecha_entrega_estimada: tracking.fecha_entrega_estimada,
                  fecha_entrega_real: tracking.fecha_entrega_real,
                  eventos_envio: tracking.eventos_envio || item.eventos_envio,
                }
              : item,
          ),
        );
        this.updatingOrderId.set(null);
        this.toastr.success(response.message, 'Envíos');
      },
      error: (error) => {
        this.updatingOrderId.set(null);
        const message = error?.error?.message || 'No fue posible actualizar el envío';
        this.toastr.error(message, 'Envíos');
      },
    });
  }

  goToPage(page: number): void {
    this.currentPage.set(Math.min(Math.max(1, page), this.totalPages()));
  }

  toggleOrderDetails(order: EmployeeOrder): void {
    this.expandedOrderId.set(this.expandedOrderId() === order.id_orden ? null : order.id_orden);
  }

  pageNumbers(): number[] {
    return Array.from({ length: this.totalPages() }, (_, index) => index + 1);
  }

  normalizeStatus(status: string): EmployeeOrderStatus {
    const normalized = String(status || '').trim().toLowerCase();

    if (normalized === 'entregado') return 'entregado';
    if (normalized === 'en proceso') return 'en proceso';
    return 'pendiente';
  }

  getStatusLabel(status: string): string {
    const normalized = this.normalizeStatus(status);
    const found = this.statuses.find((item) => item.value === normalized);
    return found?.label || 'Pendiente';
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

    if (['enviado', 'en_transito', 'preparando'].includes(normalized)) {
      return 'bg-blue-100 text-blue-700 border-blue-200';
    }

    if (normalized === 'incidencia') {
      return 'bg-red-100 text-red-700 border-red-200';
    }

    return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  }

  isDelivered(order: EmployeeOrder): boolean {
    return this.normalizeStatus(order.estado) === 'entregado';
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

  getVariantInfo(item: any): string {
    const atributos = item?.atributos || {};
    const values = [atributos.Talla, atributos.talla, atributos.Color, atributos.color]
      .filter(Boolean);
    return values.join(' · ');
  }

  getAddressLabel(order: EmployeeOrder): string {
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

  statusCount(status: EmployeeOrderStatus): number {
    return this.orders().filter((order) => this.normalizeStatus(order.estado) === status)
      .length;
  }

  get firstItem(): number {
    if (this.filteredOrders().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize + 1;
  }

  get lastItem(): number {
    return Math.min(this.currentPage() * this.pageSize, this.filteredOrders().length);
  }
}
