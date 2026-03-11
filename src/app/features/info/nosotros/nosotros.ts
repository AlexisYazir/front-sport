import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CompanyService } from '../../../core/services/company.service';

@Component({
  selector: 'app-nosotros',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './nosotros.html',
  styleUrl: './nosotros.css'
})
export class Nosotros implements OnInit {
  private companyService = inject(CompanyService);
  
  companyInfo: any = null;

  ngOnInit() {
    this.loadCompanyInfo();
  }

  loadCompanyInfo() {
    this.companyService.getCompanyInfo().subscribe({
      next: (info) => {
        this.companyInfo = info;
      },
      error: (error) => {
        console.error('Error cargando info de empresa:', error);
      }
    });
  }
}