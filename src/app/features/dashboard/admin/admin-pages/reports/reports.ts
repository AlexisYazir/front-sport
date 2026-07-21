import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartData,
  ChartOptions,
  DoughnutController,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { ToastrService } from 'ngx-toastr';
import { Subscription, finalize } from 'rxjs';
import * as XLSX from 'xlsx';
import { DashboardPreferencesService } from '../../../../../core/services/dashboard-preferences.service';
import {
  ReportGranularity,
  ReportsService,
  SalesReport,
} from '../../../../../core/services/reports.service';
import { formatMexicoDateTime } from '../../../../../core/utils/date-time.util';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  BarController,
  BarElement,
  DoughnutController,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
);

type ReportPreset = '7d' | '30d' | 'month' | '90d' | 'year' | 'custom';
type GranularitySelection = 'auto' | ReportGranularity;

interface KpiCard {
  label: string;
  value: string;
  caption: string;
  icon: string;
  tone: 'blue' | 'green' | 'orange' | 'purple';
  change: number | null;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, BaseChartDirective],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class Reports implements OnInit, OnDestroy {
  private readonly reportsService = inject(ReportsService);
  private readonly toastr = inject(ToastrService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly preferences = inject(DashboardPreferencesService);
  private reportRequest?: Subscription;

  readonly report = signal<SalesReport | null>(null);
  readonly isLoading = signal(true);
  readonly isRefreshing = signal(false);
  readonly isExporting = signal(false);
  readonly errorMessage = signal('');

  selectedPreset: ReportPreset = '30d';
  fromDate = this.addDays(this.today(), -29);
  toDate = this.today();
  granularity: GranularitySelection = 'auto';

  readonly kpiCards = computed<KpiCard[]>(() => {
    const data = this.report();
    if (!data) return [];

    return [
      {
        label: 'Venta neta',
        value: this.formatCurrency(data.summary.netSales),
        caption: 'Ventas cobradas menos reembolsos',
        icon: 'payments',
        tone: 'blue',
        change: data.comparison.netSalesChange,
      },
      {
        label: 'Pedidos cobrados',
        value: this.formatInteger(data.summary.orders),
        caption: `${this.formatInteger(data.summary.units)} unidades vendidas`,
        icon: 'shopping_bag',
        tone: 'green',
        change: data.comparison.ordersChange,
      },
      {
        label: 'Ticket promedio',
        value: this.formatCurrency(data.summary.averageTicket),
        caption: 'Importe promedio por pedido',
        icon: 'receipt_long',
        tone: 'orange',
        change: data.comparison.averageTicketChange,
      },
      {
        label: 'Clientes',
        value: this.formatInteger(data.summary.customers),
        caption: `${this.formatPercent(data.summary.repeatCustomerRate)} recurrentes`,
        icon: 'group',
        tone: 'purple',
        change: data.comparison.customersChange,
      },
    ];
  });

  readonly salesChartData = computed<ChartData<'line'>>(() => {
    const data = this.report();
    return {
      labels: data?.trend.map((item) => this.formatTrendPeriod(item.period, data.meta.granularity)) ?? [],
      datasets: [
        {
          label: 'Venta neta',
          data: data?.trend.map((item) => item.netSales) ?? [],
          borderColor: '#0367A6',
          backgroundColor: '#0367A6',
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#0367A6',
          pointBorderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 3,
          tension: 0.35,
        },
        {
          label: 'Venta cobrada',
          data: data?.trend.map((item) => item.grossSales) ?? [],
          borderColor: '#94A3B8',
          backgroundColor: '#94A3B8',
          borderDash: [6, 5],
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.3,
        },
      ],
    };
  });

  readonly categoryChartData = computed<ChartData<'bar'>>(() => {
    const categories = this.report()?.categories.slice(0, 7) ?? [];
    return {
      labels: categories.map((item) => item.category),
      datasets: [
        {
          label: 'Ingresos',
          data: categories.map((item) => item.revenue),
          backgroundColor: ['#0367A6', '#0EA5E9', '#10B981', '#F59E0B', '#7C3AED', '#EF4444', '#64748B'],
          borderRadius: 5,
          borderSkipped: false,
          maxBarThickness: 28,
        },
      ],
    };
  });

  readonly statusChartData = computed<ChartData<'doughnut'>>(() => {
    const statuses = this.report()?.orderStatuses ?? [];
    return {
      labels: statuses.map((item) => this.formatStatus(item.status)),
      datasets: [
        {
          data: statuses.map((item) => item.orders),
          backgroundColor: statuses.map((item) => this.statusColor(item.status)),
          borderColor: this.preferences.isDarkTheme() ? '#181818' : '#ffffff',
          borderWidth: 3,
          hoverOffset: 5,
        },
      ],
    };
  });

  readonly lineChartOptions = computed<ChartOptions<'line'>>(() => {
    const textColor = this.chartTextColor();
    const gridColor = this.chartGridColor();
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: { color: textColor, usePointStyle: true, pointStyle: 'circle', boxWidth: 8 },
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.dataset.label}: ${this.formatCurrency(Number(context.raw || 0))}`,
          },
        },
      },
      scales: {
        x: { ticks: { color: textColor, maxRotation: 0 }, grid: { display: false } },
        y: {
          beginAtZero: true,
          ticks: {
            color: textColor,
            callback: (value) => this.compactCurrency(Number(value)),
          },
          grid: { color: gridColor },
        },
      },
    };
  });

  readonly barChartOptions = computed<ChartOptions<'bar'>>(() => {
    const textColor = this.chartTextColor();
    return {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `Ingresos: ${this.formatCurrency(Number(context.raw || 0))}`,
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { color: textColor, callback: (value) => this.compactCurrency(Number(value)) },
          grid: { color: this.chartGridColor() },
        },
        y: { ticks: { color: textColor }, grid: { display: false } },
      },
    };
  });

  readonly doughnutChartOptions = computed<ChartOptions<'doughnut'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: this.chartTextColor(),
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 16,
          boxWidth: 8,
        },
      },
    },
  }));

  ngOnInit(): void {
    this.restoreFiltersFromUrl();
    this.loadReport();
  }

  ngOnDestroy(): void {
    this.reportRequest?.unsubscribe();
  }

  selectPreset(preset: Exclude<ReportPreset, 'custom'>): void {
    const today = this.today();
    this.selectedPreset = preset;
    this.toDate = today;

    if (preset === '7d') this.fromDate = this.addDays(today, -6);
    if (preset === '30d') this.fromDate = this.addDays(today, -29);
    if (preset === '90d') this.fromDate = this.addDays(today, -89);
    if (preset === 'month') this.fromDate = `${today.slice(0, 7)}-01`;
    if (preset === 'year') this.fromDate = `${today.slice(0, 4)}-01-01`;

    this.loadReport(true);
  }

  markCustomRange(): void {
    this.selectedPreset = 'custom';
  }

  applyFilters(): void {
    if (!this.fromDate || !this.toDate) {
      this.toastr.warning('Selecciona ambas fechas', 'Reportes');
      return;
    }
    if (this.fromDate > this.toDate) {
      this.toastr.warning('La fecha inicial no puede ser mayor a la final', 'Reportes');
      return;
    }

    this.selectedPreset = 'custom';
    this.loadReport(true);
  }

  refresh(): void {
    this.loadReport(true);
  }

  retry(): void {
    this.loadReport();
  }

  async exportToExcel(): Promise<void> {
    const data = this.report();
    if (!data || this.isExporting()) return;

    this.isExporting.set(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      const workbook = XLSX.utils.book_new();
      const summaryRows = [
        ['Reporte de ventas Sport Center'],
        ['Periodo', `${this.formatDate(data.meta.from)} - ${this.formatDate(data.meta.to)}`],
        ['Generado', formatMexicoDateTime(data.meta.generatedAt)],
        [],
        ['Métrica', 'Periodo actual', 'Periodo anterior', 'Variación'],
        ['Venta neta', data.summary.netSales, data.comparison.previous.netSales, this.excelChange(data.comparison.netSalesChange)],
        ['Venta cobrada', data.summary.grossSales, data.comparison.previous.grossSales, this.excelChange(data.comparison.grossSalesChange)],
        ['Pedidos cobrados', data.summary.orders, data.comparison.previous.orders, this.excelChange(data.comparison.ordersChange)],
        ['Ticket promedio', data.summary.averageTicket, data.comparison.previous.averageTicket, this.excelChange(data.comparison.averageTicketChange)],
        ['Clientes', data.summary.customers, data.comparison.previous.customers, this.excelChange(data.comparison.customersChange)],
        ['Unidades', data.summary.units],
        ['Descuentos', data.summary.discounts],
        ['Ingresos por envío', data.summary.shippingRevenue],
        ['Clientes recurrentes', data.summary.repeatCustomers],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
      summarySheet['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');

      this.appendJsonSheet(workbook, 'Tendencia', data.trend.map((item) => ({
        Periodo: item.period,
        'Venta cobrada': item.grossSales,
        'Venta neta': item.netSales,
        Descuentos: item.discounts,
        Pedidos: item.orders,
        Unidades: item.units,
      })));
      this.appendJsonSheet(workbook, 'Productos', data.topProducts.map((item, index) => ({
        Posición: index + 1,
        Producto: item.name,
        Marca: item.brand,
        Categoría: item.category,
        Unidades: item.units,
        Pedidos: item.orders,
        Ingresos: item.revenue,
        'Participación %': item.contribution,
      })));
      this.appendJsonSheet(workbook, 'Categorías', data.categories.map((item) => ({
        Categoría: item.category,
        Unidades: item.units,
        Pedidos: item.orders,
        Ingresos: item.revenue,
        'Participación %': item.contribution,
      })));
      this.appendJsonSheet(workbook, 'Promociones', data.promotions.map((item) => ({
        Promoción: item.name,
        Código: item.code || 'Sin código',
        Usos: item.uses,
        Clientes: item.customers,
        Descuento: item.discount,
        'Ventas asociadas': item.associatedRevenue,
      })));
      this.appendJsonSheet(workbook, 'Clientes', data.topCustomers.map((item, index) => ({
        Posición: index + 1,
        Cliente: item.name,
        Correo: item.email,
        Pedidos: item.orders,
        Unidades: item.units,
        Total: item.total,
        'Ticket promedio': item.averageTicket,
      })));

      XLSX.writeFile(workbook, `reporte-ventas-${data.meta.from}-a-${data.meta.to}.xlsx`);
      this.toastr.success('Reporte exportado correctamente', 'Reportes');
    } catch {
      this.toastr.error('No fue posible exportar el reporte', 'Reportes');
    } finally {
      this.isExporting.set(false);
    }
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
    }).format(Number(value || 0));
  }

  formatInteger(value: number): string {
    return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(Number(value || 0));
  }

  formatPercent(value: number): string {
    return `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(Number(value || 0))}%`;
  }

  formatDate(value: string): string {
    const date = new Date(`${value}T12:00:00`);
    return new Intl.DateTimeFormat('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  formatStatus(status: string): string {
    const labels: Record<string, string> = {
      pendiente: 'Pendiente',
      preparando: 'Preparando',
      preparado: 'Preparado',
      enviado: 'Enviado',
      en_transito: 'En tránsito',
      'en transito': 'En tránsito',
      entregado: 'Entregado',
      completado: 'Completado',
      incidencia_stock: 'Incidencia de stock',
      reembolsado: 'Reembolsado',
      solicitada: 'Solicitada',
      aprobada: 'Aprobada',
      rechazada: 'Rechazada',
      recibida: 'Recibida',
      reembolsada: 'Reembolsada',
      cerrada: 'Cerrada',
    };
    return labels[status] || status.replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
  }

  statusBadgeClass(status: string): string {
    if (['entregado', 'completado', 'reembolsada', 'cerrada'].includes(status)) return 'status-success';
    if (['incidencia_stock', 'rechazada'].includes(status)) return 'status-danger';
    if (['pendiente', 'solicitada'].includes(status)) return 'status-warning';
    return 'status-info';
  }

  changeText(change: number | null): string {
    if (change === null) return 'Sin base anterior';
    if (change === 0) return 'Sin variación';
    return `${change > 0 ? '+' : ''}${this.formatPercent(change)}`;
  }

  changeClass(change: number | null): string {
    if (change === null || change === 0) return 'change-neutral';
    return change > 0 ? 'change-positive' : 'change-negative';
  }

  changeIcon(change: number | null): string {
    if (change === null || change === 0) return 'horizontal_rule';
    return change > 0 ? 'north_east' : 'south_east';
  }

  hideBrokenImage(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.style.display = 'none';
    image.parentElement?.classList.add('image-fallback');
  }

  private loadReport(showToast = false): void {
    this.reportRequest?.unsubscribe();
    const hasCurrentReport = this.report() !== null;
    this.errorMessage.set('');
    hasCurrentReport ? this.isRefreshing.set(true) : this.isLoading.set(true);
    this.syncFiltersToUrl();

    this.reportRequest = this.reportsService
      .getSalesReport({
        from: this.fromDate,
        to: this.toDate,
        granularity: this.granularity === 'auto' ? undefined : this.granularity,
      })
      .pipe(finalize(() => {
        this.isLoading.set(false);
        this.isRefreshing.set(false);
      }))
      .subscribe({
        next: (report) => {
          this.report.set(report);
          if (showToast) this.toastr.success('Datos actualizados correctamente', 'Actualización');
        },
        error: () => {
          this.errorMessage.set('No fue posible obtener los datos del reporte.');
          if (hasCurrentReport) this.toastr.error('No fue posible actualizar el reporte', 'Reportes');
        },
      });
  }

  private restoreFiltersFromUrl(): void {
    const params = this.route.snapshot.queryParamMap;
    const from = params.get('from');
    const to = params.get('to');
    const group = params.get('group');

    if (from && to && this.isValidDate(from) && this.isValidDate(to) && from <= to) {
      this.fromDate = from;
      this.toDate = to;
      this.selectedPreset = 'custom';
    }
    if (group && ['day', 'week', 'month'].includes(group)) {
      this.granularity = group as ReportGranularity;
    }
  }

  private syncFiltersToUrl(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        from: this.fromDate,
        to: this.toDate,
        group: this.granularity === 'auto' ? null : this.granularity,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private appendJsonSheet(workbook: XLSX.WorkBook, name: string, rows: Record<string, unknown>[]): void {
    const sheet = rows.length > 0
      ? XLSX.utils.json_to_sheet(rows)
      : XLSX.utils.aoa_to_sheet([['Sin datos para el periodo']]);
    sheet['!cols'] = this.calculateColumnWidths(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  }

  private calculateColumnWidths(rows: Record<string, unknown>[]): Array<{ wch: number }> {
    if (rows.length === 0) return [{ wch: 30 }];
    return Object.keys(rows[0]).map((key) => ({
      wch: Math.min(
        45,
        Math.max(key.length + 2, ...rows.map((row) => String(row[key] ?? '').length + 2)),
      ),
    }));
  }

  private excelChange(value: number | null): string {
    return value === null ? 'Sin base anterior' : `${value}%`;
  }

  private chartTextColor(): string {
    return this.preferences.isDarkTheme() ? '#D1D5DB' : '#64748B';
  }

  private chartGridColor(): string {
    return this.preferences.isDarkTheme() ? 'rgba(255,255,255,0.08)' : 'rgba(148,163,184,0.18)';
  }

  private statusColor(status: string): string {
    const colors: Record<string, string> = {
      pendiente: '#F59E0B',
      preparando: '#7C3AED',
      preparado: '#7C3AED',
      enviado: '#0EA5E9',
      en_transito: '#2563EB',
      'en transito': '#2563EB',
      entregado: '#10B981',
      completado: '#059669',
      incidencia_stock: '#EF4444',
      reembolsado: '#64748B',
    };
    return colors[status] || '#94A3B8';
  }

  private compactCurrency(value: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }

  private formatTrendPeriod(value: string, granularity: ReportGranularity): string {
    const date = new Date(`${value}T12:00:00`);
    if (granularity === 'month') {
      return new Intl.DateTimeFormat('es-MX', { month: 'short', year: '2-digit' }).format(date);
    }
    if (granularity === 'week') {
      return `Sem. ${new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(date)}`;
    }
    return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(date);
  }

  private today(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  private addDays(value: string, days: number): string {
    const date = new Date(`${value}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  private isValidDate(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime());
  }
}
