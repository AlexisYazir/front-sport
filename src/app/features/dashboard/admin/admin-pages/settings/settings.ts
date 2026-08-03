import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardPreferencesPanel } from '../../../shared/dashboard-preferences-panel/dashboard-preferences-panel';
import { IconModule } from '../../../../../shared/icons/icon.module';


@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [IconModule, CommonModule, DashboardPreferencesPanel],
  template: `
    <section class="dashboard-card rounded-xl shadow-sm border p-5">
      <div class="dashboard-card rounded-xl border p-5 mb-6">
        <div class="flex items-center gap-3">
          <div class="bg-[#0367A6]/10 p-3 rounded-xl">
            <svg lucideIcon="settings" class="lucide-icon text-[#0367A6] text-2xl"></svg>
          </div>
          <div>
            <h2 class="text-2xl font-bold dashboard-title">Configuración</h2>
            <p class="text-sm dashboard-muted mt-0.5">Preferencias visuales y de uso del panel</p>
          </div>
        </div>
      </div>
      <app-dashboard-preferences-panel />
    </section>
  `
})
export class Settings {

}
