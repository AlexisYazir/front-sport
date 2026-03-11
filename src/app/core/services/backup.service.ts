import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BackupService {
  private readonly API_URL = environment.apiUrl;
  isLoading = signal<boolean>(false);

  constructor(private http: HttpClient) {}

  // Backup de inventory_movements
  backupInventoryMovements(): Observable<any> {
    this.isLoading.set(true);
    return this.http.post(`${this.API_URL}/backup/inventory-movements`, {}).pipe(
      map(res => {
        this.isLoading.set(false);
        return res;
      })
    );
  }

  // Backup completo de la base de datos
  backupFullDatabase(): Observable<any> {
    this.isLoading.set(true);
    return this.http.post(`${this.API_URL}/backup/full`, {}).pipe(
      map(res => {
        this.isLoading.set(false);
        return res;
      })
    );
  }

    backupCriticalTables(): Observable<any> {
    this.isLoading.set(true);
    return this.http.post(`${this.API_URL}/backup/critical-tables`, {}).pipe(
      map(res => {
        this.isLoading.set(false);
        return res;
      })
    );
  }

  // Listar todos los backups disponibles
  listBackups(): Observable<{ backups: string[] }> {
    this.isLoading.set(true);
        return this.http.get<{ backups: string[] }>(`${this.API_URL}/backup/list`).pipe(
        map(res => {
            this.isLoading.set(false);
            return res;
        })
        );
    }

    // Descargar backup
    downloadBackup(filename: string): Observable<Blob> {
        return this.http.get(`${this.API_URL}/backup/download/${filename}`, {
            responseType: 'blob'
        });
    }

    // tamaños de backups
    getBackupSizes(): Observable<Record<string, string>> {
        return this.http.get<Record<string, string>>(`${this.API_URL}/backup/sizes`);
    }  
}