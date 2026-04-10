import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { LogsService, SystemLogEntry } from '../../../../../core/services/logs.service';
import { formatMexicoDateTime } from '../../../../../core/utils/date-time.util';

@Component({
  selector: 'app-logs-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './logs.html',
  styleUrl: './logs.css',
})
export class LogsPage implements OnInit, OnDestroy {
  private readonly logsService = inject(LogsService);
  private readonly toastr = inject(ToastrService);
  private refreshInterval?: ReturnType<typeof setInterval>;

  isLoading = signal(false);
  availableDates = signal<string[]>([]);
  allLogs = signal<SystemLogEntry[]>([]);
  filteredLogs = signal<SystemLogEntry[]>([]);
  availableModules = signal<string[]>([]);

  selectedDate = '';
  initialDate = '';
  selectedModule = 'all';
  selectedLevel = 'all';
  searchTerm = '';

  readonly pageSize = 10;
  currentPage = 1;

  showDetailModal = signal(false);
  selectedLog = signal<SystemLogEntry | null>(null);

  ngOnInit(): void {
    this.loadDates();
    this.refreshInterval = setInterval(() => {
      if (this.selectedDate) {
        this.loadLogsForDate(this.selectedDate, false);
      }
    }, 60000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  loadDates(): void {
    this.isLoading.set(true);
    this.logsService.getDates().subscribe({
      next: (dates) => {
        this.availableDates.set(dates);
        this.selectedDate = dates[0] ?? '';
        this.initialDate = this.selectedDate;
        if (this.selectedDate) {
          this.loadLogsForDate(this.selectedDate, false);
        } else {
          this.allLogs.set([]);
          this.filteredLogs.set([]);
          this.availableModules.set([]);
          this.isLoading.set(false);
        }
      },
      error: () => {
        this.isLoading.set(false);
        this.toastr.error('No fue posible cargar las fechas de logs', 'Logs');
      },
    });
  }

  loadLogsForDate(date: string, showToast = false): void {
    if (!date) return;

    this.isLoading.set(true);
    this.logsService
      .getLogs({
        date,
        limit: 5000,
      })
      .subscribe({
        next: (response) => {
          const items = (response.items ?? []).filter((log) => log.module !== 'logs');
          this.allLogs.set(items);
          this.availableModules.set(
            Array.from(new Set(items.map((item) => item.module))).sort((a, b) => a.localeCompare(b)),
          );

          if (
            this.selectedModule !== 'all' &&
            !this.availableModules().includes(this.selectedModule)
          ) {
            this.selectedModule = 'all';
          }

          this.applyFilters();
          this.isLoading.set(false);
          if (showToast) {
            this.toastr.success('Logs actualizados', 'Logs');
          }
        },
        error: () => {
          this.isLoading.set(false);
          this.toastr.error('No fue posible cargar los logs', 'Logs');
        },
      });
  }

  refreshData(): void {
    this.loadLogsForDate(this.selectedDate, true);
  }

  onDateChange(): void {
    this.selectedModule = 'all';
    this.currentPage = 1;
    this.loadLogsForDate(this.selectedDate, false);
  }

  applyFilters(): void {
    const search = this.searchTerm.trim().toLowerCase();

    const filtered = this.allLogs()
      .filter((log) => this.selectedModule === 'all' || log.module === this.selectedModule)
      .filter((log) => this.selectedLevel === 'all' || log.level === this.selectedLevel)
      .filter((log) => {
        if (!search) return true;
        return JSON.stringify(log).toLowerCase().includes(search);
      });

    this.filteredLogs.set(filtered);
    const totalPages = this.totalPages();
    if (this.currentPage > totalPages) {
      this.currentPage = totalPages;
    }
  }

  clearFilters(): void {
    this.selectedDate = this.initialDate;
    this.selectedModule = 'all';
    this.selectedLevel = 'all';
    this.searchTerm = '';
    this.currentPage = 1;
    this.loadLogsForDate(this.selectedDate, false);
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  openDetail(log: SystemLogEntry): void {
    this.selectedLog.set(log);
    this.showDetailModal.set(true);
  }

  closeDetail(): void {
    this.showDetailModal.set(false);
    this.selectedLog.set(null);
  }

  paginatedLogs(): SystemLogEntry[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredLogs().slice(start, start + this.pageSize);
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredLogs().length / this.pageSize));
  }

  pageNumbers(): number[] {
    return Array.from({ length: this.totalPages() }, (_, index) => index + 1);
  }

  visiblePageNumbers(): number[] {
    const total = this.totalPages();
    if (total <= 7) {
      return this.pageNumbers();
    }

    let start = Math.max(1, this.currentPage - 2);
    let end = Math.min(total, start + 4);

    if (end - start < 4) {
      start = Math.max(1, end - 4);
    }

    const pages: number[] = [];
    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    return pages;
  }

  visibleEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredLogs().length);
  }

  goToPage(page: number): void {
    this.currentPage = page;
  }

  changePage(direction: 'first' | 'prev' | 'next' | 'last'): void {
    if (direction === 'first') this.currentPage = 1;
    if (direction === 'prev') this.currentPage = Math.max(1, this.currentPage - 1);
    if (direction === 'next') this.currentPage = Math.min(this.totalPages(), this.currentPage + 1);
    if (direction === 'last') this.currentPage = this.totalPages();
  }

  formatDateTime(date: string): string {
    return formatMexicoDateTime(date);
  }

  formatEvent(event: string): string {
    return (event || 'http_request').replace(/_/g, ' ');
  }

  formatJson(data: unknown): string {
    return JSON.stringify(data, null, 2);
  }

  summary(log: SystemLogEntry): string {
    const method = log.data.method ?? 'GET';
    const path = log.data.path ?? '/';
    const status = log.data.statusCode ?? 0;
    const email = log.data.email ? ` - ${log.data.email}` : '';
    return `${method} ${path} (${status})${email}`;
  }

  hasActiveFilters(): boolean {
    return (
      this.selectedDate !== this.initialDate ||
      this.selectedModule !== 'all' ||
      this.selectedLevel !== 'all' ||
      !!this.searchTerm.trim()
    );
  }

  levelBadgeClass(level: string): string {
    if (level === 'critical') return 'bg-red-100 text-red-700 border border-red-200';
    if (level === 'error') return 'bg-orange-100 text-orange-700 border border-orange-200';
    if (level === 'warn') return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
    return 'bg-blue-100 text-blue-700 border border-blue-200';
  }
}
