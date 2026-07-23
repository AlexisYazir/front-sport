import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface DemandMeta {
  source: string;
  resultSource: string;
  model: string;
  generatedAt: string;
  projectedMonth: string | null;
  historicalRecords: number;
}

export interface DemandSummary {
  variants: number;
  projectedDemand: number;
  lastDemand: number;
  variation: number;
  variationPercent: number;
  growing: number;
  stable: number;
  declining: number;
}

export interface DemandTrendPoint {
  month: string;
  actual: number;
  records: number;
}

export interface DemandProduct {
  id_producto: number;
  id_variante: number;
  nombre_producto: string;
  mes_objetivo: string;
  mes_proyectado: string;
  cantidad_hace_3_meses: number;
  cantidad_hace_2_meses: number;
  cantidad_mes_anterior: number;
  cantidad_mes_objetivo: number;
  demanda_estimada: number;
  variacion_estimada: number;
  tendencia: 'creciente' | 'estable' | 'decreciente';
}

export interface DemandReport {
  meta: DemandMeta;
  summary: DemandSummary;
  trend: DemandTrendPoint[];
  products: DemandProduct[];
  methodology: {
    objective: string;
    features: string[];
    note: string;
  };
}

export interface SegmentMeta {
  source: string;
  resultSource: string;
  model: string;
  generatedAt: string;
  cutoffDate: string | null;
}

export interface SegmentSummary {
  customers: number;
  segments: number;
  averageRecency: number;
  averageFrequency: number;
  averageSpend: number;
  totalSpend: number;
}

export interface SegmentProfile {
  name: string;
  cluster: number;
  customers: number;
  percentage: number;
  averageRecency: number;
  averageFrequency: number;
  averageSpend: number;
  action: string;
}

export interface SegmentCustomer {
  id_usuario: number;
  fecha_corte: string;
  recencia_dias: number;
  frecuencia_12_meses: number;
  gasto_12_meses: number;
  cluster: number;
  segmento: string;
  accion_sugerida: string;
  name: string;
  email: string;
}

export interface CustomerSegmentsReport {
  meta: SegmentMeta;
  summary: SegmentSummary;
  segments: SegmentProfile[];
  customers: SegmentCustomer[];
  methodology: {
    objective: string;
    variables: string[];
  };
}

export interface ProductRecommendation {
  idProduct: number;
  name: string;
  description: string;
  brand: string;
  category: string;
  sports: string[];
  price: number;
  stock: number;
  image: string | null;
  similarity: number;
}

export interface ProductRecommendationsResponse {
  productId: number;
  model: string;
  recommendations: ProductRecommendation[];
}

@Injectable({ providedIn: 'root' })
export class DataMiningService {
  private readonly http = inject(HttpClient);
  private readonly reportsUrl = `${environment.apiUrl}/reports/data-mining`;
  private readonly productsUrl = `${environment.apiUrl}/products/recommendations`;

  getDemandReport(): Observable<DemandReport> {
    return this.http.get<DemandReport>(`${this.reportsUrl}/demand`);
  }

  getCustomerSegments(): Observable<CustomerSegmentsReport> {
    return this.http.get<CustomerSegmentsReport>(`${this.reportsUrl}/customer-segments`);
  }

  getProductRecommendations(productId: number, limit = 4): Observable<ProductRecommendationsResponse> {
    const params = new HttpParams().set('limit', limit);
    return this.http.get<ProductRecommendationsResponse>(`${this.productsUrl}/${productId}`, { params });
  }
}
