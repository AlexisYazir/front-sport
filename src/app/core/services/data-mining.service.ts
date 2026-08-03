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
  sku: string;
  nombre_producto: string;
  imagen: string | null;
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

  getProductRecommendations(productId: number, limit = 4): Observable<ProductRecommendationsResponse> {
    const params = new HttpParams().set('limit', limit);
    return this.http.get<ProductRecommendationsResponse>(`${this.productsUrl}/${productId}`, { params });
  }
}
