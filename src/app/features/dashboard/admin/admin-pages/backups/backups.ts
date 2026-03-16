import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { BackupService, BackupInfo } from '../../../../../core/services/backup.service';

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
  
  backups: BackupInfo[] = [];
  filteredBackups: BackupInfo[] = [];
  paginatedBackups: BackupInfo[] = [];
  searchValue: string = '';
  
  rowsPerPage: number = 10;
  rowsPerPageOptions: number[] = [5, 10, 20, 50];
  first: number = 0;
  currentPage: number = 1;
  totalRecords: number = 0;
  
  isLoading = signal<boolean>(false);
  isCreatingBackup = signal<boolean>(false);
  isDeleting = signal<Record<string, boolean>>({});
  isDownloading = signal<Record<string, boolean>>({}); // 👈 AGREGADO AQUÍ (junto con los otros signals)
  
  // Propiedades para el modal de confirmación
  showConfirmModal: boolean = false;
  confirmAction: 'full' | 'critical' = 'full';
  isConfirming: boolean = false;

  // Modal para confirmar eliminación
  showDeleteModal: boolean = false;
  backupToDelete: BackupInfo | null = null;

  ngOnInit(): void {
    this.loadBackups();
  }

  loadBackups() {
    this.isLoading.set(true);
    this.backupService.listBackups().subscribe({
      next: (res) => {
        // Ordenar por fecha descendente (más reciente primero)
        this.backups = res.sort((a, b) => {
          return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
        });
        this.applyFilters();
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error cargando backups:', err);
        this.toastr.error('Error al cargar los backups', 'Error');
        this.isLoading.set(false);
      }
    });
  }

  applyFilters() {
    let filtered = [...this.backups];
    
    if (this.searchValue) {
      const term = this.searchValue.toLowerCase();
      filtered = filtered.filter(backup => 
        backup.name.toLowerCase().includes(term)
      );
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

  // ===== FUNCIONES PARA BACKUPS =====

  // Abrir modal de confirmación para crear backup
  openConfirmModal(action: 'full' | 'critical') {
    this.confirmAction = action;
    this.showConfirmModal = true;
  }

  // Cerrar modal de creación
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
      ? 'Este backup incluye TODA la base de datos y se guardará en Cloudflare R2. Puede tomar varios minutos dependiendo del tamaño.'
      : 'Este backup incluye solo las tablas más importantes: usuarios, órdenes, pagos, productos, variantes e inventario.';
  }

  // Obtener icono según la acción
  getModalIcon(): string {
    return this.confirmAction === 'full' ? 'database' : 'security';
  }

  getModalIconColor(): string {
    return this.confirmAction === 'full' ? 'bg-green-100' : 'bg-red-100';
  }

  getModalIconTextColor(): string {
    return this.confirmAction === 'full' ? 'text-green-600' : 'text-red-600';
  }

  // Ejecutar backup después de confirmar
  executeBackup() {
    this.isConfirming = true;
    this.isCreatingBackup.set(true);
    this.closeConfirmModal();

    const backupObservable = this.confirmAction === 'full' 
      ? this.backupService.createBackupFull()
      : this.backupService.createCriticalTablesBackup();

    backupObservable.subscribe({
      next: (res) => {
        if (res.success) {
          this.toastr.success('Backup creado exitosamente', 'Éxito', {
            timeOut: 3000,
            progressBar: true,
            closeButton: true
          });
          this.loadBackups();
        } else {
          this.toastr.error(res.error || 'Error al crear backup', 'Error');
        }
        this.isCreatingBackup.set(false);
        this.isConfirming = false;
      },
      error: (err) => {
        console.error('Error creando backup:', err);
        this.toastr.error('Error al crear backup', 'Error');
        this.isCreatingBackup.set(false);
        this.isConfirming = false;
      }
    });
  }

  // Métodos para crear backups (abren modal)
  createFullBackup() {
    this.openConfirmModal('full');
  }

  createCriticalBackup() {
    this.openConfirmModal('critical');
  }

  // ===== FUNCIONES PARA ELIMINAR =====

  // Abrir modal de confirmación para eliminar
  openDeleteModal(backup: BackupInfo) {
    this.backupToDelete = backup;
    this.showDeleteModal = true;
  }

  // Cerrar modal de eliminación
  closeDeleteModal() {
    this.showDeleteModal = false;
    this.backupToDelete = null;
  }

  // Eliminar backup
  deleteBackup() {
    if (!this.backupToDelete) return;

    const key = this.backupToDelete.name;
    const [type, ...nameParts] = key.split('/');
    const fileName = nameParts.join('/');

    this.isDeleting.update(val => ({ ...val, [key]: true }));

    this.backupService.deleteBackup(type, fileName).subscribe({
      next: () => {
        this.toastr.success('Backup eliminado correctamente', 'Éxito');
        this.closeDeleteModal();
        this.loadBackups();
      },
      error: (err) => {
        console.error('Error eliminando backup:', err);
        this.toastr.error('Error al eliminar el backup', 'Error');
        this.isDeleting.update(val => ({ ...val, [key]: false }));
        this.closeDeleteModal();
      }
    });
  }

  // ===== FUNCIONES PARA DESCARGAR CON ANIMACIÓN =====
  downloadBackup(backup: BackupInfo) {
    const key = backup.name;
    const [type, ...nameParts] = key.split('/');
    const fileName = nameParts.join('/');

    // Activar animación de carga
    this.isDownloading.update(val => ({ ...val, [key]: true }));

    this.backupService.downloadBackup(type, fileName).subscribe({
      next: (blob) => {
        // Crear URL y descargar
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        window.URL.revokeObjectURL(url);
        
        // Desactivar animación
        this.isDownloading.update(val => ({ ...val, [key]: false }));
        this.toastr.success('Descarga completada', 'Éxito');
      },
      error: (err) => {
        console.error('Error descargando backup:', err);
        this.isDownloading.update(val => ({ ...val, [key]: false }));
        this.toastr.error('Error al descargar el backup', 'Error');
      }
    });
  }

  // ===== UTILIDADES PARA LA TABLA =====

  getBackupType(backup: BackupInfo): 'full' | 'critical' | 'other' {
    if (backup.name.startsWith('full/')) return 'full';
    if (backup.name.startsWith('critical/')) return 'critical';
    return 'other';
  }

  getBackupIcon(backup: BackupInfo): string {
    const type = this.getBackupType(backup);
    if (type === 'full') return 'database';
    if (type === 'critical') return 'security';
    return 'backup';
  }

  getBackupColor(backup: BackupInfo): string {
    const type = this.getBackupType(backup);
    if (type === 'full') return 'bg-green-100 text-green-600';
    if (type === 'critical') return 'bg-red-100 text-red-600';
    return 'bg-gray-100 text-gray-600';
  }

  formatBackupDate(backup: BackupInfo): string {
    const date = new Date(backup.lastModified);
    return date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  formatBackupTime(backup: BackupInfo): string {
    const date = new Date(backup.lastModified);
    return date.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatBackupSize(backup: BackupInfo): string {
    const size = backup.size;
    if (size < 1024) return size + ' B';
    if (size < 1024 * 1024) return (size / 1024).toFixed(2) + ' KB';
    if (size < 1024 * 1024 * 1024) return (size / (1024 * 1024)).toFixed(2) + ' MB';
    return (size / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  getFileName(backup: BackupInfo): string {
    return backup.name.split('/').pop() || backup.name;
  }

  refreshData() {
    this.loadBackups();
    this.toastr.info('Actualizando datos...', 'Info', {
      timeOut: 1500,
      progressBar: true
    });
  }
}