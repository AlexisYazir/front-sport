import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'critical';
  module: string;
  event: string;
  data: {
    method?: string;
    path?: string;
    statusCode?: number;
    durationMs?: number;
    ip?: string | null;
    userAgent?: string | null;
    email?: string | null;
    userId?: number | null;
    sessionId?: string | null;
    error?: {
      name?: string;
      message?: string;
    };
  };
}

export interface LogsResponse {
  items: SystemLogEntry[];
  total: number;
  page: number;
  limit: number;
}

@Injectable({
  providedIn: 'root',
})
export class LogsService {
  private readonly API_URL = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  getDates(): Observable<string[]> {
    return this.http.get<string[]>(`${this.API_URL}/logs/dates`);
  }

  getLogs(params: {
    date: string;
    module?: string;
    level?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Observable<LogsResponse> {
    const query = new URLSearchParams();
    query.set('date', params.date);
    if (params.module) query.set('module', params.module);
    if (params.level) query.set('level', params.level);
    if (params.search) query.set('search', params.search);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    return this.http.get<LogsResponse>(`${this.API_URL}/logs?${query.toString()}`);
  }
}
