import { Injectable } from '@angular/core';
import { Observable, of, shareReplay, tap } from 'rxjs';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable({
  providedIn: 'root',
})
export class RequestCacheService {
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly inflight = new Map<string, Observable<unknown>>();

  getOrSet<T>(key: string, factory: () => Observable<T>, ttlMs = 60_000): Observable<T> {
    const now = Date.now();
    const cached = this.cache.get(key) as CacheEntry<T> | undefined;

    if (cached && cached.expiresAt > now) {
      return of(cached.value);
    }

    const inflightRequest = this.inflight.get(key) as Observable<T> | undefined;
    if (inflightRequest) {
      return inflightRequest;
    }

    const request$ = factory().pipe(
      tap((value) => {
        this.cache.set(key, {
          value,
          expiresAt: Date.now() + ttlMs,
        });
      }),
      tap({
        error: () => {
          this.inflight.delete(key);
        },
        complete: () => {
          this.inflight.delete(key);
        },
      }),
      shareReplay(1),
    );

    this.inflight.set(key, request$);
    return request$;
  }

  invalidate(keyOrPrefix: string): void {
    for (const key of Array.from(this.cache.keys())) {
      if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
        this.cache.delete(key);
      }
    }

    for (const key of Array.from(this.inflight.keys())) {
      if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
        this.inflight.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
    this.inflight.clear();
  }
}
