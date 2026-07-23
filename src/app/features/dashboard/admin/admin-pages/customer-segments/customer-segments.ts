import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { ToastrService } from 'ngx-toastr';
import {
  ArcElement,
  Chart,
  ChartConfiguration,
  DoughnutController,
  Legend,
  Tooltip,
} from 'chart.js';

import {
  CustomerSegmentsReport,
  DataMiningService,
  SegmentCustomer,
  SegmentProfile,
} from '../../../../../core/services/data-mining.service';

Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

@Component({
  selector: 'app-customer-segments',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective],
  templateUrl: './customer-segments.html',
  styleUrl: './customer-segments.css',
})
export class CustomerSegments implements OnInit {
  private readonly dataMiningService = inject(DataMiningService);
  private readonly toastr = inject(ToastrService);

  report: CustomerSegmentsReport | null = null;
  isLoading = true;
  hasError = false;
  searchTerm = '';
  selectedSegment = 'all';
  currentPage = 1;
  readonly pageSize = 10;

  chartData: ChartConfiguration<'doughnut'>['data'] = { labels: [], datasets: [] };
  readonly chartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '66%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `${context.label}: ${context.parsed} clientes`,
        },
      },
    },
  };

  ngOnInit(): void {
    this.loadReport();
  }

  loadReport(showToast = false): void {
    this.isLoading = true;
    this.hasError = false;
    this.dataMiningService.getCustomerSegments().subscribe({
      next: (report) => {
        this.report = report;
        this.buildChart(report.segments);
        this.currentPage = 1;
        this.isLoading = false;
        if (showToast) {
          this.toastr.success('Segmentos y clientes actualizados', 'Segmentación');
        }
      },
      error: () => {
        this.isLoading = false;
        this.hasError = true;
        this.toastr.error('No fue posible cargar la segmentación de clientes', 'Reportes');
      },
    });
  }

  get filteredCustomers(): SegmentCustomer[] {
    const query = this.normalize(this.searchTerm);
    return (this.report?.customers ?? []).filter((customer) => {
      const matchesSegment = this.selectedSegment === 'all' || customer.segmento === this.selectedSegment;
      const matchesSearch = !query || this.normalize(
        `${customer.name} ${customer.email} ${customer.id_usuario}`,
      ).includes(query);
      return matchesSegment && matchesSearch;
    });
  }

  get paginatedCustomers(): SegmentCustomer[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredCustomers.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredCustomers.length / this.pageSize));
  }

  get visiblePages(): number[] {
    const start = Math.max(1, Math.min(this.currentPage - 2, this.totalPages - 4));
    const end = Math.min(this.totalPages, start + 4);
    return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
  }

  applyFilters(): void {
    this.currentPage = 1;
  }

  selectSegment(segment: string): void {
    this.selectedSegment = segment;
    this.currentPage = 1;
  }

  setPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  segmentClass(name: string): string {
    const normalized = this.normalize(name);
    if (normalized.includes('vip') || normalized.includes('alto valor')) return 'vip';
    if (normalized.includes('leal') || normalized.includes('frecuente')) return 'loyal';
    if (normalized.includes('riesgo') || normalized.includes('inactivo')) return 'risk';
    if (normalized.includes('ocasional')) return 'occasional';
    return 'potential';
  }

  initials(name: string): string {
    return String(name || 'Cliente')
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase();
  }

  formatDate(value: string | null): string {
    if (!value) return 'Sin fecha';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
    }).format(date);
  }

  private buildChart(segments: SegmentProfile[]): void {
    this.chartData = {
      labels: segments.map((segment) => segment.name),
      datasets: [{
        data: segments.map((segment) => segment.customers),
        backgroundColor: segments.map((segment) => this.segmentColor(segment.name)),
        borderColor: '#ffffff',
        borderWidth: 3,
        hoverOffset: 6,
      }],
    };
  }

  private segmentColor(name: string): string {
    const type = this.segmentClass(name);
    if (type === 'vip') return '#7c3aed';
    if (type === 'loyal') return '#059669';
    if (type === 'risk') return '#dc2626';
    if (type === 'occasional') return '#16a34a';
    return '#0284c7';
  }

  private normalize(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
