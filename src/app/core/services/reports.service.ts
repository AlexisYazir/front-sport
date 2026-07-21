import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ReportGranularity = 'day' | 'week' | 'month';

export interface ReportSummary {
  grossSales: number;
  netSales: number;
  orders: number;
  averageTicket: number;
  customers: number;
  repeatCustomers: number;
  repeatCustomerRate: number;
  units: number;
  discounts: number;
  shippingRevenue: number;
  refundAmount: number;
  returnRequests: number;
  refundedReturns: number;
  returnRate: number;
}

export interface SalesReport {
  meta: {
    from: string;
    to: string;
    previousFrom: string;
    previousTo: string;
    granularity: ReportGranularity;
    days: number;
    generatedAt: string;
    currency: 'MXN';
    timeZone: string;
  };
  summary: ReportSummary;
  comparison: {
    previous: ReportSummary;
    netSalesChange: number | null;
    grossSalesChange: number | null;
    ordersChange: number | null;
    averageTicketChange: number | null;
    customersChange: number | null;
  };
  trend: Array<{
    period: string;
    grossSales: number;
    netSales: number;
    refunds: number;
    discounts: number;
    orders: number;
    units: number;
  }>;
  topProducts: Array<{
    idProduct: number;
    name: string;
    category: string;
    brand: string;
    image: string | null;
    units: number;
    orders: number;
    revenue: number;
    contribution: number;
  }>;
  categories: Array<{
    category: string;
    units: number;
    orders: number;
    revenue: number;
    contribution: number;
  }>;
  orderStatuses: Array<{
    status: string;
    orders: number;
    amount: number;
  }>;
  promotions: Array<{
    idPromotion: number;
    name: string;
    code: string | null;
    uses: number;
    customers: number;
    discount: number;
    associatedRevenue: number;
  }>;
  returnStatuses: Array<{
    status: string;
    requests: number;
    amount: number;
  }>;
  topCustomers: Array<{
    idUser: number;
    name: string;
    email: string;
    orders: number;
    units: number;
    total: number;
    averageTicket: number;
  }>;
  insights: Array<{
    type: 'positive' | 'warning' | 'info';
    icon: string;
    title: string;
    message: string;
  }>;
}

export interface SalesReportFilters {
  from: string;
  to: string;
  granularity?: ReportGranularity;
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly apiUrl = `${environment.apiUrl}/reports`;

  constructor(private readonly http: HttpClient) {}

  getSalesReport(filters: SalesReportFilters): Observable<SalesReport> {
    let params = new HttpParams()
      .set('from', filters.from)
      .set('to', filters.to);

    if (filters.granularity) {
      params = params.set('granularity', filters.granularity);
    }

    return this.http.get<SalesReport>(`${this.apiUrl}/sales`, { params });
  }
}
