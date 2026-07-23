import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { ToastrService } from 'ngx-toastr';
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
  imports: [CommonModule, FormsModule, BaseChartDirective],
  templateUrl: './prediction.html',
  styleUrl: './prediction.css',
})
export class Prediction implements OnInit {
  private readonly dataMiningService = inject(DataMiningService);
  private readonly toastr = inject(ToastrService);

  report: DemandReport | null = null;
  isLoading = true;
  hasError = false;
  searchTerm = '';
  trendFilter: 'all' | DemandProduct['tendencia'] = 'all';
  currentPage = 1;
  readonly pageSize = 10;

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
    this.isLoading = true;
    this.hasError = false;
    this.dataMiningService.getDemandReport().subscribe({
      next: (report) => {
        this.report = report;
        this.buildChart(report);
        this.currentPage = 1;
        this.isLoading = false;
        if (showToast) {
          this.toastr.success('Proyección y métricas actualizadas', 'Demanda mensual');
        }
      },
      error: () => {
        this.hasError = true;
        this.isLoading = false;
        this.toastr.error('No fue posible cargar el análisis de demanda', 'Reportes');
      },
    });
  }

  get filteredProducts(): DemandProduct[] {
    const query = this.normalize(this.searchTerm);
    return (this.report?.products ?? []).filter((product) => {
      const matchesTrend = this.trendFilter === 'all' || product.tendencia === this.trendFilter;
      const matchesSearch = !query || this.normalize(
        `${product.nombre_producto} ${product.id_producto} ${product.id_variante}`,
      ).includes(query);
      return matchesTrend && matchesSearch;
    });
  }

  get paginatedProducts(): DemandProduct[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredProducts.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredProducts.length / this.pageSize));
  }

  get visiblePages(): number[] {
    const start = Math.max(1, Math.min(this.currentPage - 2, this.totalPages - 4));
    const end = Math.min(this.totalPages, start + 4);
    return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
  }

  applyFilters(): void {
    this.currentPage = 1;
  }

  setPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

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

  variationClass(value: number): string {
    if (value > 0) return 'positive';
    if (value < 0) return 'negative';
    return 'neutral';
  }

  trendIcon(trend: DemandProduct['tendencia']): string {
    if (trend === 'creciente') return 'trending_up';
    if (trend === 'decreciente') return 'trending_down';
    return 'trending_flat';
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

  private normalize(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
