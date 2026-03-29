import {
  Component,
  OnInit,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { BaseChartDirective } from 'ng2-charts';
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
} from 'chart.js';

import { ProductService } from '../../../../../core/services/product.service';
import { Categorie } from '../../../../../core/models/product.model';
import { formatMexicoDateTime, parseApiDate } from '../../../../../core/utils/date-time.util';

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
);

interface Sport {
  id_deporte: number;
  nombre: string;
}

interface OrderProduct {
  id_producto: number;
  nombre: string;
  categoria: string;
  categoria_padre: string | null;
  deportes: string[];
  imagenes: string[][];
  total_vendido: number;
  ingresos_totales: number;
}

interface FilterParentOption {
  id: number | string;
  nombre: string;
  tipo: 'categoria' | 'deportes';
}

interface FilterChildOption {
  id: number | string;
  nombre: string;
  tipo: 'subcategoria' | 'deporte';
}

interface OrderDetail {
  id_orden: number;
  fecha_creacion: string;
  cantidad: number;
  total: number;
}

interface GroupedSale {
  label: string;
  cantidad: number;
  total: number;
  registros: number;
  sortValue: number;
}

interface MonthlySalePoint {
  label: string;
  key: string;
  cantidad: number;
  total: number;
  sortValue: number;
}

interface PredictionPoint {
  label: string;
  ventasProyectadas: number;
  ingresosProyectados: number;
  periodoIndex: number;
}

interface PredictionModelResult {
  x0: number;
  k: number;
  trendType: 'crecimiento' | 'decrecimiento' | 'estable';
  averagePrice: number;
  historicalMonths: number;
  initialLabel: string;
  projections: PredictionPoint[];
}

@Component({
  selector: 'app-prediction',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective],
  templateUrl: './prediction.html',
  styleUrl: './prediction.css',
})
export class Prediction implements OnInit {
  private productService = inject(ProductService);
  private toastr = inject(ToastrService);

  categorias: Categorie[] = [];
  categoriasPadre: Categorie[] = [];
  deportes: Sport[] = [];
  orders: OrderProduct[] = [];

  parentOptions: FilterParentOption[] = [];
  childOptions: FilterChildOption[] = [];

  selectedParent: number | string | null = null;
  selectedChild: number | string | null = null;

  isLoading = signal<boolean>(false);
  isLoadingDetails = signal<boolean>(false);
  isLoadingPrediction = signal<boolean>(false);

  // Modal detalles
  showSalesDetailModal = false;
  selectedProduct: OrderProduct | null = null;
  salesDetailRaw: OrderDetail[] = [];

  detailPeriod: 'dia' | 'semana' | 'mes' = 'dia';
  detailView: 'tabla' | 'grafica' = 'tabla';

  // Modal predicción
  showPredictionModal = false;
  predictionDetailRaw: OrderDetail[] = [];
  predictionView: 'tabla' | 'grafica' = 'tabla';
  predictionHorizon: 3 | 6 | 12 = 6;
  predictionModel: PredictionModelResult | null = null;

  // Colores
  primary = '#22C55E';
  primarySoft = 'rgba(34,197,94,0.18)';
  green = '#22C55E';
  emerald = '#10B981';
  amber = '#F59E0B';
  blue = '#0367A6';

  salesChartType: 'bar' = 'bar';
  predictionChartType: 'bar' = 'bar';

  // Paginación tabla principal
  rowsPerPage = 10;
  rowsPerPageOptions = [10];
  currentPage = 1;

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredOrders.length / this.rowsPerPage));
  }

  get paginatedOrders(): OrderProduct[] {
    const start = (this.currentPage - 1) * this.rowsPerPage;
    const end = start + this.rowsPerPage;
    return this.filteredOrders.slice(start, end);
  }

  get firstItem(): number {
    if (this.filteredOrders.length === 0) return 0;
    return (this.currentPage - 1) * this.rowsPerPage + 1;
  }

  get lastItem(): number {
    return Math.min(this.currentPage * this.rowsPerPage, this.filteredOrders.length);
  }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    const current = this.currentPage;

    let start = Math.max(1, current - 2);
    let end = Math.min(total, current + 2);

    if (current <= 2) {
      end = Math.min(total, 5);
    }

    if (current >= total - 1) {
      start = Math.max(1, total - 4);
    }

    const pages: number[] = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  changePage(action: 'first' | 'prev' | 'next' | 'last'): void {
    switch (action) {
      case 'first':
        this.currentPage = 1;
        break;
      case 'prev':
        if (this.currentPage > 1) this.currentPage--;
        break;
      case 'next':
        if (this.currentPage < this.totalPages) this.currentPage++;
        break;
      case 'last':
        this.currentPage = this.totalPages;
        break;
    }
  }

  onRowsPerPageChange(): void {
    this.currentPage = 1;
  }

  resetPagination(): void {
    this.currentPage = 1;
  }

  salesChartData = {
    labels: [] as string[],
    datasets: [
      {
        label: 'Cantidad vendida',
        data: [] as number[],
        backgroundColor: this.primary,
        borderRadius: 6
      }
    ]
  };

  salesChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        labels: {
          color: '#202020',
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        callbacks: {
          title: (tooltipItems: any[]) => {
            return tooltipItems[0]?.label || '';
          },
          label: (context: any) => {
            const index = context.dataIndex;
            const item = this.groupedSales[index];

            if (!item) return '';

            return `Cantidad vendida: ${item.cantidad}`;
          },
          afterLabel: (context: any) => {
            const index = context.dataIndex;
            const item = this.groupedSales[index];

            if (!item) return '';

            return [
              `Ingresos: ${this.formatCurrency(item.total)}`,
              `Órdenes: ${item.registros}`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: '#666666'
        },
        grid: {
          display: false
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: '#666666',
          precision: 0
        },
        grid: {
          color: '#E5E7EB'
        },
        title: {
          display: true,
          text: 'Cantidad vendida',
          color: '#666666'
        }
      }
    }
  };

  predictionChartData = {
    labels: [] as string[],
    datasets: [
      {
        label: 'Ventas proyectadas',
        data: [] as number[],
        backgroundColor: this.emerald,
        borderRadius: 8
      }
    ]
  };

  predictionChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        labels: {
          color: '#202020',
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        callbacks: {
          title: (tooltipItems: any[]) => {
            return tooltipItems[0]?.label || '';
          },
          label: (context: any) => {
            const index = context.dataIndex;
            const item = this.predictionProjections[index];
            if (!item) return '';
            return `Ventas proyectadas: ${this.round2(item.ventasProyectadas)}`;
          },
          afterLabel: (context: any) => {
            const index = context.dataIndex;
            const item = this.predictionProjections[index];
            if (!item) return '';
            return `Ingreso proyectado: ${this.formatCurrency(item.ingresosProyectados)}`;
          }
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: '#666666'
        },
        grid: {
          display: false
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: '#666666'
        },
        grid: {
          color: '#E5E7EB'
        },
        title: {
          display: true,
          text: 'Ventas proyectadas',
          color: '#666666'
        }
      }
    }
  };

  ngOnInit(): void {
    this.loadInitialData();
  }

  loadInitialData(): void {
    this.isLoading.set(true);

    forkJoin({
      categorias: this.productService.getCategorias(),
      deportes: this.productService.getSports(),
      orders: this.productService.getAllOrders(),
    }).subscribe({
      next: ({ categorias, deportes, orders }) => {
        this.categorias = categorias;
        this.categoriasPadre = categorias.filter((c) => c.id_padre === null);
        this.deportes = deportes;
        this.orders = orders.map((order) => this.normalizeOrder(order));

        this.buildParentOptions();
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading data:', error);
        this.toastr.error('Error al cargar la información', 'Error');
        this.isLoading.set(false);
      },
    });
  }

  normalizeOrder(order: any): OrderProduct {
    return {
      ...order,
      total_vendido: Number(order.total_vendido ?? 0),
      ingresos_totales: Number(order.ingresos_totales ?? 0),
      deportes: Array.isArray(order.deportes) ? order.deportes : [],
      imagenes: Array.isArray(order.imagenes) ? order.imagenes : [],
    };
  }

  normalizeOrderDetail(detail: any): OrderDetail {
    return {
      id_orden: Number(detail.id_orden),
      fecha_creacion: detail.fecha_creacion,
      cantidad: Number(detail.cantidad ?? 0),
      total: Number(detail.total ?? 0),
    };
  }

  buildParentOptions(): void {
    this.parentOptions = [
      ...this.categoriasPadre.map((cat) => ({
        id: cat.id_categoria,
        nombre: cat.nombre,
        tipo: 'categoria' as const,
      })),
      {
        id: 'deportes',
        nombre: 'Deportes',
        tipo: 'deportes' as const,
      },
    ];
  }

  onParentChange(): void {
    this.selectedChild = null;
    this.childOptions = [];
    this.resetPagination();

    if (!this.selectedParent) return;

    if (this.selectedParent === 'deportes') {
      this.childOptions = this.deportes.map((sport) => ({
        id: sport.id_deporte,
        nombre: sport.nombre,
        tipo: 'deporte' as const,
      }));
      return;
    }

    const parentId = Number(this.selectedParent);

    this.childOptions = this.categorias
      .filter((cat) => cat.id_padre === parentId)
      .map((subcat) => ({
        id: subcat.id_categoria,
        nombre: subcat.nombre,
        tipo: 'subcategoria' as const,
      }));
  }

  get filteredOrders(): OrderProduct[] {
    let data = [...this.orders];

    if (!this.selectedParent) {
      return data;
    }

    if (this.selectedParent === 'deportes') {
      if (!this.selectedChild) {
        return data.filter((order) => order.deportes.length > 0);
      }

      const sportSelected = this.deportes.find(
        (sport) => sport.id_deporte === Number(this.selectedChild)
      );

      if (!sportSelected) return data;

      return data.filter((order) =>
        order.deportes.some(
          (dep) => dep.toLowerCase() === sportSelected.nombre.toLowerCase()
        )
      );
    }

    const parentCategory = this.categoriasPadre.find(
      (cat) => cat.id_categoria === Number(this.selectedParent)
    );

    if (!parentCategory) return data;

    data = data.filter(
      (order) =>
        (order.categoria_padre || '').toLowerCase() === parentCategory.nombre.toLowerCase()
    );

    if (this.selectedChild) {
      const subCategory = this.categorias.find(
        (cat) => cat.id_categoria === Number(this.selectedChild)
      );

      if (!subCategory) return data;

      data = data.filter(
        (order) => (order.categoria || '').toLowerCase() === subCategory.nombre.toLowerCase()
      );
    }

    return data;
  }

  clearFilters(): void {
    this.selectedParent = null;
    this.selectedChild = null;
    this.childOptions = [];
    this.resetPagination();
  }

  refreshData(): void {
    this.loadInitialData();
  }

  getFirstImage(order: OrderProduct): string {
    if (!order.imagenes || order.imagenes.length === 0) {
      return 'https://via.placeholder.com/80x80?text=Sin+Imagen';
    }

    const firstGroup = order.imagenes[0];

    if (Array.isArray(firstGroup) && firstGroup.length > 0) {
      return firstGroup[0];
    }

    return 'https://via.placeholder.com/80x80?text=Sin+Imagen';
  }

  formatCurrency(value: number | string): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
    }).format(Number(value || 0));
  }

  formatDateTime(date: string): string {
    return formatMexicoDateTime(date);
  }

  get totalRecords(): number {
    return this.filteredOrders.length;
  }

  trackByProduct(index: number, item: OrderProduct): number {
    return item.id_producto;
  }

  round2(value: number): number {
    return Number((value || 0).toFixed(2));
  }

  // =========================
  // MODAL DETALLES
  // =========================
  openSalesDetailModal(product: OrderProduct): void {
    this.selectedProduct = product;
    this.showSalesDetailModal = true;
    this.detailPeriod = 'dia';
    this.detailView = 'tabla';
    this.salesDetailRaw = [];
    this.resetSalesChart();
    this.loadSalesDetail(product.id_producto);
  }

  closeSalesDetailModal(): void {
    this.showSalesDetailModal = false;
    this.selectedProduct = null;
    this.salesDetailRaw = [];
    this.detailPeriod = 'dia';
    this.detailView = 'tabla';
    this.resetSalesChart();
  }

  loadSalesDetail(productId: number): void {
    this.isLoadingDetails.set(true);

    this.productService.getOrdersById(productId).subscribe({
      next: (data: any[]) => {
        this.salesDetailRaw = Array.isArray(data)
          ? data.map((item) => this.normalizeOrderDetail(item))
          : [];

        this.updateSalesChart();
        this.isLoadingDetails.set(false);
      },
      error: (error) => {
        console.error('Error loading sales detail:', error);
        this.toastr.error('Error al cargar los detalles de venta', 'Error');
        this.isLoadingDetails.set(false);
      }
    });
  }

  setDetailPeriod(period: 'dia' | 'semana' | 'mes'): void {
    this.detailPeriod = period;
    this.updateSalesChart();
  }

  setDetailView(view: 'tabla' | 'grafica'): void {
    this.detailView = view;
    this.updateSalesChart();
  }

  get groupedSales(): GroupedSale[] {
    const map = new Map<string, GroupedSale>();

    for (const item of this.salesDetailRaw) {
      const date = parseApiDate(item.fecha_creacion);
      if (!date) continue;
      const keyData = this.getGroupKey(date, this.detailPeriod);

      if (!map.has(keyData.key)) {
        map.set(keyData.key, {
          label: keyData.label,
          cantidad: 0,
          total: 0,
          registros: 0,
          sortValue: keyData.sortValue,
        });
      }

      const group = map.get(keyData.key)!;
      group.cantidad += Number(item.cantidad || 0);
      group.total += Number(item.total || 0);
      group.registros += 1;
    }

    return Array.from(map.values()).sort((a, b) => a.sortValue - b.sortValue);
  }

  private getGroupKey(date: Date, period: 'dia' | 'semana' | 'mes') {
    if (period === 'dia') {
      const year = date.getFullYear();
      const month = this.pad(date.getMonth() + 1);
      const day = this.pad(date.getDate());

      return {
        key: `${year}-${month}-${day}`,
        label: `${day}/${month}/${year}`,
        sortValue: new Date(year, date.getMonth(), date.getDate()).getTime()
      };
    }

    if (period === 'semana') {
      const start = this.getStartOfWeek(date);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);

      const startLabel = `${this.pad(start.getDate())}/${this.pad(start.getMonth() + 1)}/${start.getFullYear()}`;
      const endLabel = `${this.pad(end.getDate())}/${this.pad(end.getMonth() + 1)}/${end.getFullYear()}`;

      return {
        key: `${start.getFullYear()}-${this.pad(start.getMonth() + 1)}-${this.pad(start.getDate())}`,
        label: `${startLabel} - ${endLabel}`,
        sortValue: start.getTime()
      };
    }

    const year = date.getFullYear();
    const month = date.getMonth();
    const monthLabel = new Intl.DateTimeFormat('es-MX', {
      month: 'long',
      year: 'numeric'
    }).format(new Date(year, month, 1));

    return {
      key: `${year}-${this.pad(month + 1)}`,
      label: this.capitalize(monthLabel),
      sortValue: new Date(year, month, 1).getTime()
    };
  }

  private getStartOfWeek(date: Date): Date {
    const current = new Date(date);
    const day = current.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    current.setHours(0, 0, 0, 0);
    current.setDate(current.getDate() + diff);
    return current;
  }

  private pad(value: number): string {
    return String(value).padStart(2, '0');
  }

  private capitalize(value: string): string {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  updateSalesChart(): void {
    const grouped = this.groupedSales;

    this.salesChartData = {
      labels: grouped.map((item) => item.label),
      datasets: [
        {
          label: 'Cantidad vendida',
          data: grouped.map((item) => item.cantidad),
          backgroundColor: this.primary,
          borderRadius: 6
        }
      ]
    };
  }

  resetSalesChart(): void {
    this.salesChartData = {
      labels: [],
      datasets: [
        {
          label: 'Cantidad vendida',
          data: [],
          backgroundColor: this.primary,
          borderRadius: 6
        }
      ]
    };
  }

  getTotalDetailCantidad(): number {
    return this.groupedSales.reduce((acc, item) => acc + item.cantidad, 0);
  }

  getTotalDetailIngresos(): number {
    return this.groupedSales.reduce((acc, item) => acc + item.total, 0);
  }

  getDetailRowsCount(): number {
    return this.groupedSales.length;
  }

  // =========================
  // MODAL PREDICCIÓN
  // =========================
  openPredictionModal(product: OrderProduct): void {
    this.selectedProduct = product;
    this.showPredictionModal = true;
    this.predictionView = 'tabla';
    this.predictionHorizon = 6;
    this.predictionDetailRaw = [];
    this.predictionModel = null;
    this.resetPredictionChart();
    this.loadPredictionData(product);
  }

  closePredictionModal(): void {
    this.showPredictionModal = false;
    this.predictionDetailRaw = [];
    this.predictionModel = null;
    this.predictionHorizon = 6;
    this.predictionView = 'tabla';
    this.resetPredictionChart();
  }

  loadPredictionData(product: OrderProduct): void {
    this.isLoadingPrediction.set(true);

    this.productService.getOrdersById(product.id_producto).subscribe({
      next: (data: any[]) => {
        this.predictionDetailRaw = Array.isArray(data)
          ? data.map((item) => this.normalizeOrderDetail(item))
          : [];

        this.predictionModel = this.buildPredictionModel(product, this.predictionDetailRaw);
        this.updatePredictionChart();
        this.isLoadingPrediction.set(false);
      },
      error: (error) => {
        console.error('Error loading prediction detail:', error);
        this.toastr.error('Error al cargar la información para la predicción', 'Error');
        this.isLoadingPrediction.set(false);
      }
    });
  }

  setPredictionView(view: 'tabla' | 'grafica'): void {
    this.predictionView = view;
    this.updatePredictionChart();
  }

  setPredictionHorizon(months: 3 | 6 | 12): void {
    this.predictionHorizon = months;
    if (this.selectedProduct) {
      this.predictionModel = this.buildPredictionModel(this.selectedProduct, this.predictionDetailRaw);
      this.updatePredictionChart();
    }
  }

  get predictionProjections(): PredictionPoint[] {
    return this.predictionModel?.projections ?? [];
  }

  get predictionTotalProjectedSales(): number {
    return this.predictionProjections.reduce((acc, item) => acc + item.ventasProyectadas, 0);
  }

  get predictionTotalProjectedRevenue(): number {
    return this.predictionProjections.reduce((acc, item) => acc + item.ingresosProyectados, 0);
  }

  private buildPredictionModel(product: OrderProduct, details: OrderDetail[]): PredictionModelResult {
    const monthlyHistory = this.buildMonthlyHistory(details);
    const historicalMonths = monthlyHistory.length;

    const averagePrice =
      product.total_vendido > 0
        ? product.ingresos_totales / product.total_vendido
        : this.getAverageUnitPriceBySubcategory(product.categoria);

    const exponentialModel = this.calculateExponentialModel(monthlyHistory);

    const projections: PredictionPoint[] = [];

    for (let i = 1; i <= this.predictionHorizon; i++) {
      const futureTime = (historicalMonths - 1) + i;
      const projectedSales = Math.max(
        0,
        exponentialModel.x0 * Math.exp(exponentialModel.k * futureTime)
      );

      const salesRounded = this.round2(projectedSales);
      const projectedRevenue = this.round2(salesRounded * averagePrice);

      projections.push({
        label: this.getFutureMonthLabel(i),
        ventasProyectadas: salesRounded,
        ingresosProyectados: projectedRevenue,
        periodoIndex: i
      });
    }

    return {
      x0: this.round2(exponentialModel.x0),
      k: this.round2(exponentialModel.k),
      trendType: exponentialModel.trendType,
      averagePrice: this.round2(averagePrice),
      historicalMonths,
      initialLabel: monthlyHistory[0]?.label ?? 'Sin historial',
      projections
    };
  }

  private buildMonthlyHistory(details: OrderDetail[]): MonthlySalePoint[] {
    const map = new Map<string, MonthlySalePoint>();

    for (const item of details) {
      const date = parseApiDate(item.fecha_creacion);
      if (!date) continue;
      const year = date.getFullYear();
      const month = date.getMonth();
      const key = `${year}-${this.pad(month + 1)}`;
      const label = this.capitalize(
        new Intl.DateTimeFormat('es-MX', {
          month: 'short',
          year: 'numeric'
        }).format(new Date(year, month, 1))
      );

      if (!map.has(key)) {
        map.set(key, {
          key,
          label,
          cantidad: 0,
          total: 0,
          sortValue: new Date(year, month, 1).getTime()
        });
      }

      const current = map.get(key)!;
      current.cantidad += Number(item.cantidad || 0);
      current.total += Number(item.total || 0);
    }

    const result = Array.from(map.values()).sort((a, b) => a.sortValue - b.sortValue);

    if (result.length === 0 && this.selectedProduct) {
      const fallbackMonth = new Date();
      const key = `${fallbackMonth.getFullYear()}-${this.pad(fallbackMonth.getMonth() + 1)}`;
      result.push({
        key,
        label: this.capitalize(
          new Intl.DateTimeFormat('es-MX', {
            month: 'short',
            year: 'numeric'
          }).format(new Date(fallbackMonth.getFullYear(), fallbackMonth.getMonth(), 1))
        ),
        cantidad: this.selectedProduct.total_vendido || 0,
        total: this.selectedProduct.ingresos_totales || 0,
        sortValue: new Date(fallbackMonth.getFullYear(), fallbackMonth.getMonth(), 1).getTime()
      });
    }

    return result;
  }

  private calculateExponentialModel(history: MonthlySalePoint[]): {
    x0: number;
    k: number;
    trendType: 'crecimiento' | 'decrecimiento' | 'estable';
  } {
    if (history.length === 0) {
      return { x0: 0, k: 0, trendType: 'estable' };
    }

    if (history.length === 1) {
      const onlyValue = Number(history[0].cantidad || 0);
      return {
        x0: onlyValue,
        k: 0,
        trendType: 'estable'
      };
    }

    const positiveHistory = history
      .map((item, index) => ({
        t: index,
        y: Number(item.cantidad || 0)
      }))
      .filter((point) => point.y > 0);

    const initialSales = Number(history[0]?.cantidad || 0);
    const fallbackBase = initialSales > 0 ? initialSales : Number(history[history.length - 1]?.cantidad || 0);

    if (positiveHistory.length < 2) {
      return {
        x0: fallbackBase,
        k: 0,
        trendType: 'estable'
      };
    }

    const x = positiveHistory.map((point) => point.t);
    const y = positiveHistory.map((point) => Math.log(point.y));

    const n = x.length;
    const sumX = x.reduce((acc, val) => acc + val, 0);
    const sumY = y.reduce((acc, val) => acc + val, 0);
    const sumXY = x.reduce((acc, val, index) => acc + (val * y[index]), 0);
    const sumX2 = x.reduce((acc, val) => acc + (val * val), 0);
    const denominator = (n * sumX2) - (sumX * sumX);

    if (denominator === 0) {
      return {
        x0: fallbackBase,
        k: 0,
        trendType: 'estable'
      };
    }

    const k = ((n * sumXY) - (sumX * sumY)) / denominator;
    const lnC = (sumY - (k * sumX)) / n;
    const x0 = initialSales > 0 ? initialSales : Math.exp(lnC);

    return {
      x0,
      k,
      trendType: this.getTrendType(k)
    };
  }

  private getTrendType(k: number): 'crecimiento' | 'decrecimiento' | 'estable' {
    if (k > 0.03) return 'crecimiento';
    if (k < -0.03) return 'decrecimiento';
    return 'estable';
  }

  private getAverageUnitPriceBySubcategory(subcategoria: string): number {
    const subcategoryProducts = this.orders.filter(
      (item) => item.categoria.toLowerCase() === subcategoria.toLowerCase() && item.total_vendido > 0
    );

    if (subcategoryProducts.length === 0) {
      return 0;
    }

    const totalRevenue = subcategoryProducts.reduce((acc, item) => acc + item.ingresos_totales, 0);
    const totalUnits = subcategoryProducts.reduce((acc, item) => acc + item.total_vendido, 0);

    return totalUnits > 0 ? totalRevenue / totalUnits : 0;
  }

  private getFutureMonthLabel(offsetMonths: number): string {
    const today = new Date();
    const futureDate = new Date(today.getFullYear(), today.getMonth() + offsetMonths, 1);

    return this.capitalize(
      new Intl.DateTimeFormat('es-MX', {
        month: 'long',
        year: 'numeric'
      }).format(futureDate)
    );
  }

  updatePredictionChart(): void {
    const projections = this.predictionProjections;

    this.predictionChartData = {
      labels: projections.map((item) => item.label),
      datasets: [
        {
          label: 'Ventas proyectadas',
          data: projections.map((item) => item.ventasProyectadas),
          backgroundColor: this.emerald,
          borderRadius: 8
        }
      ]
    };
  }

  resetPredictionChart(): void {
    this.predictionChartData = {
      labels: [],
      datasets: [
        {
          label: 'Ventas proyectadas',
          data: [],
          backgroundColor: this.emerald,
          borderRadius: 8
        }
      ]
    };
  }

  getPredictionText(): string {
  if (!this.predictionModel) return 'Sin información';

  const k = this.predictionModel.k;

  if (k > 0.03) return 'Este producto muestra una tendencia de crecimiento en ventas';
  if (k < -0.03) return 'Este producto muestra una tendencia de decrecimiento en ventas';
  return 'Este producto muestra un comportamiento estable en ventas';
}

getPredictionClass(): string {
  if (!this.predictionModel) return 'bg-gray-100 text-gray-700';

  const k = this.predictionModel.k;

  if (k > 0.03) return 'bg-green-100 text-green-700';
  if (k < -0.03) return 'bg-red-100 text-red-700';
  return 'bg-blue-100 text-blue-700';
}

get totalUnitsSold(): number {
  return this.filteredOrders.reduce((acc, item) => acc + Number(item.total_vendido || 0), 0);
}

get averageSalesPerProduct(): number {
  if (this.filteredOrders.length === 0) return 0;
  return this.totalUnitsSold / this.filteredOrders.length;
}

get medianSalesPerProduct(): number {
  if (this.filteredOrders.length === 0) return 0;

  const values = this.filteredOrders
    .map(item => Number(item.total_vendido || 0))
    .sort((a, b) => a - b);

  const middle = Math.floor(values.length / 2);

  if (values.length % 2 === 0) {
    return (values[middle - 1] + values[middle]) / 2;
  }

  return values[middle];
}

get modeSalesPerProduct(): number {
  if (this.filteredOrders.length === 0) return 0;

  const values = this.filteredOrders.map(item => Number(item.total_vendido || 0));
  const frequency: Record<number, number> = {};

  for (const value of values) {
    frequency[value] = (frequency[value] || 0) + 1;
  }

  let mode = values[0];
  let maxCount = 0;

  for (const key of Object.keys(frequency)) {
    const numKey = Number(key);
    if (frequency[numKey] > maxCount) {
      maxCount = frequency[numKey];
      mode = numKey;
    }
  }

  return mode;
}

get mostConsumedProduct(): OrderProduct | null {
  if (this.filteredOrders.length === 0) return null;

  return [...this.filteredOrders].sort(
    (a, b) => Number(b.total_vendido || 0) - Number(a.total_vendido || 0)
  )[0] || null;
}

get mostConsumedParentCategory(): { nombre: string; total: number } | null {
  if (this.filteredOrders.length === 0) return null;

  const map = new Map<string, number>();

  for (const item of this.filteredOrders) {
    const key = item.categoria_padre || 'Sin categoría padre';
    map.set(key, (map.get(key) || 0) + Number(item.total_vendido || 0));
  }

  let best: { nombre: string; total: number } | null = null;

  for (const [nombre, total] of map.entries()) {
    if (!best || total > best.total) {
      best = { nombre, total };
    }
  }

  return best;
}

get mostConsumedSubcategory(): { nombre: string; total: number } | null {
  if (this.filteredOrders.length === 0) return null;

  const map = new Map<string, number>();

  for (const item of this.filteredOrders) {
    const key = item.categoria || 'Sin subcategoría';
    map.set(key, (map.get(key) || 0) + Number(item.total_vendido || 0));
  }

  let best: { nombre: string; total: number } | null = null;

  for (const [nombre, total] of map.entries()) {
    if (!best || total > best.total) {
      best = { nombre, total };
    }
  }

  return best;
}

get mostConsumedSport(): { nombre: string; total: number } | null {
  if (this.filteredOrders.length === 0) return null;

  const map = new Map<string, number>();

  for (const item of this.filteredOrders) {
    const qty = Number(item.total_vendido || 0);

    for (const sport of item.deportes || []) {
      map.set(sport, (map.get(sport) || 0) + qty);
    }
  }

  if (map.size === 0) return null;

  let best: { nombre: string; total: number } | null = null;

  for (const [nombre, total] of map.entries()) {
    if (!best || total > best.total) {
      best = { nombre, total };
    }
  }

  return best;
}

get topProducts(): OrderProduct[] {
  return [...this.filteredOrders]
    .sort((a, b) => Number(b.total_vendido || 0) - Number(a.total_vendido || 0))
    .slice(0, 5);
}

roundStat(value: number): number {
  return Number((value || 0).toFixed(2));
}
}
