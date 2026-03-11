import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { BackupService } from '../../../../../core/services/backup.service';

@Component({
  selector: 'app-backups',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './backups.html',
  styleUrls: ['./backups.css']
})
export class Backups implements OnInit {
  private backupService = inject(BackupService);
  private toastr = inject(ToastrService);
  
  backups: string[] = [];
  filteredBackups: string[] = [];
  paginatedBackups: string[] = [];
  backupSizes: Record<string, string> = {};
  searchValue: string = '';
  
  rowsPerPage: number = 10;
  rowsPerPageOptions: number[] = [5, 10, 20, 50];
  first: number = 0;
  currentPage: number = 1;
  totalRecords: number = 0;
  
  isLoading = signal<boolean>(false);
  isCreatingBackup = signal<boolean>(false);
  
  // Propiedades para el modal de confirmación
  showConfirmModal: boolean = false;
  confirmAction: 'full' | 'critical' = 'full'; // Cambié 'inventory' por 'critical'
  isConfirming: boolean = false;

  ngOnInit(): void {
    this.loadBackups();
  }

  loadBackups() {
    this.isLoading.set(true);
    this.backupService.listBackups().subscribe({
      next: (res) => {
        this.backups = res.backups;
        this.loadBackupSizes();
      },
      error: () => {
        this.toastr.error('Error al cargar los backups', 'Error');
        this.isLoading.set(false);
      }
    });
  }

  loadBackupSizes() {
    if (this.backups.length === 0) {
      this.applyFilters();
      this.isLoading.set(false);
      return;
    }

    this.backupService.getBackupSizes().subscribe({
      next: (sizes) => {
        this.backupSizes = sizes;
        this.applyFilters();
        this.isLoading.set(false);
      },
      error: () => {
        this.applyFilters();
        this.isLoading.set(false);
      }
    });
  }

  applyFilters() {
    let filtered = [...this.backups];
    if (this.searchValue) {
      const term = this.searchValue.toLowerCase();
      filtered = filtered.filter(backup => backup.toLowerCase().includes(term));
    }
    this.filteredBackups = filtered;
    this.totalRecords = filtered.length;
    this.first = 0;
    this.updatePaginatedBackups();
  }

  onSearch(event: any) {
    this.searchValue = event.target.value;
    this.applyFilters();
  }

  clearSearch() {
    this.searchValue = '';
    this.applyFilters();
    this.toastr.success('Filtros limpiados', 'Éxito');
  }

  updatePaginatedBackups() {
    const start = this.first;
    const end = this.first + this.rowsPerPage;
    this.paginatedBackups = this.filteredBackups.slice(start, end);
    this.currentPage = Math.floor(this.first / this.rowsPerPage) + 1;
  }

  onRowsPerPageChange() {
    this.first = 0;
    this.updatePaginatedBackups();
  }

  changePage(action: 'first' | 'prev' | 'next' | 'last') {
    switch (action) {
      case 'first': this.first = 0; break;
      case 'prev': if (this.first > 0) this.first -= this.rowsPerPage; break;
      case 'next': if (this.first + this.rowsPerPage < this.totalRecords) this.first += this.rowsPerPage; break;
      case 'last': this.first = Math.floor((this.totalRecords - 1) / this.rowsPerPage) * this.rowsPerPage; break;
    }
    this.updatePaginatedBackups();
  }

  goToPage(page: number) {
    this.first = (page - 1) * this.rowsPerPage;
    this.updatePaginatedBackups();
  }

  get last(): number {
    return Math.min(this.first + this.rowsPerPage, this.totalRecords);
  }

  get pageNumbers(): number[] {
    const totalPages = Math.ceil(this.totalRecords / this.rowsPerPage);
    const current = this.currentPage;
    const pages: number[] = [];
    
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (current <= 3) for (let i = 1; i <= 5; i++) pages.push(i);
      else if (current >= totalPages - 2) for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      else for (let i = current - 2; i <= current + 2; i++) pages.push(i);
    }
    return pages;
  }

  // Abrir modal de confirmación con mensaje personalizado
  openConfirmModal(action: 'full' | 'critical') {
    this.confirmAction = action;
    this.showConfirmModal = true;
  }

  // Cerrar modal
  closeConfirmModal() {
    this.showConfirmModal = false;
    this.isConfirming = false;
  }

  // Obtener título del modal según la acción
  getModalTitle(): string {
    return this.confirmAction === 'full' 
      ? 'Backup Completo de Base de Datos' 
      : 'Backup de Tablas Críticas';
  }

  // Obtener descripción del modal según la acción
  getModalDescription(): string {
    return this.confirmAction === 'full'
      ? 'Este backup incluye TODA la base de datos: productos, usuarios, órdenes, pagos, inventario y configuraciones. Puede tomar varios minutos dependiendo del tamaño total de los datos.'
      : 'Este backup incluye solo las tablas más importantes: usuarios, órdenes, pagos, productos, variantes e inventario. Es más rápido y ocupa menos espacio.';
  }

  // Obtener icono según la acción
  getModalIcon(): string {
    return this.confirmAction === 'full' ? 'database' : 'security';
  }

getModalIconColor(): string {
  return this.confirmAction === 'full' ? 'bg-green-100' : 'bg-red-100'; // Cambiado de purple a green
}

getModalIconTextColor(): string {
  return this.confirmAction === 'full' ? 'text-green-600' : 'text-red-600'; // Cambiado de purple a green
}

  // Ejecutar backup después de confirmar
  executeBackup() {
    this.isConfirming = true;
    this.isCreatingBackup.set(true);
    this.closeConfirmModal();

    const backupObservable = this.confirmAction === 'full' 
      ? this.backupService.backupFullDatabase()
      : this.backupService.backupCriticalTables(); // Cambié a criticalTables

    backupObservable.subscribe({
      next: (res) => {
        this.toastr.success(res.message, 'Backup Completado', {
          timeOut: 3000,
          progressBar: true,
          closeButton: true
        });
        this.isCreatingBackup.set(false);
        this.loadBackups();
      },
      error: () => {
        this.toastr.error('Error al crear backup', 'Error', {
          timeOut: 3000,
          progressBar: true,
          closeButton: true
        });
        this.isCreatingBackup.set(false);
      }
    });
  }

  // Métodos para crear backups (abren modal)
  createFullBackup() {
    this.openConfirmModal('full');
  }

  createCriticalBackup() { // Cambié de createInventoryBackup a createCriticalBackup
    this.openConfirmModal('critical');
  }

  downloadBackup(filename: string) {
    this.backupService.downloadBackup(filename).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
        this.toastr.success('Descarga iniciada', 'Éxito', {
          timeOut: 2000,
          progressBar: true
        });
      },
      error: () => {
        this.toastr.error('Error al descargar el backup', 'Error');
      }
    });
  }

  getBackupIcon(backup: string): string {
    if (backup.includes('full')) return 'database';
    if (backup.includes('critical')) return 'security'; // Cambié inventory por critical
    return 'backup';
  }

getBackupColor(backup: string): string {
  if (backup.includes('full')) return 'bg-green-100 text-green-600'; // Cambiado de purple a green
  if (backup.includes('critical')) return 'bg-red-100 text-red-600';
  return 'bg-gray-100 text-gray-600';
}
  formatBackupDate(filename: string): string {
    const match = filename.match(/\d{4}-\d{2}-\d{2}/);
    if (match) {
      const [year, month, day] = match[0].split('-');
      return `${day}/${month}/${year}`;
    }
    return 'Fecha desconocida';
  }

  formatBackupTime(filename: string): string {
    const parts = filename.split('_');
    if (parts.length >= 2) {
      const timePart = parts[parts.length - 1].split('.')[0];
      return timePart.replace('-', ':');
    }
    return '--:--';
  }

  getBackupSize(filename: string): string {
    return this.backupSizes[filename] || 'Calculando...';
  }

  refreshData() {
    this.loadBackups();
    this.toastr.info('Actualizando datos...', 'Info', {
      timeOut: 1500,
      progressBar: true
    });
  }
}