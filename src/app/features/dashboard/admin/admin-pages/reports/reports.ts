import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  DoughnutController,
  Tooltip,
  Legend
} from 'chart.js';

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  DoughnutController,
  Tooltip,
  Legend
);

import { Component, OnInit, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { BackupService } from '../../../../../core/services/backup.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './reports.html',
})
export class Reports implements OnInit, OnDestroy {

  private backupService = inject(BackupService);
  private refreshInterval: any;

  // Estados de carga individuales
  isLoadingStats = signal(false);
  isLoadingConnections = signal(false);
  isLoadingLocks = signal(false);
  
  // Timestamps de última actualización
  lastUpdateStats = signal<string>('');
  lastUpdateConnections = signal<string>('');
  lastUpdateLocks = signal<string>('');

  // Datos
  connections = signal<any[]>([]);
  locks = signal<any[]>([]);
  
  // Datos de estadísticas
  mostQueried = signal<any[]>([]);
  tableSizes = signal<any[]>([]);
  indexInfo = signal<any[]>([]);
  lockStats = signal<any[]>([]);
  scanStats = signal<any[]>([]);

  // Colores base
  primary = '#0367A6';
  primarySoft = 'rgba(3,103,166,0.2)';
  gray = '#E5E7EB';
  red = '#EF4444';
  yellow = '#F59E0B';
  green = '#22C55E';
  
  // Colores para locks por tipo
  exclusiveColor = '#EF4444';
  shareColor = '#22C55E';
  accessShareColor = '#3B82F6';
  rowExclusiveColor = '#F59E0B';

  // Colores para gráficas de estadísticas
  colors = ['#0367A6', '#F59E0B', '#22C55E', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

  // ===== CHART CONEXIONES (PASTEL) =====
  connectionsChart = {
    labels: ['Activas', 'Internas', 'Inactivas'],
    datasets: [
      {
        data: [0, 0, 0],
        backgroundColor: [this.green, this.yellow, this.gray],
        borderWidth: 0,
        hoverOffset: 4
      }
    ]
  };

  // ===== CHART LOCKS (BARRAS DE COLORES) =====
  locksChart = {
    labels: [] as string[],
    datasets: [
      {
        data: [] as number[],
        backgroundColor: [] as string[],
        borderRadius: 6,
        barPercentage: 0.7
      }
    ]
  };

  // Gráfica de consultas
  queriesChart = {
    labels: [] as string[],
    datasets: [{
      label: 'Total de Consultas',
      data: [] as number[],
      backgroundColor: this.colors,
      borderRadius: 6
    }]
  };

  // Gráfica de tamaños
  sizesChart = {
    labels: [] as string[],
    datasets: [
      {
        label: 'Tamaño Tabla (MB)',
        data: [] as number[],
        backgroundColor: '#0367A6',
        borderRadius: 6
      },
      {
        label: 'Tamaño Índices (MB)',
        data: [] as number[],
        backgroundColor: '#F59E0B',
        borderRadius: 6
      }
    ]
  };

  // Gráfica de uso de índices
  indexUsageChart = {
    labels: [] as string[],
    datasets: [{
      label: 'Veces usado',
      data: [] as number[],
      backgroundColor: this.colors,
      borderRadius: 6
    }]
  };

  // Bloqueos reales
  blockingLocks = signal<any[]>([]);

  activeTab: string = 'stats';

  constructor() {
    // Cargar datos iniciales
    setTimeout(() => this.loadCurrentTabData(), 100);
  }

  ngOnInit() {
    // Actualizar cada 60 segundos
    this.refreshInterval = setInterval(() => {
      this.loadCurrentTabData();
    }, 60000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  changeTab(tab: string) {
    this.activeTab = tab;
    this.loadCurrentTabData();
  }

  loadCurrentTabData() {
    if (this.activeTab === 'stats') {
      this.loadStats();
    } else if (this.activeTab === 'conexiones') {
      this.loadConnections();
    } else if (this.activeTab === 'locks') {
      this.loadLocks();
    }
  }

  // ===========================================
  // ESTADÍSTICAS
  // ===========================================
  loadStats() {
    this.isLoadingStats.set(true);
    
    // Cargar todas las estadísticas en paralelo
    this.backupService.getMostQueriedTables().subscribe(res => {
      this.mostQueried.set(res);
      this.updateQueriesChart(res);
    });

    this.backupService.getTableSizes().subscribe(res => {
      this.tableSizes.set(res);
      this.updateSizesChart(res);
    });

    this.backupService.getIndexInfo().subscribe(res => {
      this.indexInfo.set(res);
      this.updateIndexUsageChart(res);
    });

    this.backupService.getTableLockStats().subscribe(res => {
      this.lockStats.set(res);
    });

    this.backupService.getTableScanStats().subscribe(res => {
      this.scanStats.set(res);
      this.lastUpdateStats.set(new Date().toLocaleString('es-MX'));
      this.isLoadingStats.set(false);
    });
  }

  private updateQueriesChart(data: any[]) {
    this.queriesChart.labels = data.map((t: any) => t.tablename);
    this.queriesChart.datasets[0].data = data.map((t: any) => Number(t.total_consultas) || 0);
  }

  private updateSizesChart(data: any[]) {
    this.sizesChart.labels = data.map((t: any) => t.tablename);
    this.sizesChart.datasets[0].data = data.map((t: any) => Number(t.total_size_bytes) / (1024*1024));
    this.sizesChart.datasets[1].data = data.map((t: any) => Number(t.indices_size_bytes) / (1024*1024));
  }

  private updateIndexUsageChart(data: any[]) {
    this.indexUsageChart.labels = data.slice(0, 10).map((i: any) => 
      i.indexname.length > 20 ? i.indexname.substring(0, 20) + '...' : i.indexname
    );
    this.indexUsageChart.datasets[0].data = data.slice(0, 10).map((i: any) => Number(i.veces_usado) || 0);
  }

  // ===========================================
  // CONEXIONES
  // ===========================================
  loadConnections() {
    this.isLoadingConnections.set(true);

    this.backupService.getActiveConnections().subscribe((res: any[]) => {

      const normalized = res.map(conn => {
        let estado = 'Interna';

        if (conn.state === 'active') estado = 'Activa';
        else if (conn.state === 'idle') estado = 'Inactiva';
        else if (conn.state === 'idle in transaction') estado = 'En transacción';

        return {
          pid: conn.pid,
          usename: conn.usename,
          state: estado,
          rawState: conn.state,
          client_addr: conn.client_addr || 'interna'
        };
      });

      const sorted = normalized.sort((a, b) => {
        const order: any = { active: 1, 'idle in transaction': 2, idle: 3, null: 4 };
        return (order[a.rawState] || 5) - (order[b.rawState] || 5);
      });

      this.connections.set(sorted);
      this.lastUpdateConnections.set(new Date().toLocaleString('es-MX'));

      const activas = normalized.filter(c => c.rawState === 'active').length;
      const inactivas = normalized.filter(c => c.rawState === 'idle' || c.rawState === 'idle in transaction').length;
      const internas = normalized.filter(c => !c.rawState).length;

      this.connectionsChart.datasets[0].data = [activas, internas, inactivas];
      this.isLoadingConnections.set(false);
    });
  }

  // ===========================================
  // LOCKS
  // ===========================================
  loadLocks() {
    this.isLoadingLocks.set(true);

    this.backupService.getDetailedLocks().subscribe({
      next: (res: any[]) => {
        this.locks.set(res);

        const lockTypes: Record<string, number> = {};
        res.forEach(lock => {
          const tipo = lock.mode;
          lockTypes[tipo] = (lockTypes[tipo] || 0) + 1;
        });

        this.locksChart.labels = Object.keys(lockTypes);
        this.locksChart.datasets[0].data = Object.values(lockTypes);

        this.locksChart.datasets[0].backgroundColor = Object.keys(lockTypes).map(tipo => {
          if (tipo.includes('Exclusive')) return this.exclusiveColor;
          if (tipo.includes('Share') && !tipo.includes('Access')) return this.shareColor;
          if (tipo.includes('AccessShare')) return this.accessShareColor;
          if (tipo.includes('RowExclusive')) return this.rowExclusiveColor;
          return this.primary;
        });
      }
    });

    this.backupService.getBlockLocks().subscribe({
      next: (res: any[]) => {
        this.blockingLocks.set(res);
        this.lastUpdateLocks.set(new Date().toLocaleString('es-MX'));
        this.isLoadingLocks.set(false);
      }
    });
  }

  // ===========================================
  // MÉTODOS AUXILIARES
  // ===========================================
  getLockModeColor(mode: string): string {
    if (mode.includes('Exclusive')) return this.exclusiveColor;
    if (mode.includes('Share') && !mode.includes('Access')) return this.shareColor;
    if (mode.includes('AccessShare')) return this.accessShareColor;
    if (mode.includes('RowExclusive')) return this.rowExclusiveColor;
    return this.primary;
  }

  formatDate(date: string): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('es-MX');
  }

  getTotalLocks(): number {
    return this.locks().length;
  }

  getExclusiveLocksCount(): number {
    return this.locks().filter(l => l.mode.includes('Exclusive')).length;
  }

  getShareLocksCount(): number {
    return this.locks().filter(l => l.mode.includes('Share')).length;
  }

  getAccessShareLocksCount(): number {
    return this.locks().filter(l => l.mode.includes('AccessShare')).length;
  }

  hasLocks(): boolean {
    return this.locks().length > 0;
  }

  hasBlocking(): boolean {
    return this.blockingLocks().length > 0;
  }

  hasOnlyLocks(): boolean {
    return this.hasLocks() && !this.hasBlocking();
  }

  // Métodos auxiliares para estadísticas
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getEfficiencyClass(percent: number): string {
    if (percent > 80) return 'text-red-600';
    if (percent > 50) return 'text-yellow-600';
    return 'text-green-600';
  }

  getTotalSize(): number {
    return this.tableSizes().reduce((sum, t) => sum + (Number(t.total_size_bytes) || 0), 0);
  }

  getTableQueries(tablename: string): number {
    const table = this.mostQueried().find(t => t.tablename === tablename);
    return table ? Number(table.total_consultas) || 0 : 0;
  }

  getTableIndexPercent(tablename: string): number {
    const table = this.mostQueried().find(t => t.tablename === tablename);
    return table ? Number(table.porcentaje_uso_indices) || 0 : 0;
  }
}