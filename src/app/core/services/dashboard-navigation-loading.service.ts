import { Injectable, inject, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class DashboardNavigationLoadingService {
  readonly loading = signal(true);
  private finishTimer?: ReturnType<typeof setTimeout>;

  private readonly router = inject(Router);

  constructor() {
    this.scheduleFinish(420);

    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart && event.url.startsWith('/dashboard')) {
        if (this.finishTimer) clearTimeout(this.finishTimer);
        this.loading.set(true);
        return;
      }

      if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError) {
        this.scheduleFinish(240);
      }
    });
  }

  private scheduleFinish(delay: number): void {
    if (this.finishTimer) clearTimeout(this.finishTimer);
    this.finishTimer = setTimeout(() => this.loading.set(false), delay);
  }
}
