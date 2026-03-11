import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CompanyService } from '../../../core/services/company.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-faqs',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './faqs.html',
  styleUrl: './faqs.css'
})
export class Faqs implements OnInit {
  private companyService = inject(CompanyService);
  private toastr = inject(ToastrService);
  
  faqs: any[] = [];
  filteredFaqs: any[] = [];
  searchTerm: string = '';
  selectedSeccion: string = 'todas';
  
  isLoading = signal<boolean>(false);
  
  // Obtener todas las secciones disponibles para el filtro
  get secciones(): string[] {
    const secciones = this.faqs.map(f => f.seccion).filter(Boolean);
    return ['todas', ...new Set(secciones)];
  }

  ngOnInit() {
    this.loadFaqs();
  }

  loadFaqs() {
    this.isLoading.set(true);
    this.companyService.getAllFaqs(true).subscribe({
      next: (data) => {
        this.faqs = data;
        this.applyFilters();
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error cargando FAQs:', error);
        this.toastr.error('Error al cargar las preguntas frecuentes', 'Error');
        this.isLoading.set(false);
      }
    });
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
        console.error('Error al marcar como útil:', error);
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