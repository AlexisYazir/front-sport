import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideToastr } from 'ngx-toastr';
import { provideLucideIcons } from '@lucide/angular';

import { Reports } from './reports';
import { environment } from '../../../../../../environments/environment';
import { ReportSummary, SalesReport } from '../../../../../core/services/reports.service';
import { SPORT_CENTER_ICONS } from '../../../../../shared/icons/sport-center-icons';

describe('Reports', () => {
  let component: Reports;
  let fixture: ComponentFixture<Reports>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Reports],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideNoopAnimations(), provideToastr(), provideLucideIcons(...SPORT_CENTER_ICONS)],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Reports);
    http = TestBed.inject(HttpTestingController);
    component = fixture.componentInstance;
    fixture.detectChanges();
    // El smoke test usa una respuesta sintética, sin consultar el servidor desplegado.
    const summary: ReportSummary = { grossSales: 0, netSales: 0, orders: 0, averageTicket: 0, customers: 0, repeatCustomers: 0, repeatCustomerRate: 0, units: 0, discounts: 0, shippingRevenue: 0, refundAmount: 0, returnRequests: 0, refundedReturns: 0, returnRate: 0 };
    const report: SalesReport = {
      meta: { from: '2026-01-01', to: '2026-01-01', previousFrom: '2025-12-31', previousTo: '2025-12-31', granularity: 'day', days: 1, generatedAt: '2026-01-01T00:00:00Z', currency: 'MXN', timeZone: 'America/Mexico_City' },
      summary,
      comparison: { previous: summary, netSalesChange: null, grossSalesChange: null, ordersChange: null, averageTicketChange: null, customersChange: null },
      trend: [], topProducts: [], categories: [], orderStatuses: [], promotions: [], returnStatuses: [], topCustomers: [], insights: [],
    };
    const request = http.expectOne(req => req.method === 'GET' && req.url === environment.apiUrl + '/reports/sales');
    request.flush(report);
  });

  afterEach(() => http.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
