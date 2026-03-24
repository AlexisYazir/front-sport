import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface BackupInfo {
  name: string;
  size: number;
  lastModified: string;
}

export interface ConnectionStat {
  state: string;
  total: number;
}

export interface LockStat {
  mode: string;
  total: number;
}

export interface ActiveConnection {
  pid: number;
  usename: string;
  state: string;
  query: string;
}

export interface ExplainResult {
  "QUERY PLAN": string;
}

@Injectable({
  providedIn: 'root'
})
export class BackupService {

  private readonly API_URL = environment.apiUrl;
  isLoading = signal<boolean>(false);

  constructor(private http: HttpClient) {}

  //! CREAR BACKUP COMPLETO
  createBackupFull(): Observable<any> {
    this.isLoading.set(true);
    return this.http.post(`${this.API_URL}/backup/create`, {}).pipe(
      tap({
        next: () => this.isLoading.set(false),
        error: () => this.isLoading.set(false)
      })
    );
  }

  //! CREAR BACKUP CRÍTICO
  createCriticalTablesBackup(): Observable<any> {
    this.isLoading.set(true);
    return this.http.post(`${this.API_URL}/backup/create-critical`, {}).pipe(
      tap({
        next: () => this.isLoading.set(false),
        error: () => this.isLoading.set(false)
      })
    );
  }

  //! LISTAR BACKUPS
  listBackups(): Observable<BackupInfo[]> {
    this.isLoading.set(true);
    return this.http.get<BackupInfo[]>(`${this.API_URL}/backup/list`).pipe(
      tap({
        next: () => this.isLoading.set(false),
        error: () => this.isLoading.set(false)
      })
    );
  }

  //! ELIMINAR BACKUP (CORREGIDO)
  deleteBackup(type: string, name: string): Observable<any> {
    this.isLoading.set(true);
    return this.http.delete(`${this.API_URL}/backup/delete/${type}/${name}`).pipe(
      tap({
        next: () => this.isLoading.set(false),
        error: () => this.isLoading.set(false)
      })
    );
  }

  //! LIMPIAR BACKUPS ANTIGUOS
  cleanupOldBackups(days: number = 7): Observable<any> {
    this.isLoading.set(true);
    return this.http.post(`${this.API_URL}/backup/cleanup/${days}`, {}).pipe(
      tap({
        next: () => this.isLoading.set(false),
        error: () => this.isLoading.set(false)
      })
    );
  }

  //! DESCARGAR BACKUP (CORREGIDO)
  downloadBackup(type: string, name: string): Observable<Blob> {
    return this.http.get(`${this.API_URL}/backup/download/${type}/${encodeURIComponent(name)}`, {
      responseType: 'blob'
    });
  }

  //! MÉTODO PARA DESCARGAR DESDE UI (CORREGIDO)
  downloadBackupFile(type: string, name: string) {
    this.downloadBackup(type, name).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name; //! El nombre ya incluye la carpeta? mejor extraer solo el nombre del archivo
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Error descargando backup:', err);
        //! Aquí podrías mostrar un toast de error
      }
    });
  }

  //! MÉTODO AUXILIAR PARA OBTENER EL NOMBRE DEL ARCHIVO
  private getFileNameFromPath(fullPath: string): string {
    return fullPath.split('/').pop() || 'backup.dump';
  }

  //! conexiones activas
  getActiveConnections(): Observable<ActiveConnection[]> {
    return this.http.get<ActiveConnection[]>(
      `${this.API_URL}/backup/monitor/connections`
    );
  }

  //! locks detalle
  getDetailedLocks(): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.API_URL}/backup/monitor/locks`
    );
  }

  getBlockLocks(): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.API_URL}/backup/monitor/block-locks`
    );
  }

  //! querys lentas
  getLongQueries(): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.API_URL}/backup/monitor/long-queries`
    );
  }

  //! explain
  getExplain(): Observable<ExplainResult[]> {
    return this.http.get<ExplainResult[]>(
      `${this.API_URL}/backup/monitor/explain`
    );
  }
   getMostQueriedTables(): Observable<any> {
    return this.http.get(`${this.API_URL}/backup/stats/most-queried`);
  }

  getTableSizes(): Observable<any> {
    return this.http.get(`${this.API_URL}/backup/stats/table-sizes`);
  }

  getIndexInfo(): Observable<any> {
    return this.http.get(`${this.API_URL}/backup/stats/index-info`);
  }

  getTableLockStats(): Observable<any> {
    return this.http.get(`${this.API_URL}/backup/stats/lock-stats`);
  }

  getTableScanStats(): Observable<any> {
    return this.http.get(`${this.API_URL}/backup/stats/scan-stats`);
  }
  
}