import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { ProductReturn, UpdateReturnStatusRequest } from '../../../../../core/models/product.model';
import { ProductService } from '../../../../../core/services/product.service';
import { formatMexicoDateTime } from '../../../../../core/utils/date-time.util';

type ReturnFilter = UpdateReturnStatusRequest['estado'] | 'all';

@Component({
  selector: 'app-employee-returns',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './employee-returns.html',
  styleUrl: './employee-returns.css',
})
export class EmployeeReturns implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly toastr = inject(ToastrService);

  returns = signal<ProductReturn[]>([]);
  isLoading = signal(false);
  updatingId = signal<number | null>(null);
  searchTerm = signal('');
  selectedStatus = signal<ReturnFilter>('all');
  currentPage = signal(1);
  readonly pageSize = 10;

  readonly statuses: Array<{ value: UpdateReturnStatusRequest['estado']; label: string }> = [
    { value: 'solicitada', label: 'Solicitada' },
    { value: 'aprobada', label: 'Aprobada' },
    { value: 'rechazada', label: 'Rechazada' },
    { value: 'recibida', label: 'Recibida' },
    { value: 'reembolsada', label: 'Reembolsada' },
    { value: 'cerrada', label: 'Cerrada' },
  ];

  filteredReturns = computed(() => {
    const search = this.searchTerm().trim().toLowerCase();
    const status = this.selectedStatus();

    return this.returns().filter((item) => {
      const matchesStatus = status === 'all' || this.normalizeStatus(item.estado) === status;
      const matchesSearch =
        !search ||
        [
          String(item.id_devolucion),
          String(item.id_orden),
          item.cliente,
          item.email,
          item.motivo,
          item.estado,
          ...(item.items || []).flatMap((product) => [product.sku, product.producto]),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));

      return matchesStatus && matchesSearch;
    }).sort(
      (a, b) =>
        new Date(b.fecha_actualizacion || b.fecha_solicitud || 0).getTime() -
        new Date(a.fecha_actualizacion || a.fecha_solicitud || 0).getTime(),
    );
  });

  paginatedReturns = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredReturns().slice(start, start + this.pageSize);
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredReturns().length / this.pageSize)),
  );

  requestedCount = computed(() => this.statusCount('solicitada'));
  approvedCount = computed(() =>
    this.returns().filter((item) => ['aprobada', 'recibida'].includes(this.normalizeStatus(item.estado))).length,
  );
  closedCount = computed(() =>
    this.returns().filter((item) => ['reembolsada', 'cerrada', 'rechazada'].includes(this.normalizeStatus(item.estado))).length,
  );

  ngOnInit(): void {
    this.loadReturns();
  }

  loadReturns(): void {
    this.isLoading.set(true);
    this.productService.getAllReturns().subscribe({
      next: (returns) => {
        this.returns.set(returns || []);
        this.currentPage.set(1);
        this.isLoading.set(false);
      },
      error: () => {
        this.returns.set([]);
        this.isLoading.set(false);
        this.toastr.error('No fue posible cargar devoluciones', 'Devoluciones');
      },
    });
  }

  updateStatus(item: ProductReturn, estado: string): void {
    const nextStatus = this.normalizeStatus(estado);
    const currentStatus = this.normalizeStatus(item.estado);

    if (nextStatus === currentStatus) {
      return;
    }

    const comentario = window.prompt('Comentario para historial', '')?.trim() || undefined;
    this.updatingId.set(item.id_devolucion);
    this.productService.updateReturnStatus(item.id_devolucion, { estado: nextStatus, comentario }).subscribe({
      next: (response) => {
        this.returns.set(
          this.returns().map((current) =>
            current.id_devolucion === item.id_devolucion ? response.return : current,
          ),
        );
        this.updatingId.set(null);
        this.toastr.success(response.message, 'Devoluciones');
      },
      error: (error) => {
        this.updatingId.set(null);
        this.toastr.error(error?.error?.message || 'No fue posible actualizar devolución', 'Devoluciones');
      },
    });
  }

  normalizeStatus(status: string): UpdateReturnStatusRequest['estado'] {
    const normalized = String(status || '').trim().toLowerCase();
    const allowed = this.statuses.map((item) => item.value);
    return allowed.includes(normalized as UpdateReturnStatusRequest['estado'])
      ? (normalized as UpdateReturnStatusRequest['estado'])
      : 'solicitada';
  }

  getStatusLabel(status: string): string {
    return this.statuses.find((item) => item.value === this.normalizeStatus(status))?.label || 'Solicitada';
  }

  getStatusClass(status: string): string {
    switch (this.normalizeStatus(status)) {
      case 'aprobada':
      case 'recibida':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'reembolsada':
      case 'cerrada':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'rechazada':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
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

  get firstItem(): number {
    if (this.filteredReturns().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize + 1;
  }

  get lastItem(): number {
    return Math.min(this.currentPage() * this.pageSize, this.filteredReturns().length);
  }

  statusCount(status: UpdateReturnStatusRequest['estado']): number {
    return this.returns().filter((item) => this.normalizeStatus(item.estado) === status).length;
  }

  getReturnImage(item: ProductReturn): string {
    return item.items?.[0]?.imagen || 'assets/images/no-image.jpg';
  }

  getMainProductName(item: ProductReturn): string {
    return item.items?.[0]?.producto || item.items?.[0]?.sku || 'Producto';
  }

  formatCurrency(value: number | string | undefined): string {
    return Number(value || 0).toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN',
    });
  }

  formatDate(date: string | null | undefined): string {
    return date ? formatMexicoDateTime(date) : 'Pendiente';
  }
}
