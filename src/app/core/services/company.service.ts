import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CompanyService {
  private readonly API_URL = environment.apiUrl;
  isLoading = signal<boolean>(false);

  constructor(private http: HttpClient) {}

  // ========== COMPANY INFO ==========
  
  // Obtener información de la empresa
  getCompanyInfo(): Observable<any> {
    this.isLoading.set(true);
    return this.http.get(`${this.API_URL}/company/info`).pipe(
      map(res => {
        this.isLoading.set(false);
        return res;
      })
    );
  }

  // Crear información de empresa (solo admin)
  createCompanyInfo(data: any): Observable<any> {
    this.isLoading.set(true);
    return this.http.post(`${this.API_URL}/company/info`, data).pipe(
      map(res => {
        this.isLoading.set(false);
        return res;
      })
    );
  }

  // Actualizar información de empresa (solo admin)
  updateCompanyInfo(data: any): Observable<any> {
    this.isLoading.set(true);
    return this.http.patch(`${this.API_URL}/company/info`, data).pipe(
      map(res => {
        this.isLoading.set(false);
        return res;
      })
    );
  }

  // ========== FAQS ==========

  // Obtener todas las FAQs (con filtro opcional por activo)
  getAllFaqs(activo?: boolean): Observable<any> {
    this.isLoading.set(true);
    let url = `${this.API_URL}/company/faqs`;
    if (activo !== undefined) {
      url += `?activo=${activo}`;
    }
    return this.http.get(url).pipe(
      map(res => {
        this.isLoading.set(false);
        return res;
      })
    );
  }

  // Obtener FAQs destacadas
  getFaqsDestacadas(): Observable<any> {
    this.isLoading.set(true);
    return this.http.get(`${this.API_URL}/company/faqs/destacadas`).pipe(
      map(res => {
        this.isLoading.set(false);
        return res;
      })
    );
  }

  // Obtener FAQs por sección
  getFaqsBySeccion(seccion: string): Observable<any> {
    this.isLoading.set(true);
    return this.http.get(`${this.API_URL}/company/faqs/seccion/${seccion}`).pipe(
      map(res => {
        this.isLoading.set(false);
        return res;
      })
    );
  }

  // Obtener FAQ por ID
  getFaqById(id: number): Observable<any> {
    this.isLoading.set(true);
    return this.http.get(`${this.API_URL}/company/faqs/${id}`).pipe(
      map(res => {
        this.isLoading.set(false);
        return res;
      })
    );
  }

  // Crear nueva FAQ (solo admin)
  createFaq(data: any): Observable<any> {
    this.isLoading.set(true);
    return this.http.post(`${this.API_URL}/company/faqs`, data).pipe(
      map(res => {
        this.isLoading.set(false);
        return res;
      })
    );
  }

  // Actualizar FAQ (solo admin)
  updateFaq(id: number, data: any): Observable<any> {
    this.isLoading.set(true);
    return this.http.patch(`${this.API_URL}/company/faqs/${id}`, data).pipe(
      map(res => {
        this.isLoading.set(false);
        return res;
      })
    );
  }

  // Eliminar FAQ (solo admin)
  deleteFaq(id: number): Observable<any> {
    this.isLoading.set(true);
    return this.http.delete(`${this.API_URL}/company/faqs/${id}`).pipe(
      map(res => {
        this.isLoading.set(false);
        return res;
      })
    );
  }

  // Marcar FAQ como útil (público)
  marcarFaqComoUtil(id: number): Observable<any> {
    this.isLoading.set(true);
    return this.http.post(`${this.API_URL}/company/faqs/${id}/util`, {}).pipe(
      map(res => {
        this.isLoading.set(false);
        return res;
      })
    );
  }

  // ========== CONTACT MESSAGES ==========

  // Enviar mensaje de contacto (público)
  sendContactMessage(data: any): Observable<any> {
    this.isLoading.set(true);
    return this.http.post(`${this.API_URL}/company/contact`, data).pipe(
      map(res => {
        this.isLoading.set(false);
        return res;
      })
    );
  }

  // Obtener todos los mensajes de contacto (solo admin)
  getAllContactMessages(leido?: boolean): Observable<any> {
    this.isLoading.set(true);
    let url = `${this.API_URL}/company/contact`;
    if (leido !== undefined) {
      url += `?leido=${leido}`;
    }
    return this.http.get(url).pipe(
      map(res => {
        this.isLoading.set(false);
        return res;
      })
    );
  }

  // Obtener mensaje de contacto por ID (solo admin)
  getContactMessageById(id: number): Observable<any> {
    this.isLoading.set(true);
    return this.http.get(`${this.API_URL}/company/contact/${id}`).pipe(
      map(res => {
        this.isLoading.set(false);
        return res;
      })
    );
  }

  // Actualizar mensaje de contacto (marcar leído/respondido) (solo admin)
  updateContactMessage(id: number, data: any): Observable<any> {
    this.isLoading.set(true);
    return this.http.patch(`${this.API_URL}/company/contact/${id}`, data).pipe(
      map(res => {
        this.isLoading.set(false);
        return res;
      })
    );
  }

  // Eliminar mensaje de contacto (solo admin)
  deleteContactMessage(id: number): Observable<any> {
    this.isLoading.set(true);
    return this.http.delete(`${this.API_URL}/company/contact/${id}`).pipe(
      map(res => {
        this.isLoading.set(false);
        return res;
      })
    );
  }

  // Marcar mensaje como leído (método de conveniencia)
  markMessageAsRead(id: number): Observable<any> {
    return this.updateContactMessage(id, { leido: true });
  }

  // Marcar mensaje como respondido
  markMessageAsReplied(id: number, usuarioId: number): Observable<any> {
    return this.updateContactMessage(id, { 
      respondido: true,
      id_usuario_responde: usuarioId 
    });
  }
}