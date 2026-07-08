import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { DashboardPreferencesPanel } from '../../../shared/dashboard-preferences-panel/dashboard-preferences-panel';

@Component({
  selector: 'app-employee-settings',
  standalone: true,
  imports: [CommonModule, DashboardPreferencesPanel],
  template: `
    <div class="dashboard-card rounded-xl shadow-sm border p-5 mb-6">
      <div class="flex items-center gap-3">
        <div class="bg-[#0367A6]/10 p-3 rounded-xl">
          <span class="material-symbols-outlined text-[#0367A6] text-2xl">settings</span>
        </div>
        <div>
          <h2 class="text-2xl font-bold dashboard-title">Configuración</h2>
          <p class="text-sm dashboard-muted mt-0.5">Preferencias visuales y de uso del panel</p>
        </div>
      </div>
    </div>

    <app-dashboard-preferences-panel />
  `,
})
export class EmployeeSettings {}
