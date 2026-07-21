import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CompanyInfo, CompanyService } from '../../../core/services/company.service';
import { DashboardPreferencesService } from '../../../core/services/dashboard-preferences.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer {
  private authService = inject(AuthService);
  private companyService = inject(CompanyService);
  private router = inject(Router);
  private preferences = inject(DashboardPreferencesService);
  companyInfo: CompanyInfo | null = null;

  constructor() {
    this.companyService.getCompanyInfo().subscribe({
      next: (info) => {
        this.companyInfo = info;
      },
      error: () => {
        this.companyInfo = null;
      },
    });
  }

  get hideFooter(): boolean {
    const user = this.authService.currentUser();
    const role = Number(user?.rol);
    return (
      role === 2 ||
      role === 3
    );
  }

  get isUserDashboard(): boolean {
    return this.router.url.startsWith('/dashboard/usuario');
  }

  get isUserSidebarCollapsed(): boolean {
    return !this.preferences.sidebarDefaultOpen();
  }
}
