import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-white rounded-xl shadow-md border border-gray-100 p-6">
      <h2 class="text-2xl font-bold text-[#202020] flex items-center gap-2 mb-6">
        <span class="material-symbols-outlined text-[#0367A6] text-3xl">settings</span>
        Configuración
      </h2>
      <p class="text-[#666666]">Aquí irá la configuración del sistema</p>
    </div>
  `
})
export class Settings {

}
