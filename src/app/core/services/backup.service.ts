import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export type ScheduleType = 'daily' | 'weekly' | 'datetime';
export type BackupType = 'full' | 'critical';

export interface BackupInfo {
  key: string;
  type: BackupType;
  folder: string;
  dumpKey: string;
  dumpFileName: string;
  dumpSize: number;
  logKey: string;
  logFileName: string;
  lastModified: string;
}

export interface BackupSchedule {
  id: number;
  name: string;
  type: BackupType;
  scheduleType: ScheduleType;
  dayOfWeek: number | null;
  time: string | null;
  runAt: string | null;
  retentionDays: number;
  isActive: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  description: string;
  createdAt: string;
}

export interface BackupRetentionPolicy {
  id: number;
  name: string;
  type: 'all' | BackupType;
  scheduleType: ScheduleType;
  dayOfWeek: number | null;
  time: string | null;
  runAt: string | null;
  retentionDays: number;
  isActive: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  description: string;
  createdAt: string;
}

export interface VacuumLogInfo {
  key: string;
  folder: string;
  fileName: string;
  lastModified: string;
  size: number;
}

export interface VacuumSchedule {
  id: number;
  name: string;
  scheduleType: ScheduleType;
  dayOfWeek: number | null;
  time: string | null;
  runAt: string | null;
  targetSchema: string;
  isActive: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  description: string;
  createdAt: string;
}

export interface LogResponse {
  key: string;
  content: string;
}

export interface SchedulePayload {
  name: string;
  scheduleType: ScheduleType;
  time?: string;
  dayOfWeek?: number;
  runAt?: string;
  type?: BackupType | 'vacuum';
  retentionDays?: number;
}

export interface RetentionPolicyPayload {
  name: string;
  type: 'all' | BackupType;
  scheduleType: ScheduleType;
  time: string;
  dayOfWeek?: number;
  runAt?: string;
  retentionDays: number;
}

@Injectable({
  providedIn: 'root',
})
export class BackupService {
  private readonly API_URL = environment.apiUrl;
  isLoading = signal<boolean>(false);

  constructor(private http: HttpClient) {}

  private withLoading<T>(observable: Observable<T>): Observable<T> {
    this.isLoading.set(true);
    return observable.pipe(
      tap({
        next: () => this.isLoading.set(false),
        error: () => this.isLoading.set(false),
      }),
    );
  }

  createBackupFull(): Observable<any> {
    return this.withLoading(this.http.post(`${this.API_URL}/backup/create`, {}));
  }

  createCriticalTablesBackup(): Observable<any> {
    return this.withLoading(this.http.post(`${this.API_URL}/backup/create-critical`, {}));
  }

  listBackups(): Observable<BackupInfo[]> {
    return this.withLoading(this.http.get<BackupInfo[]>(`${this.API_URL}/backup/list`));
  }

  downloadBackup(key: string): Observable<Blob> {
    return this.http.get(`${this.API_URL}/backup/download/${encodeURIComponent(key)}`, {
      responseType: 'blob',
    });
  }

  getBackupLog(key: string): Observable<LogResponse> {
    return this.http.get<LogResponse>(`${this.API_URL}/backup/log/${encodeURIComponent(key)}`);
  }

  deleteBackup(folderKey: string): Observable<any> {
    return this.withLoading(
      this.http.delete(`${this.API_URL}/backup/delete/${encodeURIComponent(folderKey)}`),
    );
  }

  cleanupOldBackups(days: number = 30): Observable<any> {
    return this.withLoading(this.http.post(`${this.API_URL}/backup/cleanup/${days}`, {}));
  }

  createBackupSchedule(payload: SchedulePayload): Observable<BackupSchedule> {
    return this.withLoading(
      this.http.post<BackupSchedule>(`${this.API_URL}/backup/schedules`, payload),
    );
  }

  listBackupSchedules(): Observable<BackupSchedule[]> {
    return this.http.get<BackupSchedule[]>(`${this.API_URL}/backup/schedules`);
  }

  deleteBackupSchedule(name: string): Observable<any> {
    return this.withLoading(this.http.delete(`${this.API_URL}/backup/schedules/${name}`));
  }

  createRetentionPolicy(payload: RetentionPolicyPayload): Observable<BackupRetentionPolicy> {
    return this.withLoading(
      this.http.post<BackupRetentionPolicy>(
        `${this.API_URL}/backup/retention-policies`,
        payload,
      ),
    );
  }

  listRetentionPolicies(): Observable<BackupRetentionPolicy[]> {
    return this.http.get<BackupRetentionPolicy[]>(`${this.API_URL}/backup/retention-policies`);
  }

  deleteRetentionPolicy(name: string): Observable<any> {
    return this.withLoading(
      this.http.delete(`${this.API_URL}/backup/retention-policies/${name}`),
    );
  }

  getActiveConnections(): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_URL}/db-monitoring/connections`);
  }

  getDetailedLocks(): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_URL}/db-monitoring/locks`);
  }

  getBlockLocks(): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_URL}/db-monitoring/blocking-locks`);
  }

  getLongQueries(): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_URL}/db-monitoring/long-queries`);
  }

  getMostQueriedTables(): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_URL}/db-monitoring/stats/most-queried`);
  }

  getTableSizes(): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_URL}/db-monitoring/stats/table-sizes`);
  }

  getIndexInfo(): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_URL}/db-monitoring/stats/index-info`);
  }

  getTableLockStats(): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_URL}/db-monitoring/stats/lock-stats`);
  }

  getTableScanStats(): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_URL}/db-monitoring/stats/scan-stats`);
  }

  runVacuumAnalyze(): Observable<any> {
    return this.withLoading(this.http.post(`${this.API_URL}/db-maintenance/vacuum`, {}));
  }

  listVacuumLogs(): Observable<VacuumLogInfo[]> {
    return this.http.get<VacuumLogInfo[]>(`${this.API_URL}/db-maintenance/vacuum/logs`);
  }

  getVacuumLog(key: string): Observable<LogResponse> {
    return this.http.get<LogResponse>(
      `${this.API_URL}/db-maintenance/vacuum/log/${encodeURIComponent(key)}`,
    );
  }

  createVacuumSchedule(payload: SchedulePayload): Observable<VacuumSchedule> {
    return this.withLoading(
      this.http.post<VacuumSchedule>(`${this.API_URL}/db-maintenance/vacuum/schedules`, {
        ...payload,
        type: 'vacuum',
      }),
    );
  }

  listVacuumSchedules(): Observable<VacuumSchedule[]> {
    return this.http.get<VacuumSchedule[]>(`${this.API_URL}/db-maintenance/vacuum/schedules`);
  }

  deleteVacuumSchedule(name: string): Observable<any> {
    return this.withLoading(
      this.http.delete(`${this.API_URL}/db-maintenance/vacuum/schedules/${name}`),
    );
  }
}
