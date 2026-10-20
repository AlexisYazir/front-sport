import { Component, OnInit, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CompanyService } from '../../../core/services/company.service';
import { PublicInfoOfflineService } from '../../../core/services/public-info-offline.service';
import { ToastrService } from 'ngx-toastr';
import { IconModule } from '../../../shared/icons/icon.module';


@Component({
  selector: 'app-faqs',
  standalone: true,
  imports: [IconModule, CommonModule, RouterModule, FormsModule],
  templateUrl: './faqs.html',
  styleUrl: './faqs.css'
})
export class Faqs implements OnInit {
  private companyService = inject(CompanyService);
  private toastr = inject(ToastrService);
  private readonly publicInfo = inject(PublicInfoOfflineService);
  
  faqs: any[] = [];
  filteredFaqs: any[] = [];
  searchTerm: string = '';
  selectedSeccion: string = 'todas';
  
  readonly loadError = this.publicInfo.faqs.error;
  readonly hasData = computed(() => this.publicInfo.faqs.data() !== null);
  readonly isLoading = computed(() => this.publicInfo.faqs.loading() && !this.hasData());

  private readonly syncPublicFaqs = effect(() => {
    const data = this.publicInfo.faqs.data();
    // Los votos modifican solo la copia de la pantalla, sin alterar los datos guardados.
    this.faqs = data?.map(faq => ({ ...faq })) ?? [];
    this.applyFilters();
  });
  
  // Obtener todas las secciones disponibles para el filtro
  get secciones(): string[] {
    const secciones = this.faqs.map(f => f.seccion).filter(Boolean);
    return ['todas', ...new Set(secciones)];
  }

  ngOnInit() {
    this.publicInfo.start();
    this.loadFaqs();
  }

  loadFaqs() {
    void this.publicInfo.refreshFaqs();
  }

  applyFilters() {
    let filtered = [...this.faqs];

    // Filtro por búsqueda
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(faq => 
        faq.pregunta.toLowerCase().includes(term) ||
        faq.respuesta.toLowerCase().includes(term) ||
        (faq.palabras_clave && faq.palabras_clave.some((p: string) => p.toLowerCase().includes(term)))
      );
    }

    // Filtro por sección
    if (this.selectedSeccion !== 'todas') {
      filtered = filtered.filter(faq => faq.seccion === this.selectedSeccion);
    }

    this.filteredFaqs = filtered;
  }

  onSearch(event: any) {
    this.searchTerm = event.target.value;
    this.applyFilters();
  }

  onSeccionChange(seccion: string) {
    this.selectedSeccion = seccion;
    this.applyFilters();
  }

  clearSearch() {
    this.searchTerm = '';
    this.selectedSeccion = 'todas';
    this.applyFilters();
  }

  // ✅ NUEVO: Método para marcar como útil
  marcarComoUtil(id: number) {
    this.companyService.marcarFaqComoUtil(id).subscribe({
      next: () => {
        this.toastr.success('Gracias por tu retroalimentación', '¡Gracias!');
        // Actualizar el contador en la UI
        const faq = this.faqs.find(f => f.id_faq === id);
        if (faq) {
          faq.contador_util = (faq.contador_util || 0) + 1;
        }
      },
      error: (error) => {
        this.toastr.error('No se pudo registrar tu voto', 'Error');
      }
    });
  }

  trackByFaqId(index: number, faq: any): number {
    return faq.id_faq;
  }

  getFaqsBySeccion(seccion: string): any[] {
    return this.faqs.filter(faq => faq.seccion === seccion);
  }
}
