import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, finalize } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { RequestCacheService } from './request-cache.service';

export interface CompanyInfo {
  id_empresa?: number;
  nombre: string;
  rfc?: string | null;
  telefono?: string | null;
  email?: string | null;
  sitio_web?: string | null;
  id_direccion?: number | null;
  facebook?: string | null;
  instagram?: string | null;
  twitter?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
  regimen_fiscal?: string | null;
  logo_url?: string | null;
  horario_atencion?: string | null;
  mision?: string | null;
  vision?: string | null;
  valores?: string[];
  mapa_ubicacion?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CompanyFaq {
  id_faq: number;
  pregunta: string;
  respuesta: string;
  orden?: number;
  seccion?: string | null;
  palabras_clave?: string[];
  activo: boolean;
  destacado?: boolean;
  contador_vistas?: number;
  contador_util?: number;
  created_at?: string;
  updated_at?: string;
}

export interface HomeBannerImage {
  id_banner: number;
  url_imagen: string;
  cloudinary_public_id?: string | null;
  titulo?: string | null;
  descripcion?: string | null;
  alt_text?: string | null;
  orden: number;
  activo: boolean;
  creado_por?: number | null;
  actualizado_por?: number | null;
  fecha_creacion?: string;
  fecha_actualizacion?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CompanyService {
  private readonly API_URL = environment.apiUrl;
  private readonly CACHE_TTL = 60_000;
  isLoading = signal<boolean>(false);

  constructor(
    private http: HttpClient,
    private cache: RequestCacheService,
  ) {}

  // ========== COMPANY INFO ==========
  
  // Obtener información de la empresa
  getCompanyInfo(): Observable<CompanyInfo> {
    this.isLoading.set(true);
    return this.cache.getOrSet(
      'company:info',
      () => this.http.get<CompanyInfo>(`${this.API_URL}/company/info`),
      this.CACHE_TTL,
    ).pipe(
      finalize(() => this.isLoading.set(false)),
    );
  }

  // Crear información de empresa (solo admin)
  createCompanyInfo(data: Partial<CompanyInfo>): Observable<CompanyInfo> {
    this.isLoading.set(true);
    return this.http.post<CompanyInfo>(`${this.API_URL}/company/info`, data).pipe(
      map((res) => {
        this.cache.invalidate('company:info');
        return res;
      }),
      finalize(() => this.isLoading.set(false)),
    );
  }

  // Actualizar información de empresa (solo admin)
  updateCompanyInfo(data: Partial<CompanyInfo>): Observable<CompanyInfo> {
    this.isLoading.set(true);
    return this.http.patch<CompanyInfo>(`${this.API_URL}/company/info`, data).pipe(
      map((res) => {
        this.cache.invalidate('company:info');
        return res;
      }),
      finalize(() => this.isLoading.set(false)),
    );
  }

  uploadCompanyLogo(file: File, folder = 'sport-center/company'): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    return this.http.post(`${this.API_URL}/products/upload-image`, formData);
  }

  // ========== HOME BANNER ==========
  getActiveBannerImages(): Observable<HomeBannerImage[]> {
    return this.cache.getOrSet(
      'company:banner:active',
      () => this.http.get<HomeBannerImage[]>(`${this.API_URL}/company/banner`),
      this.CACHE_TTL,
    );
  }

  getAdminBannerImages(): Observable<HomeBannerImage[]> {
    return this.http.get<HomeBannerImage[]>(`${this.API_URL}/company/banner/admin`);
  }

  createBannerImage(data: Partial<HomeBannerImage>): Observable<HomeBannerImage> {
    return this.http.post<HomeBannerImage>(`${this.API_URL}/company/banner`, data).pipe(
      map((res) => {
        this.cache.invalidate('company:banner:');
        return res;
      }),
    );
  }

  updateBannerImage(id: number, data: Partial<HomeBannerImage>): Observable<HomeBannerImage> {
    return this.http.patch<HomeBannerImage>(`${this.API_URL}/company/banner/${id}`, data).pipe(
      map((res) => {
        this.cache.invalidate('company:banner:');
        return res;
      }),
    );
  }

  deleteBannerImage(id: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/company/banner/${id}`).pipe(
      map((res) => {
        this.cache.invalidate('company:banner:');
        return res;
      }),
    );
  }

  uploadBannerImage(file: File, folder = 'banner'): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    return this.http.post(`${this.API_URL}/products/upload-image`, formData);
  }

  // ========== FAQS ==========

  // Obtener todas las FAQs (con filtro opcional por activo)
  getAllFaqs(activo?: boolean): Observable<any> {
    this.isLoading.set(true);
    let url = `${this.API_URL}/company/faqs`;
    if (activo !== undefined) {
      url += `?activo=${activo}`;
    }
    const cacheKey = activo === undefined ? 'company:faqs:all' : `company:faqs:${activo}`;
    return this.cache.getOrSet(
      cacheKey,
      () => this.http.get<CompanyFaq[]>(url),
      this.CACHE_TTL,
    ).pipe(
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
        this.cache.invalidate('company:faqs:');
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
        this.cache.invalidate('company:faqs:');
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
        this.cache.invalidate('company:faqs:');
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
