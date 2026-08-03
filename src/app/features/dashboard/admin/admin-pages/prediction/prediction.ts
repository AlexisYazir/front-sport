import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { ToastrService } from 'ngx-toastr';
import { IconModule } from '../../../../../shared/icons/icon.module';

import {
  CategoryScale,
  Chart,
  ChartConfiguration,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';

import {
  DataMiningService,
  DemandProduct,
  DemandReport,
} from '../../../../../core/services/data-mining.service';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
);

@Component({
  selector: 'app-prediction',
  standalone: true,
  imports: [IconModule, CommonModule, FormsModule, BaseChartDirective],
  templateUrl: './prediction.html',
  styleUrl: './prediction.css',
})
export class Prediction implements OnInit {
  private readonly dataMiningService = inject(DataMiningService);
  private readonly toastr = inject(ToastrService);

  // Estado del reporte
  report: DemandReport | null = null;
  isLoading = signal<boolean>(true);
  hasError = signal<boolean>(false);
  
  // Datos filtrados y paginados
  filteredProducts: DemandProduct[] = [];
  paginatedProducts: DemandProduct[] = [];
  
  // Filtros
  searchValue: string = '';
  filterTipo: string = 'all';
  
  // Paginación - SIEMPRE 10 POR PÁGINA
  rowsPerPage: number = 10;
  first: number = 0;
  currentPage: number = 1;
  totalRecords: number = 0;

  // Datos del chart
  chartData: ChartConfiguration<'line'>['data'] = { labels: [], datasets: [] };
  readonly chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `${Number(context.parsed.y || 0).toLocaleString('es-MX')} unidades`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#64748b' } },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(148, 163, 184, .18)' },
        ticks: { color: '#64748b', precision: 0 },
      },
    },
  };

  ngOnInit(): void {
    this.loadReport();
  }

  loadReport(showToast = false): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.dataMiningService.getDemandReport().subscribe({
      next: (report) => {
        const normalizedReport = this.normalizeReport(report);
        this.report = normalizedReport;
        this.buildChart(normalizedReport);
        this.applyFilters();
        this.isLoading.set(false);
        if (showToast) {
          this.toastr.success('Proyección y métricas actualizadas', 'Demanda mensual');
        }
      },
      error: () => {
        this.hasError.set(true);
        this.isLoading.set(false);
        this.toastr.error('No fue posible cargar el análisis de demanda', 'Reportes');
      },
    });
  }

  // APLICAR FILTROS
  applyFilters(): void {
    if (!this.report) {
      this.filteredProducts = [];
      this.totalRecords = 0;
      this.updatePaginatedProducts();
      return;
    }

    let filtered = [...this.report.products];

    // Filtro por búsqueda
    if (this.searchValue) {
      const term = this.normalize(this.searchValue);
      filtered = filtered.filter(product => {
        const searchText = this.normalize(
          `${product.nombre_producto} ${product.sku} ${product.id_producto} ${product.id_variante}`
        );
        return searchText.includes(term);
      });
    }

    // Filtro por tendencia
    if (this.filterTipo !== 'all') {
      filtered = filtered.filter(product => product.tendencia === this.filterTipo);
    }

    this.filteredProducts = filtered;
    this.totalRecords = filtered.length;
    this.first = 0;
    this.currentPage = 1;
    this.updatePaginatedProducts();
  }

  onSearch(event: any): void {
    this.searchValue = event.target.value;
    this.applyFilters();
  }

  onFilterTipoChange(event: any): void {
    this.filterTipo = event.target.value;
    this.applyFilters();
  }

  clearSearch(): void {
    this.searchValue = '';
    this.filterTipo = 'all';
    this.applyFilters();
  }

  refreshData(): void {
    this.loadReport(true);
  }

  // Paginación
  updatePaginatedProducts(): void {
    const start = this.first;
    const end = Math.min(this.first + this.rowsPerPage, this.totalRecords);
    this.paginatedProducts = this.filteredProducts.slice(start, end);
    this.currentPage = Math.floor(this.first / this.rowsPerPage) + 1;
  }

  changePage(action: 'first' | 'prev' | 'next' | 'last'): void {
    switch (action) {
      case 'first': 
        this.first = 0; 
        break;
      case 'prev': 
        if (this.first > 0) this.first -= this.rowsPerPage; 
        break;
      case 'next': 
        if (this.first + this.rowsPerPage < this.totalRecords) this.first += this.rowsPerPage; 
        break;
      case 'last': 
        this.first = Math.floor((this.totalRecords - 1) / this.rowsPerPage) * this.rowsPerPage; 
        break;
    }
    this.updatePaginatedProducts();
  }

  goToPage(page: number): void {
    this.first = (page - 1) * this.rowsPerPage;
    this.updatePaginatedProducts();
  }

  get last(): number {
    return Math.min(this.first + this.rowsPerPage, this.totalRecords);
  }

  get pageNumbers(): number[] {
    const totalPages = Math.ceil(this.totalRecords / this.rowsPerPage);
    const current = this.currentPage;
    const pages: number[] = [];
    
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (current <= 3) {
        for (let i = 1; i <= 5; i++) pages.push(i);
      } else if (current >= totalPages - 2) {
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        for (let i = current - 2; i <= current + 2; i++) pages.push(i);
      }
    }
    return pages;
  }

  // Métodos de utilidad
  formatMonth(value: string | null): string {
    if (!value) return 'Sin definir';
    const normalized = /^\d{4}-\d{2}$/.test(value) ? `${value}-01T12:00:00Z` : value;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return value;
    const result = new Intl.DateTimeFormat('es-MX', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
    return result.charAt(0).toUpperCase() + result.slice(1);
  }

  monthHeader(monthsBack: number): string {
    const projectedMonth = this.report?.meta?.projectedMonth || this.report?.products?.[0]?.mes_proyectado || null;
    if (!projectedMonth) {
      return monthsBack === 1 ? 'Mes anterior' : `Hace ${monthsBack} meses`;
    }

    const normalized = /^\d{4}-\d{2}$/.test(projectedMonth)
      ? `${projectedMonth}-01T12:00:00Z`
      : projectedMonth;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
      return monthsBack === 1 ? 'Mes anterior' : `Hace ${monthsBack} meses`;
    }

    date.setUTCMonth(date.getUTCMonth() - monthsBack);
    const label = new Intl.DateTimeFormat('es-MX', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
    return label.charAt(0).toUpperCase() + label.slice(1).replace('.', '');
  }

  variationClass(value: number): string {
    if (value > 0) return 'positive';
    if (value < 0) return 'negative';
    return 'neutral';
  }

  getTrendIcon(trend: DemandProduct['tendencia']): string | null {
    if (trend === 'creciente') return 'trending_up';
    if (trend === 'decreciente') return 'trending_down';
    return null;
  }

  private buildChart(report: DemandReport): void {
    this.chartData = {
      labels: report.trend.map((point) => this.formatMonth(point.month)),
      datasets: [
        {
          data: report.trend.map((point) => point.actual),
          label: 'Demanda real',
          borderColor: '#0367a6',
          backgroundColor: 'rgba(3, 103, 166, .13)',
          pointBackgroundColor: '#0367a6',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 3,
          tension: 0.35,
          fill: true,
        },
      ],
    };
  }

  private normalizeReport(report: DemandReport): DemandReport {
    const seenVariants = new Set<number>();

    const products = (report.products ?? [])
      .map((product: any) => {
        const idProducto = this.toNumber(product.id_producto);
        const idVariante = this.toNumber(product.id_variante);
        const nombreProducto = String(product.nombre_producto ?? '').trim();
        const cantidadMesAnterior = this.toNumber(product.cantidad_mes_anterior);
        const demandaEstimada = Math.max(
          0,
          Math.round(this.toNumber(product.demanda_estimada ?? product.predicted_units)),
        );
        const variacionEstimada = Math.round(
          this.toNumber(product.variacion_estimada ?? demandaEstimada - cantidadMesAnterior),
        );

        return {
          ...product,
          id_producto: idProducto,
          id_variante: idVariante,
          sku: String(product.sku ?? '').trim() || `Variante #${idVariante}`,
          nombre_producto: nombreProducto,
          imagen: this.normalizeImage(product.imagen ?? product.image ?? product.imagen_variante),
          mes_objetivo: product.mes_objetivo ?? product.mes_proyectado ?? report.meta?.projectedMonth ?? '',
          mes_proyectado: product.mes_proyectado ?? product.mes_objetivo ?? report.meta?.projectedMonth ?? '',
          cantidad_hace_3_meses: this.toNumber(product.cantidad_hace_3_meses),
          cantidad_hace_2_meses: this.toNumber(product.cantidad_hace_2_meses),
          cantidad_mes_anterior: cantidadMesAnterior,
          cantidad_mes_objetivo: this.toNumber(product.cantidad_mes_objetivo),
          demanda_estimada: demandaEstimada,
          variacion_estimada: variacionEstimada,
          tendencia: this.normalizeTrend(product.tendencia, variacionEstimada),
        } as DemandProduct;
      })
      .filter((product) => this.isValidProduct(product))
      .filter((product) => {
        if (seenVariants.has(product.id_variante)) return false;
        seenVariants.add(product.id_variante);
        return true;
      });

    const projectedDemand = products.reduce((sum, product) => sum + product.demanda_estimada, 0);
    const lastDemand = products.reduce((sum, product) => sum + product.cantidad_mes_anterior, 0);
    const variation = projectedDemand - lastDemand;

    return {
      ...report,
      trend: (report.trend ?? []).map((point: any) => ({
        month: String(point.month ?? ''),
        actual: this.toNumber(point.actual),
        records: this.toNumber(point.records),
      })),
      products,
      summary: {
        ...report.summary,
        variants: products.length,
        projectedDemand,
        lastDemand,
        variation,
        variationPercent: lastDemand > 0 ? Number(((variation / lastDemand) * 100).toFixed(1)) : 0,
        growing: products.filter((product) => product.tendencia === 'creciente').length,
        stable: products.filter((product) => product.tendencia === 'estable').length,
        declining: products.filter((product) => product.tendencia === 'decreciente').length,
      },
    };
  }

  private normalizeTrend(value: unknown, variation: number): DemandProduct['tendencia'] {
    const trend = this.normalize(String(value ?? ''));
    if (trend === 'creciente' || trend === 'estable' || trend === 'decreciente') {
      return trend as DemandProduct['tendencia'];
    }
    if (Math.abs(variation) <= 2) return 'estable';
    return variation > 0 ? 'creciente' : 'decreciente';
  }

  private toNumber(value: unknown): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private normalize(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private normalizeImage(value: unknown): string | null {
    if (Array.isArray(value)) {
      for (const item of value) {
        const image = this.normalizeImage(item);
        if (image) return image;
      }
      return null;
    }

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      return this.normalizeImage(
        record['url'] ?? record['secure_url'] ?? record['imagen'] ?? record['src'] ?? record['0'],
      );
    }

    const image = String(value ?? '').trim();
    if ((image.startsWith('[') && image.endsWith(']')) || (image.startsWith('{') && image.endsWith('}'))) {
      try {
        return this.normalizeImage(JSON.parse(image));
      } catch {
        return image;
      }
    }

    return image ? image : null;
  }

  private isValidProduct(product: DemandProduct): boolean {
    const idProducto = Number(product?.id_producto);
    const idVariante = Number(product?.id_variante);
    const metrics = [
      Number(product?.cantidad_hace_3_meses),
      Number(product?.cantidad_hace_2_meses),
      Number(product?.cantidad_mes_anterior),
      Number(product?.demanda_estimada),
      Number(product?.variacion_estimada),
    ];

    return Number.isFinite(idProducto)
      && idProducto > 0
      && Number.isFinite(idVariante)
      && idVariante > 0
      && Boolean(String(product?.nombre_producto ?? '').trim())
      && metrics.every(Number.isFinite);
  }
}