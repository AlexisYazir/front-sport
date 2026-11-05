import type { BackupOperationResponse, DbConnection, DbLock, DbBlockingLock, DbLongQuery, DbQueryStats, DbTableSize, DbIndex, DbTableLock, DbScanStats } from './api-contracts';
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { RequestCacheService } from './request-cache.service';

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
  private readonly CACHE_TTL = 20_000;
  isLoading = signal<boolean>(false);

  private readonly http = inject(HttpClient);
  private readonly cache = inject(RequestCacheService);

  private withLoading<T>(observable: Observable<T>): Observable<T> {
    this.isLoading.set(true);
    return observable.pipe(
      tap({
        next: () => this.isLoading.set(false),
        error: () => this.isLoading.set(false),
      }),
    );
  }

  createBackupFull(): Observable<BackupOperationResponse> {
    return this.withLoading(
      this.http.post<BackupOperationResponse>(`${this.API_URL}/backup/create`, {}).pipe(
        tap(() => this.invalidateBackupCaches()),
      ),
    );
  }

  createCriticalTablesBackup(): Observable<BackupOperationResponse> {
    return this.withLoading(
      this.http.post<BackupOperationResponse>(`${this.API_URL}/backup/create-critical`, {}).pipe(
        tap(() => this.invalidateBackupCaches()),
      ),
    );
  }

  listBackups(): Observable<BackupInfo[]> {
    return this.withLoading(
      this.cache.getOrSet(
        'backups:list',
        () => this.http.get<BackupInfo[]>(`${this.API_URL}/backup/list`),
        this.CACHE_TTL,
      ),
    );
  }

  downloadBackup(key: string): Observable<Blob> {
    return this.http.get(`${this.API_URL}/backup/download/${encodeURIComponent(key)}`, {
      responseType: 'blob',
    });
  }

  getBackupLog(key: string): Observable<LogResponse> {
    return this.cache.getOrSet(
      `backups:log:${key}`,
      () => this.http.get<LogResponse>(`${this.API_URL}/backup/log/${encodeURIComponent(key)}`),
      this.CACHE_TTL,
    );
  }

  deleteBackup(folderKey: string): Observable<BackupOperationResponse> {
    return this.withLoading(
      this.http.delete<BackupOperationResponse>(`${this.API_URL}/backup/delete/${encodeURIComponent(folderKey)}`).pipe(
        tap(() => this.invalidateBackupCaches()),
      ),
    );
  }

  cleanupOldBackups(days: number = 30): Observable<BackupOperationResponse> {
    return this.withLoading(
      this.http.post<BackupOperationResponse>(`${this.API_URL}/backup/cleanup/${days}`, {}).pipe(
        tap(() => this.invalidateBackupCaches()),
      ),
    );
  }

  createBackupSchedule(payload: SchedulePayload): Observable<BackupSchedule> {
    return this.withLoading(
      this.http.post<BackupSchedule>(`${this.API_URL}/backup/schedules`, payload).pipe(
        tap(() => this.invalidateBackupScheduleCaches()),
      ),
    );
  }

  listBackupSchedules(): Observable<BackupSchedule[]> {
    return this.cache.getOrSet(
      'backups:schedules',
      () => this.http.get<BackupSchedule[]>(`${this.API_URL}/backup/schedules`),
      this.CACHE_TTL,
    );
  }

  deleteBackupSchedule(name: string): Observable<BackupOperationResponse> {
    return this.withLoading(
      this.http.delete<BackupOperationResponse>(`${this.API_URL}/backup/schedules/${name}`).pipe(
        tap(() => this.invalidateBackupScheduleCaches()),
      ),
    );
  }

  createRetentionPolicy(payload: RetentionPolicyPayload): Observable<BackupRetentionPolicy> {
    return this.withLoading(
      this.http.post<BackupRetentionPolicy>(
        `${this.API_URL}/backup/retention-policies`,
        payload,
      ).pipe(
        tap(() => this.invalidateRetentionPolicyCaches()),
      ),
    );
  }

  listRetentionPolicies(): Observable<BackupRetentionPolicy[]> {
    return this.cache.getOrSet(
      'backups:retention-policies',
      () => this.http.get<BackupRetentionPolicy[]>(`${this.API_URL}/backup/retention-policies`),
      this.CACHE_TTL,
    );
  }

  deleteRetentionPolicy(name: string): Observable<BackupOperationResponse> {
    return this.withLoading(
      this.http.delete<BackupOperationResponse>(`${this.API_URL}/backup/retention-policies/${name}`).pipe(
        tap(() => this.invalidateRetentionPolicyCaches()),
      ),
    );
  }

  getActiveConnections(): Observable<DbConnection[]> {
    return this.http.get<DbConnection[]>(`${this.API_URL}/db-monitoring/connections`);
  }

  getDetailedLocks(): Observable<DbLock[]> {
    return this.http.get<DbLock[]>(`${this.API_URL}/db-monitoring/locks`);
  }

  getBlockLocks(): Observable<DbBlockingLock[]> {
    return this.http.get<DbBlockingLock[]>(`${this.API_URL}/db-monitoring/blocking-locks`);
  }

  getLongQueries(): Observable<DbLongQuery[]> {
    return this.http.get<DbLongQuery[]>(`${this.API_URL}/db-monitoring/long-queries`);
  }

  getMostQueriedTables(): Observable<DbQueryStats[]> {
    return this.http.get<DbQueryStats[]>(`${this.API_URL}/db-monitoring/stats/most-queried`);
  }

  getTableSizes(): Observable<DbTableSize[]> {
    return this.http.get<DbTableSize[]>(`${this.API_URL}/db-monitoring/stats/table-sizes`);
  }

  getIndexInfo(): Observable<DbIndex[]> {
    return this.http.get<DbIndex[]>(`${this.API_URL}/db-monitoring/stats/index-info`);
  }

  getTableLockStats(): Observable<DbTableLock[]> {
    return this.http.get<DbTableLock[]>(`${this.API_URL}/db-monitoring/stats/lock-stats`);
  }

  getTableScanStats(): Observable<DbScanStats[]> {
    return this.http.get<DbScanStats[]>(`${this.API_URL}/db-monitoring/stats/scan-stats`);
  }

  runVacuumAnalyze(): Observable<BackupOperationResponse> {
    return this.withLoading(
      this.http.post<BackupOperationResponse>(`${this.API_URL}/db-maintenance/vacuum`, {}).pipe(
        tap(() => this.invalidateVacuumCaches()),
      ),
    );
  }

  listVacuumLogs(): Observable<VacuumLogInfo[]> {
    return this.cache.getOrSet(
      'backups:vacuum-logs',
      () => this.http.get<VacuumLogInfo[]>(`${this.API_URL}/db-maintenance/vacuum/logs`),
      this.CACHE_TTL,
    );
  }

  getVacuumLog(key: string): Observable<LogResponse> {
    return this.cache.getOrSet(
      `backups:vacuum-log:${key}`,
      () =>
        this.http.get<LogResponse>(
          `${this.API_URL}/db-maintenance/vacuum/log/${encodeURIComponent(key)}`,
        ),
      this.CACHE_TTL,
    );
  }

  createVacuumSchedule(payload: SchedulePayload): Observable<VacuumSchedule> {
    return this.withLoading(
      this.http.post<VacuumSchedule>(`${this.API_URL}/db-maintenance/vacuum/schedules`, {
        ...payload,
        type: 'vacuum',
      }).pipe(
        tap(() => this.invalidateVacuumScheduleCaches()),
      ),
    );
  }

  listVacuumSchedules(): Observable<VacuumSchedule[]> {
    return this.cache.getOrSet(
      'backups:vacuum-schedules',
      () => this.http.get<VacuumSchedule[]>(`${this.API_URL}/db-maintenance/vacuum/schedules`),
      this.CACHE_TTL,
    );
  }

  deleteVacuumSchedule(name: string): Observable<BackupOperationResponse> {
    return this.withLoading(
      this.http.delete<BackupOperationResponse>(`${this.API_URL}/db-maintenance/vacuum/schedules/${name}`).pipe(
        tap(() => this.invalidateVacuumScheduleCaches()),
      ),
    );
  }

  clearRequestCache(): void {
    this.cache.invalidate('backups:');
  }

  private invalidateBackupCaches(): void {
    this.cache.invalidate('backups:list');
    this.cache.invalidate('backups:log:');
  }

  private invalidateBackupScheduleCaches(): void {
    this.cache.invalidate('backups:schedules');
  }

  private invalidateRetentionPolicyCaches(): void {
    this.cache.invalidate('backups:retention-policies');
  }

  private invalidateVacuumCaches(): void {
    this.cache.invalidate('backups:vacuum-logs');
    this.cache.invalidate('backups:vacuum-log:');
  }

  private invalidateVacuumScheduleCaches(): void {
    this.cache.invalidate('backups:vacuum-schedules');
  }
}
