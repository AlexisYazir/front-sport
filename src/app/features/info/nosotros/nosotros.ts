import { Component, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PublicInfoOfflineService } from '../../../core/services/public-info-offline.service';
import { IconModule } from '../../../shared/icons/icon.module';


@Component({
  selector: 'app-nosotros',
  standalone: true,
  imports: [IconModule, CommonModule, RouterModule],
  templateUrl: './nosotros.html',
  styleUrl: './nosotros.css'
})
export class Nosotros implements OnInit {
  private readonly publicInfo = inject(PublicInfoOfflineService);
  readonly loadError = this.publicInfo.company.error;
  readonly isLoading = computed(() => this.publicInfo.company.loading() && this.companyInfo === null);

  get companyInfo() { return this.publicInfo.company.data(); }

  ngOnInit() {
    this.publicInfo.start();
    this.loadCompanyInfo();
  }

  loadCompanyInfo() {
    void this.publicInfo.refreshCompany();
  }

  get valores(): string[] {
    return this.companyInfo?.valores?.length
      ? this.companyInfo.valores
      : ['Calidad', 'Servicio', 'Compromiso', 'Pasión por el deporte'];
  }

  get horarioLineas(): string[] {
    return (this.companyInfo?.horario_atencion || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }
}
