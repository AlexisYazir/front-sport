import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  DoughnutController,
  Tooltip,
  Legend,
} from 'chart.js';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { BaseChartDirective } from 'ng2-charts';
import { ToastrService } from 'ngx-toastr';
import {
  BackupInfo,
  BackupRetentionPolicy,
  BackupSchedule,
  BackupService,
  BackupType,
  SchedulePayload,
  VacuumLogInfo,
  VacuumSchedule,
} from '../../../../../core/services/backup.service';
import { formatMexicoDateTime, formatMexicoNow } from '../../../../../core/utils/date-time.util';

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  DoughnutController,
  Tooltip,
  Legend,
);

type TabKey = 'backups' | 'stats' | 'connections' | 'locks' | 'vacuum';
type SectionKey =
  | 'backupSchedules'
  | 'backups'
  | 'retentionPolicies'
  | 'connections'
  | 'locks'
  | 'vacuumSchedules'
  | 'vacuumLogs';

@Component({
  selector: 'app-db',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BaseChartDirective,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatNativeDateModule,
  ],
  templateUrl: './db.html',
  styleUrl: './db.css',
})
export class DbPage implements OnInit, OnDestroy {
  private readonly backupService = inject(BackupService);
  private readonly toastr = inject(ToastrService);
  private refreshInterval?: ReturnType<typeof setInterval>;

  activeTab = signal<TabKey>('backups');

  isLoadingBackups = signal(false);
  isLoadingStats = signal(false);
  isLoadingConnections = signal(false);
  isLoadingLocks = signal(false);
  isLoadingVacuum = signal(false);
  isCreatingBackup = signal(false);
  isRunningVacuum = signal(false);
  isDeletingBackup = signal<Record<string, boolean>>({});
  isSavingBackupSchedule = signal(false);
  isSavingRetentionPolicy = signal(false);
  isSavingVacuumSchedule = signal(false);
  isDeletingConfig = signal(false);
  isDownloadingBackup = signal<Record<string, boolean>>({});

  lastUpdateBackups = signal('');
  lastUpdateStats = signal('');
  lastUpdateConnections = signal('');
  lastUpdateLocks = signal('');
  lastUpdateVacuum = signal('');

  backups = signal<BackupInfo[]>([]);
  backupSchedules = signal<BackupSchedule[]>([]);
  retentionPolicies = signal<BackupRetentionPolicy[]>([]);
  vacuumLogs = signal<VacuumLogInfo[]>([]);
  vacuumSchedules = signal<VacuumSchedule[]>([]);

  connections = signal<any[]>([]);
  locks = signal<any[]>([]);
  blockingLocks = signal<any[]>([]);
  mostQueried = signal<any[]>([]);
  tableSizes = signal<any[]>([]);
  indexInfo = signal<any[]>([]);
  scanStats = signal<any[]>([]);

  searchBackups = '';
  searchVacuums = '';
  searchBackupSchedules = '';
  searchConnections = '';
  searchLocks = '';
  searchVacuumSchedules = '';
  searchRetentionPolicies = '';

  readonly pageSize = 10;
  currentPages: Record<SectionKey, number> = {
    backupSchedules: 1,
    backups: 1,
    retentionPolicies: 1,
    connections: 1,
    locks: 1,
    vacuumSchedules: 1,
    vacuumLogs: 1,
  };

  backupScheduleForm = {
    name: '',
    type: 'full' as BackupType,
    scheduleType: 'daily' as 'daily' | 'weekly' | 'datetime',
    time: '02:00',
    dayOfWeek: 0,
    runAt: null as Date | null,
    retentionDays: 7,
  };

  vacuumScheduleForm = {
    name: '',
    scheduleType: 'weekly' as 'daily' | 'weekly' | 'datetime',
    time: '04:00',
    dayOfWeek: 0,
    runAt: null as Date | null,
  };

  retentionPolicyForm = {
    name: '',
    type: 'all' as 'all' | BackupType,
    scheduleType: 'daily' as 'daily' | 'weekly' | 'datetime',
    time: '05:00',
    dayOfWeek: 0,
    runAt: null as Date | null,
    retentionDays: 7,
  };

  showLogModal = signal(false);
  selectedLogTitle = signal('');
  selectedLogContent = signal('');
  showBackupConfirmModal = signal(false);
  pendingBackupType = signal<BackupType>('full');
  showDeleteBackupModal = signal(false);
  backupToDelete = signal<BackupInfo | null>(null);
  showVacuumConfirmModal = signal(false);
  showBackupScheduleModal = signal(false);
  showRetentionPolicyModal = signal(false);
  showVacuumScheduleModal = signal(false);
  showDeleteConfigModal = signal(false);
  pendingConfigDelete = signal<{
    kind: 'backupSchedule' | 'retentionPolicy' | 'vacuumSchedule';
    name: string;
  } | null>(null);

  readonly weekDays = [
    { value: 0, label: 'Domingo' },
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miercoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sabado' },
  ];

  readonly tabOrder: { key: TabKey; label: string; icon: string }[] = [
    { key: 'backups', label: 'Backups', icon: 'backup' },
    { key: 'vacuum', label: 'Vacuum Analyze', icon: 'cleaning_services' },
    { key: 'stats', label: 'Estadísticas', icon: 'bar_chart' },
    { key: 'connections', label: 'Conexiones', icon: 'database' },
    { key: 'locks', label: 'Bloqueos', icon: 'lock' },
  ];

  connectionsChart = {
    labels: ['Activas', 'En espera', 'Inactivas'],
    datasets: [
      {
        data: [0, 0, 0],
        backgroundColor: ['#22C55E', '#F59E0B', '#CBD5E1'],
        borderWidth: 0,
      },
    ],
  };

  lockChart = {
    labels: [] as string[],
    datasets: [
      {
        label: 'Cantidad',
        data: [] as number[],
        backgroundColor: ['#0367A6', '#F59E0B', '#EF4444', '#22C55E', '#8B5CF6'],
        borderRadius: 8,
      },
    ],
  };

  queriesChart = {
    labels: [] as string[],
    datasets: [
      { label: 'Consultas', data: [] as number[], backgroundColor: '#0367A6', borderRadius: 8 },
    ],
  };

  sizesChart = {
    labels: [] as string[],
    datasets: [
      {
        label: 'Tabla (MB)',
        data: [] as number[],
        backgroundColor: '#0367A6',
        borderRadius: 8,
      },
      {
        label: 'Índices (MB)',
        data: [] as number[],
        backgroundColor: '#F59E0B',
        borderRadius: 8,
      },
    ],
  };

  indexUsageChart = {
    labels: [] as string[],
    datasets: [{ label: 'Uso', data: [] as number[], backgroundColor: '#22C55E', borderRadius: 8 }],
  };

  ngOnInit(): void {
    this.loadCurrentTab();
    this.refreshInterval = setInterval(() => this.loadCurrentTab(), 60000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  changeTab(tab: TabKey) {
    this.activeTab.set(tab);
    setTimeout(() => this.loadCurrentTab(), 50);
  }

  loadCurrentTab() {
    const tab = this.activeTab();
    if (tab === 'backups') this.loadBackupsTab();
    if (tab === 'stats') this.loadStats();
    if (tab === 'connections') this.loadConnections();
    if (tab === 'locks') this.loadLocks();
    if (tab === 'vacuum') this.loadVacuumTab();
  }

  loadBackupsTab() {
    this.isLoadingBackups.set(true);
    this.backupService.listBackups().subscribe({
      next: (res) => {
        this.backups.set(res);
        this.lastUpdateBackups.set(this.nowLabel());
        this.isLoadingBackups.set(false);
      },
      error: () => this.handleLoadError('backups'),
    });

    this.backupService.listBackupSchedules().subscribe({
      next: (res) => this.backupSchedules.set(res),
      error: () => this.backupSchedules.set([]),
    });

    this.backupService.listRetentionPolicies().subscribe({
      next: (res) => this.retentionPolicies.set(res),
      error: () => this.retentionPolicies.set([]),
    });
  }

  loadStats() {
    this.isLoadingStats.set(true);
    this.backupService.getMostQueriedTables().subscribe((res) => {
      this.mostQueried.set(res);
      this.queriesChart = {
        ...this.queriesChart,
        labels: res.map((item) => item.tablename),
        datasets: [
          {
            ...this.queriesChart.datasets[0],
            data: res.map((item) => Number(item.total_consultas) || 0),
          },
        ],
      };
    });

    this.backupService.getTableSizes().subscribe((res) => {
      this.tableSizes.set(res);
      this.sizesChart = {
        ...this.sizesChart,
        labels: res.map((item) => item.tablename),
        datasets: [
          {
            ...this.sizesChart.datasets[0],
            data: res.map((item) => (Number(item.total_size_bytes) || 0) / (1024 * 1024)),
          },
          {
            ...this.sizesChart.datasets[1],
            data: res.map((item) => (Number(item.indices_size_bytes) || 0) / (1024 * 1024)),
          },
        ],
      };
    });

    this.backupService.getIndexInfo().subscribe((res) => {
      this.indexInfo.set(res);
      const top = res.slice(0, 10);
      this.indexUsageChart = {
        ...this.indexUsageChart,
        labels: top.map((item) => item.indexname),
        datasets: [
          {
            ...this.indexUsageChart.datasets[0],
            data: top.map((item) => Number(item.veces_usado) || 0),
          },
        ],
      };
    });

    this.backupService.getTableScanStats().subscribe({
      next: (res) => {
        this.scanStats.set(res);
        this.lastUpdateStats.set(this.nowLabel());
        this.isLoadingStats.set(false);
      },
      error: () => this.handleLoadError('stats'),
    });
  }

  loadConnections() {
    this.isLoadingConnections.set(true);
    this.backupService.getActiveConnections().subscribe({
      next: (res) => {
        this.connections.set(res);
        const active = res.filter((row) => row.state === 'active').length;
        const waiting = res.filter((row) => row.state === 'idle in transaction').length;
        const idle = res.length - active - waiting;
        this.connectionsChart = {
          ...this.connectionsChart,
          datasets: [{ ...this.connectionsChart.datasets[0], data: [active, waiting, idle] }],
        };
        this.lastUpdateConnections.set(this.nowLabel());
        this.isLoadingConnections.set(false);
      },
      error: () => this.handleLoadError('connections'),
    });
  }

  loadLocks() {
    this.isLoadingLocks.set(true);
    this.backupService.getDetailedLocks().subscribe((res) => {
      this.locks.set(res);
      const grouped = new Map<string, number>();
      res.forEach((lock) => {
        const label = this.toFriendlyLockMode(lock.mode);
        grouped.set(label, (grouped.get(label) ?? 0) + 1);
      });
      this.lockChart = {
        ...this.lockChart,
        labels: Array.from(grouped.keys()),
        datasets: [{ ...this.lockChart.datasets[0], data: Array.from(grouped.values()) }],
      };
    });

    this.backupService.getBlockLocks().subscribe({
      next: (res) => {
        this.blockingLocks.set(res);
        this.lastUpdateLocks.set(this.nowLabel());
        this.isLoadingLocks.set(false);
      },
      error: () => this.handleLoadError('locks'),
    });
  }

  loadVacuumTab() {
    this.isLoadingVacuum.set(true);
    this.backupService.listVacuumLogs().subscribe({
      next: (res) => {
        this.vacuumLogs.set(res);
        this.lastUpdateVacuum.set(this.nowLabel());
        this.isLoadingVacuum.set(false);
      },
      error: () => this.handleLoadError('vacuum'),
    });

    this.backupService.listVacuumSchedules().subscribe({
      next: (res) => this.vacuumSchedules.set(res),
      error: () => this.vacuumSchedules.set([]),
    });
  }

  openBackupConfirmModal(type: BackupType) {
    this.pendingBackupType.set(type);
    this.showBackupConfirmModal.set(true);
  }

  closeBackupConfirmModal() {
    this.showBackupConfirmModal.set(false);
  }

  openBackupScheduleModal() {
    this.showBackupScheduleModal.set(true);
  }

  closeBackupScheduleModal() {
    this.showBackupScheduleModal.set(false);
  }

  openRetentionPolicyModal() {
    this.showRetentionPolicyModal.set(true);
  }

  closeRetentionPolicyModal() {
    this.showRetentionPolicyModal.set(false);
  }

  openVacuumScheduleModal() {
    this.showVacuumScheduleModal.set(true);
  }

  closeVacuumScheduleModal() {
    this.showVacuumScheduleModal.set(false);
  }

  openDeleteConfigModal(
    kind: 'backupSchedule' | 'retentionPolicy' | 'vacuumSchedule',
    name: string,
  ) {
    this.pendingConfigDelete.set({ kind, name });
    this.showDeleteConfigModal.set(true);
  }

  closeDeleteConfigModal() {
    this.showDeleteConfigModal.set(false);
    this.pendingConfigDelete.set(null);
  }

  createBackup(type = this.pendingBackupType()) {
    this.isCreatingBackup.set(true);
    this.closeBackupConfirmModal();
    const request =
      type === 'full'
        ? this.backupService.createBackupFull()
        : this.backupService.createCriticalTablesBackup();
    request.subscribe({
      next: () => {
        this.toastr.success('Backup ejecutado correctamente', 'Base de datos');
        this.isCreatingBackup.set(false);
        this.loadBackupsTab();
      },
      error: () => {
        this.toastr.error('No se pudo crear el backup', 'Base de datos');
        this.isCreatingBackup.set(false);
      },
    });
  }

  createBackupSchedule() {
    if (!this.backupScheduleForm.name.trim()) {
      this.toastr.warning('Completa el nombre de la programación', 'Backups');
      return;
    }

    const payload = this.buildSchedulePayload({
      name: this.backupScheduleForm.name,
      scheduleType: this.backupScheduleForm.scheduleType,
      time: this.backupScheduleForm.time,
      dayOfWeek: this.backupScheduleForm.dayOfWeek,
      runAt: this.backupScheduleForm.runAt,
      type: this.backupScheduleForm.type,
      retentionDays: this.backupScheduleForm.retentionDays,
    });

    if (!payload) return;

    this.isSavingBackupSchedule.set(true);
    this.backupService.createBackupSchedule(payload).subscribe({
      next: () => {
        this.toastr.success('Programación creada', 'Backups');
        this.isSavingBackupSchedule.set(false);
        this.closeBackupScheduleModal();
        this.backupScheduleForm = {
          name: '',
          type: 'full',
          scheduleType: 'daily',
          time: '02:00',
          dayOfWeek: 0,
          runAt: null,
          retentionDays: 7,
        };
        this.loadBackupsTab();
      },
      error: () => {
        this.isSavingBackupSchedule.set(false);
        this.toastr.error('No se pudo crear la programación', 'Backups');
      },
    });
  }

  deleteBackupSchedule(name: string) {
    this.openDeleteConfigModal('backupSchedule', name);
  }

  createRetentionPolicy() {
    if (!this.retentionPolicyForm.name.trim()) {
      this.toastr.warning('Completa el nombre de la política', 'Retención');
      return;
    }

    const payload = this.buildSchedulePayload({
      name: this.retentionPolicyForm.name,
      scheduleType: this.retentionPolicyForm.scheduleType,
      time: this.retentionPolicyForm.time,
      dayOfWeek: this.retentionPolicyForm.dayOfWeek,
      runAt: this.retentionPolicyForm.runAt,
      retentionDays: this.retentionPolicyForm.retentionDays,
    });

    if (!payload || !payload.time) return;

    this.isSavingRetentionPolicy.set(true);
    this.backupService
      .createRetentionPolicy({
        name: payload.name,
        type: this.retentionPolicyForm.type,
        scheduleType: payload.scheduleType,
        time: payload.time,
        dayOfWeek: payload.dayOfWeek,
        runAt: payload.runAt,
        retentionDays: this.retentionPolicyForm.retentionDays,
      })
      .subscribe({
        next: () => {
          this.toastr.success('Política de retención creada', 'Backups');
          this.isSavingRetentionPolicy.set(false);
          this.closeRetentionPolicyModal();
          this.retentionPolicyForm = {
            name: '',
            type: 'all',
            scheduleType: 'daily',
            time: '05:00',
            dayOfWeek: 0,
            runAt: null,
            retentionDays: 7,
          };
          this.loadBackupsTab();
        },
        error: () => {
          this.isSavingRetentionPolicy.set(false);
          this.toastr.error('No se pudo crear la política de retención', 'Backups');
        },
      });
  }

  deleteRetentionPolicy(name: string) {
    this.openDeleteConfigModal('retentionPolicy', name);
  }

  downloadBackup(backup: BackupInfo) {
    this.isDownloadingBackup.update((state) => ({ ...state, [backup.key]: true }));
    this.backupService.downloadBackup(backup.dumpKey).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = backup.dumpFileName;
        a.click();
        window.URL.revokeObjectURL(url);
        this.isDownloadingBackup.update((state) => ({ ...state, [backup.key]: false }));
      },
      error: () => {
        this.isDownloadingBackup.update((state) => ({ ...state, [backup.key]: false }));
        this.toastr.error('No se pudo descargar el backup', 'Backups');
      },
    });
  }

  openDeleteBackupModal(backup: BackupInfo) {
    this.backupToDelete.set(backup);
    this.showDeleteBackupModal.set(true);
  }

  closeDeleteBackupModal() {
    this.showDeleteBackupModal.set(false);
    this.backupToDelete.set(null);
  }

  deleteBackup(backup = this.backupToDelete()) {
    if (!backup) return;
    this.isDeletingBackup.update((state) => ({ ...state, [backup.key]: true }));
    this.backupService.deleteBackup(backup.key).subscribe({
      next: () => {
        this.toastr.success('Backup eliminado', 'Backups');
        this.isDeletingBackup.update((state) => ({ ...state, [backup.key]: false }));
        this.closeDeleteBackupModal();
        this.loadBackupsTab();
      },
      error: () => {
        this.isDeletingBackup.update((state) => ({ ...state, [backup.key]: false }));
        this.toastr.error('No se pudo eliminar el backup', 'Backups');
      },
    });
  }

  openBackupLog(backup: BackupInfo) {
    this.backupService.getBackupLog(backup.logKey).subscribe({
      next: (res) => this.openLogModal(`Log de ${backup.folder}`, res.content),
      error: () => this.toastr.error('No se pudo cargar el log', 'Backups'),
    });
  }

  openVacuumConfirmModal() {
    this.showVacuumConfirmModal.set(true);
  }

  closeVacuumConfirmModal() {
    this.showVacuumConfirmModal.set(false);
  }

  runVacuum() {
    this.isRunningVacuum.set(true);
    this.closeVacuumConfirmModal();
    this.backupService.runVacuumAnalyze().subscribe({
      next: (res) => {
        this.toastr.success('Vacuum ejecutado correctamente', 'Mantenimiento');
        this.isRunningVacuum.set(false);
        this.loadVacuumTab();
        if (res?.logKey) {
          this.backupService.getVacuumLog(res.logKey).subscribe((log) => {
            this.openLogModal('Log de VACUUM en ejecución', log.content);
          });
        }
      },
      error: () => {
        this.toastr.error('No se pudo ejecutar el vacuum', 'Mantenimiento');
        this.isRunningVacuum.set(false);
      },
    });
  }

  createVacuumSchedule() {
    if (!this.vacuumScheduleForm.name.trim()) {
      this.toastr.warning('Completa el nombre de la programación', 'Vacuum');
      return;
    }

    const payload = this.buildSchedulePayload({
      name: this.vacuumScheduleForm.name,
      scheduleType: this.vacuumScheduleForm.scheduleType,
      time: this.vacuumScheduleForm.time,
      dayOfWeek: this.vacuumScheduleForm.dayOfWeek,
      runAt: this.vacuumScheduleForm.runAt,
      type: 'vacuum',
    });

    if (!payload) return;

    this.isSavingVacuumSchedule.set(true);
    this.backupService.createVacuumSchedule(payload).subscribe({
      next: () => {
        this.toastr.success('Programación de vacuum creada', 'Vacuum');
        this.isSavingVacuumSchedule.set(false);
        this.closeVacuumScheduleModal();
        this.vacuumScheduleForm = {
          name: '',
          scheduleType: 'weekly',
          time: '04:00',
          dayOfWeek: 0,
          runAt: null,
        };
        this.loadVacuumTab();
      },
      error: () => {
        this.isSavingVacuumSchedule.set(false);
        this.toastr.error('No se pudo crear la programación', 'Vacuum');
      },
    });
  }

  deleteVacuumSchedule(name: string) {
    this.openDeleteConfigModal('vacuumSchedule', name);
  }

  confirmDeleteConfig() {
    const pending = this.pendingConfigDelete();
    if (!pending) return;
    this.isDeletingConfig.set(true);

    if (pending.kind === 'backupSchedule') {
      this.backupService.deleteBackupSchedule(pending.name).subscribe({
        next: () => {
          this.toastr.success('Programación eliminada', 'Backups');
          this.isDeletingConfig.set(false);
          this.closeDeleteConfigModal();
          this.loadBackupsTab();
        },
        error: () => {
          this.isDeletingConfig.set(false);
          this.toastr.error('No se pudo eliminar la programación', 'Backups');
        },
      });
      return;
    }

    if (pending.kind === 'retentionPolicy') {
      this.backupService.deleteRetentionPolicy(pending.name).subscribe({
        next: () => {
          this.toastr.success('Política eliminada', 'Retención');
          this.isDeletingConfig.set(false);
          this.closeDeleteConfigModal();
          this.loadBackupsTab();
        },
        error: () => {
          this.isDeletingConfig.set(false);
          this.toastr.error('No se pudo eliminar la política', 'Retención');
        },
      });
      return;
    }

    this.backupService.deleteVacuumSchedule(pending.name).subscribe({
      next: () => {
        this.toastr.success('Programación eliminada', 'Vacuum');
        this.isDeletingConfig.set(false);
        this.closeDeleteConfigModal();
        this.loadVacuumTab();
      },
      error: () => {
        this.isDeletingConfig.set(false);
        this.toastr.error('No se pudo eliminar la programación', 'Vacuum');
      },
    });
  }

  openVacuumLog(item: VacuumLogInfo) {
    this.backupService.getVacuumLog(item.key).subscribe({
      next: (res) => this.openLogModal(`Log de ${item.folder}`, res.content),
      error: () => this.toastr.error('No se pudo cargar el log', 'Vacuum'),
    });
  }

  openLogModal(title: string, content: string) {
    this.selectedLogTitle.set(title);
    this.selectedLogContent.set(content);
    this.showLogModal.set(true);
  }

  closeLogModal() {
    this.showLogModal.set(false);
    this.selectedLogTitle.set('');
    this.selectedLogContent.set('');
  }

  get filteredBackups() {
    const term = this.searchBackups.trim().toLowerCase();
    if (!term) return this.backups();
    return this.backups().filter(
      (item) =>
        item.folder.toLowerCase().includes(term) ||
        item.type.toLowerCase().includes(term) ||
        item.dumpFileName.toLowerCase().includes(term),
    );
  }

  get filteredBackupSchedules() {
    const term = this.searchBackupSchedules.trim().toLowerCase();
    if (!term) return this.backupSchedules();
    return this.backupSchedules().filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        item.type.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term),
    );
  }

  get filteredRetentionPolicies() {
    const term = this.searchRetentionPolicies.trim().toLowerCase();
    if (!term) return this.retentionPolicies();
    return this.retentionPolicies().filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        item.type.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term),
    );
  }

  get filteredConnections() {
    const term = this.searchConnections.trim().toLowerCase();
    if (!term) return this.connections();
    return this.connections().filter(
      (item) =>
        String(item.pid ?? '').toLowerCase().includes(term) ||
        String(item.usename ?? '').toLowerCase().includes(term) ||
        String(item.application_name ?? '').toLowerCase().includes(term) ||
        String(item.state ?? '').toLowerCase().includes(term) ||
        String(item.client_addr ?? '').toLowerCase().includes(term),
    );
  }

  get filteredLocks() {
    const term = this.searchLocks.trim().toLowerCase();
    if (!term) return this.locks();
    return this.locks().filter(
      (item) =>
        String(item.pid ?? '').toLowerCase().includes(term) ||
        String(item.usename ?? '').toLowerCase().includes(term) ||
        String(item.tabla ?? '').toLowerCase().includes(term) ||
        this.toFriendlyLockMode(String(item.mode ?? '')).toLowerCase().includes(term),
    );
  }

  get filteredVacuumLogs() {
    const term = this.searchVacuums.trim().toLowerCase();
    if (!term) return this.vacuumLogs();
    return this.vacuumLogs().filter(
      (item) =>
        item.folder.toLowerCase().includes(term) ||
        item.fileName.toLowerCase().includes(term),
    );
  }

  get filteredVacuumSchedules() {
    const term = this.searchVacuumSchedules.trim().toLowerCase();
    if (!term) return this.vacuumSchedules();
    return this.vacuumSchedules().filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term),
    );
  }

  get paginatedBackupSchedules() {
    return this.paginate(this.filteredBackupSchedules, this.currentPages.backupSchedules);
  }

  get paginatedBackups() {
    return this.paginate(this.filteredBackups, this.currentPages.backups);
  }

  get paginatedRetentionPolicies() {
    return this.paginate(this.filteredRetentionPolicies, this.currentPages.retentionPolicies);
  }

  get paginatedConnections() {
    return this.paginate(this.filteredConnections, this.currentPages.connections);
  }

  get paginatedLocks() {
    return this.paginate(this.filteredLocks, this.currentPages.locks);
  }

  get paginatedVacuumSchedules() {
    return this.paginate(this.filteredVacuumSchedules, this.currentPages.vacuumSchedules);
  }

  get paginatedVacuumLogs() {
    return this.paginate(this.filteredVacuumLogs, this.currentPages.vacuumLogs);
  }

  toFriendlyLockMode(mode: string): string {
    if (!mode) return 'Sin clasificar';
    if (mode.includes('AccessShare')) return 'Lectura compartida';
    if (mode.includes('RowShare')) return 'Lectura de filas';
    if (mode.includes('RowExclusive')) return 'Escritura ligera';
    if (mode.includes('ShareUpdateExclusive')) return 'Mantenimiento compartido';
    if (mode.includes('Share')) return 'Compartido';
    if (mode.includes('Exclusive')) return 'Exclusivo';
    return mode;
  }

  connectionStatusLabel(state: string): string {
    if (state === 'active') return 'Activa';
    if (state === 'idle') return 'Inactiva';
    if (state === 'idle in transaction') return 'En espera';
    return state || 'Sistema';
  }

  getLockBadgeClass(mode: string): string {
    const friendly = this.toFriendlyLockMode(mode);
    if (friendly.includes('Exclusivo')) return 'bg-red-100 text-red-700';
    if (friendly.includes('compartida') || friendly.includes('Compartido'))
      return 'bg-green-100 text-green-700';
    if (friendly.includes('Escritura')) return 'bg-yellow-100 text-yellow-700';
    return 'bg-blue-100 text-blue-700';
  }

  formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let index = 0;
    while (value >= 1024 && index < units.length - 1) {
      value /= 1024;
      index++;
    }
    return `${value.toFixed(2)} ${units[index]}`;
  }

  formatDate(date: string | Date | null): string {
    return formatMexicoDateTime(date);
  }

  backupTypeIcon(type: BackupType): string {
    return type === 'full' ? 'database' : 'security';
  }

  totalDbSize(): number {
    return this.tableSizes().reduce(
      (acc, table) => acc + (Number(table.total_size_bytes) || 0),
      0,
    );
  }

  backupHistoryCount() {
    return this.filteredBackups.length;
  }

  backupScheduleCount() {
    return this.filteredBackupSchedules.length;
  }

  retentionPolicyCount() {
    return this.filteredRetentionPolicies.length;
  }

  connectionCount() {
    return this.filteredConnections.length;
  }

  lockCount() {
    return this.filteredLocks.length;
  }

  vacuumScheduleCount() {
    return this.filteredVacuumSchedules.length;
  }

  vacuumLogCount() {
    return this.filteredVacuumLogs.length;
  }

  onSectionSearch(section: SectionKey) {
    this.currentPages[section] = 1;
  }

  changeSectionPage(section: SectionKey, action: 'first' | 'prev' | 'next' | 'last') {
    const current = this.currentPages[section];
    const totalPages = this.sectionTotalPages(section);
    if (action === 'first') this.currentPages[section] = 1;
    if (action === 'prev') this.currentPages[section] = Math.max(1, current - 1);
    if (action === 'next') this.currentPages[section] = Math.min(totalPages, current + 1);
    if (action === 'last') this.currentPages[section] = totalPages;
  }

  goToSectionPage(section: SectionKey, page: number) {
    this.currentPages[section] = page;
  }

  sectionPageNumbers(section: SectionKey): number[] {
    const totalPages = this.sectionTotalPages(section);
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  sectionRangeLabel(section: SectionKey): string {
    const total = this.sectionTotalItems(section);
    if (!total) return 'Mostrando 0 a 0';
    const start = (this.currentPages[section] - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPages[section] * this.pageSize, total);
    return `Mostrando ${start} a ${end} de ${total}`;
  }

  clearSectionSearch(section: SectionKey) {
    if (section === 'backupSchedules') this.searchBackupSchedules = '';
    if (section === 'backups') this.searchBackups = '';
    if (section === 'retentionPolicies') this.searchRetentionPolicies = '';
    if (section === 'connections') this.searchConnections = '';
    if (section === 'locks') this.searchLocks = '';
    if (section === 'vacuumSchedules') this.searchVacuumSchedules = '';
    if (section === 'vacuumLogs') this.searchVacuums = '';
    this.onSectionSearch(section);
  }

  scheduleTypeLabel(type: 'daily' | 'weekly' | 'datetime') {
    if (type === 'daily') return 'Diario';
    if (type === 'weekly') return 'Semanal';
    return 'Fecha exacta';
  }

  weekDayLabel(day: number | null) {
    return this.weekDays.find((item) => item.value === day)?.label ?? 'N/A';
  }

  private nowLabel(): string {
    return formatMexicoNow();
  }

  private paginate<T>(items: T[], currentPage: number): T[] {
    const start = (currentPage - 1) * this.pageSize;
    return items.slice(start, start + this.pageSize);
  }

  private sectionTotalItems(section: SectionKey): number {
    if (section === 'backupSchedules') return this.filteredBackupSchedules.length;
    if (section === 'backups') return this.filteredBackups.length;
    if (section === 'retentionPolicies') return this.filteredRetentionPolicies.length;
    if (section === 'connections') return this.filteredConnections.length;
    if (section === 'locks') return this.filteredLocks.length;
    if (section === 'vacuumSchedules') return this.filteredVacuumSchedules.length;
    return this.filteredVacuumLogs.length;
  }

  private sectionTotalPages(section: SectionKey): number {
    return Math.max(1, Math.ceil(this.sectionTotalItems(section) / this.pageSize));
  }

  private buildSchedulePayload(input: {
    name: string;
    scheduleType: 'daily' | 'weekly' | 'datetime';
    time?: string;
    dayOfWeek?: number;
    runAt?: Date | null;
    type?: BackupType | 'vacuum';
    retentionDays?: number;
  }): SchedulePayload | null {
    if (input.scheduleType === 'datetime') {
      if (!input.runAt) {
        this.toastr.warning('Selecciona una fecha de ejecución', 'Programación');
        return null;
      }

      const runAt = new Date(input.runAt);
      if (input.time) {
        const [hours, minutes] = input.time.split(':').map(Number);
        runAt.setHours(hours, minutes, 0, 0);
      }

      return {
        name: input.name,
        scheduleType: input.scheduleType,
        runAt: runAt.toISOString(),
        type: input.type,
        retentionDays: input.retentionDays,
      };
    }

    if (!input.time) {
      this.toastr.warning('Selecciona una hora', 'Programación');
      return null;
    }

    if (input.scheduleType === 'weekly' && typeof input.dayOfWeek !== 'number') {
      this.toastr.warning('Selecciona un día de la semana', 'Programación');
      return null;
    }

    return {
      name: input.name,
      scheduleType: input.scheduleType,
      time: input.time,
      dayOfWeek: input.scheduleType === 'weekly' ? input.dayOfWeek : undefined,
      type: input.type,
      retentionDays: input.retentionDays,
    };
  }

  private handleLoadError(section: string) {
    this.toastr.error(`No se pudo cargar ${section}`, 'Base de datos');
    this.isLoadingBackups.set(false);
    this.isLoadingStats.set(false);
    this.isLoadingConnections.set(false);
    this.isLoadingLocks.set(false);
    this.isLoadingVacuum.set(false);
  }
}
