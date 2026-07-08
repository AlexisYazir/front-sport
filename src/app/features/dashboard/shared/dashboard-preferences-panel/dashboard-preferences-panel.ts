import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { DashboardPreferencesService, DashboardTheme } from '../../../../core/services/dashboard-preferences.service';

@Component({
  selector: 'app-dashboard-preferences-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-preferences-panel.html',
  styleUrl: './dashboard-preferences-panel.css',
})
export class DashboardPreferencesPanel {
  readonly preferences = inject(DashboardPreferencesService);

  setTheme(theme: DashboardTheme): void {
    this.preferences.setTheme(theme);
  }

  setSidebarDefault(open: boolean): void {
    this.preferences.setSidebarDefaultOpen(open);
  }

  setReducedMotion(enabled: boolean): void {
    this.preferences.setReducedMotion(enabled);
  }

  reset(): void {
    this.preferences.reset();
  }
}
