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
    });
  });

  ngOnInit(): void {
    this.loadReturns();
  }

  loadReturns(): void {
    this.isLoading.set(true);
    this.productService.getAllReturns().subscribe({
      next: (returns) => {
        this.returns.set(returns || []);
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
