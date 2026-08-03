import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CompanyInfo, CompanyService } from '../../../core/services/company.service';
import { IconModule } from '../../../shared/icons/icon.module';


@Component({
  selector: 'app-nosotros',
  standalone: true,
  imports: [IconModule, CommonModule, RouterModule],
  templateUrl: './nosotros.html',
  styleUrl: './nosotros.css'
})
export class Nosotros implements OnInit {
  private companyService = inject(CompanyService);
  
  companyInfo: CompanyInfo | null = null;

  ngOnInit() {
    this.loadCompanyInfo();
  }

  loadCompanyInfo() {
    this.companyService.getCompanyInfo().subscribe({
      next: (info) => {
        this.companyInfo = info;
      },
      error: (error) => {
      }
    });
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
